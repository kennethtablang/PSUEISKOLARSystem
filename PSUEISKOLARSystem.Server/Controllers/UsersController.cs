using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.DTOs.Users;
using PSUEISKOLARSystem.Server.Exceptions;
using PSUEISKOLARSystem.Server.Infrastructure;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = UserRoles.Administrator)]
    public class UsersController(
        UserManager<ApplicationUser> userManager,
        IAuthService authService,
        IFileStorageService storage,
        SessionValidator sessions,
        ApplicationDbContext db) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? role,
            [FromQuery] string? search,
            [FromQuery] bool? isActive,
            [FromQuery] string? approvalStatus,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            page     = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 5, 100);

            var query = db.Users.AsQueryable();

            if (isActive.HasValue)
                query = query.Where(u => u.IsActive == isActive);

            if (!string.IsNullOrWhiteSpace(approvalStatus))
            {
                if (!ApprovalStatuses.All.Contains(approvalStatus))
                    return BadRequest(new { message = "Invalid approval status." });
                query = query.Where(u => u.ApprovalStatus == approvalStatus);
            }

            // Filter by role in SQL (join through AspNetUserRoles) instead of loading everyone.
            if (!string.IsNullOrWhiteSpace(role))
            {
                var roleId = await db.Roles.Where(r => r.Name == role).Select(r => r.Id).FirstOrDefaultAsync();
                var idsInRole = db.UserRoles.Where(ur => ur.RoleId == roleId).Select(ur => ur.UserId);
                query = query.Where(u => idsInRole.Contains(u.Id));
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(u =>
                    EF.Functions.Like((u.FirstName + " " + u.LastName).ToLower(), $"%{s}%") ||
                    (u.Email != null && EF.Functions.Like(u.Email.ToLower(), $"%{s}%")));
            }

            var total = await query.CountAsync();

            var users = await query
                .OrderBy(u => u.LastName).ThenBy(u => u.FirstName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Roles fetched only for the current page (bounded), not every user.
            var items = new List<UserDto>();
            foreach (var u in users)
            {
                var roles = await userManager.GetRolesAsync(u);
                items.Add(new UserDto
                {
                    Id = u.Id,
                    FirstName = u.FirstName,
                    MiddleName = u.MiddleName,
                    LastName = u.LastName,
                    FullName = u.FullName,
                    Email = u.Email ?? string.Empty,
                    Role = roles.FirstOrDefault() ?? string.Empty,
                    IsActive = u.IsActive,
                    CampusId = u.CampusId,
                    ApprovalStatus = u.ApprovalStatus,
                    ApprovalNote = u.ApprovalNote,
                    ApprovalDecidedAt = u.ApprovalDecidedAt,
                    HasAvatar = u.AvatarPath != null,
                });
            }

            return Ok(PagedResult<UserDto>.From(items, total, page, pageSize));
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user is null) return NotFound(new { message = "User not found." });

            var roles = await userManager.GetRolesAsync(user);
            return Ok(new UserDto
            {
                Id = user.Id,
                FirstName = user.FirstName,
                MiddleName = user.MiddleName,
                LastName = user.LastName,
                FullName = user.FullName,
                Email = user.Email ?? string.Empty,
                Role = roles.FirstOrDefault() ?? string.Empty,
                IsActive = user.IsActive,
                CampusId = user.CampusId,
                ApprovalStatus = user.ApprovalStatus,
                ApprovalNote = user.ApprovalNote,
                ApprovalDecidedAt = user.ApprovalDecidedAt,
                HasAvatar = user.AvatarPath != null,
            });
        }

        private string ActorId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        /// <summary>
        /// Whether <paramref name="user"/> is the only active Administrator left. Removing,
        /// archiving, or demoting that account would leave nobody able to reach User
        /// Management, Settings, or the Activity Log — a lockout only a database edit undoes.
        /// </summary>
        private async Task<bool> IsLastActiveAdministratorAsync(ApplicationUser user)
        {
            if (!user.IsActive || !await userManager.IsInRoleAsync(user, UserRoles.Administrator))
                return false;

            var admins = await userManager.GetUsersInRoleAsync(UserRoles.Administrator);
            return admins.Count(a => a.IsActive) <= 1;
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, UpdateUserDto dto)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null) return NotFound(new { message = "User not found." });

            if (!await db.Roles.AnyAsync(r => r.Name == dto.Role))
                return BadRequest(new { message = $"Role '{dto.Role}' does not exist." });

            var currentRoles = await userManager.GetRolesAsync(user);
            var roleChanged = !(currentRoles.Count == 1 && currentRoles[0] == dto.Role);

            if (roleChanged && id == ActorId)
                return BadRequest(new { message = "You cannot change your own role. Ask another administrator to do it." });

            if (roleChanged && dto.Role != UserRoles.Administrator && await IsLastActiveAdministratorAsync(user))
                return BadRequest(new { message = "This is the only active administrator. Promote another user to Administrator first." });

            // Email / login change — enforce uniqueness, keep the account confirmed.
            var newEmail = dto.Email.Trim();
            if (!string.Equals(user.Email, newEmail, StringComparison.OrdinalIgnoreCase))
            {
                var existing = await userManager.FindByEmailAsync(newEmail);
                if (existing is not null && existing.Id != user.Id)
                    return BadRequest(new { message = "Another account already uses this email." });

                user.Email = newEmail;
                user.NormalizedEmail = userManager.NormalizeEmail(newEmail);
                user.UserName = newEmail;
                user.NormalizedUserName = userManager.NormalizeName(newEmail);
            }

            user.FirstName = dto.FirstName.Trim();
            user.MiddleName = string.IsNullOrWhiteSpace(dto.MiddleName) ? null : dto.MiddleName.Trim();
            user.LastName = dto.LastName.Trim();

            // A coordinator's campus decides everything they can see; other roles have none.
            if (dto.Role == UserRoles.ScholarshipCoordinator)
            {
                if (await AuthService.CoordinatorCampusProblemAsync(db, dto.CampusId, user.Id) is { } problem)
                    return BadRequest(new { message = problem });
                user.CampusId = dto.CampusId;
            }
            else user.CampusId = null;

            /* The result used to be discarded, so a rejected update (an email Identity refuses,
               a concurrency conflict) still answered 204 and the admin saw "saved". */
            var updated = await userManager.UpdateAsync(user);
            if (!updated.Succeeded)
                return BadRequest(new { message = string.Join(" ", updated.Errors.Select(e => e.Description)) });

            if (roleChanged)
            {
                var removed = await userManager.RemoveFromRolesAsync(user, currentRoles);
                var added = removed.Succeeded ? await userManager.AddToRoleAsync(user, dto.Role) : removed;
                if (!added.Succeeded)
                    return BadRequest(new { message = string.Join(" ", added.Errors.Select(e => e.Description)) });

                /* The role travels inside the JWT, so without this a demoted coordinator kept
                   staff access until their token expired. Rotating the stamp makes
                   SessionValidator reject the old token on its next request. */
                await userManager.UpdateSecurityStampAsync(user);
                sessions.Invalidate(user.Id);
            }

            var actorId = ActorId;
            db.AuditLogs.Add(new AuditLog
            {
                UserId  = actorId,
                Action  = "UpdateUser",
                Details = $"Updated user {user.Email} — role: {dto.Role}",
            });
            await db.SaveChangesAsync();

            return NoContent();
        }

        [HttpPatch("{id}/status")]
        public async Task<IActionResult> SetStatus(string id, [FromBody] bool isActive)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null) return NotFound(new { message = "User not found." });

            if (!isActive && id == ActorId)
                return BadRequest(new { message = "You cannot archive your own account." });

            if (!isActive && await IsLastActiveAdministratorAsync(user))
                return BadRequest(new { message = "This is the only active administrator and cannot be archived." });

            user.IsActive = isActive;
            await userManager.UpdateAsync(user);

            var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            db.AuditLogs.Add(new AuditLog
            {
                UserId  = actorId,
                Action  = isActive ? "ActivateUser" : "DeactivateUser",
                Details = $"{(isActive ? "Activated" : "Deactivated")} user {user.Email}",
            });
            await db.SaveChangesAsync();

            // Their token stays cryptographically valid until it expires, so tell the
            // per-request check to re-read this account rather than trust its snapshot.
            sessions.Invalidate(user.Id);

            return NoContent();
        }

        // POST /api/users/{id}/send-password-reset — admin triggers a reset email for a user.
        [HttpPost("{id}/send-password-reset")]
        public async Task<IActionResult> SendPasswordReset(string id)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null) return NotFound(new { message = "User not found." });
            if (string.IsNullOrWhiteSpace(user.Email))
                return BadRequest(new { message = "This user has no email address on file." });

            await authService.ForgotPasswordAsync(user.Email);

            var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            db.AuditLogs.Add(new AuditLog
            {
                UserId  = actorId,
                Action  = "AdminPasswordReset",
                Details = $"Sent a password reset link to {user.Email}",
            });
            await db.SaveChangesAsync();

            return Ok(new { message = $"A password reset link has been sent to {user.Email}." });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null) return NotFound(new { message = "User not found." });

            if (id == ActorId)
                return BadRequest(new { message = "You cannot delete your own account." });

            if (await IsLastActiveAdministratorAsync(user))
                return BadRequest(new { message = "This is the only active administrator and cannot be deleted." });

            /* Some records name their author in a required column that the database refuses to
               orphan: announcements, the reviewer on a document's status history, and messages
               sent into someone else's thread. They are part of the institution's record, so
               they are not deleted with the account — and before this check the delete simply
               failed on the foreign key with an unexplained 500. Archiving keeps the history
               and still revokes access. */
            var authoredAnnouncements = await db.Announcements.CountAsync(a => a.CreatedById == id);
            var reviewedHistory = await db.DocumentStatusHistories
                .CountAsync(h => h.ChangedById == id && h.Submission.ScholarId != id);
            var sentMessages = await db.Messages.CountAsync(m => m.SenderId == id && m.ScholarId != id);

            if (authoredAnnouncements + reviewedHistory + sentMessages > 0)
            {
                var owned = new List<string>();
                if (authoredAnnouncements > 0) owned.Add($"{authoredAnnouncements} announcement(s)");
                if (reviewedHistory > 0) owned.Add($"{reviewedHistory} document review(s)");
                if (sentMessages > 0) owned.Add($"{sentMessages} message(s) to scholars");
                return Conflict(new
                {
                    message = $"{user.FullName} cannot be deleted because they are recorded on {string.Join(", ", owned)}. Archive the account instead to revoke access while keeping that history.",
                });
            }

            var deletedEmail = user.Email;
            var avatarPath = user.AvatarPath;

            /* Deleting the user cascades their DocumentSubmissions rows away, which would
               otherwise leave every file they ever uploaded on disk with nothing referring to
               it — over a few graduating cohorts, the bulk of the upload directory,
               unreferenced and un-purgeable. Collected before the delete, removed after it. */
            var uploadedFiles = await db.DocumentSubmissions
                .Where(ds => ds.ScholarId == id)
                .Select(ds => ds.StoredFileName)
                .ToListAsync();

            // The clean-up below is several statements; if the final delete fails, none of it
            // should stick, or the user survives with their audit links already nulled.
            await using var transaction = await db.Database.BeginTransactionAsync();

            // A scholar's own conversation goes with them, as their submissions do. Messages
            // restrict deletes (two FKs into the users table), so they must go first.
            await db.Messages
                .Where(m => m.ScholarId == id)
                .ExecuteDeleteAsync();

            // Likewise the status history of their own submissions: those rows name the
            // scholar as the uploader through a restricting FK, so they are cleared explicitly
            // rather than trusting the submission cascade to reach them first.
            await db.DocumentStatusHistories
                .Where(h => h.Submission.ScholarId == id)
                .ExecuteDeleteAsync();

            // Null out audit FK fields before deleting to avoid FK constraint violations
            // (ClientSetNull on these columns means EF won't cascade automatically)
            await db.ScholarshipReleases
                .Where(r => r.RecordedById == id)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.RecordedById, (string?)null));

            await db.AcademicGrades
                .Where(g => g.RecordedById == id)
                .ExecuteUpdateAsync(s => s.SetProperty(g => g.RecordedById, (string?)null));

            await db.DocumentSubmissions
                .Where(ds => ds.ReviewedById == id)
                .ExecuteUpdateAsync(s => s.SetProperty(ds => ds.ReviewedById, (string?)null));

            await db.ScholarshipAssignments
                .Where(a => a.AssignedById == id)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.AssignedById, (string?)null));

            await db.OneTimeGrants
                .Where(g => g.RecordedById == id)
                .ExecuteUpdateAsync(s => s.SetProperty(g => g.RecordedById, (string?)null));

            var result = await userManager.DeleteAsync(user);
            if (!result.Succeeded)
                return BadRequest(new { message = string.Join("; ", result.Errors.Select(e => e.Description)) });

            await transaction.CommitAsync();
            sessions.Invalidate(id);

            // The rows are gone, so nothing points at these files any more. A failure here is
            // not worth failing the request over — it leaves a recoverable orphan, not a broken
            // record — so each is attempted independently.
            if (avatarPath is not null) await DeleteQuietlyAsync(avatarPath);
            foreach (var stored in uploadedFiles) await DeleteQuietlyAsync(stored);

            var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            db.AuditLogs.Add(new AuditLog
            {
                UserId  = actorId,
                Action  = "DeleteUser",
                Details = $"Deleted user {deletedEmail}",
            });
            await db.SaveChangesAsync();

            return NoContent();
        }

        private async Task DeleteQuietlyAsync(string storedFileName)
        {
            try { await storage.DeleteAsync(storedFileName); }
            catch (IOException) { /* the row is already gone; a stuck file is not worth a 500 */ }
            catch (UnauthorizedAccessException) { }
        }

        // POST /api/users/archive-inactive
        // Deactivates all Scholar accounts that have had no document submissions in the last N days.
        [HttpPost("archive-inactive")]
        public async Task<IActionResult> ArchiveInactive([FromQuery] int daysInactive = 180)
        {
            if (daysInactive < 30)
                return BadRequest(new { message = "daysInactive must be at least 30." });

            var cutoff = DateTime.UtcNow.AddDays(-daysInactive);

            // Find active scholars whose last submission (or account creation) is older than cutoff
            var scholarIds = await db.UserRoles
                .Where(ur => db.Roles.Any(r => r.Id == ur.RoleId && r.Name == UserRoles.Scholar))
                .Select(ur => ur.UserId)
                .ToListAsync();

            var activeScholars = await db.Users
                .Where(u => u.IsActive && scholarIds.Contains(u.Id))
                .ToListAsync();

            var recentSubmitters = await db.DocumentSubmissions
                .Where(s => s.SubmittedAt >= cutoff)
                .Select(s => s.ScholarId)
                .Distinct()
                .ToListAsync();

            var toArchive = activeScholars
                .Where(u => !recentSubmitters.Contains(u.Id) && u.CreatedAt < cutoff)
                .ToList();

            foreach (var u in toArchive)
                u.IsActive = false;

            if (toArchive.Count > 0)
            {
                var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
                db.AuditLogs.Add(new AuditLog
                {
                    UserId  = actorId,
                    Action  = "ArchiveInactiveScholars",
                    Details = $"Archived {toArchive.Count} scholar(s) inactive for >{daysInactive} days: {string.Join(", ", toArchive.Select(u => u.Email))}",
                });
                await db.SaveChangesAsync();

                foreach (var u in toArchive)
                    sessions.Invalidate(u.Id);
            }

            return Ok(new { archived = toArchive.Count, emails = toArchive.Select(u => u.Email) });
        }
    }
}
