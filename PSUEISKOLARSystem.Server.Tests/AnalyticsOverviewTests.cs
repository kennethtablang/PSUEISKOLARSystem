using Microsoft.AspNetCore.Mvc;
using PSUEISKOLARSystem.Server.Controllers;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

public class AnalyticsOverviewTests
{
    private static object Prop(object o, string name) => o.GetType().GetProperty(name)!.GetValue(o)!;

    [Fact]
    public async Task Overview_Counts_Compliance_And_Submissions_Correctly()
    {
        using var db = TestDb.New();
        db.AddType(1, "T", minGwa: 2.5m);
        db.AddRequirement(1, "Req1");

        // 5 scholars: 2 compliant, 1 non-compliant, 2 without grades.
        db.AddScholar("s1"); var p1 = db.AddProfile("s1", 1);
        db.AddScholar("s2"); var p2 = db.AddProfile("s2", 1);
        db.AddScholar("s3"); var p3 = db.AddProfile("s3", 1);
        db.AddScholar("s4"); db.AddProfile("s4", 1);
        db.AddScholar("s5"); db.AddProfile("s5", 1);
        db.SaveChanges();

        db.AddGrade(p1.Id, "2025-2026", 1, 1.75m, meets: true);
        db.AddGrade(p2.Id, "2025-2026", 1, 2.00m, meets: true);
        db.AddGrade(p3.Id, "2025-2026", 1, 3.25m, meets: false);

        db.AddSubmission("s1", 1, DocumentStatus.Verified);
        db.AddSubmission("s2", 1, DocumentStatus.Verified);
        db.AddSubmission("s3", 1, DocumentStatus.Pending);
        db.AddSubmission("s4", 1, DocumentStatus.Incomplete);
        db.SaveChanges();

        var result = await new AnalyticsController(db).Overview(null);
        var value = Assert.IsType<OkObjectResult>(result).Value!;

        Assert.Equal(5, Prop(value, "totalScholars"));
        Assert.Equal(2, Prop(value, "compliant"));
        Assert.Equal(1, Prop(value, "nonCompliant"));
        Assert.Equal(2, Prop(value, "noGwa"));

        var subs = Prop(value, "submissions");
        Assert.Equal(4, Prop(subs, "total"));
        Assert.Equal(2, Prop(subs, "verified"));
        Assert.Equal(1, Prop(subs, "pending"));
        Assert.Equal(1, Prop(subs, "incomplete"));
    }
}
