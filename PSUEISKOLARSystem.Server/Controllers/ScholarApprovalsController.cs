using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    /// <summary>
    /// Verification queue for self-registered scholars. A scholar who signs themselves up
    /// starts <c>Pending</c>: they can sign in and complete their profile, but cannot submit
    /// documents until an administrator or coordinator verifies the registration.
    /// </summary>
    [ApiController]
    [Route("api/scholar-approvals")]
    [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
    public class ScholarApprovalsController(
        ApplicationDbContext db,
        INotificationService notifications,
        IEmailService emailService) : ControllerBase
    {
        // GET /api/scholar-approvals?status=Pending&search=&page=1&pageSize=20
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? status,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var scholarRoleId = await db.Roles
                .Where(r => r.Name == UserRoles.Scholar)
                .Select(r => r.Id)
                .FirstOrDefaultAsync();
            var scholarIds = db.UserRoles.Where(ur => ur.RoleId == scholarRoleId).Select(ur => ur.UserId);

            var query = db.Users.Where(u => scholarIds.Contains(u.Id));

            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!ApprovalStatuses.All.Contains(status))
                    return BadRequest(new { message = "Invalid approval status." });
                query = query.Where(u => u.ApprovalStatus == status);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(u =>
                    EF.Functions.Like((u.FirstName + " " + u.LastName).ToLower(), $"%{s}%") ||
                    (u.Email != null && EF.Functions.Like(u.Email.ToLower(), $"%{s}%")));
            }

            var total = await query.CountAsync();

            // Oldest registrations first — they have been waiting longest.
            var users = await query
                .OrderBy(u => u.ApprovalStatus == ApprovalStatuses.Pending ? 0 : 1)
                .ThenBy(u => u.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new
                {
                    u.Id,
                    u.FirstName,
                    u.MiddleName,
                    u.LastName,
                    u.Email,
                    u.EmailConfirmed,
                    u.IsActive,
                    u.CreatedAt,
                    u.ApprovalStatus,
                    u.ApprovalNote,
                    u.ApprovalDecidedAt,
                    DecidedBy = db.Users
                        .Where(a => a.Id == u.ApprovalDecidedById)
                        .Select(a => a.FirstName + " " + a.LastName)
                        .FirstOrDefault(),
                })
                .ToListAsync();

            var ids = users.Select(u => u.Id).ToList();

            var profiles = await db.ScholarProfiles
                .Where(sp => ids.Contains(sp.UserId))
                .Select(sp => new
                {
                    sp.UserId,
                    sp.StudentId,
                    sp.YearLevel,
                    sp.ContactNumber,
                    ProgramName = sp.Program != null ? sp.Program.Name : null,
                    ProgramCode = sp.Program != null ? sp.Program.Code : null,
                    sp.ScholarshipTypeId,
                    ScholarshipTypeName = sp.ScholarshipType != null ? sp.ScholarshipType.Name : null,
                    ScholarshipTypeCategory = sp.ScholarshipType != null ? sp.ScholarshipType.Category : null,
                })
                .ToDictionaryAsync(x => x.UserId);

            // Duplicate-student-ID check: two accounts claiming the same student number is
            // the usual sign of a double registration.
            var studentIds = profiles.Values
                .Select(p => p.StudentId)
                .Where(sid => !string.IsNullOrWhiteSpace(sid))
                .ToList();

            var duplicateStudentIds = await db.ScholarProfiles
                .Where(sp => studentIds.Contains(sp.StudentId))
                .GroupBy(sp => sp.StudentId)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToListAsync();

            // Scholars who already hold an active scholarship assignment.
            var activeAssignments = await db.ScholarshipAssignments
                .Where(a => ids.Contains(a.ScholarId) && a.EndedAt == null)
                .Select(a => new { a.ScholarId, a.ScholarshipType.Name })
                .ToDictionaryAsync(a => a.ScholarId, a => a.Name);

            var priorAssignmentCounts = await db.ScholarshipAssignments
                .Where(a => ids.Contains(a.ScholarId))
                .GroupBy(a => a.ScholarId)
                .Select(g => new { ScholarId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ScholarId, x => x.Count);

            var items = users.Select(u =>
            {
                profiles.TryGetValue(u.Id, out var p);
                var warnings = new List<string>();

                if (!u.EmailConfirmed)
                    warnings.Add("Email address is not verified yet.");
                if (p is null)
                    warnings.Add("Scholar profile has not been set up.");
                else
                {
                    if (p.ScholarshipTypeId is null)
                        warnings.Add("No scholarship selected.");
                    if (!string.IsNullOrWhiteSpace(p.StudentId) && duplicateStudentIds.Contains(p.StudentId))
                        warnings.Add($"Student ID {p.StudentId} is used by more than one account.");
                }
                if (priorAssignmentCounts.TryGetValue(u.Id, out var count) && count > 1)
                    warnings.Add($"Has {count} scholarship assignment records — verify the history.");

                return new
                {
                    u.Id,
                    u.FirstName,
                    u.MiddleName,
                    u.LastName,
                    FullName = string.IsNullOrWhiteSpace(u.MiddleName)
                        ? $"{u.FirstName} {u.LastName}".Trim()
                        : $"{u.FirstName} {u.MiddleName} {u.LastName}".Trim(),
                    u.Email,
                    u.EmailConfirmed,
                    u.IsActive,
                    u.CreatedAt,
                    u.ApprovalStatus,
                    u.ApprovalNote,
                    u.ApprovalDecidedAt,
                    u.DecidedBy,
                    p?.StudentId,
                    p?.YearLevel,
                    p?.ContactNumber,
                    p?.ProgramName,
                    p?.ProgramCode,
                    p?.ScholarshipTypeId,
                    p?.ScholarshipTypeName,
                    p?.ScholarshipTypeCategory,
                    ActiveScholarship = activeAssignments.GetValueOrDefault(u.Id),
                    ProfileComplete = p is not null && !string.IsNullOrWhiteSpace(p.StudentId)
                                        && p.ScholarshipTypeId is not null,
                    Warnings = warnings,
                };
            });

            return Ok(new
            {
                total,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(total / (double)pageSize),
                items,
            });
        }

        // GET /api/scholar-approvals/pending-count  — sidebar / dashboard badge
        [HttpGet("pending-count")]
        public async Task<IActionResult> PendingCount()
        {
            var scholarRoleId = await db.Roles
                .Where(r => r.Name == UserRoles.Scholar)
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            var count = await db.Users
                .Where(u => u.ApprovalStatus == ApprovalStatuses.Pending &&
                            db.UserRoles.Any(ur => ur.RoleId == scholarRoleId && ur.UserId == u.Id))
                .CountAsync();

            return Ok(new { count });
        }

        // POST /api/scholar-approvals/{userId}/approve
        [HttpPost("{userId}/approve")]
        public async Task<IActionResult> Approve(string userId, ApprovalDecisionRequest dto)
            => await DecideAsync(userId, approved: true, dto.Note);

        // POST /api/scholar-approvals/{userId}/reject
        [HttpPost("{userId}/reject")]
        public async Task<IActionResult> Reject(string userId, ApprovalDecisionRequest dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Note))
                return BadRequest(new { message = "A reason is required when rejecting a registration." });
            return await DecideAsync(userId, approved: false, dto.Note);
        }

        private async Task<IActionResult> DecideAsync(string userId, bool approved, string? note)
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user is null) return NotFound(new { message = "User not found." });

            var isScholar = await db.UserRoles.AnyAsync(ur =>
                ur.UserId == userId &&
                db.Roles.Any(r => r.Id == ur.RoleId && r.Name == UserRoles.Scholar));
            if (!isScholar)
                return BadRequest(new { message = "Only scholar accounts go through registration approval." });

            var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var profile = await db.ScholarProfiles
                .Include(sp => sp.ScholarshipType)
                .FirstOrDefaultAsync(sp => sp.UserId == userId);

            if (approved)
            {
                if (profile is null || string.IsNullOrWhiteSpace(profile.StudentId))
                    return BadRequest(new { message = "This scholar has not set up their profile yet — there is nothing to verify." });
                if (profile.ScholarshipTypeId is null)
                    return BadRequest(new { message = "This scholar has not selected a scholarship yet. Assign one from their profile before approving." });

                // Open the ledger row that records which scholarship they were verified into.
                await ScholarshipRegistry.BackfillAsync(db, profile, actorId);
            }

            user.ApprovalStatus = approved ? ApprovalStatuses.Approved : ApprovalStatuses.Rejected;
            user.ApprovalDecidedAt = DateTime.UtcNow;
            user.ApprovalDecidedById = actorId;
            user.ApprovalNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();

            db.Audit(this, approved ? "ApproveScholarRegistration" : "RejectScholarRegistration",
                $"{(approved ? "Approved" : "Rejected")} scholar registration for {user.Email}" +
                (approved && profile?.ScholarshipType is not null ? $" under {profile.ScholarshipType.Name}" : "") +
                (string.IsNullOrWhiteSpace(note) ? "" : $" — {note.Trim()}"));

            await db.SaveChangesAsync();

            await notifications.CreateAsync(
                user.Id,
                approved ? "Registration approved" : "Registration not approved",
                approved
                    ? "Your scholar registration has been verified. You can now submit your document requirements."
                    : $"Your scholar registration was not approved. Reason: {user.ApprovalNote}",
                NotificationCategories.Account,
                approved ? "/my-documents" : "/my-profile");

            if (user.Email is not null)
            {
                _ = emailService.SendScholarApprovalDecisionAsync(
                    user.Email, user.FullName, approved, profile?.ScholarshipType?.Name, user.ApprovalNote);
            }

            _ = notifications.BroadcastAsync("AnalyticsChanged");

            return Ok(new { user.ApprovalStatus, user.ApprovalDecidedAt, user.ApprovalNote });
        }
    }

    public record ApprovalDecisionRequest(string? Note);
}
