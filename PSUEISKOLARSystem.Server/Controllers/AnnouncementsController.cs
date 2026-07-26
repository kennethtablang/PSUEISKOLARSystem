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
    public class AnnouncementsController(ApplicationDbContext db, IAnnouncementDelivery delivery, IFileStorageService storage) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var role = User.FindFirstValue(ClaimTypes.Role);

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
                .Include(a => a.TargetScholarshipType)
                .Include(a => a.TargetProgram)
                .Include(a => a.Recipients)
                    .ThenInclude(r => r.Scholar)
                .Where(a =>
                    a.IsActive &&
                    (a.ExpiresAt == null || a.ExpiresAt > now));

            if (!isManager)
            {
                // A scheduled announcement stays invisible to its audience until it is due —
                // managers still see it in the list, badged as Scheduled.
                query = query.Where(a => a.PublishAt == null || a.PublishAt <= now);

                // An announcement addressed to named scholars reaches exactly those scholars;
                // one with no named recipients falls back to the audience filters.
                query = query.Where(a =>
                    a.Recipients.Any()
                        ? a.Recipients.Any(r => r.ScholarId == userId)
                        : (a.TargetRole == null || a.TargetRole == role) &&
                          (a.TargetScholarshipTypeId == null || a.TargetScholarshipTypeId == scholarshipTypeId) &&
                          (a.TargetProgramId == null || a.TargetProgramId == programId));
            }

            var announcements = await query
                // Sort by when the announcement actually reaches people, so a scheduled post
                // sits at the top of the manager's list until it goes out.
                .OrderByDescending(a => a.PublishAt ?? a.CreatedAt)
                .ToListAsync();

            return Ok(announcements.Select(a => new
            {
                a.Id,
                a.Title,
                a.Content,
                a.TargetRole,
                TargetScholarshipType = a.TargetScholarshipType?.Name,
                TargetProgram = a.TargetProgram?.Name,
                a.ExpiresAt,
                a.PublishAt,
                a.IsScheduled,
                a.IntentAction,
                HasImage = a.ImagePath != null,
                a.CreatedAt,
                // Managers get the named audience back so the editor can prefill it.
                RecipientIds = isManager ? a.Recipients.Select(r => r.ScholarId).ToList() : [],
                RecipientNames = isManager
                    ? a.Recipients.Select(r => r.Scholar.FullName).OrderBy(n => n).ToList()
                    : [],
                RecipientCount = a.Recipients.Count,
                CreatedBy = a.CreatedBy.MiddleName != null
                    ? a.CreatedBy.FirstName + " " + a.CreatedBy.MiddleName + " " + a.CreatedBy.LastName
                    : a.CreatedBy.FirstName + " " + a.CreatedBy.LastName,
            }));
        }

        [HttpPost]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> Create(AnnouncementRequest dto)
        {
            var error = Validate(dto);
            if (error is not null) return BadRequest(new { message = error });

            var publishAt = NormalizePublishAt(dto.PublishAt);

            var announcement = new Announcement
            {
                Title = dto.Title,
                Content = dto.Content,
                TargetRole = string.IsNullOrEmpty(dto.TargetRole) ? null : dto.TargetRole,
                TargetScholarshipTypeId = dto.TargetScholarshipTypeId,
                TargetProgramId = dto.TargetProgramId,
                ExpiresAt = dto.ExpiresAt,
                PublishAt = publishAt,
                IntentAction = string.IsNullOrWhiteSpace(dto.IntentAction) ? null : dto.IntentAction,
                CreatedById = User.FindFirstValue(ClaimTypes.NameIdentifier)!,
            };

            db.Announcements.Add(announcement);
            await db.SaveChangesAsync();

            var namedCount = await SetRecipientsAsync(announcement.Id, dto.RecipientIds);

            db.Audit(this, "CreateAnnouncement",
                $"Created announcement '{announcement.Title}'" +
                (namedCount > 0 ? $" for {namedCount} named scholar(s)" : "") +
                (publishAt is not null ? $", scheduled for {publishAt:yyyy-MM-dd HH:mm} UTC" : ""));
            await db.SaveChangesAsync();

            // Scheduled posts are released by AnnouncementPublisherService when they fall due,
            // so nothing is notified or emailed here.
            if (publishAt is null)
                await delivery.PublishAsync(announcement);

            return Ok(new { announcement.Id, Scheduled = publishAt is not null });
        }

        // Treat a publish time that has already passed as "publish now" — the scheduler would
        // release it on its next pass anyway, and this way the poster gets immediate feedback.
        private static DateTime? NormalizePublishAt(DateTime? publishAt) =>
            publishAt is null || publishAt <= DateTime.UtcNow.AddMinutes(1) ? null : publishAt;

        private static string? Validate(AnnouncementRequest dto)
        {
            if (!string.IsNullOrWhiteSpace(dto.IntentAction) && !AnnouncementIntents.IsValid(dto.IntentAction))
                return $"Unknown intended action '{dto.IntentAction}'.";
            if (dto.PublishAt is not null && dto.ExpiresAt is not null && dto.ExpiresAt <= dto.PublishAt)
                return "The expiry date must come after the scheduled publish time.";
            return null;
        }

        /// <summary>
        /// Replaces an announcement's named recipients. Ids that are not active scholars are
        /// dropped rather than failing the whole save. Returns how many were stored.
        /// </summary>
        private async Task<int> SetRecipientsAsync(int announcementId, List<string>? recipientIds)
        {
            var existing = await db.AnnouncementRecipients
                .Where(r => r.AnnouncementId == announcementId)
                .ToListAsync();
            db.AnnouncementRecipients.RemoveRange(existing);

            var requested = (recipientIds ?? [])
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct()
                .ToList();

            if (requested.Count == 0)
            {
                await db.SaveChangesAsync();
                return 0;
            }

            var scholarRoleId = await db.Roles
                .Where(r => r.Name == UserRoles.Scholar)
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            var valid = await db.Users
                .Where(u => requested.Contains(u.Id) && u.IsActive &&
                            db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == scholarRoleId))
                .Select(u => u.Id)
                .ToListAsync();

            db.AnnouncementRecipients.AddRange(
                valid.Select(id => new AnnouncementRecipient { AnnouncementId = announcementId, ScholarId = id }));

            await db.SaveChangesAsync();
            return valid.Count;
        }

        [HttpPut("{id}")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> Update(int id, AnnouncementRequest dto)
        {
            var error = Validate(dto);
            if (error is not null) return BadRequest(new { message = error });

            var announcement = await db.Announcements.FindAsync(id);
            if (announcement is null) return NotFound();

            announcement.Title = dto.Title;
            announcement.Content = dto.Content;
            announcement.TargetRole = string.IsNullOrEmpty(dto.TargetRole) ? null : dto.TargetRole;
            announcement.TargetScholarshipTypeId = dto.TargetScholarshipTypeId;
            announcement.TargetProgramId = dto.TargetProgramId;
            announcement.ExpiresAt = dto.ExpiresAt;
            announcement.IntentAction = string.IsNullOrWhiteSpace(dto.IntentAction) ? null : dto.IntentAction;

            // Rescheduling only applies while the announcement is still unpublished; once it
            // has gone out, its publish time is history and the field is left alone.
            if (announcement.PublishedAt is null)
                announcement.PublishAt = NormalizePublishAt(dto.PublishAt);

            var namedCount = await SetRecipientsAsync(id, dto.RecipientIds);

            db.Audit(this, "UpdateAnnouncement",
                $"Updated announcement #{id} '{announcement.Title}'" +
                (namedCount > 0 ? $" — {namedCount} named scholar(s)" : ""));
            await db.SaveChangesAsync();
            return NoContent();
        }

        // POST /api/announcements/{id}/publish-now  — release a scheduled announcement early.
        [HttpPost("{id}/publish-now")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> PublishNow(int id)
        {
            var announcement = await db.Announcements
                .Include(a => a.Recipients)
                .FirstOrDefaultAsync(a => a.Id == id);
            if (announcement is null) return NotFound();
            if (announcement.PublishedAt is not null)
                return BadRequest(new { message = "This announcement has already been published." });

            announcement.PublishAt = null;
            var reached = await delivery.PublishAsync(announcement);

            db.Audit(this, "PublishAnnouncement",
                $"Published scheduled announcement #{id} '{announcement.Title}' early to {reached} scholar(s)");
            await db.SaveChangesAsync();

            return Ok(new { published = true, reached });
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
        int? TargetScholarshipTypeId,
        int? TargetProgramId,
        DateTime? ExpiresAt,
        // Null (or already past) publishes immediately; a future time schedules the release.
        DateTime? PublishAt,
        string? IntentAction,
        // Named scholars. Non-empty means these scholars only; the filters above are ignored.
        List<string>? RecipientIds);
}
