using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// Works out who an announcement reaches and delivers it over both channels.
    /// Shared by the controller (publish now) and <see cref="AnnouncementPublisherService"/>
    /// (publish when a scheduled announcement falls due) so the two can never drift.
    /// </summary>
    public interface IAnnouncementDelivery
    {
        /// <summary>
        /// Sends the in-app notifications, stamps <see cref="Announcement.PublishedAt"/>, and
        /// emails the scholars who opted in. Doing nothing and returning 0 when the
        /// announcement has already been published makes this safe to call twice.
        /// </summary>
        /// <param name="awaitEmails">
        /// False from a request thread: emails are queued to run after the response returns.
        /// True from the background publisher, which has all the time it needs.
        /// </param>
        Task<int> PublishAsync(Announcement announcement, bool awaitEmails = false);
    }

    public class AnnouncementDelivery(
        ApplicationDbContext db,
        INotificationService notifications,
        IServiceScopeFactory scopeFactory,
        ILogger<AnnouncementDelivery> logger) : IAnnouncementDelivery
    {
        private record TargetedScholar(string Id, string Email, string FullName, bool EmailOptIn);

        public async Task<int> PublishAsync(Announcement announcement, bool awaitEmails = false)
        {
            if (announcement.PublishedAt is not null) return 0;

            // The named audience decides delivery, so make sure it is loaded.
            if (!db.Entry(announcement).Collection(a => a.Recipients).IsLoaded)
                await db.Entry(announcement).Collection(a => a.Recipients).LoadAsync();

            var scholars = await ResolveAudienceAsync(announcement);

            announcement.PublishedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();

            if (scholars.Count == 0) return 0;

            var preview = announcement.Content.Length > 200
                ? announcement.Content[..200] + "…"
                : announcement.Content;

            // Awaited so the notification rows are committed before we return.
            await notifications.CreateForManyAsync(
                scholars.Select(s => s.Id),
                announcement.Title,
                preview,
                NotificationCategories.Announcement,
                "/dashboard");

            var emailTargets = scholars.Where(s => s.EmailOptIn).ToList();
            var emails = SendEmailsAsync(emailTargets, announcement.Title, announcement.Content);
            if (awaitEmails) await emails;

            return scholars.Count;
        }

        // The named recipients when there are any, otherwise everyone matching the
        // role/scholarship-type/program filters.
        private async Task<List<TargetedScholar>> ResolveAudienceAsync(Announcement a)
        {
            if (a.Recipients.Count > 0)
            {
                var namedIds = a.Recipients.Select(r => r.ScholarId).ToList();
                return await db.Users
                    .Where(u => namedIds.Contains(u.Id) && u.IsActive && u.Email != null)
                    .Select(u => new TargetedScholar(u.Id, u.Email!, u.FirstName + " " + u.LastName, u.EmailAnnouncements))
                    .ToListAsync();
            }

            // If the announcement targets a non-scholar role, there are no scholars to reach.
            if (!string.IsNullOrEmpty(a.TargetRole) && a.TargetRole != UserRoles.Scholar)
                return [];

            var scholars = await db.Users
                .Join(db.UserRoles, u => u.Id, ur => ur.UserId, (u, ur) => new { u, ur })
                .Join(db.Roles, x => x.ur.RoleId, r => r.Id, (x, r) => new { x.u, RoleName = r.Name })
                .Where(x => x.RoleName == UserRoles.Scholar && x.u.IsActive && x.u.Email != null)
                .Select(x => x.u)
                .ToListAsync();

            if (a.TargetScholarshipTypeId.HasValue || a.TargetProgramId.HasValue)
            {
                var profileQuery = db.ScholarProfiles.AsQueryable();
                if (a.TargetScholarshipTypeId.HasValue)
                    profileQuery = profileQuery.Where(sp => sp.ScholarshipTypeId == a.TargetScholarshipTypeId);
                if (a.TargetProgramId.HasValue)
                    profileQuery = profileQuery.Where(sp => sp.ProgramId == a.TargetProgramId);

                var matchedUserIds = await profileQuery.Select(sp => sp.UserId).ToListAsync();
                scholars = scholars.Where(u => matchedUserIds.Contains(u.Id)).ToList();
            }

            return scholars.Select(u => new TargetedScholar(u.Id, u.Email!, u.FullName, u.EmailAnnouncements)).ToList();
        }

        // May run after the HTTP response returns, so it must NOT use a request-scoped
        // IEmailService (its scope is disposed by then). Resolve a fresh one in a new scope.
        private async Task SendEmailsAsync(List<TargetedScholar> scholars, string title, string content)
        {
            if (scholars.Count == 0) return;

            using var scope = scopeFactory.CreateScope();
            var email = scope.ServiceProvider.GetRequiredService<IEmailService>();

            foreach (var scholar in scholars)
            {
                try
                {
                    await email.SendAnnouncementEmailAsync(scholar.Email, scholar.FullName, title, content);
                }
                catch (Exception ex)
                {
                    // Don't let one failed address abort the rest of the batch.
                    logger.LogWarning(ex, "Announcement email to {Email} failed.", scholar.Email);
                }
            }
        }
    }
}
