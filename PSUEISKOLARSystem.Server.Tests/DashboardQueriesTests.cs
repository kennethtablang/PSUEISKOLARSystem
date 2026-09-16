using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// The single dashboard payload that replaced eleven client-side calls.
/// <para>
/// The scholar's compliance figures used to be worked out in the browser by cross-referencing
/// three separate responses, so they are the part most worth pinning: which requirements apply,
/// which deadlines are still open, and the fact that a scholar's dashboard never carries staff
/// data (or the reverse).
/// </para>
/// </summary>
public class DashboardQueriesTests
{
    private static DashboardQueries Queries(PSUEISKOLARSystem.Server.Data.ApplicationDbContext db)
        => new(db, new AnalyticsQueries(db));

    [Fact]
    public async Task Scholar_dashboard_counts_only_their_own_submissions()
    {
        using var db = TestDb.New();
        db.AddType(1, "T");
        db.AddRequirement(1, "COR");
        db.AddRequirement(2, "Grades");
        db.AddScholar("me");
        db.AddScholar("someone-else");
        db.AddProfile("me", 1);
        db.AddProfile("someone-else", 1);
        db.SetActiveSemester("2025-2026", 1);
        db.SaveChanges();

        db.AddSubmission("me", 1, DocumentStatus.Verified);
        db.AddSubmission("me", 2, DocumentStatus.Pending);
        db.AddSubmission("someone-else", 1, DocumentStatus.Verified);
        db.SaveChanges();

        var result = await Queries(db).ForScholarAsync("me", UserRoles.Scholar);

        Assert.NotNull(result.Scholar);
        Assert.Null(result.Staff);
        Assert.Equal(1, result.Scholar!.Compliance.VerifiedCount);
        Assert.Equal(1, result.Scholar.Compliance.PendingCount);
        Assert.Equal(2, result.Scholar.Compliance.TotalRequired);
        Assert.Equal("2025-2026", result.Scholar.Compliance.AcademicYear);
    }

    [Fact]
    public async Task Compliance_counts_the_active_semester_only_and_never_exceeds_the_requirements()
    {
        using var db = TestDb.New();
        db.AddType(1, "T");
        db.AddRequirement(1, "COR");
        db.AddRequirement(2, "Grades");
        db.AddScholar("me");
        db.AddProfile("me", 1);
        db.SetActiveSemester("2025-2026", 2);
        db.SaveChanges();

        // Semester 1 history must not leak into Semester 2's standing.
        db.AddSubmission("me", 1, DocumentStatus.Verified, sem: 1);
        db.AddSubmission("me", 2, DocumentStatus.Verified, sem: 1);
        db.AddSubmission("me", 1, DocumentStatus.Verified, sem: 2);
        db.AddSubmission("me", 2, DocumentStatus.Pending, sem: 2);
        db.SaveChanges();

        var c = (await Queries(db).ForScholarAsync("me", UserRoles.Scholar)).Scholar!.Compliance;

        Assert.Equal(2, c.TotalRequired);
        Assert.Equal(1, c.VerifiedCount);
        Assert.Equal(1, c.PendingCount);
        Assert.Equal(2, c.Semester);
    }

    [Fact]
    public async Task Only_requirements_linked_to_the_scholarship_count_toward_the_total()
    {
        using var db = TestDb.New();
        db.AddType(1, "Linked");
        db.AddRequirement(1, "Applies");
        db.AddRequirement(2, "Belongs to another scholarship");
        db.AddScholar("me");
        db.AddProfile("me", 1);
        db.SetActiveSemester("2025-2026", 1);
        db.SaveChanges();

        db.LinkTypeRequirement(1, 1);
        db.SaveChanges();

        var result = await Queries(db).ForScholarAsync("me", UserRoles.Scholar);

        Assert.Equal(1, result.Scholar!.Compliance.TotalRequired);
    }

    [Fact]
    public async Task A_scholarship_with_no_configured_links_sees_the_whole_catalogue()
    {
        // The fallback DocumentRequirementsController.GetAll applies: an unconfigured type must
        // not silently exempt its scholars from every requirement.
        using var db = TestDb.New();
        db.AddType(1, "Unconfigured");
        db.AddRequirement(1, "COR");
        db.AddRequirement(2, "Grades");
        db.AddScholar("me");
        db.AddProfile("me", 1);
        db.SetActiveSemester("2025-2026", 1);
        db.SaveChanges();

        var result = await Queries(db).ForScholarAsync("me", UserRoles.Scholar);

        Assert.Equal(2, result.Scholar!.Compliance.TotalRequired);
    }

    [Fact]
    public async Task Upcoming_deadlines_skip_what_is_already_verified_and_what_has_passed()
    {
        using var db = TestDb.New();
        db.AddType(1, "T");
        db.AddRequirement(1, "Already verified");
        db.AddRequirement(2, "Still open");
        db.AddRequirement(3, "Overdue");
        db.AddScholar("me");
        db.AddProfile("me", 1);
        db.SetActiveSemester("2025-2026", 1);
        db.SaveChanges();

        var now = DateTime.UtcNow;
        db.AddDeadline(1, 1, now.AddDays(5));
        db.AddDeadline(2, 2, now.AddDays(7));
        db.AddDeadline(3, 3, now.AddDays(-1));
        db.AddSubmission("me", 1, DocumentStatus.Verified);
        db.SaveChanges();

        var result = await Queries(db).ForScholarAsync("me", UserRoles.Scholar);

        var open = Assert.Single(result.Scholar!.Deadlines);
        Assert.Equal(2, open.RequirementId);
        Assert.Equal("Still open", open.RequirementName);
    }

    [Fact]
    public async Task Gwa_is_null_until_a_grade_exists_then_reports_the_latest()
    {
        using var db = TestDb.New();
        db.AddType(1, "T", minGwa: 2.5m);
        db.AddScholar("me");
        var profile = db.AddProfile("me", 1);
        db.SetActiveSemester("2025-2026", 1);
        db.SaveChanges();

        Assert.Null((await Queries(db).ForScholarAsync("me", UserRoles.Scholar)).Scholar!.Gwa);

        db.AddGrade(profile.Id, "2025-2026", 1, 3.10m, meets: false);
        db.AddGrade(profile.Id, "2025-2026", 2, 1.90m, meets: true);
        db.SaveChanges();

        var gwa = (await Queries(db).ForScholarAsync("me", UserRoles.Scholar)).Scholar!.Gwa;

        Assert.NotNull(gwa);
        Assert.Equal(1.90m, gwa!.LatestGwa);
        Assert.True(gwa.MeetsRequirement);
        Assert.Equal(2.5m, gwa.MinimumGwa);
    }

    [Fact]
    public async Task A_replaced_incomplete_document_stops_being_reported_as_incomplete()
    {
        // Upload keeps the superseded Incomplete row alongside the new Pending one, so the
        // scholar's standing has to come from the later submission rather than whichever row
        // the database happens to return first.
        using var db = TestDb.New();
        db.AddType(1, "T");
        db.AddRequirement(1, "COR");
        db.AddScholar("me");
        db.AddProfile("me", 1);
        db.SetActiveSemester("2025-2026", 1);
        db.SaveChanges();

        db.DocumentSubmissions.Add(new PSUEISKOLARSystem.Server.Models.DocumentSubmission
        {
            ScholarId = "me", RequirementId = 1, Status = DocumentStatus.Incomplete,
            AcademicYear = "2025-2026", Semester = 1, SubmittedAt = DateTime.UtcNow.AddDays(-3),
            FileName = "old.pdf", StoredFileName = "old", ContentType = "application/pdf", FileSizeBytes = 1,
        });
        db.DocumentSubmissions.Add(new PSUEISKOLARSystem.Server.Models.DocumentSubmission
        {
            ScholarId = "me", RequirementId = 1, Status = DocumentStatus.Pending,
            AcademicYear = "2025-2026", Semester = 1, SubmittedAt = DateTime.UtcNow,
            FileName = "new.pdf", StoredFileName = "new", ContentType = "application/pdf", FileSizeBytes = 1,
        });
        db.SaveChanges();

        var result = await Queries(db).ForScholarAsync("me", UserRoles.Scholar);

        Assert.Empty(result.Scholar!.Compliance.IncompleteItems);
    }

    [Fact]
    public async Task Staff_dashboard_carries_the_overview_and_no_scholar_section()
    {
        using var db = TestDb.New();
        db.AddType(1, "T");
        db.AddScholar("s1");
        db.AddProfile("s1", 1);
        db.SaveChanges();

        var result = await Queries(db).ForStaffAsync("admin", UserRoles.Administrator);

        Assert.Null(result.Scholar);
        Assert.NotNull(result.Staff);
        Assert.Equal(1, result.Staff!.Overview.TotalScholars);
        Assert.Equal(UserRoles.Administrator, result.Role);
    }

    [Fact]
    public async Task Renewal_count_is_the_scholars_awaiting_a_decision()
    {
        using var db = TestDb.New();
        db.AddType(1, "T");
        db.AddScholar("a"); db.AddScholar("b"); db.AddScholar("c"); db.AddScholar("d");
        db.SaveChanges();

        db.AddProfile("a", 1).LifecycleStatus = LifecycleStatuses.Lapsed;
        db.AddProfile("b", 1).LifecycleStatus = LifecycleStatuses.Suspended;
        db.AddProfile("c", 1).LifecycleStatus = LifecycleStatuses.Active;
        db.AddProfile("d", 1).LifecycleStatus = LifecycleStatuses.Graduated;
        db.SaveChanges();

        var result = await Queries(db).ForStaffAsync("admin", UserRoles.Administrator);

        Assert.Equal(2, result.Staff!.RenewalCount);
    }

    [Fact]
    public async Task Coordinators_are_counted_for_an_administrator_and_not_for_a_coordinator()
    {
        using var db = TestDb.New();
        db.SaveChanges();

        var asAdmin = await Queries(db).ForStaffAsync("admin", UserRoles.Administrator);
        var asCoord = await Queries(db).ForStaffAsync("coord", UserRoles.ScholarshipCoordinator);

        Assert.NotNull(asAdmin.Staff!.Coordinators);
        Assert.Null(asCoord.Staff!.Coordinators);
    }
}
