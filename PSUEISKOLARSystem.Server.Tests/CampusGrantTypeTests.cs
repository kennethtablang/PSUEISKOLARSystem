using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Controllers;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// Revision 8 — a coordinator may add a grant type of their own, used only at their campus,
/// the way they already could with scholarship types. General grant types stay the
/// administrator's.
/// </summary>
public class CampusGrantTypeTests
{
    private sealed class NoAnnouncements : IAnnouncementDelivery
    {
        public Task<int> PublishAsync(Announcement announcement, bool awaitEmails = false) => Task.FromResult(0);
    }

    private static async Task<ApplicationDbContext> SeedAsync()
    {
        var db = TestDb.New();
        db.Campuses.AddRange(
            new Campus { Id = 1, Name = "Binmaley Campus", Code = "BIN" },
            new Campus { Id = 2, Name = "Infanta Campus", Code = "INF" });
        db.GrantTypes.AddRange(
            new GrantType { Id = 1, Name = "Tulong Dunong Program" },
            new GrantType { Id = 2, Name = "Infanta Relief", CampusId = 2 });
        db.Users.AddRange(
            new ApplicationUser { Id = "coord-bin", UserName = "bin@t", Email = "bin@t", FirstName = "R", LastName = "A", CampusId = 1 },
            new ApplicationUser { Id = "coord-inf", UserName = "inf@t", Email = "inf@t", FirstName = "A", LastName = "C", CampusId = 2 });
        await db.SaveChangesAsync();
        return db;
    }

    private static GrantTypesController Controller(ApplicationDbContext db, string userId, string role) =>
        new GrantTypesController(db, new FakeNotifications(), new NoAnnouncements()).As(userId, role);

    private static async Task<List<string>> NamesAsync(ApplicationDbContext db, string userId, string role)
    {
        var result = await Controller(db, userId, role).GetAll();
        var json = JsonSerializer.Serialize(((OkObjectResult)result).Value);
        return JsonDocument.Parse(json).RootElement.EnumerateArray()
            .Select(t => t.GetProperty("Name").GetString()!).OrderBy(n => n).ToList();
    }

    [Fact]
    public async Task Coordinator_creates_a_grant_type_for_their_own_campus()
    {
        using var db = await SeedAsync();

        var result = await Controller(db, "coord-bin", UserRoles.ScholarshipCoordinator)
            .Create(new GrantTypeRequest("Binmaley Book Allowance", null, "LGU Binmaley", 2000m));

        Assert.IsType<OkObjectResult>(result);
        var created = await db.GrantTypes.SingleAsync(t => t.Name == "Binmaley Book Allowance");
        Assert.Equal(1, created.CampusId);
    }

    [Fact]
    public async Task Coordinator_sees_general_and_own_campus_grant_types_only()
    {
        using var db = await SeedAsync();

        Assert.Equal(["Tulong Dunong Program"], await NamesAsync(db, "coord-bin", UserRoles.ScholarshipCoordinator));
        Assert.Equal(["Infanta Relief", "Tulong Dunong Program"], await NamesAsync(db, "coord-inf", UserRoles.ScholarshipCoordinator));
        Assert.Equal(["Infanta Relief", "Tulong Dunong Program"], await NamesAsync(db, "admin", UserRoles.Administrator));
    }

    [Fact]
    public async Task Coordinator_cannot_change_a_general_or_another_campus_grant_type()
    {
        using var db = await SeedAsync();
        var bin = Controller(db, "coord-bin", UserRoles.ScholarshipCoordinator);

        var general = await bin.Update(1, new GrantTypeRequest("Renamed", null, null, null));
        Assert.Equal(403, Assert.IsType<ObjectResult>(general).StatusCode);

        Assert.IsType<NotFoundResult>(await bin.Delete(2));
        Assert.Equal("Tulong Dunong Program", (await db.GrantTypes.FindAsync(1))!.Name);
    }

    [Fact]
    public async Task Coordinator_edits_their_own_campus_grant_type()
    {
        using var db = await SeedAsync();

        var result = await Controller(db, "coord-inf", UserRoles.ScholarshipCoordinator)
            .Update(2, new GrantTypeRequest("Infanta Calamity Relief", null, null, 1500m));

        Assert.IsType<NoContentResult>(result);
        Assert.Equal("Infanta Calamity Relief", (await db.GrantTypes.FindAsync(2))!.Name);
    }
}
