using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using PSUEISKOLARSystem.Server.Controllers;
using PSUEISKOLARSystem.Server.DTOs.Users;
using PSUEISKOLARSystem.Server.Infrastructure;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// Rules that stop an administrator from locking the office out of its own system, and keep
/// review and approval decisions from being recorded or announced in a broken state.
/// <para>
/// The delete clean-up itself runs in a SQL Server transaction the in-memory provider cannot
/// host, so these cover the guards that decide *whether* it runs; the clean-up was verified
/// against LocalDB.
/// </para>
/// </summary>
public class AdminSafeguardTests
{
    private const string Pw = "Str0ng!Passw0rd";

    private static UsersController Users(AuthHost host) =>
        new(host.Users, host.Auth, new FakeStorage(), new SessionValidator(new MemoryCache(new MemoryCacheOptions())), host.Db);

    private static string Message(IActionResult result)
    {
        var value = result switch
        {
            BadRequestObjectResult b => b.Value,
            ConflictObjectResult c => c.Value,
            _ => throw new Xunit.Sdk.XunitException($"Unexpected result {result.GetType().Name}"),
        };
        return (string)value!.GetType().GetProperty("message")!.GetValue(value)!;
    }

    private static UpdateUserDto Dto(ApplicationUser u, string role) => new()
    {
        FirstName = u.FirstName, LastName = u.LastName, Email = u.Email!, Role = role,
    };

    // ── Own account ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Admin_cannot_archive_their_own_account()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@t.test", Pw, UserRoles.Administrator);

        var result = await Users(host).As(admin.Id, UserRoles.Administrator).SetStatus(admin.Id, false);

        Assert.Contains("your own account", Message(result));
        Assert.True((await host.Users.FindByIdAsync(admin.Id))!.IsActive);
    }

    [Fact]
    public async Task Admin_cannot_delete_their_own_account()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@t.test", Pw, UserRoles.Administrator);

        var result = await Users(host).As(admin.Id, UserRoles.Administrator).Delete(admin.Id);

        Assert.Contains("your own account", Message(result));
        Assert.NotNull(await host.Users.FindByIdAsync(admin.Id));
    }

    [Fact]
    public async Task Admin_cannot_change_their_own_role()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@t.test", Pw, UserRoles.Administrator);

        var result = await Users(host).As(admin.Id, UserRoles.Administrator)
            .Update(admin.Id, Dto(admin, UserRoles.Scholar));

        Assert.Contains("your own role", Message(result));
        Assert.True(await host.Users.IsInRoleAsync(admin, UserRoles.Administrator));
    }

    [Fact]
    public async Task Editing_own_details_without_a_role_change_is_allowed()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@t.test", Pw, UserRoles.Administrator);
        var dto = Dto(admin, UserRoles.Administrator);
        dto.FirstName = "Renamed";

        var result = await Users(host).As(admin.Id, UserRoles.Administrator).Update(admin.Id, dto);

        Assert.IsType<NoContentResult>(result);
        Assert.Equal("Renamed", (await host.Users.FindByIdAsync(admin.Id))!.FirstName);
    }

    // ── Other accounts ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Changing_a_role_rotates_the_security_stamp_so_the_old_token_dies()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@t.test", Pw, UserRoles.Administrator);
        var coord = await host.AddUserAsync("coord@t.test", Pw, UserRoles.ScholarshipCoordinator);
        var stampBefore = coord.SecurityStamp;

        var result = await Users(host).As(admin.Id, UserRoles.Administrator)
            .Update(coord.Id, Dto(coord, UserRoles.Scholar));

        Assert.IsType<NoContentResult>(result);
        var reloaded = (await host.Users.FindByIdAsync(coord.Id))!;
        Assert.Equal([UserRoles.Scholar], await host.Users.GetRolesAsync(reloaded));
        Assert.NotEqual(stampBefore, reloaded.SecurityStamp);
    }

    [Fact]
    public async Task Saving_without_a_role_change_keeps_the_stamp()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@t.test", Pw, UserRoles.Administrator);
        var coord = await host.AddUserAsync("coord@t.test", Pw, UserRoles.ScholarshipCoordinator);
        var stampBefore = (await host.Users.FindByIdAsync(coord.Id))!.SecurityStamp;

        await Users(host).As(admin.Id, UserRoles.Administrator)
            .Update(coord.Id, Dto(coord, UserRoles.ScholarshipCoordinator));

        Assert.Equal(stampBefore, (await host.Users.FindByIdAsync(coord.Id))!.SecurityStamp);
    }

    [Fact]
    public async Task Deleting_a_staff_member_who_authored_announcements_is_refused_with_a_reason()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@t.test", Pw, UserRoles.Administrator);
        var coord = await host.AddUserAsync("coord@t.test", Pw, UserRoles.ScholarshipCoordinator);
        host.Db.Announcements.Add(new Announcement { Title = "Notice", Content = "Body", CreatedById = coord.Id });
        await host.Db.SaveChangesAsync();

        var result = await Users(host).As(admin.Id, UserRoles.Administrator).Delete(coord.Id);

        Assert.IsType<ConflictObjectResult>(result);
        Assert.Contains("Archive the account instead", Message(result));
        Assert.NotNull(await host.Users.FindByIdAsync(coord.Id));
    }

    // ── Review decisions ──────────────────────────────────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task Marking_incomplete_requires_feedback_on_the_server(string? feedback)
    {
        var db = TestDb.New();
        var controller = new DocumentsController(db, new FakeStorage(), Fakes.Mailer(), new FakeNotifications())
            .As("coord-1", UserRoles.ScholarshipCoordinator);

        var single = await controller.Review(1, new ReviewRequest("Incomplete", feedback));
        var batch = await controller.BatchReview(new BatchReviewRequest([1], "Incomplete", feedback));

        Assert.IsType<BadRequestObjectResult>(single);
        Assert.IsType<BadRequestObjectResult>(batch);
    }

    [Fact]
    public async Task Feedback_longer_than_the_column_is_refused()
    {
        var db = TestDb.New();
        var controller = new DocumentsController(db, new FakeStorage(), Fakes.Mailer(), new FakeNotifications())
            .As("coord-1", UserRoles.ScholarshipCoordinator);

        var result = await controller.Review(1, new ReviewRequest("Verified", new string('x', 1001)));

        Assert.Contains("1000 characters", Message(result));
    }

    // ── Approval decisions ────────────────────────────────────────────────────────

    [Fact]
    public async Task Repeating_an_approval_does_not_notify_the_scholar_again()
    {
        var db = TestDb.New();
        var scholar = db.AddScholar("scholar-1");
        scholar.ApprovalStatus = ApprovalStatuses.Approved;
        db.SaveChanges();

        var notes = new FakeNotifications();
        var controller = new ScholarApprovalsController(db, notes, Fakes.Mailer()).As("coord-1", UserRoles.ScholarshipCoordinator);

        var result = await controller.Approve("scholar-1", new ApprovalDecisionRequest(null));

        Assert.IsType<OkObjectResult>(result);
        Assert.Empty(notes.Sent);
        Assert.Empty(db.AuditLogs);
    }
}
