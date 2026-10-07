using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using PSUEISKOLARSystem.Server.Controllers;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// Revision 7 — a scholarship type a campus coordinator made is that campus's alone. The type
/// pickers on the Master List and Releases pages read /api/lookups/scholarship-types, which
/// used to list every type, so one campus's coordinator saw the others' types there.
/// </summary>
public class CampusTypeVisibilityTests
{
    private static async Task<ApplicationDbContext> SeedAsync()
    {
        var db = TestDb.New();
        var binmaley = new Campus { Id = 1, Name = "Binmaley Campus", Code = "BIN" };
        var infanta = new Campus { Id = 2, Name = "Infanta Campus", Code = "INF" };
        db.Campuses.AddRange(binmaley, infanta);
        db.ScholarshipTypes.AddRange(
            new ScholarshipType { Id = 1, Name = "CHED Scholarship" },
            new ScholarshipType { Id = 2, Name = "BINMALEY SCHOLARSHIP", CampusId = 1 },
            new ScholarshipType { Id = 3, Name = "INFANTA SCHOLARSHIP", CampusId = 2 });
        db.Users.AddRange(
            new ApplicationUser { Id = "coord-bin", UserName = "bin@t", Email = "bin@t", FirstName = "R", LastName = "A", CampusId = 1 },
            new ApplicationUser { Id = "coord-inf", UserName = "inf@t", Email = "inf@t", FirstName = "A", LastName = "C", CampusId = 2 });
        await db.SaveChangesAsync();
        return db;
    }

    private static async Task<List<string>> TypeNamesAsync(ApplicationDbContext db, string userId, string role)
    {
        var result = await new LookupsController(db).As(userId, role).GetScholarshipTypes();
        var json = JsonSerializer.Serialize(((OkObjectResult)result).Value);
        return JsonDocument.Parse(json).RootElement.EnumerateArray()
            .Select(t => t.GetProperty("Name").GetString()!).ToList();
    }

    [Fact]
    public async Task Coordinator_sees_general_types_and_their_own_campus_types_only()
    {
        using var db = await SeedAsync();

        Assert.Equal(["CHED Scholarship", "INFANTA SCHOLARSHIP"],
            await TypeNamesAsync(db, "coord-inf", UserRoles.ScholarshipCoordinator));
        Assert.Equal(["BINMALEY SCHOLARSHIP", "CHED Scholarship"],
            await TypeNamesAsync(db, "coord-bin", UserRoles.ScholarshipCoordinator));
    }

    [Fact]
    public async Task Administrator_sees_every_campus_types()
    {
        using var db = await SeedAsync();

        Assert.Equal(["BINMALEY SCHOLARSHIP", "CHED Scholarship", "INFANTA SCHOLARSHIP"],
            await TypeNamesAsync(db, "admin", UserRoles.Administrator));
    }
}
