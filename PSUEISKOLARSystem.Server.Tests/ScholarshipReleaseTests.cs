using Microsoft.AspNetCore.Mvc;
using PSUEISKOLARSystem.Server.Controllers;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// The money path. A scholarship release is a record of a payout, so its rules are about
/// what may no longer change: once a release is marked <c>Released</c> it is part of the
/// disbursement record and can be neither edited, cancelled, nor deleted. Those three
/// refusals are the point of the design, and nothing else in the system enforces them.
/// </summary>
public class ScholarshipReleaseTests
{
    private const string Scholar = "scholar-1";
    private const string Admin = "admin-1";

    private static (ScholarshipReleasesController Controller, FakeNotifications Notes) Build(
        ApplicationDbContext db, string role = UserRoles.Administrator)
    {
        var notes = new FakeNotifications();
        var controller = new ScholarshipReleasesController(db, notes).As(Admin, role);
        return (controller, notes);
    }

    /// <summary>One per-semester scholarship, one scholar registered under it.</summary>
    private static ApplicationDbContext Seeded(string frequency = ScholarshipFrequencies.PerSemester)
    {
        var db = TestDb.New();
        var type = db.AddType(1, "CHED Merit");
        type.Frequency = frequency;
        type.Amount = 10_000m;

        db.AddScholar(Scholar);
        db.AddScholar(Admin);
        db.AddProfile(Scholar, 1);
        db.SaveChanges();
        return db;
    }

    private static ScholarshipRelease Existing(
        ApplicationDbContext db, string status = GrantReleaseStatuses.Pending)
    {
        var release = new ScholarshipRelease
        {
            ScholarId = Scholar,
            ScholarshipTypeId = 1,
            AcademicYear = "2025-2026",
            Semester = 1,
            Amount = 10_000m,
            Status = status,
        };
        db.ScholarshipReleases.Add(release);
        db.SaveChanges();
        return release;
    }

    private static string Message(IActionResult result) =>
        (string)Assert.IsType<BadRequestObjectResult>(result).Value!
            .GetType().GetProperty("message")!.GetValue(
                Assert.IsType<BadRequestObjectResult>(result).Value)!;

    // ── Scheduling ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task A_release_can_only_be_scheduled_for_a_scholar_who_holds_the_scholarship()
    {
        using var db = Seeded();
        db.AddScholar("outsider");
        db.SaveChanges();
        var (controller, _) = Build(db);

        var result = await controller.Upsert(new ScholarshipReleaseRequest(
            "outsider", 1, "2025-2026", 1, 10_000m, null));

        Assert.Contains("is not registered under", Message(result));
        Assert.Empty(db.ScholarshipReleases);
    }

    [Fact]
    public async Task Scheduling_the_same_period_twice_updates_the_row_rather_than_duplicating_it()
    {
        // One payout per scholar per period is the whole invariant — a second row would mean
        // the monitor reporting two answers to "have they been paid?".
        using var db = Seeded();
        var (controller, _) = Build(db);
        var request = new ScholarshipReleaseRequest(
            Scholar, 1, "2025-2026", 1, 10_000m, null);

        await controller.Upsert(request);
        await controller.Upsert(request with { Amount = 12_000m });

        var row = Assert.Single(db.ScholarshipReleases);
        Assert.Equal(12_000m, row.Amount);
    }

    [Fact]
    public async Task A_per_year_scholarship_uses_the_whole_year_marker_not_a_semester()
    {
        using var db = Seeded(ScholarshipFrequencies.PerYear);
        var (controller, _) = Build(db);

        var perSemester = await controller.Upsert(new ScholarshipReleaseRequest(
            Scholar, 1, "2025-2026", 1, 10_000m, null));
        Assert.IsType<BadRequestObjectResult>(perSemester);

        var wholeYear = await controller.Upsert(new ScholarshipReleaseRequest(
            Scholar, 1, "2025-2026", ScholarshipFrequencies.WholeYearSemester, 10_000m, null));
        Assert.IsType<OkObjectResult>(wholeYear);
    }

    [Fact]
    public async Task A_one_time_scholarship_has_no_per_period_releases_to_generate()
    {
        using var db = Seeded(ScholarshipFrequencies.OneTime);
        var (controller, _) = Build(db);

        var result = await controller.Generate(new GenerateReleasesRequest(
            1, "2025-2026", 1, 10_000m));

        Assert.Contains("one-time scholarship", Message(result));
    }

    [Fact]
    public async Task Generate_is_idempotent()
    {
        using var db = Seeded();
        var (controller, _) = Build(db);
        var request = new GenerateReleasesRequest(1, "2025-2026", 1, 10_000m);

        await controller.Generate(request);
        await controller.Generate(request);

        Assert.Single(db.ScholarshipReleases);
    }

    // ── Releasing ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Releasing_marks_the_payout_and_tells_the_scholar()
    {
        using var db = Seeded();
        var release = Existing(db);
        var (controller, notes) = Build(db);

        var result = await controller.Release(release.Id,
            new ReleaseScholarshipRequest("REF-001", null));

        Assert.IsType<OkObjectResult>(result);
        var row = db.ScholarshipReleases.Single();
        Assert.Equal(GrantReleaseStatuses.Released, row.Status);
        Assert.Equal("REF-001", row.ReferenceNo);
        Assert.NotNull(row.ReleasedAt);
        Assert.Contains(notes.Sent, n => n.RecipientId == Scholar && n.Title == "Scholarship released");
    }

    [Fact]
    public async Task The_same_payout_cannot_be_released_twice()
    {
        using var db = Seeded();
        var release = Existing(db, GrantReleaseStatuses.Released);
        var (controller, _) = Build(db);

        var result = await controller.Release(release.Id,
            new ReleaseScholarshipRequest(null, null));

        Assert.Contains("Only a pending release", Message(result));
    }

    [Fact]
    public async Task A_release_cannot_be_back_dated_into_the_future()
    {
        using var db = Seeded();
        var release = Existing(db);
        var (controller, _) = Build(db);

        var result = await controller.Release(release.Id,
            new ReleaseScholarshipRequest(null, DateTime.UtcNow.AddDays(30)));

        Assert.Contains("cannot be in the future", Message(result));
        Assert.Equal(GrantReleaseStatuses.Pending, db.ScholarshipReleases.Single().Status);
    }

    // ── What a released payout refuses ────────────────────────────────────────────

    [Fact]
    public async Task A_released_payout_cannot_be_edited()
    {
        using var db = Seeded();
        Existing(db, GrantReleaseStatuses.Released);
        var (controller, _) = Build(db);

        var result = await controller.Upsert(new ScholarshipReleaseRequest(
            Scholar, 1, "2025-2026", 1, 99_000m, "trying to change the amount"));

        Assert.Contains("already been released", Message(result));
        Assert.Equal(10_000m, db.ScholarshipReleases.Single().Amount);
    }

    [Fact]
    public async Task A_released_payout_cannot_be_cancelled()
    {
        using var db = Seeded();
        var release = Existing(db, GrantReleaseStatuses.Released);
        var (controller, _) = Build(db);

        var result = await controller.Cancel(release.Id,
            new CancelReleaseRequest("Paid in error"));

        Assert.Contains("part of the disbursement record", Message(result));
        Assert.Equal(GrantReleaseStatuses.Released, db.ScholarshipReleases.Single().Status);
    }

    [Fact]
    public async Task A_released_payout_cannot_be_deleted()
    {
        using var db = Seeded();
        var release = Existing(db, GrantReleaseStatuses.Released);
        var (controller, _) = Build(db);

        var result = await controller.Delete(release.Id);

        Assert.Contains("cannot be deleted", Message(result));
        Assert.Single(db.ScholarshipReleases);
    }

    // ── Cancelling ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Cancelling_requires_a_reason_and_keeps_the_row()
    {
        // The row stays so the period still shows what happened — a deleted release and a
        // cancelled one answer "was this scholar paid?" very differently.
        using var db = Seeded();
        var release = Existing(db);
        var (controller, _) = Build(db);

        var noReason = await controller.Cancel(release.Id,
            new CancelReleaseRequest("   "));
        Assert.Contains("reason is required", Message(noReason));

        var cancelled = await controller.Cancel(release.Id,
            new CancelReleaseRequest("Scholar withdrew"));
        Assert.IsType<OkObjectResult>(cancelled);

        var row = db.ScholarshipReleases.Single();
        Assert.Equal(GrantReleaseStatuses.Cancelled, row.Status);
        Assert.Contains("Scholar withdrew", row.Notes);
    }

    [Fact]
    public async Task A_cancelled_release_cannot_be_cancelled_again()
    {
        using var db = Seeded();
        var release = Existing(db, GrantReleaseStatuses.Cancelled);
        var (controller, _) = Build(db);

        var result = await controller.Cancel(release.Id,
            new CancelReleaseRequest("Again"));

        Assert.Contains("already cancelled", Message(result));
    }

    // ── Scoping ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task A_scholar_sees_only_their_own_releases()
    {
        using var db = Seeded();
        db.AddScholar("scholar-2");
        db.AddProfile("scholar-2", 1);
        db.SaveChanges();
        Existing(db);
        db.ScholarshipReleases.Add(new ScholarshipRelease
        {
            ScholarId = "scholar-2", ScholarshipTypeId = 1,
            AcademicYear = "2025-2026", Semester = 1, Amount = 10_000m,
        });
        db.SaveChanges();

        var controller = new ScholarshipReleasesController(db, new FakeNotifications())
            .As(Scholar, UserRoles.Scholar);

        var payload = Assert.IsType<OkObjectResult>(await controller.GetAll(null, null, null, null, null, 1, 20)).Value!;
        var total = (int)payload.GetType().GetProperty("total")!.GetValue(payload)!;

        Assert.Equal(1, total);
    }
}
