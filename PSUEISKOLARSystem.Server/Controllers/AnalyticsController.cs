using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Analytics;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/analytics")]
    [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
    public class AnalyticsController(ApplicationDbContext db, AnalyticsQueries analytics) : ControllerBase
    {
        // GET /api/analytics/overview?academicYear=&semester=
        // The aggregate itself lives in AnalyticsQueries — the staff dashboard needs the same
        // numbers, and two copies of an eleven-query aggregate is two things to keep in step.
        [HttpGet("overview")]
        public async Task<ActionResult<OverviewDto>> Overview(
            [FromQuery] string? academicYear = null,
            [FromQuery] int? semester = null,
            CancellationToken ct = default)
            => Ok(await analytics.OverviewAsync(academicYear, semester, ct));

        // GET /api/analytics/trends
        // One row per academic period, ordered oldest → newest, for the stacked-area comparison
        // charts and the period-vs-period delta panel. Grades and submissions are both stamped
        // with a period, so both can be compared across semesters.
        [HttpGet("trends")]
        public async Task<IActionResult> Trends()
        {
            var submissionsByPeriod = await db.DocumentSubmissions
                .GroupBy(s => new { s.AcademicYear, s.Semester })
                .Select(g => new
                {
                    g.Key.AcademicYear,
                    g.Key.Semester,
                    Verified = g.Count(s => s.Status == DocumentStatus.Verified),
                    Pending = g.Count(s => s.Status == DocumentStatus.Pending),
                    Incomplete = g.Count(s => s.Status == DocumentStatus.Incomplete),
                })
                .ToListAsync();

            var gradesByPeriod = await db.AcademicGrades
                .GroupBy(g => new { g.AcademicYear, g.Semester })
                .Select(g => new
                {
                    g.Key.AcademicYear,
                    g.Key.Semester,
                    Compliant = g.Count(x => x.MeetsRequirement),
                    Flagged = g.Count(x => !x.MeetsRequirement),
                    AverageGwa = g.Average(x => (decimal?)x.Gwa),
                })
                .ToListAsync();

            // Union of both sources so a period with grades but no submissions still appears.
            var keys = submissionsByPeriod
                .Select(s => (s.AcademicYear, s.Semester))
                .Concat(gradesByPeriod.Select(g => (g.AcademicYear, g.Semester)))
                .Distinct()
                .OrderBy(k => AcademicPeriod.SortKey(k.AcademicYear, k.Semester))
                .ToList();

            var periods = keys.Select(k =>
            {
                var subs = submissionsByPeriod.FirstOrDefault(s => s.AcademicYear == k.AcademicYear && s.Semester == k.Semester);
                var grades = gradesByPeriod.FirstOrDefault(g => g.AcademicYear == k.AcademicYear && g.Semester == k.Semester);
                var verified = subs?.Verified ?? 0;
                var pending = subs?.Pending ?? 0;
                var incomplete = subs?.Incomplete ?? 0;
                var compliant = grades?.Compliant ?? 0;
                var flagged = grades?.Flagged ?? 0;
                var totalSubs = verified + pending + incomplete;
                var totalGraded = compliant + flagged;

                return new
                {
                    academicYear = k.AcademicYear,
                    semester = k.Semester,
                    period = $"{k.AcademicYear} Sem {k.Semester}",
                    // Short axis label — the full year doubles the tick width for no gain.
                    shortLabel = $"{ShortYear(k.AcademicYear)} S{k.Semester}",
                    verified,
                    pending,
                    incomplete,
                    totalSubmissions = totalSubs,
                    verifiedRate = totalSubs > 0 ? Math.Round(verified * 100.0 / totalSubs) : 0,
                    compliant,
                    flagged,
                    totalGraded,
                    complianceRate = totalGraded > 0 ? Math.Round(compliant * 100.0 / totalGraded) : 0,
                    averageGwa = grades?.AverageGwa is { } avg ? Math.Round(avg, 2) : (decimal?)null,
                };
            }).ToList();

            return Ok(new { periods });
        }

        /// <summary>
        /// GET /api/analytics/disbursements — the money side of the system.
        /// <para>
        /// Two streams feed it and they are reported separately on purpose: recurring
        /// scholarship releases (per semester / per year) and one-off grants. Summing them
        /// into a single "total disbursed" would hide the question staff actually ask, which
        /// is whether the recurring obligation for the current period has been met.
        /// </para>
        /// Coverage per scholarship type is the headline: released ÷ holders. A type whose
        /// holders outnumber its releases has scholars who have not been paid.
        /// </summary>
        [HttpGet("disbursements")]
        public async Task<IActionResult> Disbursements(
            [FromQuery] string? academicYear = null,
            [FromQuery] int? semester = null)
        {
            var releases = db.ScholarshipReleases.AsQueryable();
            if (!string.IsNullOrWhiteSpace(academicYear))
                releases = releases.Where(r => r.AcademicYear == academicYear);
            if (semester is int sem)
                releases = releases.Where(r => r.Semester == sem);

            var released = releases.Where(r => r.Status == GrantReleaseStatuses.Released);
            var pending = releases.Where(r => r.Status == GrantReleaseStatuses.Pending);

            var releasedCount = await released.CountAsync();
            var pendingCount = await pending.CountAsync();
            var cancelledCount = await releases.CountAsync(r => r.Status == GrantReleaseStatuses.Cancelled);

            var releasedAmount = releasedCount == 0 ? 0m : await released.SumAsync(r => r.Amount);
            var pendingAmount = pendingCount == 0 ? 0m : await pending.SumAsync(r => r.Amount);

            // Holders per type, so coverage can be stated as a share of who is owed rather
            // than a share of rows that happen to exist.
            var holders = await db.ScholarProfiles
                .Where(sp => sp.ScholarshipTypeId != null)
                .GroupBy(sp => sp.ScholarshipTypeId!.Value)
                .Select(g => new { TypeId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.TypeId, x => x.Count);

            var perType = await releases
                .GroupBy(r => new { r.ScholarshipTypeId, r.ScholarshipType.Name, r.ScholarshipType.Frequency })
                .Select(g => new
                {
                    g.Key.ScholarshipTypeId,
                    g.Key.Name,
                    g.Key.Frequency,
                    ReleasedCount = g.Count(r => r.Status == GrantReleaseStatuses.Released),
                    PendingCount = g.Count(r => r.Status == GrantReleaseStatuses.Pending),
                    ReleasedAmount = g.Where(r => r.Status == GrantReleaseStatuses.Released).Sum(r => (decimal?)r.Amount) ?? 0m,
                    PendingAmount = g.Where(r => r.Status == GrantReleaseStatuses.Pending).Sum(r => (decimal?)r.Amount) ?? 0m,
                })
                .ToListAsync();

            var byType = perType
                .Select(t => new
                {
                    scholarshipTypeId = t.ScholarshipTypeId,
                    type = t.Name,
                    frequency = t.Frequency,
                    holders = holders.GetValueOrDefault(t.ScholarshipTypeId),
                    releasedCount = t.ReleasedCount,
                    pendingCount = t.PendingCount,
                    releasedAmount = t.ReleasedAmount,
                    pendingAmount = t.PendingAmount,
                    // Only meaningful for a single period; across "all periods" a scholar can
                    // legitimately have several releases, so this is capped at 100.
                    coverage = holders.GetValueOrDefault(t.ScholarshipTypeId) > 0
                        ? Math.Min(100, (int)Math.Round(t.ReleasedCount * 100.0 / holders.GetValueOrDefault(t.ScholarshipTypeId)))
                        : 0,
                })
                .OrderByDescending(t => t.releasedAmount)
                .ToList();

            var perPeriod = await db.ScholarshipReleases
                .GroupBy(r => new { r.AcademicYear, r.Semester })
                .Select(g => new
                {
                    g.Key.AcademicYear,
                    g.Key.Semester,
                    ReleasedAmount = g.Where(r => r.Status == GrantReleaseStatuses.Released).Sum(r => (decimal?)r.Amount) ?? 0m,
                    PendingAmount = g.Where(r => r.Status == GrantReleaseStatuses.Pending).Sum(r => (decimal?)r.Amount) ?? 0m,
                    ReleasedCount = g.Count(r => r.Status == GrantReleaseStatuses.Released),
                    PendingCount = g.Count(r => r.Status == GrantReleaseStatuses.Pending),
                })
                .ToListAsync();

            var byPeriod = perPeriod
                .OrderBy(p => AcademicPeriod.SortKey(p.AcademicYear, p.Semester))
                .Select(p => new
                {
                    period = p.Semester == ScholarshipFrequencies.WholeYearSemester
                        ? $"{p.AcademicYear} (whole year)"
                        : $"{p.AcademicYear} Sem {p.Semester}",
                    shortLabel = p.Semester == ScholarshipFrequencies.WholeYearSemester
                        ? $"{ShortYear(p.AcademicYear)} yr"
                        : $"{ShortYear(p.AcademicYear)} S{p.Semester}",
                    releasedAmount = p.ReleasedAmount,
                    pendingAmount = p.PendingAmount,
                    releasedCount = p.ReleasedCount,
                    pendingCount = p.PendingCount,
                })
                .ToList();

            // One-off grants, reported beside the recurring stream rather than folded into it.
            var grantsReleased = db.OneTimeGrants.Where(g => g.ReleaseStatus == GrantReleaseStatuses.Released);
            var grantsPending = db.OneTimeGrants.Where(g => g.ReleaseStatus == GrantReleaseStatuses.Pending);
            var grantsReleasedCount = await grantsReleased.CountAsync();
            var grantsPendingCount = await grantsPending.CountAsync();

            var beneficiaries = await releases
                .Where(r => r.Status == GrantReleaseStatuses.Released)
                .Select(r => r.ScholarId)
                .Distinct()
                .CountAsync();

            var awaiting = await releases
                .Where(r => r.Status == GrantReleaseStatuses.Pending)
                .Select(r => r.ScholarId)
                .Distinct()
                .CountAsync();

            return Ok(new
            {
                releasedCount,
                pendingCount,
                cancelledCount,
                releasedAmount,
                pendingAmount,
                scholarsPaid = beneficiaries,
                scholarsAwaiting = awaiting,
                releaseRate = releasedCount + pendingCount > 0
                    ? (int)Math.Round(releasedCount * 100.0 / (releasedCount + pendingCount))
                    : 0,
                byType,
                byPeriod,
                grants = new
                {
                    releasedCount = grantsReleasedCount,
                    pendingCount = grantsPendingCount,
                    releasedAmount = grantsReleasedCount == 0 ? 0m : await grantsReleased.SumAsync(g => g.Amount),
                    pendingAmount = grantsPendingCount == 0 ? 0m : await grantsPending.SumAsync(g => g.Amount),
                },
            });
        }

        // "2025-2026" → "25-26"; anything unparseable is passed through unchanged.
        private static string ShortYear(string? academicYear)
        {
            if (string.IsNullOrWhiteSpace(academicYear)) return "—";
            var parts = academicYear.Split('-');
            return parts.Length == 2 && parts[0].Length == 4 && parts[1].Length == 4
                ? $"{parts[0][2..]}-{parts[1][2..]}"
                : academicYear;
        }
    }
}
