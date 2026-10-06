using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PSUEISKOLARSystem.Server.Controllers;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.Infrastructure;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// Rules added while fixing the second batch of pages: validation the forms relied on but the
/// API did not enforce, and the session that ended itself after a password change.
/// </summary>
[Collection(SystemSettingsCollection.Name)]
public class RoundTwoRuleTests
{
    private static string Message(IActionResult result)
    {
        var value = Assert.IsType<BadRequestObjectResult>(result).Value!;
        return (string)value.GetType().GetProperty("message")!.GetValue(value)!;
    }

    // ── Deadlines ─────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(202)]
    [InlineData(2200)]
    public async Task A_due_date_outside_any_plausible_calendar_is_refused(int year)
    {
        var db = TestDb.New();
        db.AddRequirement(1, "COR");
        db.SaveChanges();

        var result = await new DeadlinesController(db).As("coord-1", UserRoles.ScholarshipCoordinator)
            .Upsert(new DeadlinesController.DeadlineRequest(1, "2025-2026", 1, new DateTime(year, 5, 1, 0, 0, 0, DateTimeKind.Utc)));

        Assert.Contains("between the years 2000 and 2100", Message(result));
        Assert.Empty(db.SubmissionDeadlines);
    }

    // ── Messages ──────────────────────────────────────────────────────────────────

    private static MessagesController Messages(ApplicationDbContext db) =>
        // The hub and mailer are only reached after validation, which is all these cover.
        new(db, new FakeNotifications(), null!, Fakes.Mailer());

    [Fact]
    public async Task Staff_cannot_open_a_thread_with_a_non_scholar_account()
    {
        var db = TestDb.New();
        db.Roles.Add(new IdentityRole { Id = "role-admin", Name = UserRoles.Administrator, NormalizedName = "ADMINISTRATOR" });
        db.Users.Add(new ApplicationUser { Id = "admin-2", UserName = "a2@t", Email = "a2@t", FirstName = "A", LastName = "Two" });
        db.UserRoles.Add(new IdentityUserRole<string> { UserId = "admin-2", RoleId = "role-admin" });
        db.SaveChanges();

        var result = await Messages(db).As("admin-1", UserRoles.Administrator)
            .Send(new MessagesController.SendMessageRequest("admin-2", null, "hello"));

        Assert.Contains("scholar accounts", Message(result));
        Assert.Empty(db.Messages);
    }

    [Fact]
    public async Task A_message_longer_than_the_column_is_refused()
    {
        var db = TestDb.New();
        db.AddScholar("scholar-1");
        db.SaveChanges();

        var result = await Messages(db).As("scholar-1", UserRoles.Scholar)
            .Send(new MessagesController.SendMessageRequest(null, null, new string('x', 2001)));

        Assert.Contains("2000 characters", Message(result));
    }

    // ── Money ─────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task A_grant_release_dated_before_2000_is_refused_and_stays_pending()
    {
        var db = TestDb.New();
        db.AddScholar("scholar-1");
        db.OneTimeGrants.Add(new OneTimeGrant
        {
            Id = 7, ScholarId = "scholar-1", Title = "Book allowance", Amount = 500m,
            AwardedOn = DateTime.UtcNow, ReleaseStatus = GrantReleaseStatuses.Pending,
        });
        db.SaveChanges();

        var result = await new OneTimeGrantsController(db, new FakeNotifications())
            .As("coord-1", UserRoles.ScholarshipCoordinator)
            .Release(7, new ReleaseGrantRequest(null, new DateTime(202, 1, 1, 0, 0, 0, DateTimeKind.Utc)));

        Assert.Contains("2000 or later", Message(result));
        Assert.Equal(GrantReleaseStatuses.Pending, db.OneTimeGrants.Single().ReleaseStatus);
    }

    // ── Sessions ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Changing_your_password_hands_back_a_token_carrying_the_new_stamp()
    {
        using var host = new AuthHost();
        var user = await host.AddUserAsync("coord@t.test", "Str0ng!Passw0rd", UserRoles.ScholarshipCoordinator);
        var oldStamp = user.SecurityStamp;

        var controller = new AuthController(host.Auth, host.Db, new SessionValidator(new MemoryCache(new MemoryCacheOptions())))
            .As(user.Id, UserRoles.ScholarshipCoordinator);

        var result = await controller.UpdateProfile(new UpdateProfileDto
        {
            FirstName = "Test", LastName = "User",
            CurrentPassword = "Str0ng!Passw0rd", NewPassword = "N3wer!Passw0rd",
        });

        var session = Assert.IsType<AuthResponseDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.False(string.IsNullOrEmpty(session.Token));

        var newStamp = (await host.Users.FindByIdAsync(user.Id))!.SecurityStamp;
        Assert.NotEqual(oldStamp, newStamp);

        var claims = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(session.Token).Claims;
        Assert.Equal(newStamp, claims.Single(c => c.Type == SessionValidator.StampClaim).Value);
    }

    [Fact]
    public async Task Saving_only_your_name_returns_the_profile_and_no_new_token()
    {
        using var host = new AuthHost();
        var user = await host.AddUserAsync("coord@t.test", "Str0ng!Passw0rd", UserRoles.ScholarshipCoordinator);

        var controller = new AuthController(host.Auth, host.Db, new SessionValidator(new MemoryCache(new MemoryCacheOptions())))
            .As(user.Id, UserRoles.ScholarshipCoordinator);

        var result = await controller.UpdateProfile(new UpdateProfileDto { FirstName = "Renamed", LastName = "User" });

        Assert.IsType<UserDto>(Assert.IsType<OkObjectResult>(result.Result).Value);
    }

    // ── Timestamps ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Timestamps_read_back_from_the_database_are_marked_utc_but_birth_dates_are_not()
    {
        var db = TestDb.New();
        db.AddScholar("scholar-1");
        var profile = db.AddProfile("scholar-1", null);
        profile.BirthDate = new DateTime(2004, 5, 1);
        db.AuditLogs.Add(new AuditLog { UserId = "scholar-1", Action = "Test", TimestampUtc = new DateTime(2026, 1, 15, 8, 0, 0) });
        db.SaveChanges();

        var log = await db.AuditLogs.AsNoTracking().SingleAsync();
        var readProfile = await db.ScholarProfiles.AsNoTracking().SingleAsync();

        Assert.Equal(DateTimeKind.Utc, log.TimestampUtc.Kind);
        Assert.NotEqual(DateTimeKind.Utc, readProfile.BirthDate!.Value.Kind);
    }
}
