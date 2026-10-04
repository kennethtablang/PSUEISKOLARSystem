using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// The overview aggregate. It used to issue one round trip per number; the counts are now
/// folded out of two GROUP BY queries, so these pin the arithmetic that folding has to
/// preserve — particularly that a scholar is judged by their <i>latest</i> grade, which was
/// the part expressed as a correlated subquery and is the easiest thing to get wrong.
/// </summary>
public class AnalyticsOverviewTests
{
    [Fact]
    public async Task Counts_compliance_and_submissions_correctly()
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
        db.AddSubmission("s4", 1, DocumentStatus.Rejected);
        db.SaveChanges();

        var overview = await new AnalyticsQueries(db).OverviewAsync();

        Assert.Equal(5, overview.TotalScholars);
        Assert.Equal(2, overview.Compliant);
        Assert.Equal(1, overview.NonCompliant);
        Assert.Equal(2, overview.NoGwa);

        Assert.Equal(4, overview.Submissions.Total);
        Assert.Equal(2, overview.Submissions.Verified);
        Assert.Equal(1, overview.Submissions.Pending);
        Assert.Equal(1, overview.Submissions.Incomplete);
    }

    [Fact]
    public async Task A_scholar_is_judged_by_their_latest_grade_not_their_worst()
    {
        using var db = TestDb.New();
        db.AddType(1, "T", minGwa: 2.5m);
        db.AddScholar("s1");
        var profile = db.AddProfile("s1", 1);
        db.SaveChanges();

        // Failed last semester, recovered this one. They are compliant.
        db.AddGrade(profile.Id, "2025-2026", 1, 3.25m, meets: false);
        db.AddGrade(profile.Id, "2025-2026", 2, 1.80m, meets: true);
        db.SaveChanges();

        var overview = await new AnalyticsQueries(db).OverviewAsync();

        Assert.Equal(1, overview.TotalScholars);
        Assert.Equal(1, overview.Compliant);
        Assert.Equal(0, overview.NonCompliant);
    }

    [Fact]
    public async Task The_three_compliance_buckets_always_account_for_every_scholar()
    {
        using var db = TestDb.New();
        db.AddType(1, "T", minGwa: 2.5m);
        db.AddScholar("s1"); var p1 = db.AddProfile("s1", 1);
        db.AddScholar("s2"); db.AddProfile("s2", 1);
        db.AddScholar("s3"); db.AddProfile("s3", 1);
        db.SaveChanges();
        db.AddGrade(p1.Id, "2025-2026", 1, 1.50m, meets: true);
        db.SaveChanges();

        var overview = await new AnalyticsQueries(db).OverviewAsync();

        // NoGwa is derived by subtraction rather than counted, so this is the invariant that
        // keeps the derivation honest.
        Assert.Equal(
            overview.TotalScholars,
            overview.Compliant + overview.NonCompliant + overview.NoGwa);
        Assert.Equal(3, overview.TotalScholars);
    }

    [Fact]
    public async Task The_period_filter_narrows_submissions_but_not_the_period_options()
    {
        using var db = TestDb.New();
        db.AddRequirement(1, "Req1");
        db.AddScholar("s1");
        db.SaveChanges();

        db.AddSubmission("s1", 1, DocumentStatus.Verified, year: "2024-2025", sem: 1);
        db.AddSubmission("s1", 1, DocumentStatus.Pending, year: "2025-2026", sem: 1);
        db.SaveChanges();

        var overview = await new AnalyticsQueries(db).OverviewAsync("2025-2026", 1);

        Assert.Equal(1, overview.Submissions.Total);
        Assert.Equal(1, overview.Submissions.Pending);

        // The dropdown that drives the filter must not empty itself out when a filter is on.
        Assert.Equal(2, overview.AvailablePeriods.Count);
    }
}
