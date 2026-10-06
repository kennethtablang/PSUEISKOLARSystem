using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// The auto-generated summary report: the figures behind the dashboard and the Data
    /// Visualization page, written up as a document a coordinator can print or forward without
    /// choosing a single filter. For a coordinator it covers their campus alone; the
    /// administrator gets the whole university, or one campus when they pick it.
    /// <para>
    /// Every section is a small label/number table, and the highlights at the top are sentences
    /// composed from those same numbers — so the prose can never disagree with the tables.
    /// </para>
    /// </summary>
    public sealed class SummaryReport(ApplicationDbContext db, AnalyticsQueries analytics)
    {
        public sealed record Section(string Heading, string[] Headers, float[] Widths, List<string[]> Rows, string? Note = null);

        public sealed record Result(string Title, string Scope, List<string> Highlights, List<Section> Sections);

        public async Task<Result> BuildAsync(int? campusId, CancellationToken ct = default)
        {
            var campusName = campusId is int c
                ? await db.Campuses.Where(x => x.Id == c).Select(x => x.Name).FirstOrDefaultAsync(ct)
                : null;
            var scope = campusName is null ? "All campuses" : campusName;

            var overview = await analytics.OverviewAsync(ct: ct, campusId: campusId);
            var scholars = db.ScholarProfiles.AtCampus(campusId);
            var grantees = db.GranteeProfiles.AtCampus(campusId);
            var students = db.StudentsAt(campusId);

            /* ── Scholars ── */
            var byStatus = await scholars.GroupBy(sp => sp.LifecycleStatus)
                .Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
            var byYear = await scholars.GroupBy(sp => sp.YearLevel)
                .Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
            var bySex = await scholars.GroupBy(sp => sp.Personal.Sex)
                .Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
            var byCategory = await scholars.Where(sp => sp.ScholarshipType != null)
                .GroupBy(sp => sp.ScholarshipType!.Category)
                .Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
            var typeCategory = await db.ScholarshipTypes.VisibleAt(campusId)
                .ToDictionaryAsync(t => t.Name, t => t.Category, ct);

            /* ── Grantees and one-time grants ── */
            var granteeTotal = await grantees.CountAsync(ct);
            var granteeActive = await grantees.CountAsync(g => g.User.IsActive, ct);
            var grants = db.OneTimeGrants.Where(g => g.ReleaseStatus != GrantReleaseStatuses.Cancelled);
            if (students is not null) grants = grants.Where(g => students.Contains(g.ScholarId));
            var grantsByType = await grants
                .GroupBy(g => g.GrantType != null ? g.GrantType.Name : g.Title)
                .Select(g => new
                {
                    Name = g.Key,
                    Recipients = g.Select(x => x.ScholarId).Distinct().Count(),
                    Released = g.Where(x => x.ReleaseStatus == GrantReleaseStatuses.Released).Sum(x => (decimal?)x.Amount) ?? 0m,
                    Pending = g.Where(x => x.ReleaseStatus == GrantReleaseStatuses.Pending).Sum(x => (decimal?)x.Amount) ?? 0m,
                })
                .ToListAsync(ct);

            /* ── Scholarship releases ── */
            var releases = db.ScholarshipReleases.AsQueryable();
            if (students is not null) releases = releases.Where(r => students.Contains(r.ScholarId));
            var releasesByType = await releases
                .Where(r => r.Status != GrantReleaseStatuses.Cancelled)
                .GroupBy(r => r.ScholarshipType.Name)
                .Select(g => new
                {
                    Name = g.Key,
                    ReleasedCount = g.Count(r => r.Status == GrantReleaseStatuses.Released),
                    PendingCount = g.Count(r => r.Status == GrantReleaseStatuses.Pending),
                    Released = g.Where(r => r.Status == GrantReleaseStatuses.Released).Sum(r => (decimal?)r.Amount) ?? 0m,
                    Pending = g.Where(r => r.Status == GrantReleaseStatuses.Pending).Sum(r => (decimal?)r.Amount) ?? 0m,
                })
                .ToListAsync(ct);

            var sections = new List<Section>();
            int total = overview.TotalScholars;
            string Pct(int n, int of) => of == 0 ? "—" : $"{n * 100.0 / of:0}%";

            sections.Add(new Section("Key figures", ["Measure", "Count", "Share"], [3f, 1f, 1f],
            [
                ["Scholars", total.ToString("N0"), ""],
                ["   Meeting the GWA requirement", overview.Compliant.ToString("N0"), Pct(overview.Compliant, total)],
                ["   Flagged (below the requirement)", overview.NonCompliant.ToString("N0"), Pct(overview.NonCompliant, total)],
                ["   No GWA on record yet", overview.NoGwa.ToString("N0"), Pct(overview.NoGwa, total)],
                ["Grantees", granteeTotal.ToString("N0"), ""],
                ["   Accounts still active", granteeActive.ToString("N0"), Pct(granteeActive, granteeTotal)],
                ["Document submissions", overview.Submissions.Total.ToString("N0"), ""],
                ["   Verified", overview.Submissions.Verified.ToString("N0"), Pct(overview.Submissions.Verified, overview.Submissions.Total)],
                ["   Awaiting review", overview.Submissions.Pending.ToString("N0"), Pct(overview.Submissions.Pending, overview.Submissions.Total)],
                ["   Rejected", overview.Submissions.Incomplete.ToString("N0"), Pct(overview.Submissions.Incomplete, overview.Submissions.Total)],
            ]));

            sections.Add(new Section("Scholars by scholarship type", ["Scholarship type", "Category", "Scholars", "Share"], [3f, 1.3f, 1f, 1f],
                overview.ByScholarshipType
                    .Select(t => new[] { t.Type, typeCategory.GetValueOrDefault(t.Type) ?? "—", t.Count.ToString("N0"), Pct(t.Count, total) })
                    .ToList()));

            sections.Add(new Section("Scholars by category", ["Category", "Scholars", "Share"], [3f, 1f, 1f],
                ScholarshipCategories.All
                    .Select(cat => (cat, n: byCategory.Where(x => x.Key == cat).Sum(x => x.Count)))
                    .Select(x => new[] { x.cat, x.n.ToString("N0"), Pct(x.n, total) })
                    .ToList()));

            sections.Add(new Section("Scholars by program", ["Program", "Scholars", "Share"], [3f, 1f, 1f],
                overview.ByProgram.Select(p => new[] { p.Program, p.Count.ToString("N0"), Pct(p.Count, total) }).ToList()));

            sections.Add(new Section("Scholars by year level", ["Year level", "Scholars", "Share"], [3f, 1f, 1f],
                byYear.OrderBy(y => y.Key)
                    .Select(y => new[] { $"Year {y.Key}", y.Count.ToString("N0"), Pct(y.Count, total) }).ToList()));

            sections.Add(new Section("Scholars by sex", ["Sex", "Scholars", "Share"], [3f, 1f, 1f],
                bySex.OrderByDescending(s => s.Count)
                    .Select(s => new[] { string.IsNullOrWhiteSpace(s.Key) ? "Not stated" : s.Key!, s.Count.ToString("N0"), Pct(s.Count, total) }).ToList()));

            sections.Add(new Section("Scholars by status", ["Status", "Scholars", "Share"], [3f, 1f, 1f],
                byStatus.OrderByDescending(s => s.Count)
                    .Select(s => new[] { s.Key, s.Count.ToString("N0"), Pct(s.Count, total) }).ToList()));

            sections.Add(new Section("Scholarship releases", ["Scholarship type", "Released", "Amount released", "Pending", "Amount pending"], [2.6f, 0.8f, 1.4f, 0.8f, 1.4f],
                releasesByType.OrderByDescending(r => r.Released + r.Pending)
                    .Select(r => new[] { r.Name, r.ReleasedCount.ToString("N0"), Peso(r.Released), r.PendingCount.ToString("N0"), Peso(r.Pending) })
                    .ToList(),
                Note: releasesByType.Count == 0 ? null
                    : $"Total released {Peso(releasesByType.Sum(r => r.Released))}; awaiting release {Peso(releasesByType.Sum(r => r.Pending))}."));

            sections.Add(new Section("One-time grants", ["Grant", "Recipients", "Amount released", "Amount pending"], [2.6f, 1f, 1.4f, 1.4f],
                grantsByType.OrderByDescending(g => g.Released + g.Pending)
                    .Select(g => new[] { g.Name, g.Recipients.ToString("N0"), Peso(g.Released), Peso(g.Pending) })
                    .ToList()));

            sections.Add(new Section("Document submissions by period", ["Period", "Total", "Verified", "Awaiting review", "Rejected"], [2f, 1f, 1f, 1.2f, 1f],
                overview.ByPeriod.Select(p => new[]
                {
                    p.Period, p.Total.ToString("N0"), p.Verified.ToString("N0"), p.Pending.ToString("N0"), p.Incomplete.ToString("N0"),
                }).ToList()));

            // The whole university: show how it splits across campuses.
            if (campusId is null)
            {
                var scholarsByCampus = await db.ScholarProfiles
                    .GroupBy(sp => sp.Campus != null ? sp.Campus.Name : "No campus")
                    .Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
                var granteesByCampus = await db.GranteeProfiles
                    .GroupBy(gp => gp.Campus != null ? gp.Campus.Name : "No campus")
                    .Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
                var names = scholarsByCampus.Select(x => x.Key).Union(granteesByCampus.Select(x => x.Key)).OrderBy(n => n);
                sections.Add(new Section("By campus", ["Campus", "Scholars", "Grantees"], [3f, 1f, 1f],
                    names.Select(n => new[]
                    {
                        n,
                        (scholarsByCampus.FirstOrDefault(x => x.Key == n)?.Count ?? 0).ToString("N0"),
                        (granteesByCampus.FirstOrDefault(x => x.Key == n)?.Count ?? 0).ToString("N0"),
                    }).ToList()));
            }

            /* ── Highlights, composed from the numbers above ── */
            var highlights = new List<string>();
            var where = campusName is null ? "across all campuses" : $"at {campusName}";
            highlights.Add($"{total:N0} scholar{(total == 1 ? "" : "s")} and {granteeTotal:N0} grantee{(granteeTotal == 1 ? "" : "s")} are on record {where}.");
            if (overview.ByScholarshipType.Count > 0)
            {
                var top = overview.ByScholarshipType[0];
                highlights.Add($"{top.Type} has the most scholars ({top.Count:N0}, {Pct(top.Count, total)} of all scholars).");
            }
            var gov = byCategory.Where(x => x.Key == ScholarshipCategories.Government).Sum(x => x.Count);
            var priv = byCategory.Where(x => x.Key == ScholarshipCategories.Private).Sum(x => x.Count);
            if (gov + priv > 0)
                highlights.Add($"{gov:N0} scholar{(gov == 1 ? " holds" : "s hold")} a government scholarship and {priv:N0} a private one.");
            if (total > 0)
                highlights.Add($"{Pct(overview.Compliant, total)} of scholars meet their GWA requirement; {overview.NonCompliant:N0} " +
                               $"{(overview.NonCompliant == 1 ? "is" : "are")} flagged and {overview.NoGwa:N0} " +
                               $"{(overview.NoGwa == 1 ? "has" : "have")} no GWA on record yet.");
            if (overview.Submissions.Total > 0)
                highlights.Add($"{overview.Submissions.Verified:N0} of {overview.Submissions.Total:N0} document submissions are verified " +
                               $"({Pct(overview.Submissions.Verified, overview.Submissions.Total)}); {overview.Submissions.Pending:N0} " +
                               $"{(overview.Submissions.Pending == 1 ? "is" : "are")} waiting for review.");
            var pendingMoney = releasesByType.Sum(r => r.Pending) + grantsByType.Sum(g => g.Pending);
            var releasedMoney = releasesByType.Sum(r => r.Released) + grantsByType.Sum(g => g.Released);
            if (releasedMoney + pendingMoney > 0)
                highlights.Add($"{Peso(releasedMoney)} has been released in scholarships and grants; {Peso(pendingMoney)} is awaiting release.");

            var title = campusName is null ? "Scholarship Summary Report" : $"{campusName} Summary Report";
            return new Result(title, scope, highlights, sections);
        }

        public static string Peso(decimal amount) => $"PHP {amount:N2}";
    }
}
