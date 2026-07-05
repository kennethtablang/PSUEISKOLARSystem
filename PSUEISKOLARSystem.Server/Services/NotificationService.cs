using Microsoft.AspNetCore.SignalR;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Hubs;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Services
{
    public class NotificationService(ApplicationDbContext db, IHubContext<NotificationHub> hub) : INotificationService
    {
        public async Task CreateAsync(string recipientId, string title, string message, string category, string? linkUrl = null)
        {
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
            var notifications = recipientIds
                .Distinct()
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
