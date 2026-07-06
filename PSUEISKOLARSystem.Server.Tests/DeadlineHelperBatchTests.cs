using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Tests;

// Verifies the batched applicable-scholar resolver (used by the deadline report to
// avoid per-requirement N+1 queries) matches the single-requirement semantics.
public class DeadlineHelperBatchTests
{
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
    public async Task Batch_Resolves_Each_Requirement_Correctly()
    {
        using var db = Arrange();
        var result = await DeadlineHelper.GetApplicableScholarsBatchAsync(db, new[] { 1, 2 });

        Assert.Equal(new[] { "s1", "s2", "s3" }, result[1].Select(r => r.Id).OrderBy(x => x).ToArray());
        // s1 (TypeA) is configured but not linked to Req2 → excluded.
        Assert.Equal(new[] { "s2", "s3" }, result[2].Select(r => r.Id).OrderBy(x => x).ToArray());
    }

    [Fact]
    public async Task Batch_Matches_Single_Requirement_Method()
    {
        using var db = Arrange();
        var batch = await DeadlineHelper.GetApplicableScholarsBatchAsync(db, new[] { 1, 2 });
        var single1 = await DeadlineHelper.GetApplicableScholarsAsync(db, 1);
        var single2 = await DeadlineHelper.GetApplicableScholarsAsync(db, 2);

        Assert.Equal(single1.Select(r => r.Id).OrderBy(x => x), batch[1].Select(r => r.Id).OrderBy(x => x));
        Assert.Equal(single2.Select(r => r.Id).OrderBy(x => x), batch[2].Select(r => r.Id).OrderBy(x => x));
    }

    [Fact]
    public async Task Batch_With_No_Requirements_Returns_Empty()
    {
        using var db = Arrange();
        var result = await DeadlineHelper.GetApplicableScholarsBatchAsync(db, Array.Empty<int>());
        Assert.Empty(result);
    }
}
