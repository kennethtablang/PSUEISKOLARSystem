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
        public async Task<IActionResult> Overview([FromQuery] int? campusId)
        {
            // Scholar counts
            var scholarQuery = db.ScholarProfiles
                .Include(sp => sp.User)
                .Include(sp => sp.Program)
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.Grades
                    .OrderByDescending(g => g.AcademicYear)
                    .ThenByDescending(g => g.Semester)
                    .Take(1))
                .AsQueryable();

            if (campusId.HasValue)
                scholarQuery = scholarQuery.Where(sp => sp.User!.CampusId == campusId);

            var scholars = await scholarQuery.ToListAsync();

            var totalScholars = scholars.Count;
            var scholarsWithGwa = scholars.Where(sp => sp.Grades.Any()).ToList();
            var compliant = scholarsWithGwa.Count(sp => sp.Grades.First().MeetsRequirement);
            var nonCompliant = scholarsWithGwa.Count(sp => !sp.Grades.First().MeetsRequirement);
            var noGwa = totalScholars - scholarsWithGwa.Count;

            // By program
            var byProgram = scholars
                .Where(sp => sp.Program != null)
                .GroupBy(sp => sp.Program!.Code)
                .Select(g => new { program = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .ToList();

            // By scholarship type
            var byScholarshipType = scholars
                .Where(sp => sp.ScholarshipType != null)
                .GroupBy(sp => sp.ScholarshipType!.Name)
                .Select(g => new { type = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .ToList();

            // Submission stats
            var submissionQuery = db.DocumentSubmissions.AsQueryable();
            if (campusId.HasValue)
                submissionQuery = submissionQuery.Where(s => db.Users
                    .Any(u => u.Id == s.ScholarId && u.CampusId == campusId));
            var submissions = await submissionQuery.ToListAsync();
            var totalSubs = submissions.Count;
            var verifiedSubs = submissions.Count(s => s.Status == DocumentStatus.Verified);
            var pendingSubs = submissions.Count(s => s.Status == DocumentStatus.Pending);
            var incompleteSubs = submissions.Count(s => s.Status == DocumentStatus.Incomplete);

            // Submissions by academic period
            var byPeriod = submissions
                .GroupBy(s => new { s.AcademicYear, s.Semester })
                .Select(g => new
                {
                    period = $"{g.Key.AcademicYear} Sem {g.Key.Semester}",
                    total = g.Count(),
                    verified = g.Count(s => s.Status == DocumentStatus.Verified),
                    pending = g.Count(s => s.Status == DocumentStatus.Pending),
                    incomplete = g.Count(s => s.Status == DocumentStatus.Incomplete),
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
            });
        }
    }
}
