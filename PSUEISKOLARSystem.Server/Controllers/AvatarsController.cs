using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Controllers
{
    /// <summary>
    /// Profile photos. Separate from UsersController because that one is admin-only at the
    /// class level, while every signed-in user may manage their own photo and read others'
    /// (avatars appear in the scholar list, message threads, and the review queue).
    /// </summary>
    [ApiController]
    [Route("api/avatars")]
    [Authorize]
    public class AvatarsController(ApplicationDbContext db, IFileStorageService storage) : ControllerBase
    {
        // Photos are displayed at 96px at most, so anything past a couple of megabytes is
        // a phone camera dump rather than an avatar.
        private const long MaxAvatarBytes = 4 * 1024 * 1024;

        // GET /api/avatars/{userId} — any signed-in user; avatars are shown across the app.
        [HttpGet("{userId}")]
        public async Task<IActionResult> Get(string userId)
        {
            var path = await db.Users
                .Where(u => u.Id == userId)
                .Select(u => u.AvatarPath)
                .FirstOrDefaultAsync();
            if (path is null) return NotFound();

            try
            {
                var (stream, contentType) = await storage.GetAsync(path, ImageFileTypes.ContentTypeFor(path));
                Response.Headers["X-Content-Type-Options"] = "nosniff";
                Response.Headers.CacheControl = "private, max-age=300";
                return File(stream, contentType, enableRangeProcessing: true);
            }
            catch (FileNotFoundException)
            {
                return NotFound();
            }
        }

        // POST /api/avatars/me — replace your own photo.
        [HttpPost("me")]
        public Task<IActionResult> UploadMine(IFormFile file) => SaveAvatarAsync(CurrentUserId, file);

        // DELETE /api/avatars/me
        [HttpDelete("me")]
        public Task<IActionResult> DeleteMine() => RemoveAvatarAsync(CurrentUserId);

        // POST /api/avatars/{userId} — staff can set a scholar's photo from their profile page.
        [HttpPost("{userId}")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public Task<IActionResult> Upload(string userId, IFormFile file) => SaveAvatarAsync(userId, file);

        // DELETE /api/avatars/{userId}
        [HttpDelete("{userId}")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public Task<IActionResult> Delete(string userId) => RemoveAvatarAsync(userId);

        private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        private async Task<IActionResult> SaveAvatarAsync(string userId, IFormFile file)
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user is null) return NotFound(new { message = "User not found." });

            if (file is null || file.Length == 0)
                return BadRequest(new { message = "No image uploaded." });
            if (!ImageFileTypes.Extensions.Contains(Path.GetExtension(file.FileName)))
                return BadRequest(new { message = "Profile photo must be a PNG, JPG, or WEBP image." });
            if (file.Length > MaxAvatarBytes)
                return BadRequest(new { message = "Profile photo must be 4 MB or smaller." });

            try
            {
                var (stored, _) = await storage.SaveAsync(file);
                var previous = user.AvatarPath;
                user.AvatarPath = stored;
                await db.SaveChangesAsync();

                // Only after the new path is committed, so a failed delete can't orphan the user.
                if (previous is not null) await storage.DeleteAsync(previous);

                return Ok(new { hasAvatar = true });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        private async Task<IActionResult> RemoveAvatarAsync(string userId)
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user is null) return NotFound(new { message = "User not found." });

            if (user.AvatarPath is not null)
            {
                var path = user.AvatarPath;
                user.AvatarPath = null;
                await db.SaveChangesAsync();
                await storage.DeleteAsync(path);
            }

            return NoContent();
        }
    }
}
