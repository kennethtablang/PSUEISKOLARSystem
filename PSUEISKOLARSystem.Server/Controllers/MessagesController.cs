using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Hubs;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    // Scholar <-> coordinator threaded messaging (FR-17).
    [ApiController]
    [Route("api/messages")]
    [Authorize]
    public class MessagesController(
        ApplicationDbContext db,
        INotificationService notifications,
        IEmailService emailService,
        IHubContext<NotificationHub> hub) : ControllerBase
    {
        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        private bool IsStaff => User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

        // GET /api/messages/threads[?scholarId=]
        [HttpGet("threads")]
        public async Task<IActionResult> Threads([FromQuery] string? scholarId)
        {
            var query = db.Messages
                .Include(m => m.Scholar)
                .Include(m => m.Requirement)
                .AsQueryable();

            if (!IsStaff)
                query = query.Where(m => m.ScholarId == UserId);          // scholars see only their own
            else if (!string.IsNullOrEmpty(scholarId))
                query = query.Where(m => m.ScholarId == scholarId);

            var all = await query.OrderByDescending(m => m.CreatedAt).ToListAsync();

            var threads = all
                .GroupBy(m => new { m.ScholarId, m.RequirementId })
                .Select(g =>
                {
                    var last = g.First(); // list is already newest-first
                    return new
                    {
                        last.ScholarId,
                        ScholarName = last.Scholar.FullName,
                        last.RequirementId,
                        RequirementName = last.Requirement != null ? last.Requirement.Name : null,
                        LastBody = last.Body,
                        LastAt = last.CreatedAt,
                        LastSenderId = last.SenderId,
                        Unread = g.Count(x => IsStaff ? !x.ReadByStaff : !x.ReadByScholar),
                    };
                })
                .OrderByDescending(t => t.LastAt)
                .ToList();

            return Ok(threads);
        }

        // GET /api/messages/thread?scholarId=&requirementId=
        [HttpGet("thread")]
        public async Task<IActionResult> Thread([FromQuery] string scholarId, [FromQuery] int? requirementId)
        {
            if (!IsStaff && scholarId != UserId) return Forbid();

            var messages = await db.Messages
                .Include(m => m.Sender)
                .Where(m => m.ScholarId == scholarId && m.RequirementId == requirementId)
                .OrderBy(m => m.CreatedAt)
                .ToListAsync();

            // Mark as read for the viewing side.
            bool changed = false;
            foreach (var m in messages)
            {
                if (IsStaff && !m.ReadByStaff) { m.ReadByStaff = true; changed = true; }
                else if (!IsStaff && !m.ReadByScholar) { m.ReadByScholar = true; changed = true; }
            }
            if (changed) await db.SaveChangesAsync();

            var result = messages.Select(m => new
            {
                m.Id,
                m.SenderId,
                SenderName = m.Sender.FullName,
                Mine = m.SenderId == UserId,
                m.Body,
                m.CreatedAt,
            });

            return Ok(result);
        }

        // POST /api/messages  { scholarId?, requirementId?, body }
        [HttpPost]
        public async Task<IActionResult> Send(SendMessageRequest dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Body))
                return BadRequest(new { message = "Message cannot be empty." });

            // Scholars always post to their own thread; staff post to the named scholar.
            string scholarId = IsStaff ? dto.ScholarId ?? "" : UserId;
            if (string.IsNullOrEmpty(scholarId))
                return BadRequest(new { message = "A scholar must be specified." });

            var scholar = await db.Users.FindAsync(scholarId);
            if (scholar is null) return BadRequest(new { message = "Scholar not found." });

            if (dto.RequirementId.HasValue &&
                !await db.DocumentRequirements.AnyAsync(r => r.Id == dto.RequirementId))
                return BadRequest(new { message = "Requirement not found." });

            var message = new Message
            {
                ScholarId = scholarId,
                RequirementId = dto.RequirementId,
                SenderId = UserId,
                Body = dto.Body.Trim(),
                ReadByScholar = !IsStaff, // sender has "read" their own message
                ReadByStaff = IsStaff,
            };
            db.Messages.Add(message);
            await db.SaveChangesAsync();

            var senderName = (await db.Users.FindAsync(UserId))?.FullName ?? "Someone";
            var preview = message.Body.Length > 140 ? message.Body[..140] + "…" : message.Body;

            // Recipients: scholar->staff notifies coordinators/admins; staff->scholar notifies the scholar.
            List<string> recipientIds = IsStaff
                ? [scholarId]
                : await db.Users
                    .Join(db.UserRoles, u => u.Id, ur => ur.UserId, (u, ur) => new { u, ur })
                    .Join(db.Roles, x => x.ur.RoleId, r => r.Id, (x, r) => new { x.u, RoleName = r.Name })
                    .Where(x => (x.RoleName == UserRoles.Administrator || x.RoleName == UserRoles.ScholarshipCoordinator)
                                && x.u.IsActive)
                    .Select(x => x.u.Id)
                    .Distinct()
                    .ToListAsync();

            recipientIds.Remove(UserId); // never notify yourself

            if (recipientIds.Count > 0)
            {
                await notifications.CreateForManyAsync(
                    recipientIds,
                    $"New message from {senderName}",
                    preview,
                    NotificationCategories.Message,
                    "/messages");

                // When a coordinator/admin messages a scholar, also email the scholar (FR add-on).
                if (IsStaff && scholar.Email is not null)
                    _ = SendMessageEmailSafeAsync(scholar.Email, scholar.FullName, senderName, preview);

                // Live thread append for anyone with the conversation open (FR-17.3).
                await hub.Clients.Users(recipientIds).SendAsync("ReceiveMessage", new
                {
                    ScholarId = scholarId,
                    message.RequirementId,
                    message.Id,
                    message.SenderId,
                    SenderName = senderName,
                    message.Body,
                    message.CreatedAt,
                });
            }

            return Ok(new
            {
                message.Id,
                message.SenderId,
                SenderName = senderName,
                Mine = true,
                message.Body,
                message.CreatedAt,
            });
        }

        // GET /api/messages/unread-count
        [HttpGet("unread-count")]
        public async Task<IActionResult> UnreadCount()
        {
            int count = IsStaff
                ? await db.Messages.CountAsync(m => !m.ReadByStaff && m.SenderId != UserId)
                : await db.Messages.CountAsync(m => m.ScholarId == UserId && !m.ReadByScholar && m.SenderId != UserId);
            return Ok(new { count });
        }

        private async Task SendMessageEmailSafeAsync(string email, string name, string senderName, string preview)
        {
            try { await emailService.SendMessageEmailAsync(email, name, senderName, preview); }
            catch { /* fire-and-forget */ }
        }

        public record SendMessageRequest(string? ScholarId, int? RequirementId, string Body);
    }
}
