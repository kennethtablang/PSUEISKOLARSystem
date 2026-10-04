using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// Releases one-time grants on the day the office scheduled them for
    /// (<see cref="GrantType.ScheduledDate"/>). Once that day arrives, every grant of the type
    /// still pending is marked released, dated to the scheduled day, and its recipient — grantee
    /// or scholar — is told, so their profile shows the grant as received without anyone having
    /// to release each one by hand.
    /// <para>
    /// Runs shortly after start-up (so a server that was off on release day catches up) and
    /// then every fifteen minutes; a calendar date needs nothing finer.
    /// </para>
    /// </summary>
    public class GrantReleaseService(IServiceProvider services, ILogger<GrantReleaseService> logger)
        : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

        /// <summary>Philippine Standard Time is UTC+8 all year (no daylight saving).</summary>
        private static readonly TimeSpan PhilippineOffset = TimeSpan.FromHours(8);

        /// <summary>Today's date in the Philippines, which is what "release day" means to the office.</summary>
        public static DateTime PhilippineToday() => DateTime.UtcNow.Add(PhilippineOffset).Date;

        /// <summary>Where a recipient sees their grants: grantees and scholars have different pages.</summary>
        public static string GrantsLink(bool isGrantee) => isGrantee ? "/my-grants" : "/my-profile";

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); }
            catch (OperationCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = services.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();
                    var released = await ReleaseDueAsync(db, notifications, stoppingToken);
                    if (released > 0)
                        logger.LogInformation("Released {Count} scheduled one-time grant(s).", released);
                    var closed = await CloseFinishedTypesAsync(db, notifications, stoppingToken);
                    if (closed > 0)
                        logger.LogInformation("Closed {Count} grant type(s) whose release date has passed.", closed);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Scheduled grant release pass failed.");
                }

                try { await Task.Delay(Interval, stoppingToken); }
                catch (OperationCanceledException) { break; }
            }
        }

        /// <summary>
        /// Marks every pending grant whose type's release day has arrived as released.
        /// Returns how many were released. Public so tests can drive a pass directly.
        /// </summary>
        public static async Task<int> ReleaseDueAsync(
            ApplicationDbContext db, INotificationService notifications, CancellationToken ct = default)
        {
            var today = PhilippineToday();

            var due = await db.OneTimeGrants
                .Include(g => g.GrantType)
                .Where(g => g.ReleaseStatus == GrantReleaseStatuses.Pending
                         && g.GrantType != null
                         && g.GrantType.ScheduledDate != null
                         && g.GrantType.ScheduledDate <= today)
                .ToListAsync(ct);
            if (due.Count == 0) return 0;

            var recipientIds = due.Select(g => g.ScholarId).Distinct().ToList();
            var granteeIds = (await db.GranteeProfiles
                .Where(gp => recipientIds.Contains(gp.UserId))
                .Select(gp => gp.UserId)
                .ToListAsync(ct)).ToHashSet();

            foreach (var grant in due)
            {
                var day = grant.GrantType!.ScheduledDate!.Value.Date;
                grant.ReleaseStatus = GrantReleaseStatuses.Released;
                // Midnight of the release day in Manila, stored as the UTC instant it is.
                grant.ReleasedAt = DateTime.SpecifyKind(day - PhilippineOffset, DateTimeKind.Utc);
                grant.Notes = string.IsNullOrWhiteSpace(grant.Notes)
                    ? "Released automatically on the scheduled release date."
                    : $"{grant.Notes}\nReleased automatically on the scheduled release date.";
            }

            db.AuditLogs.Add(new AuditLog
            {
                UserId = "(system)",
                Action = "AutoReleaseOneTimeGrants",
                Details = string.Join("; ", due
                    .GroupBy(g => g.GrantType!.Name)
                    .Select(g => $"{g.Count()} '{g.Key}' grant(s) released on schedule ({g.Sum(x => x.Amount):N2})")),
            });
            await db.SaveChangesAsync(ct);

            foreach (var grant in due)
            {
                await notifications.CreateAsync(
                    grant.ScholarId,
                    "One-time grant released",
                    $"'{grant.GrantType!.Name}' (PHP {grant.Amount:N2}) has been released as scheduled on " +
                    $"{grant.GrantType.ScheduledDate:MMMM d, yyyy}.",
                    NotificationCategories.Account,
                    GrantsLink(granteeIds.Contains(grant.ScholarId)));
            }

            return due.Count;
        }

        /// <summary>
        /// Once a grant type's release day is over, the grantees under it have received what
        /// they signed up for: the type is closed and every grantee account under it is
        /// deactivated, automatically. Returns how many types were closed.
        /// </summary>
        public static async Task<int> CloseFinishedTypesAsync(
            ApplicationDbContext db, INotificationService notifications, CancellationToken ct = default)
        {
            var today = PhilippineToday();
            var finished = await db.GrantTypes
                .Where(t => t.IsActive && t.AccountsClosedAt == null
                         && t.ScheduledDate != null && t.ScheduledDate < today)
                .ToListAsync(ct);

            foreach (var type in finished)
            {
                var (closed, _) = await CloseGranteeAccountsAsync(db, type.Id, ct);
                type.IsActive = false;
                type.DeactivatedAt = DateTime.UtcNow;
                type.AccountsClosedAt = DateTime.UtcNow;
                db.AuditLogs.Add(new AuditLog
                {
                    UserId = "(system)",
                    Action = "AutoCloseGrantType",
                    Details = $"'{type.Name}' was released on {type.ScheduledDate:MMM d, yyyy}; " +
                              $"the type and {closed} grantee account(s) under it were deactivated automatically",
                });
            }

            if (finished.Count > 0)
            {
                await db.SaveChangesAsync(ct);
                _ = notifications.BroadcastAsync("AnalyticsChanged");
            }
            return finished.Count;
        }

        /// <summary>
        /// Deactivates the grantee accounts that hold a grant of this type. A grantee who is still
        /// owed a pending grant under another, still-active type keeps their account. Scholars
        /// are never touched — their account belongs to their scholarship. The caller saves.
        /// </summary>
        public static async Task<(int Closed, int KeptOpen)> CloseGranteeAccountsAsync(
            ApplicationDbContext db, int grantTypeId, CancellationToken ct = default)
        {
            var granteeIds = await GranteeIdsAsync(db, grantTypeId, ct);

            var stillOwed = await db.OneTimeGrants
                .Where(g => granteeIds.Contains(g.ScholarId)
                         && g.GrantTypeId != grantTypeId
                         && g.ReleaseStatus == GrantReleaseStatuses.Pending
                         && (g.GrantType == null || g.GrantType.IsActive))
                .Select(g => g.ScholarId)
                .Distinct()
                .ToListAsync(ct);

            var toClose = granteeIds.Except(stillOwed).ToList();
            var users = await db.Users.Where(u => toClose.Contains(u.Id) && u.IsActive).ToListAsync(ct);
            foreach (var u in users)
            {
                u.IsActive = false;
                // Rotating the stamp ends any session the grantee still has open.
                u.SecurityStamp = Guid.NewGuid().ToString();
            }
            return (users.Count, stillOwed.Count);
        }

        /// <summary>Accounts with the Grantee role holding a grant of this type.</summary>
        public static async Task<List<string>> GranteeIdsAsync(ApplicationDbContext db, int grantTypeId, CancellationToken ct = default)
        {
            var granteeRoleId = await db.Roles.Where(r => r.Name == UserRoles.Grantee).Select(r => r.Id).FirstOrDefaultAsync(ct);
            return await db.OneTimeGrants
                .Where(g => g.GrantTypeId == grantTypeId && db.UserRoles.Any(ur => ur.UserId == g.ScholarId && ur.RoleId == granteeRoleId))
                .Select(g => g.ScholarId)
                .Distinct()
                .ToListAsync(ct);
        }
    }
}
