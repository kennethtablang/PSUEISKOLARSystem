using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.DTOs.Announcements;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Data
{
    /// <summary>
    /// Who may see which announcement, in one place.
    /// <para>
    /// The rule is not simple — named recipients override the audience filters, a scheduled
    /// post is invisible to its audience until it is due but visible to managers, and expiry
    /// applies to everyone — and it is needed by both the Announcements page and the dashboard.
    /// Two copies of it would drift, and the copy that drifted would either leak an
    /// announcement to the wrong scholar or hide one from the right scholar.
    /// </para>
    /// </summary>
    public static class AnnouncementFeed
    {
        /// <summary>
        /// The announcements <paramref name="userId"/> is entitled to see, newest first.
        /// </summary>
        public static async Task<List<AnnouncementDto>> LoadAsync(
            ApplicationDbContext db, string userId, string? role, CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;

            // Admins and coordinators see every active announcement so they can manage it;
            // scholars see only what is addressed to them.
            var isManager = role is UserRoles.Administrator or UserRoles.ScholarshipCoordinator;

            int? scholarshipTypeId = null;
            int? programId = null;

            if (!isManager)
            {
                var profile = await db.ScholarProfiles
                    .Where(sp => sp.UserId == userId)
                    .Select(sp => new { sp.ScholarshipTypeId, sp.ProgramId })
                    .FirstOrDefaultAsync(ct);
                scholarshipTypeId = profile?.ScholarshipTypeId;
                programId = profile?.ProgramId;
            }

            var query = db.Announcements
                .Include(a => a.CreatedBy)
                .Include(a => a.TargetScholarshipType)
                .Include(a => a.TargetProgram)
                .Include(a => a.Recipients)
                    .ThenInclude(r => r.Scholar)
                .Where(a =>
                    a.IsActive &&
                    (a.ExpiresAt == null || a.ExpiresAt > now));

            if (!isManager)
            {
                // A scheduled announcement stays invisible to its audience until it is due —
                // managers still see it in the list, badged as Scheduled.
                query = query.Where(a => a.PublishAt == null || a.PublishAt <= now);

                // An announcement addressed to named scholars reaches exactly those scholars;
                // one with no named recipients falls back to the audience filters.
                query = query.Where(a =>
                    a.Recipients.Any()
                        ? a.Recipients.Any(r => r.ScholarId == userId)
                        : (a.TargetRole == null || a.TargetRole == role) &&
                          (a.TargetScholarshipTypeId == null || a.TargetScholarshipTypeId == scholarshipTypeId) &&
                          (a.TargetProgramId == null || a.TargetProgramId == programId));
            }

            var announcements = await query
                // Sort by when the announcement actually reaches people, so a scheduled post
                // sits at the top of the manager's list until it goes out.
                .OrderByDescending(a => a.PublishAt ?? a.CreatedAt)
                .ToListAsync(ct);

            return announcements.Select(a => Project(a, isManager)).ToList();
        }

        private static AnnouncementDto Project(Announcement a, bool isManager) => new(
            a.Id,
            a.Title,
            a.Content,
            a.TargetRole,
            a.TargetScholarshipTypeId,
            a.TargetScholarshipType?.Name,
            a.TargetProgramId,
            a.TargetProgram?.Name,
            a.ExpiresAt,
            a.PublishAt,
            a.IsScheduled,
            a.IntentAction,
            HasImage: a.ImagePath != null,
            a.CreatedAt,
            // Managers get the named audience back so the editor can prefill it.
            RecipientIds: isManager ? a.Recipients.Select(r => r.ScholarId).ToList() : [],
            RecipientNames: isManager
                ? a.Recipients.Select(r => r.Scholar.FullName).OrderBy(n => n).ToList()
                : [],
            RecipientCount: a.Recipients.Count,
            CreatedBy: a.CreatedBy.FullName);
    }
}
