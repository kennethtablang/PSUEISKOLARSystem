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
    public class DocumentsController(ApplicationDbContext db, IFileStorageService storage, IEmailService emailService) : ControllerBase
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
                .Include(ds => ds.Scholar).ThenInclude(u => u.Campus)
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
                    CampusName = ds.Scholar.Campus != null ? ds.Scholar.Campus.Name : null,
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
                })
                .ToListAsync();

            return Ok(submissions);
        }

        // POST /api/documents  (multipart/form-data)
        [HttpPost]
        public async Task<IActionResult> Upload(
            [FromForm] int requirementId,
            [FromForm] string academicYear,
            [FromForm] int semester,
            IFormFile file)
        {
            var scholarId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;

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

            if (existing is not null)
                return BadRequest(new { message = "A submission already exists for this requirement and period. Remove it or wait for the coordinator to mark it Incomplete before resubmitting." });

            try
            {
                var (storedFileName, sizeBytes) = await storage.SaveAsync(file);

                var submission = new DocumentSubmission
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
                await db.SaveChangesAsync();
                return Ok(new { submission.Id });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
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
            if (!Enum.TryParse<DocumentStatus>(dto.Status, out var status) || status == DocumentStatus.Pending)
                return BadRequest(new { message = "Status must be 'Verified' or 'Incomplete'." });

            var submission = await db.DocumentSubmissions
                .Include(s => s.Scholar)
                .Include(s => s.Requirement)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (submission is null) return NotFound();

            submission.Status = status;
            submission.FeedbackNote = dto.FeedbackNote;
            submission.ReviewedById = User.FindFirstValue(ClaimTypes.NameIdentifier);
            submission.ReviewedAt = DateTime.UtcNow;

            await db.SaveChangesAsync();

            // Notify scholar by email (fire-and-forget — don't fail the request if email fails)
            if (submission.Scholar?.Email is not null)
            {
                _ = emailService.SendDocumentStatusEmailAsync(
                    submission.Scholar.Email,
                    submission.Scholar.FullName,
                    submission.Requirement?.Name ?? "Document",
                    status.ToString(),
                    dto.FeedbackNote);
            }

            return NoContent();
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

            await storage.DeleteAsync(submission.StoredFileName);
            db.DocumentSubmissions.Remove(submission);
            await db.SaveChangesAsync();
            return NoContent();
        }
    }

    public record ReviewRequest(string Status, string? FeedbackNote);
}
