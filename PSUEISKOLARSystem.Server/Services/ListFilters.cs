using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// The filters behind the three people lists — the Master List, a scholarship type's
    /// scholars and a grant type's grantees — kept in one place so the page and its export
    /// (Excel / printable PDF) always show the same people.
    /// </summary>
    public static class ListFilters
    {
        /* ── Master List ─────────────────────────────────────────────── */

        public class MasterListFilter
        {
            /// <summary>Scholar or Grantee: someone listed for at least one of that kind.</summary>
            public string? Kind { get; set; }
            /// <summary>"claimed" — has an account; "unclaimed" — has not signed up yet.</summary>
            public string? Status { get; set; }
            public int? CampusId { get; set; }
            public string? Sex { get; set; }
            public int? ScholarshipTypeId { get; set; }
            public int? GrantTypeId { get; set; }
            public string? Search { get; set; }
        }

        public sealed record PersonEntry(int LineId, string Kind, string Name, decimal? Amount, bool Claimed);

        /// <summary>One student on the Master List, however many lists they are on.</summary>
        public sealed record PersonRow(
            string StudentId,
            string LastName,
            string FirstName,
            string? MiddleName,
            string? Sex,
            string? CampusName,
            bool HasAccount,
            string? UserId,
            string? Email,
            string? Role,
            bool? AccountActive,
            IReadOnlyList<PersonEntry> Entries)
        {
            public string FullName => $"{LastName}, {FirstName}{(MiddleName is null ? "" : " " + MiddleName)}";
        }

        public static async Task<List<PersonRow>> MasterListPeopleAsync(ApplicationDbContext db, MasterListFilter f)
        {
            var lines = await db.EligibilityRecords
                .Select(e => new
                {
                    e.Id, e.Kind, e.StudentId, e.LastName, e.FirstName, e.MiddleName, e.Sex, e.CampusId,
                    CampusName = e.Campus != null ? e.Campus.Name : null,
                    e.ScholarshipTypeId,
                    ScholarshipName = e.ScholarshipType != null ? e.ScholarshipType.Name : null,
                    e.GrantTypeId,
                    GrantName = e.GrantType != null ? e.GrantType.Name : null,
                    Amount = e.GrantAmount ?? (e.GrantType != null ? e.GrantType.DefaultAmount : null),
                    e.ClaimedByUserId,
                    e.CreatedAt,
                })
                .ToListAsync();

            var studentIds = lines.Select(l => l.StudentId).Distinct().ToList();

            // The account behind each student number, scholar first.
            var scholarAccounts = await db.ScholarProfiles
                .Where(sp => studentIds.Contains(sp.StudentId))
                .Select(sp => new { sp.StudentId, sp.UserId, sp.User.Email, sp.User.IsActive, Sex = sp.Personal.Sex, CampusName = sp.Campus != null ? sp.Campus.Name : null })
                .ToListAsync();
            var granteeAccounts = await db.GranteeProfiles
                .Where(gp => studentIds.Contains(gp.StudentId))
                .Select(gp => new { gp.StudentId, gp.UserId, gp.User.Email, gp.User.IsActive, Sex = gp.Personal.Sex, CampusName = gp.Campus != null ? gp.Campus.Name : null })
                .ToListAsync();
            var scholarBySid = scholarAccounts.GroupBy(a => a.StudentId).ToDictionary(g => g.Key, g => g.First());
            var granteeBySid = granteeAccounts.GroupBy(a => a.StudentId).ToDictionary(g => g.Key, g => g.First());

            var people = lines
                .GroupBy(l => l.StudentId)
                .Select(g =>
                {
                    // The newest line carries the name as the office last wrote it.
                    var head = g.OrderByDescending(l => l.CreatedAt).First();
                    scholarBySid.TryGetValue(g.Key, out var sa);
                    granteeBySid.TryGetValue(g.Key, out var ga);
                    var userId = sa?.UserId ?? ga?.UserId;
                    return new PersonRow(
                        g.Key, head.LastName, head.FirstName, head.MiddleName,
                        sa?.Sex ?? ga?.Sex ?? g.Select(l => l.Sex).FirstOrDefault(x => x != null),
                        sa?.CampusName ?? ga?.CampusName ?? g.Select(l => l.CampusName).FirstOrDefault(x => x != null),
                        HasAccount: userId != null || g.Any(l => l.ClaimedByUserId != null),
                        UserId: userId ?? g.Select(l => l.ClaimedByUserId).FirstOrDefault(x => x != null),
                        Email: sa?.Email ?? ga?.Email,
                        Role: sa is not null ? UserRoles.Scholar : ga is not null ? UserRoles.Grantee : null,
                        AccountActive: sa?.IsActive ?? ga?.IsActive,
                        Entries: g.OrderBy(l => l.Kind == EligibilityKinds.Scholar ? 0 : 1).ThenBy(l => l.CreatedAt)
                            .Select(l => new PersonEntry(l.Id, l.Kind,
                                l.Kind == EligibilityKinds.Scholar ? l.ScholarshipName ?? "Scholarship" : l.GrantName ?? "Grant",
                                l.Kind == EligibilityKinds.Grantee ? l.Amount : null,
                                l.ClaimedByUserId != null))
                            .ToList());
                })
                .ToList();

            // Filters on the person (any of their lines may satisfy them).
            IEnumerable<PersonRow> q = people;
            if (!string.IsNullOrWhiteSpace(f.Kind)) q = q.Where(p => p.Entries.Any(e => e.Kind == f.Kind));
            if (f.Status == "claimed") q = q.Where(p => p.HasAccount);
            else if (f.Status == "unclaimed") q = q.Where(p => !p.HasAccount);
            if (!string.IsNullOrWhiteSpace(f.Sex)) q = q.Where(p => string.Equals(p.Sex, f.Sex, StringComparison.OrdinalIgnoreCase));
            if (f.CampusId is int cid)
            {
                var campusName = await db.Campuses.Where(c => c.Id == cid).Select(c => c.Name).FirstOrDefaultAsync();
                var sids = lines.Where(l => l.CampusId == cid).Select(l => l.StudentId).ToHashSet();
                q = q.Where(p => sids.Contains(p.StudentId) || p.CampusName == campusName);
            }
            if (f.ScholarshipTypeId is int st)
            {
                var sids = lines.Where(l => l.ScholarshipTypeId == st).Select(l => l.StudentId).ToHashSet();
                q = q.Where(p => sids.Contains(p.StudentId));
            }
            if (f.GrantTypeId is int gt)
            {
                var sids = lines.Where(l => l.GrantTypeId == gt).Select(l => l.StudentId).ToHashSet();
                q = q.Where(p => sids.Contains(p.StudentId));
            }
            if (!string.IsNullOrWhiteSpace(f.Search))
            {
                var s = f.Search.Trim().ToUpperInvariant();
                q = q.Where(p => p.StudentId.Contains(s) || p.FullName.Contains(s) || $"{p.FirstName} {p.LastName}".Contains(s)
                              || (p.Email?.ToUpperInvariant().Contains(s) ?? false));
            }

            return q.OrderBy(p => p.LastName).ThenBy(p => p.FirstName).ToList();
        }

        /* ── Scholars ────────────────────────────────────────────────── */

        public class ScholarFilter
        {
            public int? ScholarshipTypeId { get; set; }
            public int? CampusId { get; set; }
            public int? ProgramId { get; set; }
            public int? YearLevel { get; set; }
            public string? Sex { get; set; }
            public string? LifecycleStatus { get; set; }
            public string? Search { get; set; }
        }

        public static IQueryable<ScholarProfile> Scholars(ApplicationDbContext db, ScholarFilter f)
        {
            var q = db.ScholarProfiles.AsQueryable();
            if (f.ScholarshipTypeId is int st) q = q.Where(sp => sp.ScholarshipTypeId == st);
            if (f.CampusId is int c) q = q.Where(sp => sp.CampusId == c);
            if (f.ProgramId is int p) q = q.Where(sp => sp.ProgramId == p);
            if (f.YearLevel is int y) q = q.Where(sp => sp.YearLevel == y);
            if (!string.IsNullOrWhiteSpace(f.Sex)) q = q.Where(sp => sp.Personal.Sex == f.Sex);
            if (!string.IsNullOrWhiteSpace(f.LifecycleStatus)) q = q.Where(sp => sp.LifecycleStatus == f.LifecycleStatus);
            if (!string.IsNullOrWhiteSpace(f.Search))
            {
                var s = f.Search.Trim();
                q = q.Where(sp =>
                    (sp.User.FirstName + " " + sp.User.LastName).Contains(s) ||
                    sp.User.LastName.Contains(s) ||
                    sp.StudentId.Contains(s) ||
                    (sp.User.Email != null && sp.User.Email.Contains(s)));
            }
            return q;
        }

        /* ── Grantees ────────────────────────────────────────────────── */

        public class GranteeFilter
        {
            public int? GrantTypeId { get; set; }
            public int? CampusId { get; set; }
            public int? ProgramId { get; set; }
            public int? YearLevel { get; set; }
            public string? Sex { get; set; }
            public bool? Active { get; set; }
            public string? Search { get; set; }
        }

        public static IQueryable<GranteeProfile> Grantees(ApplicationDbContext db, GranteeFilter f)
        {
            var q = db.GranteeProfiles.AsQueryable();
            if (f.GrantTypeId is int gt) q = q.Where(g => db.OneTimeGrants.Any(x => x.ScholarId == g.UserId && x.GrantTypeId == gt));
            if (f.CampusId is int c) q = q.Where(g => g.CampusId == c);
            if (f.ProgramId is int p) q = q.Where(g => g.ProgramId == p);
            if (f.YearLevel is int y) q = q.Where(g => g.YearLevel == y);
            if (!string.IsNullOrWhiteSpace(f.Sex)) q = q.Where(g => g.Personal.Sex == f.Sex);
            if (f.Active is bool a) q = q.Where(g => g.User.IsActive == a);
            if (!string.IsNullOrWhiteSpace(f.Search))
            {
                var s = f.Search.Trim();
                q = q.Where(g =>
                    g.StudentId.Contains(s) ||
                    (g.User.FirstName + " " + g.User.LastName).Contains(s) ||
                    g.User.LastName.Contains(s) ||
                    (g.User.Email != null && g.User.Email.Contains(s)));
            }
            return q;
        }
    }
}
