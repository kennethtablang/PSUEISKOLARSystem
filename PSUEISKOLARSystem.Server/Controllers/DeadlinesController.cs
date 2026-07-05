using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Controllers
{
    // Submission deadlines & compliance windows (FR-16).
    [ApiController]
    [Route("api/deadlines")]
    [Authorize]
    public class DeadlinesController(ApplicationDbContext db) : ControllerBase
    {
        private const string ManagerRoles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}";

        // GET /api/deadlines?academicYear=&semester=
        // Readable by all authenticated users so scholars can see due dates & countdowns (FR-16.2).
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? academicYear, [FromQuery] int? semester)
        {
            var query = db.SubmissionDeadlines
                .Include(d => d.Requirement)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(academicYear))
                query = query.Where(d => d.AcademicYear == academicYear);
            if (semester.HasValue)
                query = query.Where(d => d.Semester == semester);

            var result = await query
                .OrderBy(d => d.DueDate)
                .Select(d => new
                {
                    d.Id,
                    d.RequirementId,
                    RequirementName = d.Requirement.Name,
                    d.AcademicYear,
                    d.Semester,
                    d.DueDate,
                })
                .ToListAsync();

            return Ok(result);
        }

        // POST /api/deadlines  — upsert a deadline for a requirement+period
        [HttpPost]
        [Authorize(Roles = ManagerRoles)]
        public async Task<IActionResult> Upsert(DeadlineRequest dto)
        {
            if (string.IsNullOrWhiteSpace(dto.AcademicYear) || dto.Semester is < 1 or > 2)
                return BadRequest(new { message = "Academic year and a valid semester (1 or 2) are required." });

            var requirement = await db.DocumentRequirements.FindAsync(dto.RequirementId);
            if (requirement is null || !requirement.IsActive)
                return BadRequest(new { message = "Document requirement not found." });

            var existing = await db.SubmissionDeadlines.FirstOrDefaultAsync(d =>
                d.RequirementId == dto.RequirementId &&
                d.AcademicYear == dto.AcademicYear &&
                d.Semester == dto.Semester);

            if (existing is not null)
            {
                // Reset the reminder flag if the due date moved so reminders re-fire.
                if (existing.DueDate != dto.DueDate)
                    existing.RemindersSentAt = null;
                existing.DueDate = dto.DueDate;
                db.Audit(this, "UpdateDeadline", $"Updated deadline for requirement #{dto.RequirementId} ({dto.AcademicYear} Sem {dto.Semester}) → {dto.DueDate:yyyy-MM-dd}");
                await db.SaveChangesAsync();
                return Ok(new { existing.Id });
            }

            var deadline = new SubmissionDeadline
            {
                RequirementId = dto.RequirementId,
                AcademicYear = dto.AcademicYear,
                Semester = dto.Semester,
                DueDate = dto.DueDate,
                CreatedById = User.FindFirstValue(ClaimTypes.NameIdentifier),
            };
            db.SubmissionDeadlines.Add(deadline);
            db.Audit(this, "CreateDeadline", $"Set deadline for requirement #{dto.RequirementId} ({dto.AcademicYear} Sem {dto.Semester}) → {dto.DueDate:yyyy-MM-dd}");
            await db.SaveChangesAsync();
            return Ok(new { deadline.Id });
        }

        // PUT /api/deadlines/{id}
        [HttpPut("{id}")]
        [Authorize(Roles = ManagerRoles)]
        public async Task<IActionResult> Update(int id, UpdateDeadlineRequest dto)
        {
            var deadline = await db.SubmissionDeadlines.FindAsync(id);
            if (deadline is null) return NotFound();

            if (deadline.DueDate != dto.DueDate)
                deadline.RemindersSentAt = null;
            deadline.DueDate = dto.DueDate;
            await db.SaveChangesAsync();
            return NoContent();
        }

        // DELETE /api/deadlines/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = ManagerRoles)]
        public async Task<IActionResult> Delete(int id)
        {
            var deadline = await db.SubmissionDeadlines.FindAsync(id);
            if (deadline is null) return NotFound();
            db.Audit(this, "DeleteDeadline", $"Removed deadline #{id} (requirement #{deadline.RequirementId})");
            db.SubmissionDeadlines.Remove(deadline);
            await db.SaveChangesAsync();
            return NoContent();
        }

        // GET /api/deadlines/report?academicYear=&semester=
        // Overdue / missing / late report per requirement (FR-16.5).
        [HttpGet("report")]
        [Authorize(Roles = ManagerRoles)]
        public async Task<IActionResult> Report([FromQuery] string academicYear, [FromQuery] int semester)
        {
            if (string.IsNullOrWhiteSpace(academicYear) || semester is < 1 or > 2)
                return BadRequest(new { message = "Academic year and a valid semester are required." });

            var deadlines = await db.SubmissionDeadlines
                .Include(d => d.Requirement)
                .Where(d => d.AcademicYear == academicYear && d.Semester == semester)
                .OrderBy(d => d.DueDate)
                .ToListAsync();

            var report = new List<object>();

            foreach (var d in deadlines)
            {
                var submissions = await db.DocumentSubmissions
                    .Include(s => s.Scholar)
                    .Where(s => s.RequirementId == d.RequirementId &&
                                s.AcademicYear == academicYear &&
                                s.Semester == semester)
                    .ToListAsync();

                var submittedIds = submissions.Select(s => s.ScholarId).ToHashSet();
                var applicable = await DeadlineHelper.GetApplicableScholarsAsync(db, d.RequirementId);

                var lateSubmissions = submissions
                    .Where(s => s.SubmittedAt > d.DueDate)
                    .Select(s => new { s.ScholarId, ScholarName = s.Scholar.FullName, s.SubmittedAt })
                    .OrderBy(s => s.ScholarName)
                    .ToList();

                var missingScholars = applicable
                    .Where(a => !submittedIds.Contains(a.Id))
                    .Select(a => new { a.Id, a.FullName, a.CampusName })
                    .OrderBy(a => a.FullName)
                    .ToList();

                report.Add(new
                {
                    d.Id,
                    d.RequirementId,
                    RequirementName = d.Requirement.Name,
                    d.DueDate,
                    IsPastDue = d.DueDate < DateTime.UtcNow,
                    Applicable = applicable.Count,
                    Submitted = submissions.Count,
                    OnTime = submissions.Count(s => s.SubmittedAt <= d.DueDate),
                    Late = lateSubmissions.Count,
                    Missing = missingScholars.Count,
                    LateSubmissions = lateSubmissions,
                    MissingScholars = missingScholars,
                });
            }

            return Ok(report);
        }

        public record DeadlineRequest(int RequirementId, string AcademicYear, int Semester, DateTime DueDate);
        public record UpdateDeadlineRequest(DateTime DueDate);
    }
}
