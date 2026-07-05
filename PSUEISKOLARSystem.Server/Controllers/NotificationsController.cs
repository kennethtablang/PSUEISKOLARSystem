using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/notifications")]
    [Authorize]
    public class NotificationsController(ApplicationDbContext db) : ControllerBase
    {
        // GET /api/notifications?unreadOnly=&page=&pageSize=
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] bool unreadOnly = false,
            [FromQuery] string? category = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;

            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 20;

            var query = db.Notifications.Where(n => n.RecipientId == userId);
            if (unreadOnly)
                query = query.Where(n => !n.IsRead);
            if (!string.IsNullOrWhiteSpace(category))
                query = query.Where(n => n.Category == category);

            var total = await query.CountAsync();

            var items = await query
                .OrderByDescending(n => n.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(n => new
                {
                    n.Id,
                    n.Title,
                    n.Message,
                    n.Category,
                    n.LinkUrl,
                    n.IsRead,
                    n.CreatedAt,
                })
                .ToListAsync();

            return Ok(new
            {
                total,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(total / (double)pageSize),
                items,
            });
        }

        // GET /api/notifications/unread-count
        [HttpGet("unread-count")]
        public async Task<IActionResult> UnreadCount()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var count = await db.Notifications.CountAsync(n => n.RecipientId == userId && !n.IsRead);
            return Ok(new { count });
        }

        // PATCH /api/notifications/{id}/read
        [HttpPatch("{id}/read")]
        public async Task<IActionResult> MarkRead(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var notification = await db.Notifications
                .FirstOrDefaultAsync(n => n.Id == id && n.RecipientId == userId);
            if (notification is null) return NotFound();

            if (!notification.IsRead)
            {
                notification.IsRead = true;
                notification.ReadAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }

            return NoContent();
        }

        // PATCH /api/notifications/read-all
        [HttpPatch("read-all")]
        public async Task<IActionResult> MarkAllRead()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var now = DateTime.UtcNow;

            await db.Notifications
                .Where(n => n.RecipientId == userId && !n.IsRead)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(n => n.IsRead, true)
                    .SetProperty(n => n.ReadAt, now));

            return NoContent();
        }
    }
}
