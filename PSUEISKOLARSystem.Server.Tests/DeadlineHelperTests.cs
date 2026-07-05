using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Tests;

public class DeadlineHelperTests
{
    // Builds: TypeA is "configured" (linked to Req1 only); TypeB has no links.
    // S1=TypeA active, S2=TypeB active, S3=no profile active, S4=TypeA inactive.
    private static ApplicationDbContext Arrange()
    {
        var db = TestDb.New();
        db.AddType(1, "TypeA");
        db.AddType(2, "TypeB");
        db.AddRequirement(1, "Req1");
        db.AddRequirement(2, "Req2");
        db.LinkTypeRequirement(1, 1); // TypeA -> Req1 only

        db.AddScholar("s1"); db.AddProfile("s1", 1);
        db.AddScholar("s2"); db.AddProfile("s2", 2);
        db.AddScholar("s3"); // no profile
        db.AddScholar("s4", active: false); db.AddProfile("s4", 1);
        db.SaveChanges();
        return db;
    }

    [Fact]
    public async Task Req1_Applies_To_LinkedType_UnconfiguredType_And_NoProfile_But_Not_Inactive()
    {
        using var db = Arrange();
        var result = await DeadlineHelper.GetApplicableScholarsAsync(db, requirementId: 1);
        var ids = result.Select(r => r.Id).OrderBy(x => x).ToArray();
        Assert.Equal(new[] { "s1", "s2", "s3" }, ids);
    }

    [Fact]
    public async Task Req2_Excludes_ConfiguredTypeNotLinked_Includes_Unconfigured_And_NoProfile()
    {
        using var db = Arrange();
        var result = await DeadlineHelper.GetApplicableScholarsAsync(db, requirementId: 2);
        var ids = result.Select(r => r.Id).OrderBy(x => x).ToArray();
        // s1 (TypeA) is configured but NOT linked to Req2 -> excluded.
        Assert.Equal(new[] { "s2", "s3" }, ids);
    }

    [Fact]
    public async Task FullName_Is_Composed_From_Name_Parts()
    {
        using var db = TestDb.New();
        db.AddRequirement(1, "Req1");
        var u = db.AddScholar("x");
        u.FirstName = "Ana"; u.MiddleName = "Marie"; u.LastName = "Reyes";
        db.SaveChanges();

        var result = await DeadlineHelper.GetApplicableScholarsAsync(db, 1);
        Assert.Equal("Ana Marie Reyes", Assert.Single(result).FullName);
    }
}
