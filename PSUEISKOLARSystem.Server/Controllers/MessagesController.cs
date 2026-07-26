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
        IHubContext<NotificationHub> hub,
        IServiceScopeFactory scopeFactory) : ControllerBase
    {
        private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        private bool IsStaff => User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

        // GET /api/messages/threads[?scholarId=]
        [HttpGet("threads")]
        public async Task<IActionResult> Threads([FromQuery] string? scholarId)
        {
            var baseQuery = db.Messages.AsQueryable();

            if (!IsStaff)
                baseQuery = baseQuery.Where(m => m.ScholarId == UserId);   // scholars see only their own
            else if (!string.IsNullOrEmpty(scholarId))
                baseQuery = baseQuery.Where(m => m.ScholarId == scholarId);

            // Aggregate per thread in SQL — last-message time + unread counts — instead of
            // pulling every message into memory.
            var grouped = await baseQuery
                .GroupBy(m => new { m.ScholarId, m.RequirementId })
                .Select(g => new
                {
                    g.Key.ScholarId,
                    g.Key.RequirementId,
                    LastAt = g.Max(m => m.CreatedAt),
                    UnreadStaff = g.Count(x => !x.ReadByStaff),
                    UnreadScholar = g.Count(x => !x.ReadByScholar),
                })
                .ToListAsync();

            if (grouped.Count == 0) return Ok(Array.Empty<object>());

            // Fetch only the last message of each thread (not the whole history).
            var lastAts = grouped.Select(g => g.LastAt).Distinct().ToList();
            var lastMsgs = await baseQuery
                .Where(m => lastAts.Contains(m.CreatedAt))
                .Include(m => m.Scholar)
                .Include(m => m.Requirement)
                .ToListAsync();

            var lastByKey = lastMsgs
                .GroupBy(m => new { m.ScholarId, m.RequirementId })
                .ToDictionary(g => (g.Key.ScholarId, g.Key.RequirementId),
                              g => g.OrderByDescending(m => m.CreatedAt).First());

            var threads = grouped
                .OrderByDescending(g => g.LastAt)
                .Select(g =>
                {
                    lastByKey.TryGetValue((g.ScholarId, g.RequirementId), out var last);
                    return new
                    {
                        g.ScholarId,
                        ScholarName = last?.Scholar.FullName,
                        g.RequirementId,
                        RequirementName = last?.Requirement != null ? last.Requirement.Name : null,
                        LastBody = last?.Body,
                        LastAt = g.LastAt,
                        LastSenderId = last?.SenderId,
                        Unread = IsStaff ? g.UnreadStaff : g.UnreadScholar,
                    };
                })
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
                // An automatic acknowledgement is attributed to the office, not to the admin
                // account that happens to own the FK.
                SenderName = m.IsAutoReply ? "Scholarship Office" : m.Sender.FullName,
                Mine = !m.IsAutoReply && m.SenderId == UserId,
                m.IsAutoReply,
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

            // "First message in this thread" has to be decided before the new one is stored.
            var isFirstInThread = !await db.Messages
                .AnyAsync(m => m.ScholarId == scholarId && m.RequirementId == dto.RequirementId);

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

            // Acknowledge a scholar opening a conversation, once per thread.
            var autoReply = !IsStaff && isFirstInThread
                ? await TryPostAutoReplyAsync(scholarId, dto.RequirementId)
                : null;

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
                // The client appends this straight after the scholar's own message.
                AutoReply = autoReply,
            });
        }

        /// <summary>
        /// Posts the configured acknowledgement into a thread a scholar has just opened.
        /// Returns the message shape the client should append, or null when auto-reply is off
        /// or no account exists to attribute it to.
        /// </summary>
        private async Task<object?> TryPostAutoReplyAsync(string scholarId, int? requirementId)
        {
            var settings = await MessagingSettingsStore.GetAsync(db);
            if (!settings.AutoReplyEnabled || string.IsNullOrWhiteSpace(settings.AutoReplyMessage))
                return null;

            // Message.SenderId is a required FK, so the acknowledgement is attributed to the
            // admin who configured it (falling back to any active administrator). The scholar
            // sees "Scholarship Office"; the row keeps a real author for auditing.
            var senderId = settings.UpdatedById;
            if (senderId is null || !await db.Users.AnyAsync(u => u.Id == senderId && u.IsActive))
            {
                var adminRoleId = await db.Roles
                    .Where(r => r.Name == UserRoles.Administrator)
                    .Select(r => r.Id)
                    .FirstOrDefaultAsync();

                senderId = await db.Users
                    .Where(u => u.IsActive && db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == adminRoleId))
                    .OrderBy(u => u.CreatedAt)
                    .Select(u => u.Id)
                    .FirstOrDefaultAsync();
            }

            if (string.IsNullOrEmpty(senderId)) return null;   // nobody to attribute it to

            var reply = new Message
            {
                ScholarId = scholarId,
                RequirementId = requirementId,
                SenderId = senderId,
                Body = settings.AutoReplyMessage.Trim(),
                IsAutoReply = true,
                ReadByScholar = false,   // the scholar should see it land
                ReadByStaff = true,      // no human action needed
            };

            db.Messages.Add(reply);
            await db.SaveChangesAsync();

            return new
            {
                reply.Id,
                reply.SenderId,
                SenderName = "Scholarship Office",
                Mine = false,
                IsAutoReply = true,
                reply.Body,
                reply.CreatedAt,
            };
        }

        // GET /api/messages/unread-count
        [HttpGet("unread-count")]
        public async Task<IActionResult> UnreadCount()
        {
            // Automatic acknowledgements never count as something a human must read.
            int count = IsStaff
                ? await db.Messages.CountAsync(m => !m.ReadByStaff && !m.IsAutoReply && m.SenderId != UserId)
                : await db.Messages.CountAsync(m => m.ScholarId == UserId && !m.ReadByScholar && m.SenderId != UserId);
            return Ok(new { count });
        }

        // Runs after the response returns — use a fresh scope, not the request-scoped emailService.
        private async Task SendMessageEmailSafeAsync(string email, string name, string senderName, string preview)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var scopedEmail = scope.ServiceProvider.GetRequiredService<IEmailService>();
                await scopedEmail.SendMessageEmailAsync(email, name, senderName, preview);
            }
            catch { /* fire-and-forget */ }
        }

        public record SendMessageRequest(string? ScholarId, int? RequirementId, string Body);
    }
}
