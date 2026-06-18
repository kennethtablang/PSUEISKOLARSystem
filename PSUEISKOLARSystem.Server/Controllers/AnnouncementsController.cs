using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AnnouncementsController(ApplicationDbContext db) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var role = User.FindFirstValue(ClaimTypes.Role);
            var campusIdClaim = User.FindFirstValue("campusId");
            int? campusId = campusIdClaim is not null ? int.Parse(campusIdClaim) : null;

            var now = DateTime.UtcNow;

            var announcements = await db.Announcements
                .Include(a => a.CreatedBy)
                .Include(a => a.TargetCampus)
                .Where(a =>
                    a.IsActive &&
                    (a.ExpiresAt == null || a.ExpiresAt > now) &&
                    (a.TargetRole == null || a.TargetRole == role) &&
                    (a.TargetCampusId == null || a.TargetCampusId == campusId))
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new
                {
                    a.Id,
                    a.Title,
                    a.Content,
                    a.TargetRole,
                    TargetCampus = a.TargetCampus != null ? a.TargetCampus.Name : null,
                    a.ExpiresAt,
                    a.CreatedAt,
                    CreatedBy = a.CreatedBy.MiddleName != null
                        ? a.CreatedBy.FirstName + " " + a.CreatedBy.MiddleName + " " + a.CreatedBy.LastName
                        : a.CreatedBy.FirstName + " " + a.CreatedBy.LastName,
                })
                .ToListAsync();

            return Ok(announcements);
        }

        [HttpPost]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> Create(AnnouncementRequest dto)
        {
            var announcement = new Announcement
            {
                Title = dto.Title,
                Content = dto.Content,
                TargetRole = string.IsNullOrEmpty(dto.TargetRole) ? null : dto.TargetRole,
                TargetCampusId = dto.TargetCampusId,
                ExpiresAt = dto.ExpiresAt,
                CreatedById = User.FindFirstValue(ClaimTypes.NameIdentifier)!,
            };

            db.Announcements.Add(announcement);
            await db.SaveChangesAsync();
            return Ok(new { announcement.Id });
        }

        [HttpPut("{id}")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> Update(int id, AnnouncementRequest dto)
        {
            var announcement = await db.Announcements.FindAsync(id);
            if (announcement is null) return NotFound();

            announcement.Title = dto.Title;
            announcement.Content = dto.Content;
            announcement.TargetRole = string.IsNullOrEmpty(dto.TargetRole) ? null : dto.TargetRole;
            announcement.TargetCampusId = dto.TargetCampusId;
            announcement.ExpiresAt = dto.ExpiresAt;

            await db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Delete(int id)
        {
            var announcement = await db.Announcements.FindAsync(id);
            if (announcement is null) return NotFound();

            announcement.IsActive = false;
            await db.SaveChangesAsync();
            return NoContent();
        }
    }

    public record AnnouncementRequest(
        string Title,
        string Content,
        string? TargetRole,
        int? TargetCampusId,
        DateTime? ExpiresAt);
}
