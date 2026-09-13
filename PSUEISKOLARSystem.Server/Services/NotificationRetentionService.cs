using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// Deletes read notifications older than the retention period set in System Settings.
    /// <para>
    /// Notifications accumulate faster than anything else here — every review, message,
    /// announcement, and release writes one per recipient — and a scholar who has read
    /// something from two years ago is never going to read it again. Unread notifications are
    /// never touched, however old: those still represent something the user has not seen.
    /// </para>
    /// A retention of 0 means "keep everything", and the sweep does nothing.
    /// </summary>
    public class NotificationRetentionService(IServiceProvider services, ILogger<NotificationRetentionService> logger)
        : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Let the app finish starting, and don't compete with the other background passes.
            try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); }
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
                    logger.LogError(ex, "Notification retention sweep failed.");
                }

                try { await Task.Delay(Interval, stoppingToken); }
                catch (OperationCanceledException) { break; }
            }
        }

        private async Task RunOnceAsync(CancellationToken ct)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var policy = await SystemSettingsStore.GetAsync(db);
            if (policy.NotificationRetentionDays <= 0) return;

            var cutoff = DateTime.UtcNow.AddDays(-policy.NotificationRetentionDays);

            var deleted = await db.Notifications
                .Where(n => n.IsRead && n.CreatedAt < cutoff)
                .ExecuteDeleteAsync(ct);

            if (deleted > 0)
                logger.LogInformation(
                    "Notification retention: removed {Count} read notification(s) older than {Days} days.",
                    deleted, policy.NotificationRetentionDays);
        }
    }
}
