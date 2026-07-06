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
    [Route("api/[controller]")]
    [Authorize]
    public class AnnouncementsController(ApplicationDbContext db, IEmailService emailService, INotificationService notifications, IFileStorageService storage, IServiceScopeFactory scopeFactory) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var role = User.FindFirstValue(ClaimTypes.Role);
            var campusIdClaim = User.FindFirstValue("campusId");
            int? campusId = campusIdClaim is not null ? int.Parse(campusIdClaim) : null;

            var now = DateTime.UtcNow;

            // Admins and coordinators see all active announcements for management.
            // Scholars see only what is targeted at them.
            var isManager = role == UserRoles.Administrator || role == UserRoles.ScholarshipCoordinator;

            int? scholarshipTypeId = null;
            int? programId = null;

            if (!isManager)
            {
                var profile = await db.ScholarProfiles
                    .Where(sp => sp.UserId == userId)
                    .Select(sp => new { sp.ScholarshipTypeId, sp.ProgramId })
                    .FirstOrDefaultAsync();
                scholarshipTypeId = profile?.ScholarshipTypeId;
                programId = profile?.ProgramId;
            }

            var query = db.Announcements
                .Include(a => a.CreatedBy)
                .Include(a => a.TargetCampus)
                .Include(a => a.TargetScholarshipType)
                .Include(a => a.TargetProgram)
                .Where(a =>
                    a.IsActive &&
                    (a.ExpiresAt == null || a.ExpiresAt > now));

            if (!isManager)
            {
                query = query.Where(a =>
                    (a.TargetRole == null || a.TargetRole == role) &&
                    (a.TargetCampusId == null || a.TargetCampusId == campusId) &&
                    (a.TargetScholarshipTypeId == null || a.TargetScholarshipTypeId == scholarshipTypeId) &&
                    (a.TargetProgramId == null || a.TargetProgramId == programId));
            }

            var announcements = await query
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            return Ok(announcements.Select(a => new
            {
                a.Id,
                a.Title,
                a.Content,
                a.TargetRole,
                TargetCampus = a.TargetCampus?.Name,
                TargetScholarshipType = a.TargetScholarshipType?.Name,
                TargetProgram = a.TargetProgram?.Name,
                a.ExpiresAt,
                a.IntentAction,
                HasImage = a.ImagePath != null,
                a.CreatedAt,
                CreatedBy = a.CreatedBy.MiddleName != null
                    ? a.CreatedBy.FirstName + " " + a.CreatedBy.MiddleName + " " + a.CreatedBy.LastName
                    : a.CreatedBy.FirstName + " " + a.CreatedBy.LastName,
            }));
        }

        [HttpPost]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> Create(AnnouncementRequest dto)
        {
            if (!string.IsNullOrWhiteSpace(dto.IntentAction) && !AnnouncementIntents.IsValid(dto.IntentAction))
                return BadRequest(new { message = $"Unknown intended action '{dto.IntentAction}'." });

            var announcement = new Announcement
            {
                Title = dto.Title,
                Content = dto.Content,
                TargetRole = string.IsNullOrEmpty(dto.TargetRole) ? null : dto.TargetRole,
                TargetCampusId = dto.TargetCampusId,
                TargetScholarshipTypeId = dto.TargetScholarshipTypeId,
                TargetProgramId = dto.TargetProgramId,
                ExpiresAt = dto.ExpiresAt,
                IntentAction = string.IsNullOrWhiteSpace(dto.IntentAction) ? null : dto.IntentAction,
                CreatedById = User.FindFirstValue(ClaimTypes.NameIdentifier)!,
            };

            db.Announcements.Add(announcement);
            db.Audit(this, "CreateAnnouncement", $"Created announcement '{announcement.Title}'");
            await db.SaveChangesAsync();

            // Resolve targeted scholars once, then deliver via both channels.
            var scholars = await GetTargetedScholarsAsync(announcement);
            if (scholars.Count > 0)
            {
                // Real-time in-app notification (FR-13/FR-14/FR-6.4) — awaited so it persists.
                var preview = announcement.Content.Length > 200
                    ? announcement.Content[..200] + "…"
                    : announcement.Content;
                await notifications.CreateForManyAsync(
                    scholars.Select(s => s.Id),
                    announcement.Title,
                    preview,
                    NotificationCategories.Announcement,
                    "/dashboard");

                // Email only scholars who opted in to announcement emails (FR-20).
                _ = SendAnnouncementEmailsAsync(
                    scholars.Where(s => s.EmailOptIn).ToList(), announcement.Title, announcement.Content);
            }

            return Ok(new { announcement.Id });
        }

        // Returns the scholars an announcement targets (campus/type/program/role scoped).
        private async Task<List<TargetedScholar>> GetTargetedScholarsAsync(Announcement a)
        {
            // If the announcement targets a non-scholar role, there are no scholars to reach.
            if (!string.IsNullOrEmpty(a.TargetRole) && a.TargetRole != UserRoles.Scholar)
                return [];

            var query = db.Users
                .Join(db.UserRoles, u => u.Id, ur => ur.UserId, (u, ur) => new { u, ur })
                .Join(db.Roles, x => x.ur.RoleId, r => r.Id, (x, r) => new { x.u, RoleName = r.Name })
                .Where(x => x.RoleName == UserRoles.Scholar && x.u.IsActive && x.u.Email != null)
                .Select(x => x.u)
                .AsQueryable();

            if (a.TargetCampusId.HasValue)
                query = query.Where(u => u.CampusId == a.TargetCampusId);

            var scholars = await query.ToListAsync();

            if (a.TargetScholarshipTypeId.HasValue || a.TargetProgramId.HasValue)
            {
                var profileQuery = db.ScholarProfiles.AsQueryable();
                if (a.TargetScholarshipTypeId.HasValue)
                    profileQuery = profileQuery.Where(sp => sp.ScholarshipTypeId == a.TargetScholarshipTypeId);
                if (a.TargetProgramId.HasValue)
                    profileQuery = profileQuery.Where(sp => sp.ProgramId == a.TargetProgramId);

                var matchedUserIds = await profileQuery.Select(sp => sp.UserId).ToListAsync();
                scholars = scholars.Where(u => matchedUserIds.Contains(u.Id)).ToList();
            }

            return scholars.Select(u => new TargetedScholar(u.Id, u.Email!, u.FullName, u.EmailAnnouncements)).ToList();
        }

        // Runs after the HTTP response returns, so it must NOT use the request-scoped
        // emailService (its scope is disposed by then). Resolve a fresh one in a new scope.
        private async Task SendAnnouncementEmailsAsync(List<TargetedScholar> scholars, string title, string content)
        {
            using var scope = scopeFactory.CreateScope();
            var scopedEmail = scope.ServiceProvider.GetRequiredService<IEmailService>();

            foreach (var scholar in scholars)
            {
                try
                {
                    await scopedEmail.SendAnnouncementEmailAsync(scholar.Email, scholar.FullName, title, content);
                }
                catch { /* don't let one failed email abort the rest */ }
            }
        }

        private record TargetedScholar(string Id, string Email, string FullName, bool EmailOptIn);

        [HttpPut("{id}")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> Update(int id, AnnouncementRequest dto)
        {
            if (!string.IsNullOrWhiteSpace(dto.IntentAction) && !AnnouncementIntents.IsValid(dto.IntentAction))
                return BadRequest(new { message = $"Unknown intended action '{dto.IntentAction}'." });

            var announcement = await db.Announcements.FindAsync(id);
            if (announcement is null) return NotFound();

            announcement.Title = dto.Title;
            announcement.Content = dto.Content;
            announcement.TargetRole = string.IsNullOrEmpty(dto.TargetRole) ? null : dto.TargetRole;
            announcement.TargetCampusId = dto.TargetCampusId;
            announcement.TargetScholarshipTypeId = dto.TargetScholarshipTypeId;
            announcement.TargetProgramId = dto.TargetProgramId;
            announcement.ExpiresAt = dto.ExpiresAt;
            announcement.IntentAction = string.IsNullOrWhiteSpace(dto.IntentAction) ? null : dto.IntentAction;

            db.Audit(this, "UpdateAnnouncement", $"Updated announcement #{id} '{announcement.Title}'");
            await db.SaveChangesAsync();
            return NoContent();
        }

        // POST /api/announcements/{id}/image  — attach an image (admin/coord)
        [HttpPost("{id}/image")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> UploadImage(int id, IFormFile file)
        {
            var announcement = await db.Announcements.FindAsync(id);
            if (announcement is null) return NotFound();
            if (file is null || file.Length == 0)
                return BadRequest(new { message = "No image uploaded." });
            if (!ImageFileTypes.Extensions.Contains(System.IO.Path.GetExtension(file.FileName)))
                return BadRequest(new { message = "Image must be PNG, JPG, or WEBP." });

            try
            {
                var (stored, _) = await storage.SaveAsync(file);
                if (announcement.ImagePath is not null)
                    await storage.DeleteAsync(announcement.ImagePath);
                announcement.ImagePath = stored;
                await db.SaveChangesAsync();
                return Ok(new { hasImage = true });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET /api/announcements/{id}/image  — serve the image (any authenticated user)
        [HttpGet("{id}/image")]
        public async Task<IActionResult> GetImage(int id)
        {
            var announcement = await db.Announcements.FindAsync(id);
            if (announcement?.ImagePath is null) return NotFound();
            try
            {
                var (stream, contentType) = await storage.GetAsync(announcement.ImagePath, ImageFileTypes.ContentTypeFor(announcement.ImagePath));
                Response.Headers["X-Content-Type-Options"] = "nosniff";
                return File(stream, contentType, enableRangeProcessing: true);
            }
            catch (FileNotFoundException) { return NotFound(); }
        }

        // DELETE /api/announcements/{id}/image
        [HttpDelete("{id}/image")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> DeleteImage(int id)
        {
            var announcement = await db.Announcements.FindAsync(id);
            if (announcement is null) return NotFound();
            if (announcement.ImagePath is not null)
            {
                await storage.DeleteAsync(announcement.ImagePath);
                announcement.ImagePath = null;
                await db.SaveChangesAsync();
            }
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Delete(int id)
        {
            var announcement = await db.Announcements.FindAsync(id);
            if (announcement is null) return NotFound();

            announcement.IsActive = false;
            db.Audit(this, "DeleteAnnouncement", $"Deleted announcement #{id} '{announcement.Title}'");
            await db.SaveChangesAsync();
            return NoContent();
        }
    }

    public record AnnouncementRequest(
        string Title,
        string Content,
        string? TargetRole,
        int? TargetCampusId,
        int? TargetScholarshipTypeId,
        int? TargetProgramId,
        DateTime? ExpiresAt,
        string? IntentAction);
}
