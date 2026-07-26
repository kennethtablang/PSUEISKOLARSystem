using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Hubs;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Services
{
    public class NotificationService(ApplicationDbContext db, IHubContext<NotificationHub> hub) : INotificationService
    {
        public async Task CreateAsync(string recipientId, string title, string message, string category, string? linkUrl = null)
        {
            if (await IsMutedAsync(recipientId, category)) return;

            var notification = new Notification
            {
                RecipientId = recipientId,
                Title = title,
                Message = message,
                Category = category,
                LinkUrl = linkUrl,
            };

            db.Notifications.Add(notification);
            await db.SaveChangesAsync();
            await PushAsync(notification);
        }

        public async Task CreateForManyAsync(IEnumerable<string> recipientIds, string title, string message, string category, string? linkUrl = null)
        {
            var ids = recipientIds.Distinct().ToList();
            if (ids.Count == 0) return;

            var notifications = (await FilterMutedAsync(ids, category))
                .Select(id => new Notification
                {
                    RecipientId = id,
                    Title = title,
                    Message = message,
                    Category = category,
                    LinkUrl = linkUrl,
                })
                .ToList();

            if (notifications.Count == 0) return;

            db.Notifications.AddRange(notifications);
            await db.SaveChangesAsync();

            foreach (var notification in notifications)
                await PushAsync(notification);
        }

        // Per-user in-app muting (FR-20 add-on). Only the categories in
        // NotificationMuting.Mutable can be silenced — account/security notices always land.

        private async Task<bool> IsMutedAsync(string recipientId, string category)
        {
            if (!NotificationMuting.Mutable.Contains(category)) return false;

            var token = NotificationMuting.Token(category);
            return await db.Users.AnyAsync(u =>
                u.Id == recipientId &&
                u.MutedNotificationCategories != null &&
                u.MutedNotificationCategories.Contains(token));
        }

        private async Task<List<string>> FilterMutedAsync(List<string> recipientIds, string category)
        {
            if (!NotificationMuting.Mutable.Contains(category)) return recipientIds;

            var token = NotificationMuting.Token(category);
            var muted = await db.Users
                .Where(u => recipientIds.Contains(u.Id) &&
                            u.MutedNotificationCategories != null &&
                            u.MutedNotificationCategories.Contains(token))
                .Select(u => u.Id)
                .ToListAsync();

            return muted.Count == 0
                ? recipientIds
                : recipientIds.Where(id => !muted.Contains(id)).ToList();
        }

        // Staff-scoped broadcast (e.g. "AnalyticsChanged"): only admins/coordinators
        // join the staff group on connect, so scholar clients aren't needlessly notified.
        public Task BroadcastAsync(string eventName) => hub.Clients.Group(NotificationHub.StaffGroup).SendAsync(eventName);

        private Task PushAsync(Notification n) =>
            hub.Clients.User(n.RecipientId).SendAsync("ReceiveNotification", new
            {
                n.Id,
                n.Title,
                n.Message,
                n.Category,
                n.LinkUrl,
                n.IsRead,
                n.CreatedAt,
            });
    }
}
