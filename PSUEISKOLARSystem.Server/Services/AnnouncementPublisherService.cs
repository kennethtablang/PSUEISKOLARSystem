using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// Releases scheduled announcements once their publish time has passed: the audience is
    /// hidden from until then, and the notifications/emails only go out here.
    /// Runs every minute so "publish at 8:00 AM" lands close enough to 8:00 AM.
    /// </summary>
    public class AnnouncementPublisherService(IServiceProvider services, ILogger<AnnouncementPublisherService> logger)
        : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try { await Task.Delay(TimeSpan.FromSeconds(25), stoppingToken); }
            catch (OperationCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunOnceAsync(stoppingToken);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Scheduled announcement pass failed.");
                }

                try { await Task.Delay(Interval, stoppingToken); }
                catch (OperationCanceledException) { break; }
            }
        }

        private async Task RunOnceAsync(CancellationToken ct)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var delivery = scope.ServiceProvider.GetRequiredService<IAnnouncementDelivery>();

            var now = DateTime.UtcNow;

            var due = await db.Announcements
                .Include(a => a.Recipients)
                .Where(a => a.IsActive &&
                            a.PublishedAt == null &&
                            a.PublishAt != null && a.PublishAt <= now &&
                            (a.ExpiresAt == null || a.ExpiresAt > now))
                .ToListAsync(ct);

            foreach (var announcement in due)
            {
                var reached = await delivery.PublishAsync(announcement, awaitEmails: true);
                logger.LogInformation(
                    "Published scheduled announcement #{Id} '{Title}' to {Count} scholar(s).",
                    announcement.Id, announcement.Title, reached);
            }
        }
    }
}
