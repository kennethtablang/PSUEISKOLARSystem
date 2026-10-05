using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Dashboard;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// Assembles the dashboard for one user, server-side.
    /// <para>
    /// This replaces eleven client-issued round trips with one. Beyond the latency, it removes
    /// a class of bug the page could not avoid: with each card fetching independently, a slow
    /// or failing call left the screen half-rendered, and the scholar's compliance figures were
    /// computed in the browser by cross-referencing three separate responses — so a requirement
    /// list that arrived from a different moment than the submission list could disagree with
    /// itself.
    /// </para>
    /// </summary>
    public sealed class DashboardQueries(ApplicationDbContext db, AnalyticsQueries analytics)
    {
        public async Task<DashboardDto> ForScholarAsync(string userId, string role, CancellationToken ct = default)
        {
            var announcements = await AnnouncementFeed.LoadAsync(db, userId, role, ct);

            var profile = await db.ScholarProfiles
                .Where(sp => sp.UserId == userId)
                .Select(sp => new
                {
                    sp.Id,
                    sp.ScholarshipTypeId,
                    ScholarshipTypeName = sp.ScholarshipType != null ? sp.ScholarshipType.Name : null,
                    MinimumGwa = sp.ScholarshipType != null ? (decimal?)sp.ScholarshipType.MinimumGwa : null,
                })
                .FirstOrDefaultAsync(ct);

            var active = await db.ActiveSemesters.AsNoTracking().FirstOrDefaultAsync(ct);
            var academicYear = active?.AcademicYear ?? CurrentAcademicYear();
            var semester = active?.Semester ?? 1;

            var requirements = await ApplicableRequirementsAsync(profile?.ScholarshipTypeId, ct);
            var requirementIds = requirements.Select(r => r.Id).ToList();

            /* The active *semester*, not just the year. Filtering on the year alone let a document
               verified in Semester 1 count toward Semester 2, so the dashboard disagreed with the
               My Documents checklist (which is per semester) and could report more documents
               verified than are required. */
            var submissions = await db.DocumentSubmissions
                .Where(s => s.ScholarId == userId && s.AcademicYear == academicYear && s.Semester == semester)
                .Select(s => new { s.RequirementId, s.Status, s.SubmittedAt, s.ReviewedAt, s.FeedbackNote })
                .ToListAsync(ct);

            /* A requirement can legitimately hold more than one row for a period — an
               Incomplete one the scholar has since replaced sits alongside the new Pending one
               (that is exactly what the filtered unique index permits). The scholar's standing
               is whichever came last, so order it rather than trusting the order rows come back
               in. */
            var latestByRequirement = submissions
                .GroupBy(s => s.RequirementId)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(s => s.SubmittedAt).First().Status);

            DocumentStatus? LatestFor(int requirementId) =>
                latestByRequirement.TryGetValue(requirementId, out var s) ? s : null;

            var now = DateTime.UtcNow;
            var dueByRequirement = await db.SubmissionDeadlines
                .Where(d => d.AcademicYear == academicYear && d.Semester == semester && requirementIds.Contains(d.RequirementId))
                .ToDictionaryAsync(d => d.RequirementId, d => d.DueDate, ct);

            var documents = requirements.Select(r =>
            {
                var latest = submissions.Where(s => s.RequirementId == r.Id).OrderByDescending(s => s.SubmittedAt).FirstOrDefault();
                DateTime? due = dueByRequirement.TryGetValue(r.Id, out var d) ? d : null;
                return new DocumentTrackDto(
                    r.Id, r.Name, r.IsRequired,
                    latest?.Status.ToString(), latest?.SubmittedAt, latest?.ReviewedAt, latest?.FeedbackNote,
                    due,
                    Missed: latest is null && due is DateTime dd && dd < now);
            }).ToList();

            // Counted per requirement from its latest row, and only over what applies to this
            // scholar — raw row counts included superseded rows and documents outside the
            // checklist, so "verified" could exceed "required".
            var compliance = new ComplianceDto(
                TotalRequired: requirements.Count(r => r.IsRequired),
                VerifiedCount: requirements.Count(r => r.IsRequired && LatestFor(r.Id) == DocumentStatus.Verified),
                PendingCount: requirements.Count(r => LatestFor(r.Id) is DocumentStatus.Pending or DocumentStatus.UnderReview),
                IncompleteItems: requirements
                    .Where(r => latestByRequirement.TryGetValue(r.Id, out var status)
                                && status == DocumentStatus.Rejected)
                    .Select(r => r.Name)
                    .ToList(),
                ScholarshipTypeName: profile?.ScholarshipTypeName,
                AcademicYear: academicYear,
                Semester: semester,
                Documents: documents);

            // Still open: applicable to this scholar, not yet verified, and not yet due.
            var verified = latestByRequirement
                .Where(kv => kv.Value == DocumentStatus.Verified)
                .Select(kv => kv.Key)
                .ToHashSet();

            var deadlines = await db.SubmissionDeadlines
                .Where(d => d.AcademicYear == academicYear
                         && d.Semester == semester
                         && d.DueDate > now
                         && requirementIds.Contains(d.RequirementId)
                         && !verified.Contains(d.RequirementId))
                .OrderBy(d => d.DueDate)
                .Take(3)
                .Select(d => new UpcomingDeadlineDto(d.Id, d.RequirementId, d.Requirement.Name, d.DueDate))
                .ToListAsync(ct);

            ScholarGwaDto? gwa = null;
            if (profile is not null)
            {
                var latest = await db.AcademicGrades
                    .Where(g => g.ScholarProfileId == profile.Id)
                    .OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester)
                    .Select(g => new { g.Gwa, g.MeetsRequirement })
                    .FirstOrDefaultAsync(ct);

                if (latest is not null)
                    gwa = new ScholarGwaDto(
                        latest.Gwa, profile.MinimumGwa, profile.ScholarshipTypeName, latest.MeetsRequirement);
            }

            return new DashboardDto(role, announcements, new ScholarDashboardDto(compliance, gwa, deadlines), null);
        }

        public async Task<DashboardDto> ForStaffAsync(string userId, string role, CancellationToken ct = default)
        {
            var isAdmin = role == UserRoles.Administrator;
            // A coordinator's dashboard counts their own campus only.
            var campusId = isAdmin ? null
                : await db.Users.Where(u => u.Id == userId).Select(u => u.CampusId).FirstOrDefaultAsync(ct);
            var atCampus = db.StudentsAt(campusId);

            var announcements = await AnnouncementFeed.LoadAsync(db, userId, role, ct);
            var overview = await analytics.OverviewAsync(ct: ct, campusId: campusId);

            var scholarRoleId = await db.Roles
                .Where(r => r.Name == UserRoles.Scholar)
                .Select(r => r.Id)
                .FirstOrDefaultAsync(ct);

            var users = atCampus is null ? db.Users : db.Users.Where(u => atCampus.Contains(u.Id));
            var pendingApprovals = await users
                .CountAsync(u => u.ApprovalStatus == ApprovalStatuses.Pending &&
                                 db.UserRoles.Any(ur => ur.RoleId == scholarRoleId && ur.UserId == u.Id), ct);

            // Scholars whose scholarship needs a renewal decision. One count, not the two
            // paged list calls the page used to make just to read their totals.
            var renewalCount = await db.ScholarProfiles
                .AtCampus(campusId)
                .CountAsync(sp => sp.LifecycleStatus == LifecycleStatuses.Lapsed
                               || sp.LifecycleStatus == LifecycleStatuses.Suspended, ct);

            int? coordinators = null;
            if (isAdmin)
            {
                var coordRoleId = await db.Roles
                    .Where(r => r.Name == UserRoles.ScholarshipCoordinator)
                    .Select(r => r.Id)
                    .FirstOrDefaultAsync(ct);

                coordinators = await db.Users
                    .CountAsync(u => u.IsActive &&
                                     db.UserRoles.Any(ur => ur.RoleId == coordRoleId && ur.UserId == u.Id), ct);
            }

            var campusGrants = atCampus is null ? db.OneTimeGrants : db.OneTimeGrants.Where(g => atCampus.Contains(g.ScholarId));
            var grantBuckets = await campusGrants
                .GroupBy(g => g.ReleaseStatus)
                .Select(g => new { Status = g.Key, Count = g.Count(), Amount = g.Sum(x => x.Amount) })
                .ToListAsync(ct);

            decimal AmountFor(string s) => grantBuckets.FirstOrDefault(g => g.Status == s)?.Amount ?? 0m;
            int CountFor(string s) => grantBuckets.FirstOrDefault(g => g.Status == s)?.Count ?? 0;

            var grants = new GrantSummaryDto(
                grantBuckets.Sum(g => g.Count),
                grantBuckets.Sum(g => g.Amount),
                CountFor(GrantReleaseStatuses.Pending),
                AmountFor(GrantReleaseStatuses.Pending),
                CountFor(GrantReleaseStatuses.Released),
                AmountFor(GrantReleaseStatuses.Released),
                CountFor(GrantReleaseStatuses.Cancelled));

            // A coordinator sees what happened at their campus: their own actions and their students'.
            var activity = await RecentActivityAsync(8, ct, atCampus is null ? null : userId, atCampus);

            return new DashboardDto(role, announcements, null,
                new StaffDashboardDto(overview, coordinators, renewalCount, pendingApprovals, grants, activity));
        }

        /// <summary>
        /// The requirements a scholar on <paramref name="scholarshipTypeId"/> must satisfy,
        /// with the same fallback <c>DocumentRequirementsController.GetAll</c> applies: a type
        /// with no configured links sees the whole catalogue.
        /// </summary>
        private async Task<List<RequirementRow>> ApplicableRequirementsAsync(int? scholarshipTypeId, CancellationToken ct)
        {
            var query = db.DocumentRequirements.Where(dr => dr.IsActive);

            if (scholarshipTypeId is int typeId)
            {
                var linkedIds = await db.ScholarshipTypeRequirements
                    .Where(str => str.ScholarshipTypeId == typeId)
                    .Select(str => str.RequirementId)
                    .ToListAsync(ct);

                if (linkedIds.Count > 0)
                    query = query.Where(dr => linkedIds.Contains(dr.Id));
            }

            return await query
                .Select(dr => new RequirementRow(dr.Id, dr.Name, dr.IsRequired))
                .ToListAsync(ct);
        }

        private async Task<List<ActivityEntryDto>> RecentActivityAsync(
            int take, CancellationToken ct, string? coordinatorId = null, IQueryable<string>? students = null)
        {
            var source = db.AuditLogs.AsQueryable();
            if (students is not null)
                source = source.Where(l => l.UserId == coordinatorId || students.Contains(l.UserId));

            var logs = await source
                .OrderByDescending(l => l.TimestampUtc)
                .Take(take)
                .Select(l => new { l.Id, l.UserId, l.Action, l.Details, l.TimestampUtc })
                .ToListAsync(ct);

            var userIds = logs.Select(l => l.UserId).Distinct().ToList();
            var names = await db.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName })
                .ToDictionaryAsync(u => u.Id, u => $"{u.FirstName} {u.LastName}".Trim(), ct);

            return logs
                .Select(l => new ActivityEntryDto(
                    l.Id, names.GetValueOrDefault(l.UserId, "System"), l.Action, l.Details, l.TimestampUtc))
                .ToList();
        }

        /// <summary>
        /// Fallback academic year when no active semester is set. The PSU year turns over in
        /// August, so anything from August on belongs to the year that starts this calendar year.
        /// </summary>
        private static string CurrentAcademicYear()
        {
            var now = DateTime.UtcNow;
            var start = now.Month >= 8 ? now.Year : now.Year - 1;
            return $"{start}-{start + 1}";
        }

        private sealed record RequirementRow(int Id, string Name, bool IsRequired);
    }
}
