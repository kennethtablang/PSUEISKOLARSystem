using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Services
{
    // Periodically sends a one-time "due soon" reminder for each deadline entering the
    // reminder window, to applicable scholars who have not yet submitted (FR-16.4).
    public class DeadlineReminderService(IServiceProvider services, ILogger<DeadlineReminderService> logger)
        : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromHours(6);
        private static readonly TimeSpan Window = TimeSpan.FromDays(3);

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Let the app finish starting before the first pass.
            try { await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken); }
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
                    logger.LogError(ex, "Deadline reminder pass failed.");
                }

                try { await Task.Delay(Interval, stoppingToken); }
                catch (OperationCanceledException) { break; }
            }
        }

        private async Task RunOnceAsync(CancellationToken ct)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

            var now = DateTime.UtcNow;
            var windowEnd = now + Window;

            var dueSoon = await db.SubmissionDeadlines
                .Include(d => d.Requirement)
                .Where(d => d.RemindersSentAt == null && d.DueDate > now && d.DueDate <= windowEnd)
                .ToListAsync(ct);

            foreach (var d in dueSoon)
            {
                var applicable = await DeadlineHelper.GetApplicableScholarsAsync(db, d.RequirementId);

                var submittedIds = (await db.DocumentSubmissions
                    .Where(s => s.RequirementId == d.RequirementId &&
                                s.AcademicYear == d.AcademicYear &&
                                s.Semester == d.Semester)
                    .Select(s => s.ScholarId)
                    .ToListAsync(ct))
                    .ToHashSet();

                var targetIds = applicable
                    .Where(a => !submittedIds.Contains(a.Id))
                    .Select(a => a.Id);

                await notifications.CreateForManyAsync(
                    targetIds,
                    $"Deadline approaching: {d.Requirement.Name}",
                    $"Your \"{d.Requirement.Name}\" is due {d.DueDate:MMM d, yyyy}. Please submit before the deadline.",
                    NotificationCategories.Deadline,
                    "/my-documents");

                d.RemindersSentAt = now;
            }

            if (dueSoon.Count > 0)
            {
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Sent reminders for {Count} deadline(s).", dueSoon.Count);
            }
        }
    }
}
