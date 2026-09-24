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

        /// <summary>
        /// GET /api/analytics/demographics?population=scholars|grantees|all&amp;campusId=
        /// <para>
        /// Profile make-up drawn from the Scholar's Data sheet collected at sign-up: campus,
        /// sex, age, civil status, the equity flags (4Ps, IP, PWD, solo parent, first-generation,
        /// working student), household income and support source. Grantee profiles are kept
        /// after their accounts are deactivated, so they keep counting here.
        /// </para>
        /// </summary>
        [HttpGet("demographics")]
        public async Task<IActionResult> Demographics([FromQuery] string? population, [FromQuery] int? campusId)
        {
            population = population?.ToLowerInvariant() switch
            {
                "grantees" => "grantees",
                "all" => "all",
                _ => "scholars",
            };

            var rows = new List<DemographicRow>();

            if (population is "scholars" or "all")
            {
                var q = db.ScholarProfiles.AsQueryable();
                if (campusId is int cid) q = q.Where(sp => sp.CampusId == cid);
                rows.AddRange(await q.Select(sp => new DemographicRow(
                    sp.Campus != null ? sp.Campus.Name : null,
                    sp.Program != null ? sp.Program.Code : null,
                    sp.YearLevel,
                    sp.BirthDate,
                    sp.Personal.Sex,
                    sp.Personal.CivilStatus,
                    sp.Personal.Is4PsBeneficiary,
                    sp.Personal.IsIndigenousPeople,
                    sp.Personal.IsPwd,
                    sp.Personal.IsSoloParent,
                    sp.Personal.IsFirstGenerationStudent,
                    sp.Personal.IsWorkingStudent,
                    sp.Personal.FatherMonthlyIncome,
                    sp.Personal.MotherMonthlyIncome,
                    sp.Personal.FamilyMembers,
                    sp.Personal.MainSupportSource)).ToListAsync());
            }

            if (population is "grantees" or "all")
            {
                var q = db.GranteeProfiles.AsQueryable();
                if (campusId is int cid) q = q.Where(gp => gp.CampusId == cid);
                rows.AddRange(await q.Select(gp => new DemographicRow(
                    gp.Campus != null ? gp.Campus.Name : null,
                    gp.Program != null ? gp.Program.Code : null,
                    gp.YearLevel,
                    gp.BirthDate,
                    gp.Personal.Sex,
                    gp.Personal.CivilStatus,
                    gp.Personal.Is4PsBeneficiary,
                    gp.Personal.IsIndigenousPeople,
                    gp.Personal.IsPwd,
                    gp.Personal.IsSoloParent,
                    gp.Personal.IsFirstGenerationStudent,
                    gp.Personal.IsWorkingStudent,
                    gp.Personal.FatherMonthlyIncome,
                    gp.Personal.MotherMonthlyIncome,
                    gp.Personal.FamilyMembers,
                    gp.Personal.MainSupportSource)).ToListAsync());
            }

            static List<NameCount> Tally(IEnumerable<string?> values, string unknown = "Not stated") =>
                values.GroupBy(v => string.IsNullOrWhiteSpace(v) ? unknown : v!)
                      .Select(g => new NameCount(g.Key, g.Count()))
                      .OrderBy(x => x.Name == unknown ? 1 : 0).ThenByDescending(x => x.Count)
                      .ToList();

            var today = DateTime.UtcNow.Date;
            string AgeBucket(DateTime? birth)
            {
                if (birth is not DateTime b) return "Not stated";
                var age = today.Year - b.Year - (b.Date > today.AddYears(-(today.Year - b.Year)) ? 1 : 0);
                return age switch
                {
                    <= 17 => "17 and below",
                    <= 19 => "18–19",
                    <= 21 => "20–21",
                    <= 24 => "22–24",
                    _ => "25 and above",
                };
            }

            string IncomeBracket(decimal? father, decimal? mother)
            {
                if (father is null && mother is null) return "Not stated";
                var total = (father ?? 0) + (mother ?? 0);
                return total switch
                {
                    < 10_000 => "Below ₱10,000",
                    < 20_000 => "₱10,000–19,999",
                    < 30_000 => "₱20,000–29,999",
                    < 50_000 => "₱30,000–49,999",
                    _ => "₱50,000 and above",
                };
            }

            string[] ageOrder = ["17 and below", "18–19", "20–21", "22–24", "25 and above", "Not stated"];
            string[] incomeOrder = ["Below ₱10,000", "₱10,000–19,999", "₱20,000–29,999", "₱30,000–49,999", "₱50,000 and above", "Not stated"];

            var total = rows.Count;
            return Ok(new
            {
                population,
                total,
                byCampus = Tally(rows.Select(r => r.Campus), "No campus"),
                bySex = Tally(rows.Select(r => r.Sex)),
                byCivilStatus = Tally(rows.Select(r => r.CivilStatus)),
                bySupportSource = Tally(rows.Select(r => r.SupportSource)),
                byYearLevel = rows.GroupBy(r => r.YearLevel).OrderBy(g => g.Key)
                    .Select(g => new NameCount($"Year {g.Key}", g.Count())).ToList(),
                byAge = ageOrder.Select(a => new NameCount(a, rows.Count(r => AgeBucket(r.BirthDate) == a)))
                    .Where(x => x.Count > 0).ToList(),
                byIncome = incomeOrder.Select(b => new NameCount(b, rows.Count(r => IncomeBracket(r.FatherIncome, r.MotherIncome) == b)))
                    .Where(x => x.Count > 0).ToList(),
                flags = new[]
                {
                    new FlagCount("4Ps beneficiary", rows.Count(r => r.Is4Ps), total),
                    new FlagCount("Indigenous Peoples", rows.Count(r => r.IsIp), total),
                    new FlagCount("Person with disability", rows.Count(r => r.IsPwd), total),
                    new FlagCount("Solo parent / child of solo parent", rows.Count(r => r.IsSoloParent), total),
                    new FlagCount("First-generation college student", rows.Count(r => r.IsFirstGen), total),
                    new FlagCount("Working student", rows.Count(r => r.IsWorking), total),
                },
                averageFamilySize = rows.Where(r => r.FamilyMembers is not null).Select(r => (double)r.FamilyMembers!.Value)
                    .DefaultIfEmpty().Average(),
            });
        }

        /// <summary>
        /// GET /api/analytics/grantees — grantee accounts and the grants paid under each type.
        /// Deactivated grantees and closed grant types are included on purpose: closing a grant
        /// ends access, not the record.
        /// </summary>
        [HttpGet("grantees")]
        public async Task<IActionResult> Grantees([FromQuery] int? campusId)
        {
            var grantees = db.GranteeProfiles.AsQueryable();
            if (campusId is int cid) grantees = grantees.Where(g => g.CampusId == cid);

            var totalGrantees = await grantees.CountAsync();
            var activeAccounts = await grantees.CountAsync(g => g.User.IsActive);

            var granteeIds = grantees.Select(g => g.UserId);
            var scholarIds = campusId is int c2
                ? db.ScholarProfiles.Where(sp => sp.CampusId == c2).Select(sp => sp.UserId)
                : db.ScholarProfiles.Select(sp => sp.UserId);

            var grants = db.OneTimeGrants.Where(g =>
                g.ReleaseStatus != GrantReleaseStatuses.Cancelled &&
                (granteeIds.Contains(g.ScholarId) || scholarIds.Contains(g.ScholarId)));

            var scholarGrantees = await grants.Where(g => scholarIds.Contains(g.ScholarId))
                .Select(g => g.ScholarId).Distinct().CountAsync();

            var byType = await grants
                .GroupBy(g => new
                {
                    g.GrantTypeId,
                    Name = g.GrantType != null ? g.GrantType.Name : g.Title,
                    IsActive = g.GrantType == null || g.GrantType.IsActive,
                })
                .Select(g => new
                {
                    grantTypeId = g.Key.GrantTypeId,
                    name = g.Key.Name,
                    isActive = g.Key.IsActive,
                    recipients = g.Select(x => x.ScholarId).Distinct().Count(),
                    granteeRecipients = g.Where(x => granteeIds.Contains(x.ScholarId)).Select(x => x.ScholarId).Distinct().Count(),
                    scholarRecipients = g.Where(x => scholarIds.Contains(x.ScholarId)).Select(x => x.ScholarId).Distinct().Count(),
                    released = g.Count(x => x.ReleaseStatus == GrantReleaseStatuses.Released),
                    pending = g.Count(x => x.ReleaseStatus == GrantReleaseStatuses.Pending),
                    releasedAmount = g.Where(x => x.ReleaseStatus == GrantReleaseStatuses.Released).Sum(x => (decimal?)x.Amount) ?? 0m,
                    pendingAmount = g.Where(x => x.ReleaseStatus == GrantReleaseStatuses.Pending).Sum(x => (decimal?)x.Amount) ?? 0m,
                })
                .OrderByDescending(x => x.releasedAmount + x.pendingAmount)
                .ToListAsync();

            var byCampus = await grantees
                .GroupBy(g => g.Campus != null ? g.Campus.Name : "No campus")
                .Select(g => new { name = g.Key, count = g.Count(), active = g.Count(x => x.User.IsActive) })
                .OrderByDescending(x => x.count)
                .ToListAsync();

            var byMonth = (await grants
                    .Where(g => g.ReleaseStatus == GrantReleaseStatuses.Released && g.ReleasedAt != null)
                    .GroupBy(g => new { g.ReleasedAt!.Value.Year, g.ReleasedAt!.Value.Month })
                    .Select(g => new { g.Key.Year, g.Key.Month, amount = g.Sum(x => x.Amount), count = g.Count() })
                    .ToListAsync())
                .OrderBy(x => x.Year).ThenBy(x => x.Month)
                .Select(x => new { label = new DateTime(x.Year, x.Month, 1).ToString("MMM yyyy"), x.amount, x.count })
                .ToList();

            return Ok(new
            {
                totalGrantees,
                activeAccounts,
                deactivatedAccounts = totalGrantees - activeAccounts,
                scholarGrantees,
                releasedAmount = byType.Sum(t => t.releasedAmount),
                pendingAmount = byType.Sum(t => t.pendingAmount),
                byType,
                byCampus,
                byMonth,
            });
        }

        private record DemographicRow(
            string? Campus, string? Program, int YearLevel, DateTime? BirthDate,
            string? Sex, string? CivilStatus,
            bool Is4Ps, bool IsIp, bool IsPwd, bool IsSoloParent, bool IsFirstGen, bool IsWorking,
            decimal? FatherIncome, decimal? MotherIncome, int? FamilyMembers, string? SupportSource);

        private record NameCount(string Name, int Count);

        private record FlagCount(string Name, int Count, int Total);

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
