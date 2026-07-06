using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/analytics")]
    [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
    public class AnalyticsController(ApplicationDbContext db) : ControllerBase
    {
        // GET /api/analytics/overview?campusId=
        [HttpGet("overview")]
        public async Task<IActionResult> Overview(
            [FromQuery] int? campusId,
            [FromQuery] string? academicYear = null,
            [FromQuery] int? semester = null)
        {
            // Scholar counts — aggregated in SQL rather than materializing every profile.
            var scholarQuery = db.ScholarProfiles.AsQueryable();
            if (campusId.HasValue)
                scholarQuery = scholarQuery.Where(sp => sp.User!.CampusId == campusId);

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
            if (campusId.HasValue)
                submissionQuery = submissionQuery.Where(s => db.Users
                    .Any(u => u.Id == s.ScholarId && u.CampusId == campusId));

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
    }
}
