using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// Walks each submission deadline through its notice sequence (FR-16.4): an early warning,
    /// a last call, and — if the date passes with nothing submitted — a notice to the scholar
    /// and a digest to the scholarship office.
    /// <para>
    /// The pass is idempotent by stage rather than by time: it records how far each deadline
    /// has got (<see cref="SubmissionDeadline.ReminderStage"/>) and only ever moves forward,
    /// so restarting the app, running the sweep twice in an hour, or changing
    /// <c>DeadlineReminderDays</c> mid-period cannot make a scholar receive the same notice
    /// twice.
    /// </para>
    /// </summary>
    public class DeadlineReminderService(IServiceProvider services, ILogger<DeadlineReminderService> logger)
        : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromHours(6);

        /// <summary>
        /// How close to the due date the last-call notice goes out. Fixed rather than
        /// configurable: the early warning's timing is the institutional choice
        /// (<c>DeadlineReminderDays</c>), and "the day before" is what a last call means.
        /// If the configured window is a day or less the two collapse into one notice — the
        /// stage sequence handles that without sending twice.
        /// </summary>
        public static readonly TimeSpan FinalNoticeWindow = TimeSpan.FromDays(1);

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

        /// <summary>
        /// Which notice a deadline is owed at <paramref name="now"/>, ignoring what has already
        /// been sent. The caller compares it against the recorded stage, so a deadline never
        /// moves backwards and never repeats a notice it has already sent.
        /// </summary>
        public static DeadlineReminderStage StageDueFor(DateTime dueDate, DateTime now) =>
            dueDate <= now ? DeadlineReminderStage.Missed
            : dueDate <= now + FinalNoticeWindow ? DeadlineReminderStage.Final
            : DeadlineReminderStage.Approaching;

        private async Task RunOnceAsync(CancellationToken ct)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

            // How far ahead the early warning goes out is an institutional choice, so it is
            // read per pass rather than compiled in — a change takes effect on the next sweep.
            var policy = await SystemSettingsStore.GetAsync(db);
            var now = DateTime.UtcNow;
            var windowEnd = now + TimeSpan.FromDays(policy.DeadlineReminderDays);

            /* Everything with a notice still owing. Overdue deadlines satisfy DueDate <= now,
               which is inside the window too, so this one predicate picks up all three stages
               and the branch below decides which is due. */
            var due = await db.SubmissionDeadlines
                .Include(d => d.Requirement)
                .Where(d => d.ReminderStage < DeadlineReminderStage.Missed && d.DueDate <= windowEnd)
                .ToListAsync(ct);

            var sent = 0;

            foreach (var d in due)
            {
                if (ct.IsCancellationRequested) break;

                var stage = StageDueFor(d.DueDate, now);

                // A deadline first seen close to its date skips straight to the stage that is
                // actually due; one that has already had this notice is left alone.
                if (stage <= d.ReminderStage) continue;

                var targetIds = await NonSubmittersAsync(db, d, ct);

                if (targetIds.Count > 0)
                {
                    var (title, body) = Wording(stage, d);
                    await notifications.CreateForManyAsync(
                        targetIds, title, body, NotificationCategories.Deadline, "/my-documents");

                    await EmailRemindersAsync(scope, db, targetIds, d, stage, ct);
                }

                if (stage == DeadlineReminderStage.Missed)
                    await NotifyOfficeAsync(db, notifications, d, targetIds.Count, ct);

                d.ReminderStage = stage;
                d.RemindersSentAt = now;
                sent++;
            }

            if (sent > 0)
            {
                await db.SaveChangesAsync(ct);
                logger.LogInformation("Advanced the notice stage for {Count} deadline(s).", sent);
            }
        }

        /// <summary>Applicable scholars who have not filed anything for this requirement and period.</summary>
        private static async Task<List<string>> NonSubmittersAsync(
            ApplicationDbContext db, SubmissionDeadline d, CancellationToken ct)
        {
            var applicable = await DeadlineHelper.GetApplicableScholarsAsync(db, d.RequirementId);

            var submittedIds = (await db.DocumentSubmissions
                .Where(s => s.RequirementId == d.RequirementId &&
                            s.AcademicYear == d.AcademicYear &&
                            s.Semester == d.Semester)
                .Select(s => s.ScholarId)
                .ToListAsync(ct))
                .ToHashSet();

            return applicable
                .Where(a => !submittedIds.Contains(a.Id))
                .Select(a => a.Id)
                .ToList();
        }

        private static (string Title, string Body) Wording(DeadlineReminderStage stage, SubmissionDeadline d)
        {
            var name = d.Requirement.Name;
            return stage switch
            {
                DeadlineReminderStage.Missed => (
                    $"Deadline missed: {name}",
                    $"The deadline for your \"{name}\" passed on {d.DueDate:MMM d, yyyy} and nothing " +
                    "has been submitted. Message your scholarship coordinator to arrange a late submission."),

                DeadlineReminderStage.Final => (
                    $"Due tomorrow: {name}",
                    $"Your \"{name}\" is due {d.DueDate:MMM d, yyyy}. This is the last reminder before " +
                    "the deadline — please submit today."),

                _ => (
                    $"Deadline approaching: {name}",
                    $"Your \"{name}\" is due {d.DueDate:MMM d, yyyy}. Please submit before the deadline."),
            };
        }

        /// <summary>
        /// Tells the scholarship office who is non-compliant for the period, once per deadline.
        /// Without it, a missed deadline was visible only to whoever thought to filter the
        /// review page for it.
        /// </summary>
        private static async Task NotifyOfficeAsync(
            ApplicationDbContext db, INotificationService notifications,
            SubmissionDeadline d, int missingCount, CancellationToken ct)
        {
            var staffIds = await (
                from u in db.Users
                join ur in db.UserRoles on u.Id equals ur.UserId
                join r in db.Roles on ur.RoleId equals r.Id
                where u.IsActive
                   && (r.Name == UserRoles.Administrator || r.Name == UserRoles.ScholarshipCoordinator)
                select u.Id)
                .Distinct()
                .ToListAsync(ct);

            if (staffIds.Count == 0) return;

            await notifications.CreateForManyAsync(
                staffIds,
                $"Deadline passed: {d.Requirement.Name}",
                missingCount == 0
                    ? $"The {d.DueDate:MMM d, yyyy} deadline for \"{d.Requirement.Name}\" " +
                      $"({d.AcademicYear} Sem {d.Semester}) has passed. Everyone submitted."
                    : $"{missingCount} scholar{(missingCount == 1 ? "" : "s")} did not submit " +
                      $"\"{d.Requirement.Name}\" for {d.AcademicYear} Sem {d.Semester} by " +
                      $"{d.DueDate:MMM d, yyyy}.",
                NotificationCategories.Deadline,
                "/document-review");
        }

        /// <summary>
        /// Emails the scholars who asked to hear about deadlines by mail.
        /// <para>
        /// <c>EmailDeadlines</c> was written, migrated, and exposed on My Profile, and no code
        /// path read it — a scholar could turn the toggle on and never receive anything. Its
        /// siblings are honoured at <c>DocumentsController</c> (EmailDocumentStatus) and
        /// <c>AnnouncementDelivery</c> (EmailAnnouncements); this is the third.
        /// </para>
        /// Awaited rather than fire-and-forget: this is a background pass with nobody waiting
        /// on a response, and a failed send should be logged rather than lost.
        /// </summary>
        private async Task EmailRemindersAsync(
            IServiceScope scope, ApplicationDbContext db, List<string> targetIds,
            SubmissionDeadline deadline, DeadlineReminderStage stage, CancellationToken ct)
        {
            if (targetIds.Count == 0) return;

            var recipients = await db.Users
                .Where(u => targetIds.Contains(u.Id) && u.EmailDeadlines && u.Email != null)
                .Select(u => new { u.Email, u.FirstName, u.MiddleName, u.LastName })
                .ToListAsync(ct);

            if (recipients.Count == 0) return;

            var email = scope.ServiceProvider.GetRequiredService<IEmailService>();

            // One connection for the whole sweep rather than one per scholar.
            await using var batch = await email.BeginBatchAsync();

            foreach (var r in recipients)
            {
                if (ct.IsCancellationRequested) return;
                try
                {
                    var name = r.MiddleName != null
                        ? $"{r.FirstName} {r.MiddleName} {r.LastName}"
                        : $"{r.FirstName} {r.LastName}";

                    await email.SendDeadlineReminderAsync(
                        r.Email!, name, deadline.Requirement.Name, deadline.DueDate,
                        deadline.AcademicYear, deadline.Semester,
                        overdue: stage == DeadlineReminderStage.Missed);
                }
                catch (Exception ex)
                {
                    // One bad address must not stop the rest of the batch.
                    logger.LogWarning(ex, "Deadline reminder email to {Email} failed.", r.Email);
                }
            }
        }
    }
}
