using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/analytics")]
    [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
    public class AnalyticsController(ApplicationDbContext db) : ControllerBase
    {
        // GET /api/analytics/overview?academicYear=&semester=
        [HttpGet("overview")]
        public async Task<IActionResult> Overview(
            [FromQuery] string? academicYear = null,
            [FromQuery] int? semester = null)
        {
            // Scholar counts — aggregated in SQL rather than materializing every profile.
            var scholarQuery = db.ScholarProfiles.AsQueryable();

            var totalScholars = await scholarQuery.CountAsync();

            // Latest grade's compliance per scholar, evaluated as a correlated subquery.
            var compliant = await scholarQuery.CountAsync(sp => sp.Grades
                .OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester)
                .Select(g => (bool?)g.MeetsRequirement).FirstOrDefault() == true);
            var nonCompliant = await scholarQuery.CountAsync(sp => sp.Grades
                .OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester)
                .Select(g => (bool?)g.MeetsRequirement).FirstOrDefault() == false);
            var noGwa = totalScholars - compliant - nonCompliant;

            // By program
            var byProgram = await scholarQuery
                .Where(sp => sp.Program != null)
                .GroupBy(sp => sp.Program!.Code)
                .Select(g => new { program = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .ToListAsync();

            // By scholarship type
            var byScholarshipType = await scholarQuery
                .Where(sp => sp.ScholarshipType != null)
                .GroupBy(sp => sp.ScholarshipType!.Name)
                .Select(g => new { type = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .ToListAsync();

            // Submission stats
            var submissionQuery = db.DocumentSubmissions.AsQueryable();

            // Period options are computed before the period filter so the dropdown stays populated.
            var periodKeys = await submissionQuery
                .Select(s => new { s.AcademicYear, s.Semester })
                .Distinct()
                .ToListAsync();
            var availablePeriods = periodKeys
                .Select(p => new { academicYear = p.AcademicYear, semester = p.Semester, label = $"{p.AcademicYear} Sem {p.Semester}" })
                .OrderByDescending(p => p.academicYear).ThenByDescending(p => p.semester)
                .ToList();

            // Academic-period filter (optional) — narrows submission stats to one period.
            if (!string.IsNullOrWhiteSpace(academicYear))
                submissionQuery = submissionQuery.Where(s => s.AcademicYear == academicYear);
            if (semester is 1 or 2)
                submissionQuery = submissionQuery.Where(s => s.Semester == semester);

            var totalSubs = await submissionQuery.CountAsync();
            var verifiedSubs = await submissionQuery.CountAsync(s => s.Status == DocumentStatus.Verified);
            var pendingSubs = await submissionQuery.CountAsync(s => s.Status == DocumentStatus.Pending);
            var incompleteSubs = await submissionQuery.CountAsync(s => s.Status == DocumentStatus.Incomplete);

            // Submissions by academic period (grouped in SQL; label formatted after)
            var byPeriodRaw = await submissionQuery
                .GroupBy(s => new { s.AcademicYear, s.Semester })
                .Select(g => new
                {
                    g.Key.AcademicYear,
                    g.Key.Semester,
                    total = g.Count(),
                    verified = g.Count(s => s.Status == DocumentStatus.Verified),
                    pending = g.Count(s => s.Status == DocumentStatus.Pending),
                    incomplete = g.Count(s => s.Status == DocumentStatus.Incomplete),
                })
                .ToListAsync();

            var byPeriod = byPeriodRaw
                .Select(x => new
                {
                    period = $"{x.AcademicYear} Sem {x.Semester}",
                    x.total, x.verified, x.pending, x.incomplete,
                })
                .OrderBy(x => x.period)
                .ToList();

            return Ok(new
            {
                totalScholars,
                compliant,
                nonCompliant,
                noGwa,
                byProgram,
                byScholarshipType,
                submissions = new
                {
                    total = totalSubs,
                    verified = verifiedSubs,
                    pending = pendingSubs,
                    incomplete = incompleteSubs,
                },
                byPeriod,
                availablePeriods,
            });
        }

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
