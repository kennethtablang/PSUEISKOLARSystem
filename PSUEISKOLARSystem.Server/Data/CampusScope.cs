using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Data
{
    /// <summary>
    /// Which campus a staff member works within. Each campus has its own coordinator, and a
    /// coordinator sees only their campus: its scholars and grantees, their documents and
    /// messages, its figures, and the scholarship types that apply there (every general type
    /// plus the campus's own). The administrator is not limited.
    /// </summary>
    public static class CampusScope
    {
        /// <summary>
        /// The campus the caller is limited to, or null when they see every campus — the
        /// administrator, or a coordinator who has not been given a campus yet.
        /// </summary>
        public static async Task<int?> CampusOfAsync(this ApplicationDbContext db, ClaimsPrincipal user)
        {
            if (!user.IsInRole(UserRoles.ScholarshipCoordinator)) return null;
            var id = user.FindFirstValue(ClaimTypes.NameIdentifier);
            return await db.Users.Where(u => u.Id == id).Select(u => u.CampusId).FirstOrDefaultAsync();
        }

        /// <summary>Scholars at the campus; every scholar when <paramref name="campusId"/> is null.</summary>
        public static IQueryable<ScholarProfile> AtCampus(this IQueryable<ScholarProfile> q, int? campusId) =>
            campusId is int c ? q.Where(sp => sp.CampusId == c) : q;

        /// <summary>Grantees at the campus; every grantee when <paramref name="campusId"/> is null.</summary>
        public static IQueryable<GranteeProfile> AtCampus(this IQueryable<GranteeProfile> q, int? campusId) =>
            campusId is int c ? q.Where(g => g.CampusId == c) : q;

        /// <summary>Cross-matching lines for the campus; every line when <paramref name="campusId"/> is null.</summary>
        public static IQueryable<EligibilityRecord> AtCampus(this IQueryable<EligibilityRecord> q, int? campusId) =>
            campusId is int c ? q.Where(e => e.CampusId == c) : q;

        /// <summary>
        /// Scholarship types that apply at the campus: every general type plus the campus's own.
        /// Every type when <paramref name="campusId"/> is null.
        /// </summary>
        public static IQueryable<ScholarshipType> VisibleAt(this IQueryable<ScholarshipType> q, int? campusId) =>
            campusId is int c ? q.Where(t => t.CampusId == null || t.CampusId == c) : q;

        /// <summary>
        /// Whether a staff member limited to <paramref name="campusId"/> may change the type.
        /// General types belong to the administrator; a campus type to that campus's coordinator.
        /// </summary>
        public static bool CanManage(this ScholarshipType type, ClaimsPrincipal user, int? campusId) =>
            user.IsInRole(UserRoles.Administrator) || (campusId is int c && type.CampusId == c);

        /// <summary>Submissions from scholars at the campus; every submission when <paramref name="campusId"/> is null.</summary>
        public static IQueryable<DocumentSubmission> AtCampus(this IQueryable<DocumentSubmission> q, ApplicationDbContext db, int? campusId) =>
            campusId is int c ? q.Where(ds => db.ScholarProfiles.Any(sp => sp.UserId == ds.ScholarId && sp.CampusId == c)) : q;

        /// <summary>
        /// The accounts — scholars and grantees — at the campus, for filtering anything keyed by
        /// a student's user id (releases, grants, messages). Null when every campus is visible.
        /// </summary>
        public static IQueryable<string>? StudentsAt(this ApplicationDbContext db, int? campusId) =>
            campusId is int c
                ? db.ScholarProfiles.Where(sp => sp.CampusId == c).Select(sp => sp.UserId)
                    .Concat(db.GranteeProfiles.Where(g => g.CampusId == c).Select(g => g.UserId))
                : null;

        /// <summary>Whether the scholar is at a campus the caller may see.</summary>
        public static async Task<bool> CanSeeScholarAsync(this ApplicationDbContext db, int? campusId, string scholarUserId) =>
            campusId is not int c || await db.ScholarProfiles.AnyAsync(sp => sp.UserId == scholarUserId && sp.CampusId == c);
    }
}
