using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.DTOs.Users;
using PSUEISKOLARSystem.Server.Exceptions;
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
                    ApprovalStatus = u.ApprovalStatus,
                    ApprovalNote = u.ApprovalNote,
                    ApprovalDecidedAt = u.ApprovalDecidedAt,
                    HasAvatar = u.AvatarPath != null,
                });
            }

            return Ok(new { total, page, pageSize, items });
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
                ApprovalStatus = user.ApprovalStatus,
                ApprovalNote = user.ApprovalNote,
                ApprovalDecidedAt = user.ApprovalDecidedAt,
                HasAvatar = user.AvatarPath != null,
            });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, UpdateUserDto dto)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null) return NotFound(new { message = "User not found." });

            if (!await db.Roles.AnyAsync(r => r.Name == dto.Role))
                return BadRequest(new { message = $"Role '{dto.Role}' does not exist." });

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

            var currentRoles = await userManager.GetRolesAsync(user);
            await userManager.RemoveFromRolesAsync(user, currentRoles);
            await userManager.AddToRoleAsync(user, dto.Role);

            await userManager.UpdateAsync(user);

            var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
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

            var deletedEmail = user.Email;
            var avatarPath = user.AvatarPath;

            // Null out audit FK fields before deleting to avoid FK constraint violations
            // (ClientSetNull on these columns means EF won't cascade automatically)
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

            // The row is gone, so nothing points at the photo any more — remove the file too.
            if (avatarPath is not null) await storage.DeleteAsync(avatarPath);

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
            }

            return Ok(new { archived = toArchive.Count, emails = toArchive.Select(u => u.Email) });
        }
    }
}
