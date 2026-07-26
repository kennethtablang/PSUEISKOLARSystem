using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    // Single-row inbox configuration: the automatic acknowledgement scholars get when they
    // open a conversation.
    [ApiController]
    [Route("api/messaging-settings")]
    [Authorize]
    public class MessagingSettingsController(ApplicationDbContext db) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var settings = await MessagingSettingsStore.GetAsync(db);
            return Ok(new
            {
                settings.AutoReplyEnabled,
                settings.AutoReplyMessage,
                settings.UpdatedAt,
                UpdatedByName = await db.Users
                    .Where(u => u.Id == settings.UpdatedById)
                    .Select(u => u.FirstName + " " + u.LastName)
                    .FirstOrDefaultAsync(),
            });
        }

        [HttpPut]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Update(MessagingSettingsRequest dto)
        {
            var text = dto.AutoReplyMessage?.Trim() ?? "";

            if (dto.AutoReplyEnabled)
            {
                if (text.Length < 10)
                    return BadRequest(new { message = "The auto-reply message needs at least 10 characters." });
                if (text.Length > 1000)
                    return BadRequest(new { message = "The auto-reply message must be 1000 characters or fewer." });
            }

            var settings = await db.MessagingSettings.FirstOrDefaultAsync();
            if (settings is null)
            {
                settings = new MessagingSettings();
                db.MessagingSettings.Add(settings);
            }

            settings.AutoReplyEnabled = dto.AutoReplyEnabled;
            if (text.Length >= 10) settings.AutoReplyMessage = text;
            settings.UpdatedAt = DateTime.UtcNow;
            settings.UpdatedById = User.FindFirstValue(ClaimTypes.NameIdentifier);

            db.Audit(this, "UpdateMessagingSettings",
                $"Message auto-reply turned {(settings.AutoReplyEnabled ? "on" : "off")}");
            await db.SaveChangesAsync();

            return Ok(new { settings.AutoReplyEnabled, settings.AutoReplyMessage, settings.UpdatedAt });
        }
    }

    public record MessagingSettingsRequest(bool AutoReplyEnabled, string? AutoReplyMessage);
}
