using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/documents")]
    [Authorize]
    public class DocumentsController(ApplicationDbContext db, IFileStorageService storage, BackgroundEmailer mail, INotificationService notifications) : ControllerBase
    {
        // Only these types may be rendered inline; everything else is forced to download.
        private static readonly HashSet<string> PreviewableTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/gif",
            "image/webp",
        };

        // GET /api/documents?scholarId=&requirementId=&status=&academicYear=&semester=
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? scholarId,
            [FromQuery] int? requirementId,
            [FromQuery] string? status,
            [FromQuery] string? academicYear,
            [FromQuery] int? semester)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isAdminOrCoord = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

            var query = db.DocumentSubmissions
                .Include(ds => ds.Scholar)
                .Include(ds => ds.Requirement)
                .Include(ds => ds.ReviewedBy)
                .AsQueryable();

            // Scholars can only see their own
            if (!isAdminOrCoord)
                query = query.Where(ds => ds.ScholarId == currentUserId);
            else if (!string.IsNullOrEmpty(scholarId))
                query = query.Where(ds => ds.ScholarId == scholarId);

            if (requirementId.HasValue)
                query = query.Where(ds => ds.RequirementId == requirementId);

            if (!string.IsNullOrEmpty(status) && Enum.TryParse<DocumentStatus>(status, out var parsedStatus))
                query = query.Where(ds => ds.Status == parsedStatus);

            if (!string.IsNullOrEmpty(academicYear))
                query = query.Where(ds => ds.AcademicYear == academicYear);

            if (semester.HasValue)
                query = query.Where(ds => ds.Semester == semester);

            var submissions = await query
                .OrderByDescending(ds => ds.SubmittedAt)
                .Select(ds => new
                {
                    ds.Id,
                    ds.ScholarId,
                    ScholarName = ds.Scholar.MiddleName != null
                        ? ds.Scholar.FirstName + " " + ds.Scholar.MiddleName + " " + ds.Scholar.LastName
                        : ds.Scholar.FirstName + " " + ds.Scholar.LastName,
                    ScholarEmail = ds.Scholar.Email,
                    ds.RequirementId,
                    RequirementName = ds.Requirement.Name,
                    ds.FileName,
                    ds.FileSizeBytes,
                    ds.ContentType,
                    Status = ds.Status.ToString(),
                    ds.FeedbackNote,
                    ReviewedBy = ds.ReviewedBy != null
                        ? (ds.ReviewedBy.MiddleName != null
                            ? ds.ReviewedBy.FirstName + " " + ds.ReviewedBy.MiddleName + " " + ds.ReviewedBy.LastName
                            : ds.ReviewedBy.FirstName + " " + ds.ReviewedBy.LastName)
                        : null,
                    ds.ReviewedAt,
                    ds.SubmittedAt,
                    ds.AcademicYear,
                    ds.Semester,
                    // On-time / late vs the requirement's deadline for this period (FR-16.3)
                    DueDate = db.SubmissionDeadlines
                        .Where(dl => dl.RequirementId == ds.RequirementId &&
                                     dl.AcademicYear == ds.AcademicYear &&
                                     dl.Semester == ds.Semester)
                        .Select(dl => (DateTime?)dl.DueDate)
                        .FirstOrDefault(),
                    IsLate = db.SubmissionDeadlines
                        .Any(dl => dl.RequirementId == ds.RequirementId &&
                                   dl.AcademicYear == ds.AcademicYear &&
                                   dl.Semester == ds.Semester &&
                                   ds.SubmittedAt > dl.DueDate),
                })
                .ToListAsync();

            return Ok(submissions);
        }

        /// <summary>
        /// POST /api/documents (multipart/form-data). Files a submission for the caller, or —
        /// when <paramref name="scholarId"/> names someone else — for that scholar.
        /// </summary>
        /// <param name="scholarId">
        /// Whose checklist this belongs on. Omitted for a scholar filing their own document.
        /// Staff use it to file a document a scholar handed in at the counter or by mail: the
        /// exemptions below (bypassing the profile gate, backfilling a closed period,
        /// replacing a verified file, submitting past a deadline) exist precisely for that
        /// case, and until this parameter existed there was no way to reach them — a staff
        /// upload filed the document under the staff member's own account.
        /// </param>
        [HttpPost]
        public async Task<IActionResult> Upload(
            [FromForm] int requirementId,
            [FromForm] string academicYear,
            [FromForm] int semester,
            IFormFile file,
            [FromForm] string? scholarId = null)
        {
            var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isStaff = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

            scholarId = string.IsNullOrWhiteSpace(scholarId) ? actorId : scholarId.Trim();
            var onBehalf = scholarId != actorId;

            if (onBehalf && !isStaff) return Forbid();

            // Registration must be verified by the scholarship office before a scholar can
            // submit anything (see ScholarApprovalsController).
            var scholar = await db.Users.FindAsync(scholarId);
            if (scholar is null)
                return BadRequest(new { message = onBehalf ? "That scholar was not found." : "Account not found." });

            if (onBehalf && !await db.UserRoles
                    .AnyAsync(ur => ur.UserId == scholarId &&
                                    db.Roles.Any(r => r.Id == ur.RoleId && r.Name == UserRoles.Scholar)))
                return BadRequest(new { message = $"{scholar.FullName} is not a scholar." });

            if (scholar.ApprovalStatus != ApprovalStatuses.Approved)
                return BadRequest(new
                {
                    message = onBehalf
                        ? $"{scholar.FullName}'s registration is {scholar.ApprovalStatus.ToLowerInvariant()}. " +
                          "Approve the registration before filing documents for them."
                        : scholar.ApprovalStatus == ApprovalStatuses.Rejected
                            ? "Your scholar registration was not approved, so document submission is locked. Please contact the scholarship office."
                            : "Your scholar registration is still awaiting verification by the scholarship office. You can submit documents once it has been approved."
                });

            var policy = await SystemSettingsStore.GetAsync(db);

            // A profile is what tells the system which requirements, deadlines, and GWA
            // threshold apply to this scholar. Without it a submission belongs to no
            // checklist, so setting up the profile has to come before submitting anything.
            if (policy.RequireProfileBeforeSubmission && !isStaff)
            {
                var profile = await db.ScholarProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == scholarId);
                if (!ScholarOnboarding.IsComplete(profile))
                    return BadRequest(new { message = ScholarOnboarding.BlockedMessage(profile) });
            }

            // File policy (size + type) is configurable in System Settings. The same policy is
            // handed to the storage layer below, so the two cannot disagree; storage adds the
            // magic-byte check on top of it.
            var ext = Path.GetExtension(file?.FileName ?? "").ToLowerInvariant();
            if (file is null || file.Length == 0)
                return BadRequest(new { message = "Please choose a file to upload." });
            if (!policy.ExtensionSet().Contains(ext))
                return BadRequest(new
                {
                    message = $"That file type isn't accepted. Allowed types: {policy.AllowedFileExtensions}."
                });
            if (file.Length > (long)policy.MaxUploadMb * 1024 * 1024)
                return BadRequest(new
                {
                    message = $"That file is {file.Length / 1024.0 / 1024.0:N1} MB — the limit is {policy.MaxUploadMb} MB."
                });

            // The period was previously taken on trust — any string reached the database, which
            // silently detached submissions from deadlines and compliance stats.
            if (!AcademicPeriod.TryParse(academicYear, semester, out var period, out var periodError))
                return BadRequest(new { message = periodError });

            var active = await db.ActiveSemesters.FirstOrDefaultAsync();

            if (active is not null &&
                AcademicPeriod.TryParse(active.AcademicYear, active.Semester, out var activePeriod, out _))
            {
                if (!isStaff && period != activePeriod)
                    return BadRequest(new
                    {
                        message = $"Documents can only be submitted for the active period " +
                                  $"({activePeriod.Label}). Contact your coordinator if you need to " +
                                  $"submit for {period.Label}."
                    });

                // Staff may backfill a past period on a scholar's behalf, but never a future one.
                if (isStaff && period > activePeriod)
                    return BadRequest(new
                    {
                        message = $"{period.Label} is later than the active period ({activePeriod.Label})."
                    });
            }

            academicYear = period.AcademicYear;   // store the normalised form

            var requirement = await db.DocumentRequirements.FindAsync(requirementId);
            if (requirement is null || !requirement.IsActive)
                return BadRequest(new { message = "Document requirement not found." });

            // Only one pending/verified submission per requirement per semester
            var existing = await db.DocumentSubmissions.FirstOrDefaultAsync(ds =>
                ds.ScholarId == scholarId &&
                ds.RequirementId == requirementId &&
                ds.AcademicYear == academicYear &&
                ds.Semester == semester &&
                ds.Status != DocumentStatus.Incomplete);

            /* Whether this upload is allowed to stand in for the existing one.

               A verified document is a decision the office has already made, so swapping the
               file underneath it is a policy call (AllowReplaceVerified). Staff are exempt —
               they are the ones the scholar would otherwise have to ask.

               These two conditions used to be written as a pair of guards that both fell
               through when a replacement was permitted, so the upload carried on and inserted
               a *second* row for the period: the old file orphaned on disk, the checklist
               showing whichever row came back first, and compliance counting the requirement
               twice. */
            var mayReplace = existing is not null
                && (isStaff || (existing.Status == DocumentStatus.Verified && policy.AllowReplaceVerified));

            if (existing is not null && !mayReplace)
                return BadRequest(new
                {
                    message = existing.Status == DocumentStatus.Verified
                        ? "This document has already been verified and can no longer be replaced. " +
                          "Message your coordinator if it needs to be changed."
                        : "A submission already exists for this requirement and period. Remove it or " +
                          "wait for the coordinator to mark it Incomplete before resubmitting.",
                });

            // Late submissions: the deadline for this requirement and period, if one is set.
            if (!policy.AllowLateSubmissions && !isStaff)
            {
                var due = await db.SubmissionDeadlines
                    .Where(d => d.RequirementId == requirementId
                             && d.AcademicYear == academicYear
                             && d.Semester == semester)
                    .Select(d => (DateTime?)d.DueDate)
                    .FirstOrDefaultAsync();

                if (due is DateTime dueDate && DateTime.UtcNow > dueDate)
                    return BadRequest(new
                    {
                        message = $"The deadline for this requirement passed on {dueDate:d MMMM yyyy}. " +
                                  "Late submissions are currently closed — contact your coordinator."
                    });
            }

            try
            {
                var (storedFileName, sizeBytes) = await storage.SaveAsync(file, FileUploadPolicy.ForDocuments(policy));

                DocumentSubmission submission;
                string? supersededFile = null;
                string historyNote;

                if (mayReplace)
                {
                    /* Replace in place rather than inserting alongside. Keeping the row means
                       the status history, and any message thread hanging off this submission,
                       stay attached to the requirement they belong to; the review resets
                       because the file a coordinator signed off on is no longer there. */
                    supersededFile = existing!.StoredFileName;
                    historyNote = $"Replaced the previous {existing.Status} submission " +
                                  $"('{existing.FileName}').";

                    existing.FileName = file.FileName;
                    existing.StoredFileName = storedFileName;
                    existing.ContentType = file.ContentType;
                    existing.FileSizeBytes = sizeBytes;
                    existing.SubmittedAt = DateTime.UtcNow;
                    existing.Status = DocumentStatus.Pending;
                    existing.FeedbackNote = null;
                    existing.ReviewedById = null;
                    existing.ReviewedAt = null;
                    submission = existing;
                }
                else
                {
                    historyNote = onBehalf
                        ? $"Filed by {User.FindFirstValue(ClaimTypes.Name)} on the scholar's behalf."
                        : "Document submitted by scholar.";
                    submission = new DocumentSubmission
                    {
                        ScholarId = scholarId,
                        RequirementId = requirementId,
                        FileName = file.FileName,
                        StoredFileName = storedFileName,
                        ContentType = file.ContentType,
                        FileSizeBytes = sizeBytes,
                        AcademicYear = academicYear,
                        Semester = semester,
                    };
                    db.DocumentSubmissions.Add(submission);
                }

                await db.SaveChangesAsync();

                db.DocumentStatusHistories.Add(new DocumentStatusHistory
                {
                    SubmissionId = submission.Id,
                    Status = "Pending",
                    Note = historyNote,
                    // Who performed the upload, which is not the scholar when staff file it.
                    ChangedById = actorId,
                    ChangedAt = submission.SubmittedAt,
                });
                db.Audit(this, mayReplace ? "ReplaceDocument" : "UploadDocument",
                    $"{(mayReplace ? "Replaced" : "Submitted")} '{requirement.Name}' ({academicYear} Sem {semester})" +
                    (onBehalf ? $" on behalf of {scholar.FullName}" : ""));
                await db.SaveChangesAsync();

                // Only once the row points at the new file, so a failure above cannot leave a
                // submission referring to a file that has already been deleted.
                if (supersededFile is not null) await storage.DeleteAsync(supersededFile);

                // Notify scholar (sent after the response returns — see BackgroundEmailer)
                if (scholar.Email is not null)
                {
                    mail.Queue($"upload confirmation to {scholar.Email}", email =>
                        email.SendDocumentUploadConfirmationAsync(
                            scholar.Email,
                            scholar.FullName,
                            requirement.Name,
                            academicYear,
                            semester));
                }

                // The scholar did not perform this upload, so nothing else would tell them a
                // document just appeared on their checklist under their name.
                if (onBehalf)
                {
                    await notifications.CreateAsync(
                        scholarId,
                        "Document filed for you",
                        $"The scholarship office filed your \"{requirement.Name}\" for {academicYear} " +
                        $"Sem {semester}. Check that it is the document you handed in.",
                        NotificationCategories.DocumentStatus,
                        "/my-documents");
                }

                _ = notifications.BroadcastAsync("AnalyticsChanged");
                return Ok(new { submission.Id });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET /api/documents/pending-count  — sidebar badge for the Document Review queue
        [HttpGet("pending-count")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> PendingCount()
        {
            var count = await db.DocumentSubmissions.CountAsync(ds => ds.Status == DocumentStatus.Pending);
            return Ok(new { count });
        }

        // GET /api/documents/{id}/preview  — serves inline (no download prompt)
        [HttpGet("{id}/preview")]
        public async Task<IActionResult> Preview(int id)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isAdminOrCoord = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

            var submission = await db.DocumentSubmissions.FindAsync(id);
            if (submission is null) return NotFound();

            if (!isAdminOrCoord && submission.ScholarId != currentUserId)
                return Forbid();

            try
            {
                var (stream, _) = await storage.GetAsync(submission.StoredFileName, submission.ContentType);

                // Only allow known-safe types inline; anything else (HTML, SVG, Word…) is forced to download.
                var safeType = PreviewableTypes.Contains(submission.ContentType)
                    ? submission.ContentType
                    : "application/octet-stream";

                Response.Headers["X-Content-Type-Options"] = "nosniff";
                Response.Headers["Content-Security-Policy"] =
                    "default-src 'none'; img-src 'self' blob:; object-src 'none'; sandbox";

                return File(stream, safeType, fileDownloadName: null, enableRangeProcessing: true);
            }
            catch (FileNotFoundException)
            {
                return NotFound(new { message = "File not found on server." });
            }
        }

        // GET /api/documents/{id}/download
        [HttpGet("{id}/download")]
        public async Task<IActionResult> Download(int id)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isAdminOrCoord = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

            var submission = await db.DocumentSubmissions.FindAsync(id);
            if (submission is null) return NotFound();

            if (!isAdminOrCoord && submission.ScholarId != currentUserId)
                return Forbid();

            try
            {
                var (stream, contentType) = await storage.GetAsync(submission.StoredFileName, submission.ContentType);
                return File(stream, contentType, submission.FileName);
            }
            catch (FileNotFoundException)
            {
                return NotFound(new { message = "File not found on server." });
            }
        }

        // PATCH /api/documents/{id}/review
        [HttpPatch("{id}/review")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> Review(int id, ReviewRequest dto)
        {
            if (ValidateReview(dto.Status, dto.FeedbackNote, out var status, out var feedback) is { } invalid)
                return invalid;

            var submission = await db.DocumentSubmissions
                .Include(s => s.Scholar)
                .Include(s => s.Requirement)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (submission is null) return NotFound();

            var reviewerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            submission.Status = status;
            submission.FeedbackNote = feedback;
            submission.ReviewedById = reviewerId;
            submission.ReviewedAt = DateTime.UtcNow;

            db.DocumentStatusHistories.Add(new DocumentStatusHistory
            {
                SubmissionId = id,
                Status = status.ToString(),
                Note = feedback,
                ChangedById = reviewerId,
                ChangedAt = DateTime.UtcNow,
            });

            db.Audit(this, "ReviewDocument", $"Marked submission #{id} ({submission.Requirement?.Name}) as {status}");
            await db.SaveChangesAsync();

            var requirementName = submission.Requirement?.Name ?? "Document";

            // Real-time in-app notification (FR-13/FR-14)
            await notifications.CreateAsync(
                submission.ScholarId,
                $"Document {status}",
                $"Your \"{requirementName}\" submission was marked {status}." +
                    (feedback is null ? "" : $" Note: {feedback}"),
                NotificationCategories.DocumentStatus,
                "/my-documents");

            _ = notifications.BroadcastAsync("AnalyticsChanged");

            // Notify scholar by email (after the response — respects their preference, FR-20)
            if (submission.Scholar?.Email is not null && submission.Scholar.EmailDocumentStatus)
            {
                var scholar = submission.Scholar;
                mail.Queue($"document status to {scholar.Email}", email =>
                    email.SendDocumentStatusEmailAsync(
                        scholar.Email!,
                        scholar.FullName,
                        requirementName,
                        status.ToString(),
                        feedback));
            }

            return NoContent();
        }

        // POST /api/documents/batch-review  — review many submissions at once
        [HttpPost("batch-review")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> BatchReview(BatchReviewRequest dto)
        {
            if (ValidateReview(dto.Status, dto.FeedbackNote, out var status, out var feedback) is { } invalid)
                return invalid;
            if (dto.Ids is null || dto.Ids.Count == 0)
                return BadRequest(new { message = "No submissions selected." });

            var reviewerId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var now = DateTime.UtcNow;

            var submissions = await db.DocumentSubmissions
                .Include(s => s.Scholar)
                .Include(s => s.Requirement)
                .Where(s => dto.Ids.Contains(s.Id))
                .ToListAsync();

            foreach (var submission in submissions)
            {
                submission.Status = status;
                submission.FeedbackNote = feedback;
                submission.ReviewedById = reviewerId;
                submission.ReviewedAt = now;
                db.DocumentStatusHistories.Add(new DocumentStatusHistory
                {
                    SubmissionId = submission.Id,
                    Status = status.ToString(),
                    Note = feedback,
                    ChangedById = reviewerId,
                    ChangedAt = now,
                });
            }
            db.Audit(this, "BatchReviewDocuments", $"Marked {submissions.Count} submission(s) as {status}");
            await db.SaveChangesAsync();

            foreach (var submission in submissions)
            {
                var requirementName = submission.Requirement?.Name ?? "Document";
                await notifications.CreateAsync(
                    submission.ScholarId,
                    $"Document {status}",
                    $"Your \"{requirementName}\" submission was marked {status}." +
                        (feedback is null ? "" : $" Note: {feedback}"),
                    NotificationCategories.DocumentStatus,
                    "/my-documents");

                if (submission.Scholar?.Email is not null && submission.Scholar.EmailDocumentStatus)
                {
                    var scholar = submission.Scholar;
                    mail.Queue($"document status to {scholar.Email}", email =>
                        email.SendDocumentStatusEmailAsync(
                            scholar.Email!, scholar.FullName,
                            requirementName, status.ToString(), feedback));
                }
            }

            _ = notifications.BroadcastAsync("AnalyticsChanged");
            return Ok(new { reviewed = submissions.Count });
        }

        /// <summary>
        /// Shared rules for a review decision. Marking a document Incomplete without saying
        /// what is wrong leaves the scholar unable to fix it, and that rule was only enforced
        /// by the review form — the API accepted a blank note. The note is also bounded to the
        /// 1000-character column, which otherwise failed at SaveChanges.
        /// </summary>
        private BadRequestObjectResult? ValidateReview(string? rawStatus, string? rawFeedback, out DocumentStatus status, out string? feedback)
        {
            feedback = string.IsNullOrWhiteSpace(rawFeedback) ? null : rawFeedback.Trim();

            if (!Enum.TryParse(rawStatus, out status) || status == DocumentStatus.Pending)
                return BadRequest(new { message = "Status must be 'Verified' or 'Incomplete'." });
            if (status == DocumentStatus.Incomplete && feedback is null)
                return BadRequest(new { message = "Add feedback explaining what needs to be corrected before marking a document incomplete." });
            if (feedback?.Length > 1000)
                return BadRequest(new { message = "Feedback must be 1000 characters or fewer." });
            return null;
        }

        // GET /api/documents/{id}/history
        [HttpGet("{id}/history")]
        public async Task<IActionResult> GetHistory(int id)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isAdminOrCoord = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

            var submission = await db.DocumentSubmissions.FindAsync(id);
            if (submission is null) return NotFound();

            if (!isAdminOrCoord && submission.ScholarId != currentUserId)
                return Forbid();

            var history = await db.DocumentStatusHistories
                .Include(h => h.ChangedBy)
                .Where(h => h.SubmissionId == id)
                .OrderBy(h => h.ChangedAt)
                .Select(h => new
                {
                    h.Id,
                    h.Status,
                    h.Note,
                    ChangedBy = h.ChangedBy.MiddleName != null
                        ? h.ChangedBy.FirstName + " " + h.ChangedBy.MiddleName + " " + h.ChangedBy.LastName
                        : h.ChangedBy.FirstName + " " + h.ChangedBy.LastName,
                    h.ChangedAt,
                })
                .ToListAsync();

            return Ok(history);
        }

        // DELETE /api/documents/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isAdmin = User.IsInRole(UserRoles.Administrator);

            var submission = await db.DocumentSubmissions.FindAsync(id);
            if (submission is null) return NotFound();

            if (!isAdmin && submission.ScholarId != currentUserId)
                return Forbid();

            if (!isAdmin && submission.Status == DocumentStatus.Verified)
                return BadRequest(new { message = "Verified documents cannot be deleted." });

            var storedFile = submission.StoredFileName;

            db.Audit(this, "DeleteDocument", $"Deleted submission #{id} ({submission.FileName})");
            db.DocumentSubmissions.Remove(submission);
            await db.SaveChangesAsync();

            /* Commit first, delete the file second. The other order left a surviving row
               pointing at a file that no longer existed whenever SaveChangesAsync threw —
               preview and download then returned "File not found on server." forever, with no
               way to clear it from the checklist. An orphaned file is recoverable; a row
               pointing at nothing is not. */
            await storage.DeleteAsync(storedFile);
            return NoContent();
        }
    }

    public record ReviewRequest(string Status, string? FeedbackNote);
    public record BatchReviewRequest(List<int> Ids, string Status, string? FeedbackNote);
}
