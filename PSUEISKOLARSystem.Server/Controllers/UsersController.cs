using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.DTOs.Users;
using PSUEISKOLARSystem.Server.Exceptions;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = UserRoles.Administrator)]
    public class UsersController(
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext db) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? role, [FromQuery] int? campusId)
        {
            var query = db.Users.Include(u => u.Campus).AsQueryable();

            if (campusId.HasValue)
                query = query.Where(u => u.CampusId == campusId);

            var users = await query.OrderBy(u => u.LastName).ThenBy(u => u.FirstName).ToListAsync();

            var result = new List<object>();
            foreach (var u in users)
            {
                var roles = await userManager.GetRolesAsync(u);
                var userRole = roles.FirstOrDefault() ?? string.Empty;

                if (!string.IsNullOrEmpty(role) && userRole != role) continue;

                result.Add(new UserDto
                {
                    Id = u.Id,
                    FirstName = u.FirstName,
                    MiddleName = u.MiddleName,
                    LastName = u.LastName,
                    FullName = u.FullName,
                    Email = u.Email ?? string.Empty,
                    Role = userRole,
                    CampusId = u.CampusId,
                    CampusName = u.Campus?.Name,
                    IsActive = u.IsActive,
                });
            }

            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            var user = await db.Users.Include(u => u.Campus).FirstOrDefaultAsync(u => u.Id == id);
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
                CampusId = user.CampusId,
                CampusName = user.Campus?.Name,
                IsActive = user.IsActive,
            });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, UpdateUserDto dto)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null) return NotFound(new { message = "User not found." });

            if (!await db.Roles.AnyAsync(r => r.Name == dto.Role))
                return BadRequest(new { message = $"Role '{dto.Role}' does not exist." });

            if (dto.CampusId.HasValue && !await db.Campuses.AnyAsync(c => c.Id == dto.CampusId))
                return BadRequest(new { message = $"Campus does not exist." });

            user.FirstName = dto.FirstName.Trim();
            user.MiddleName = string.IsNullOrWhiteSpace(dto.MiddleName) ? null : dto.MiddleName.Trim();
            user.LastName = dto.LastName.Trim();
            user.CampusId = dto.CampusId;

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

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null) return NotFound(new { message = "User not found." });

            var deletedEmail = user.Email;

            // Null out audit FK fields before deleting to avoid FK constraint violations
            // (ClientSetNull on these columns means EF won't cascade automatically)
            await db.AcademicGrades
                .Where(g => g.RecordedById == id)
                .ExecuteUpdateAsync(s => s.SetProperty(g => g.RecordedById, (string?)null));

            await db.DocumentSubmissions
                .Where(ds => ds.ReviewedById == id)
                .ExecuteUpdateAsync(s => s.SetProperty(ds => ds.ReviewedById, (string?)null));

            var result = await userManager.DeleteAsync(user);
            if (!result.Succeeded)
                return BadRequest(new { message = string.Join("; ", result.Errors.Select(e => e.Description)) });

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
    }
}
