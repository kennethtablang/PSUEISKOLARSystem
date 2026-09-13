using Microsoft.AspNetCore.Mvc;
using PSUEISKOLARSystem.Server.Controllers;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// <c>DocumentsController.Upload</c> — nine sequential guards, the most branching logic in the
/// codebase, and where the replace-a-verified-document bug lived: two of the guards fell
/// through when a replacement was permitted, so the upload carried on and inserted a *second*
/// row for the period. That is the case worth a test that cannot rot.
/// </summary>
public class DocumentUploadTests
{
    private const string Scholar = "scholar-1";
    private const string Staff = "coord-1";

    private static (DocumentsController Controller, FakeStorage Storage, FakeNotifications Notes)
        Build(ApplicationDbContext db)
    {
        var storage = new FakeStorage();
        var notes = new FakeNotifications();
        return (new DocumentsController(db, storage, Fakes.Mailer(), notes), storage, notes);
    }

    /// <summary>An approved scholar with a complete profile, one requirement, one active period.</summary>
    private static ApplicationDbContext Seeded(
        SystemSettings? settings = null, string approval = ApprovalStatuses.Approved)
    {
        var db = TestDb.New();
        db.AddType(1, "CHED");
        db.AddRequirement(1, "Certificate of Registration");
        db.AcademicPrograms.Add(new AcademicProgram { Id = 1, Name = "BSCS", Code = "BSCS" });

        var user = db.AddScholar(Scholar);
        user.ApprovalStatus = approval;
        db.AddScholar(Staff);

        var profile = db.AddProfile(Scholar, 1);
        profile.ProgramId = 1;

        db.SetActiveSemester("2025-2026", 1);
        if (settings is not null) db.SystemSettings.Add(settings);
        db.SaveChanges();

        // The settings store caches process-wide for 15s, so a test that seeds a row must
        // drop the cache or it reads whatever the previous test left behind.
        SystemSettingsStore.Invalidate();
        return db;
    }

    private static string Message(IActionResult result) =>
        (string)Assert.IsType<BadRequestObjectResult>(result).Value!
            .GetType().GetProperty("message")!.GetValue(
                Assert.IsType<BadRequestObjectResult>(result).Value)!;

    // ── The happy path ────────────────────────────────────────────────────────────

    [Fact]
    public async Task A_scholar_can_file_their_own_document()
    {
        using var db = Seeded();
        var (controller, storage, _) = Build(db);
        controller.As(Scholar, UserRoles.Scholar);

        var result = await controller.Upload(1, "2025-2026", 1, Fakes.File());

        Assert.IsType<OkObjectResult>(result);
        Assert.Single(storage.Saved);
        var row = Assert.Single(db.DocumentSubmissions);
        Assert.Equal(Scholar, row.ScholarId);
        Assert.Equal(DocumentStatus.Pending, row.Status);
    }

    // ── The guards ────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(ApprovalStatuses.Pending, "awaiting verification")]
    [InlineData(ApprovalStatuses.Rejected, "was not approved")]
    public async Task An_unapproved_scholar_cannot_submit(string approval, string expected)
    {
        using var db = Seeded(approval: approval);
        var (controller, storage, _) = Build(db);
        controller.As(Scholar, UserRoles.Scholar);

        var result = await controller.Upload(1, "2025-2026", 1, Fakes.File());

        Assert.Contains(expected, Message(result));
        Assert.Empty(storage.Saved);
    }

    [Fact]
    public async Task A_malformed_period_is_refused_before_anything_is_written()
    {
        using var db = Seeded();
        var (controller, storage, _) = Build(db);
        controller.As(Scholar, UserRoles.Scholar);

        var result = await controller.Upload(1, "2025/2026", 1, Fakes.File());

        Assert.Contains("YYYY-YYYY", Message(result));
        Assert.Empty(storage.Saved);
        Assert.Empty(db.DocumentSubmissions);
    }

    [Fact]
    public async Task A_scholar_cannot_submit_for_a_period_other_than_the_active_one()
    {
        using var db = Seeded();
        var (controller, _, _) = Build(db);
        controller.As(Scholar, UserRoles.Scholar);

        var result = await controller.Upload(1, "2024-2025", 1, Fakes.File());

        Assert.Contains("active period", Message(result));
    }

    [Fact]
    public async Task Staff_may_backfill_a_past_period_but_never_a_future_one()
    {
        using var db = Seeded();
        var (controller, _, _) = Build(db);
        controller.As(Staff, UserRoles.ScholarshipCoordinator);

        Assert.IsType<OkObjectResult>(await controller.Upload(1, "2024-2025", 1, Fakes.File(), Scholar));

        var future = await controller.Upload(1, "2026-2027", 1, Fakes.File(), Scholar);
        Assert.Contains("later than the active period", Message(future));
    }

    [Fact]
    public async Task An_unknown_requirement_is_refused()
    {
        using var db = Seeded();
        var (controller, _, _) = Build(db);
        controller.As(Scholar, UserRoles.Scholar);

        var result = await controller.Upload(99, "2025-2026", 1, Fakes.File());

        Assert.Contains("requirement not found", Message(result));
    }

    [Fact]
    public async Task A_scholar_without_a_complete_profile_is_told_what_is_missing()
    {
        using var db = Seeded();
        var profile = db.ScholarProfiles.Single(p => p.UserId == Scholar);
        profile.ProgramId = null;
        db.SaveChanges();

        var (controller, storage, _) = Build(db);
        controller.As(Scholar, UserRoles.Scholar);

        var result = await controller.Upload(1, "2025-2026", 1, Fakes.File());

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(storage.Saved);
    }

    // ── Replacement: the §2.5 regression ──────────────────────────────────────────

    [Fact]
    public async Task A_second_submission_for_the_same_period_is_refused()
    {
        using var db = Seeded();
        var (controller, _, _) = Build(db);
        controller.As(Scholar, UserRoles.Scholar);

        await controller.Upload(1, "2025-2026", 1, Fakes.File());
        var second = await controller.Upload(1, "2025-2026", 1, Fakes.File());

        Assert.Contains("already exists", Message(second));
        Assert.Single(db.DocumentSubmissions);
    }

    [Fact]
    public async Task A_verified_document_cannot_be_replaced_by_the_scholar()
    {
        using var db = Seeded();
        var (controller, _, _) = Build(db);
        controller.As(Scholar, UserRoles.Scholar);

        await controller.Upload(1, "2025-2026", 1, Fakes.File());
        db.DocumentSubmissions.Single().Status = DocumentStatus.Verified;
        db.SaveChanges();

        var result = await controller.Upload(1, "2025-2026", 1, Fakes.File());

        Assert.Contains("already been verified", Message(result));
        Assert.Single(db.DocumentSubmissions);
    }

    [Fact]
    public async Task A_permitted_replacement_updates_the_row_instead_of_adding_a_second()
    {
        /* The bug: the verified-document guard and the duplicate guard both fell through when
           a replacement was allowed, so Upload carried on to the insert. The period then held
           two rows — the old file orphaned on disk, the checklist showing whichever came back
           first, and compliance counting the requirement twice. */
        using var db = Seeded();
        var (controller, storage, _) = Build(db);
        controller.As(Staff, UserRoles.ScholarshipCoordinator);

        await controller.Upload(1, "2025-2026", 1, Fakes.File("first.pdf"), Scholar);
        var first = db.DocumentSubmissions.Single();
        first.Status = DocumentStatus.Verified;
        db.SaveChanges();
        var supersededFile = first.StoredFileName;

        var result = await controller.Upload(1, "2025-2026", 1, Fakes.File("second.pdf"), Scholar);

        Assert.IsType<OkObjectResult>(result);

        var row = Assert.Single(db.DocumentSubmissions);          // still one row, not two
        Assert.Equal("second.pdf", row.FileName);
        Assert.Equal(DocumentStatus.Pending, row.Status);          // review resets
        Assert.Null(row.ReviewedById);
        Assert.Contains(supersededFile, storage.Deleted);          // no orphan left on disk
    }

    [Fact]
    public async Task Replacing_after_an_incomplete_review_is_allowed_and_keeps_both_rows()
    {
        // The uniqueness rule ignores Incomplete on purpose: the superseded row is the
        // scholar's record of having been sent back, and the new one is the resubmission.
        using var db = Seeded();
        var (controller, _, _) = Build(db);
        controller.As(Scholar, UserRoles.Scholar);

        await controller.Upload(1, "2025-2026", 1, Fakes.File("first.pdf"));
        db.DocumentSubmissions.Single().Status = DocumentStatus.Incomplete;
        db.SaveChanges();

        var result = await controller.Upload(1, "2025-2026", 1, Fakes.File("second.pdf"));

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(2, db.DocumentSubmissions.Count());
    }

    // ── Filing on someone else's behalf ───────────────────────────────────────────

    [Fact]
    public async Task A_scholar_cannot_file_under_another_scholars_name()
    {
        using var db = Seeded();
        db.AddScholar("scholar-2");
        db.SaveChanges();

        var (controller, storage, _) = Build(db);
        controller.As(Scholar, UserRoles.Scholar);

        var result = await controller.Upload(1, "2025-2026", 1, Fakes.File(), "scholar-2");

        Assert.IsType<ForbidResult>(result);
        Assert.Empty(storage.Saved);
    }

    [Fact]
    public async Task Staff_filing_on_behalf_files_it_under_the_scholar_and_tells_them()
    {
        using var db = Seeded();
        var (controller, _, notes) = Build(db);
        controller.As(Staff, UserRoles.ScholarshipCoordinator, "Ana Cruz");

        var result = await controller.Upload(1, "2025-2026", 1, Fakes.File(), Scholar);

        Assert.IsType<OkObjectResult>(result);

        // Filed under the scholar, not the staff member — the defect that made the whole
        // staff-upload branch unreachable in the first place.
        Assert.Equal(Scholar, db.DocumentSubmissions.Single().ScholarId);
        Assert.Contains(notes.Sent, n => n.RecipientId == Scholar && n.Title.Contains("filed for you"));
    }

    [Fact]
    public async Task The_history_entry_records_who_actually_uploaded_it()
    {
        using var db = Seeded();
        var (controller, _, _) = Build(db);
        controller.As(Staff, UserRoles.ScholarshipCoordinator, "Ana Cruz");

        await controller.Upload(1, "2025-2026", 1, Fakes.File(), Scholar);

        var history = Assert.Single(db.DocumentStatusHistories);
        Assert.Equal(Staff, history.ChangedById);
    }

    // ── Storage rejections ────────────────────────────────────────────────────────

    [Fact]
    public async Task A_file_storage_rejects_leaves_no_submission_behind()
    {
        using var db = Seeded();
        var (controller, storage, _) = Build(db);
        storage.RejectWith = "The file's contents do not match its extension.";
        controller.As(Scholar, UserRoles.Scholar);

        var result = await controller.Upload(1, "2025-2026", 1, Fakes.File());

        Assert.Contains("do not match", Message(result));
        Assert.Empty(db.DocumentSubmissions);
    }

    [Fact]
    public async Task An_empty_file_is_refused()
    {
        using var db = Seeded();
        var (controller, _, _) = Build(db);
        controller.As(Scholar, UserRoles.Scholar);

        var result = await controller.Upload(1, "2025-2026", 1, Fakes.File(bytes: 0));

        Assert.Contains("choose a file", Message(result));
    }
}
