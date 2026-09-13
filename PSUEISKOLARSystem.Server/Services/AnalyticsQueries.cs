using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Analytics;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// The overview aggregate, in one place because two screens need it: the Data Visualization
    /// page and the staff dashboard.
    /// <para>
    /// It also stopped issuing one round trip per number: the four submission counts were four
    /// separate scans of the same filtered set, and are now folded out of the by-period GROUP BY
    /// that had to run anyway.
    /// </para>
    /// </summary>
    public sealed class AnalyticsQueries(ApplicationDbContext db)
    {
        public async Task<OverviewDto> OverviewAsync(
            string? academicYear = null, int? semester = null, CancellationToken ct = default)
        {
            var scholars = db.ScholarProfiles.AsQueryable();

            /* Each scholar's verdict is their latest grade's — a correlated "top 1 ordered by
               period" subquery. Grouping by that subquery would count all three buckets in one
               pass, but neither provider will translate a GROUP BY over a correlated
               projection, so these stay as three counts against the same predicate. They are
               indexed lookups; the four submission counts below were the expensive repetition
               and those are folded out of a single GROUP BY. */
            var totalScholars = await scholars.CountAsync(ct);

            var compliant = await scholars.CountAsync(sp => sp.Grades
                .OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester)
                .Select(g => (bool?)g.MeetsRequirement).FirstOrDefault() == true, ct);

            var nonCompliant = await scholars.CountAsync(sp => sp.Grades
                .OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester)
                .Select(g => (bool?)g.MeetsRequirement).FirstOrDefault() == false, ct);

            var noGwa = totalScholars - compliant - nonCompliant;

            /* The group-by projections land in anonymous types and are shaped afterwards.
               A record constructor inside a GroupBy's Select does not translate — the provider
               reports it as an untranslatable expression and the whole query falls over — so
               the DTO is built once the rows are back. */
            var byProgram = (await scholars
                .Where(sp => sp.Program != null)
                .GroupBy(sp => sp.Program!.Code)
                .Select(g => new { Code = g.Key, Count = g.Count() })
                .ToListAsync(ct))
                .OrderByDescending(x => x.Count)
                .Select(x => new ProgramCountDto(x.Code, x.Count))
                .ToList();

            var byScholarshipType = (await scholars
                .Where(sp => sp.ScholarshipType != null)
                .GroupBy(sp => sp.ScholarshipType!.Name)
                .Select(g => new { Name = g.Key, Count = g.Count() })
                .ToListAsync(ct))
                .OrderByDescending(x => x.Count)
                .Select(x => new ScholarshipTypeCountDto(x.Name, x.Count))
                .ToList();

            var submissions = db.DocumentSubmissions.AsQueryable();

            // Before the filter is applied — see the remark on AvailablePeriods.
            var periodKeys = await submissions
                .Select(s => new { s.AcademicYear, s.Semester })
                .Distinct()
                .ToListAsync(ct);

            var availablePeriods = periodKeys
                .OrderByDescending(p => AcademicPeriod.SortKey(p.AcademicYear, p.Semester))
                .Select(p => new PeriodOptionDto(p.AcademicYear, p.Semester, $"{p.AcademicYear} Sem {p.Semester}"))
                .ToList();

            if (!string.IsNullOrWhiteSpace(academicYear))
                submissions = submissions.Where(s => s.AcademicYear == academicYear);
            if (semester is 1 or 2)
                submissions = submissions.Where(s => s.Semester == semester);

            // Submissions by period, grouped in SQL. The overall counts are folded out of this
            // rather than re-queried — the four status counts were four more scans of the same set.
            var byPeriodRaw = await submissions
                .GroupBy(s => new { s.AcademicYear, s.Semester })
                .Select(g => new
                {
                    g.Key.AcademicYear,
                    g.Key.Semester,
                    Total = g.Count(),
                    Verified = g.Count(s => s.Status == DocumentStatus.Verified),
                    Pending = g.Count(s => s.Status == DocumentStatus.Pending),
                    Incomplete = g.Count(s => s.Status == DocumentStatus.Incomplete),
                })
                .ToListAsync(ct);

            var byPeriod = byPeriodRaw
                .OrderBy(x => AcademicPeriod.SortKey(x.AcademicYear, x.Semester))
                .Select(x => new PeriodSubmissionsDto(
                    $"{x.AcademicYear} Sem {x.Semester}", x.Total, x.Verified, x.Pending, x.Incomplete))
                .ToList();

            var counts = new SubmissionCountsDto(
                byPeriodRaw.Sum(x => x.Total),
                byPeriodRaw.Sum(x => x.Verified),
                byPeriodRaw.Sum(x => x.Pending),
                byPeriodRaw.Sum(x => x.Incomplete));

            return new OverviewDto(
                totalScholars, compliant, nonCompliant, noGwa,
                byProgram, byScholarshipType, counts, byPeriod, availablePeriods);
        }
    }
}
