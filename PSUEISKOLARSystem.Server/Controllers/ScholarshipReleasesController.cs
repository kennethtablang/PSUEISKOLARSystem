using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    /// <summary>
    /// Recurring scholarship payouts — the per-semester and per-year money a scholar receives
    /// for holding their scholarship, as opposed to the one-off awards in
    /// <see cref="OneTimeGrantsController"/>.
    /// <para>
    /// The endpoint that matters is <c>GET /monitor</c>: for one scholarship type in one
    /// academic period it lists every scholar who holds it and says whether each has been paid.
    /// Scholars with no release row at all are reported as <c>NotRecorded</c> rather than
    /// omitted — an unbilled scholar is exactly what the report is for.
    /// </para>
    /// </summary>
    [ApiController]
    [Route("api/scholarship-releases")]
    [Authorize]
    public class ScholarshipReleasesController(ApplicationDbContext db, INotificationService notifications) : ControllerBase
    {
        private const string StaffRoles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}";

        // GET /api/scholarship-releases?scholarshipTypeId=&academicYear=&semester=&status=&search=&page=&pageSize=
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] int? scholarshipTypeId,
            [FromQuery] string? academicYear,
            [FromQuery] int? semester,
            [FromQuery] string? status,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isStaff = IsStaff();

            var query = db.ScholarshipReleases.AsQueryable();

            // Scholars only ever see their own releases.
            if (!isStaff) query = query.Where(r => r.ScholarId == currentUserId);

            if (scholarshipTypeId is int typeId) query = query.Where(r => r.ScholarshipTypeId == typeId);
            if (!string.IsNullOrWhiteSpace(academicYear)) query = query.Where(r => r.AcademicYear == academicYear.Trim());
            if (semester is int sem) query = query.Where(r => r.Semester == sem);

            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!GrantReleaseStatuses.All.Contains(status))
                    return BadRequest(new { message = "Invalid release status." });
                query = query.Where(r => r.Status == status);
            }

            if (isStaff && !string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(r =>
                    EF.Functions.Like((r.Scholar.FirstName + " " + r.Scholar.LastName).ToLower(), $"%{s}%") ||
                    EF.Functions.Like(r.ScholarshipType.Name.ToLower(), $"%{s}%") ||
                    (r.ReferenceNo != null && EF.Functions.Like(r.ReferenceNo.ToLower(), $"%{s}%")));
            }

            /* All four headline figures come out of one grouped pass over the filtered set.
               They used to be a Count, a Sum, a filtered Sum and another Count — four round
               trips each re-evaluating the same predicate, which on a filtered search means
               running the LIKE four times. */
            var byStatus = await query
                .GroupBy(r => r.Status)
                .Select(g => new { Status = g.Key, Count = g.Count(), Amount = g.Sum(r => r.Amount) })
                .ToListAsync();

            var total = byStatus.Sum(g => g.Count);
            var totalAmount = byStatus.Sum(g => g.Amount);
            var released = byStatus.FirstOrDefault(g => g.Status == GrantReleaseStatuses.Released);
            var releasedAmount = released?.Amount ?? 0m;
            var pendingCount = byStatus.FirstOrDefault(g => g.Status == GrantReleaseStatuses.Pending)?.Count ?? 0;

            var items = await query
                .OrderByDescending(r => r.AcademicYear)
                .ThenByDescending(r => r.Semester)
                .ThenBy(r => r.Scholar.LastName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(Project)
                .ToListAsync();

            return Ok(new
            {
                total,
                page,
                pageSize,
                // Envelope kept as-is because it carries money totals alongside the page;
                // only the page-count arithmetic is shared (see PagedResult).
                totalPages = PagedResult<object>.PageCount(total, pageSize),
                totalAmount,
                releasedAmount,
                pendingAmount = totalAmount - releasedAmount,
                pendingCount,
                items,
            });
        }

        /// <summary>
        /// GET /api/scholarship-releases/monitor?scholarshipTypeId=&amp;academicYear=&amp;semester=
        /// <para>
        /// "Has this scholar received this scholarship?" — one row per scholar currently
        /// holding the type, joined to their release for the period if one exists.
        /// </para>
        /// </summary>
        [HttpGet("monitor")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Monitor(
            [FromQuery] int scholarshipTypeId,
            [FromQuery] string academicYear,
            [FromQuery] int semester)
        {
            var type = await db.ScholarshipTypes.FindAsync(scholarshipTypeId);
            if (type is null) return NotFound(new { message = "Scholarship type not found." });

            var periodError = ValidatePeriod(type.Frequency, academicYear, semester, out var year);
            if (periodError is not null) return BadRequest(new { message = periodError });

            // The holders of the scholarship are the denormalised pointers on the profiles —
            // the same source the slot tracker counts, so the two never disagree.
            var rows = await db.ScholarProfiles
                .Where(sp => sp.ScholarshipTypeId == scholarshipTypeId)
                .OrderBy(sp => sp.User.LastName).ThenBy(sp => sp.User.FirstName)
                .Select(sp => new
                {
                    ScholarId = sp.UserId,
                    ScholarName = sp.User.MiddleName != null
                        ? sp.User.FirstName + " " + sp.User.MiddleName + " " + sp.User.LastName
                        : sp.User.FirstName + " " + sp.User.LastName,
                    ScholarEmail = sp.User.Email,
                    sp.StudentId,
                    sp.LifecycleStatus,
                    Release = db.ScholarshipReleases
                        .Where(r => r.ScholarId == sp.UserId
                                 && r.ScholarshipTypeId == scholarshipTypeId
                                 && r.AcademicYear == year
                                 && r.Semester == semester)
                        .Select(r => new
                        {
                            r.Id,
                            r.Amount,
                            r.Status,
                            r.ReleasedAt,
                            r.ReferenceNo,
                            r.Notes,
                        })
                        .FirstOrDefault(),
                })
                .ToListAsync();

            var scholars = rows.Select(r => new
            {
                r.ScholarId,
                r.ScholarName,
                r.ScholarEmail,
                r.StudentId,
                r.LifecycleStatus,
                // NotRecorded is its own state: nobody has even scheduled this scholar's payout.
                Status = r.Release?.Status ?? "NotRecorded",
                Received = r.Release != null && r.Release.Status == GrantReleaseStatuses.Released,
                ReleaseId = r.Release?.Id,
                Amount = r.Release?.Amount,
                ReleasedAt = r.Release?.ReleasedAt,
                ReferenceNo = r.Release?.ReferenceNo,
                Notes = r.Release?.Notes,
            }).ToList();

            return Ok(new
            {
                scholarshipType = new { type.Id, type.Name, type.Frequency, type.Amount },
                academicYear = year,
                semester,
                periodLabel = PeriodLabel(year, semester),
                totalScholars = scholars.Count,
                received = scholars.Count(s => s.Received),
                pending = scholars.Count(s => s.Status == GrantReleaseStatuses.Pending),
                cancelled = scholars.Count(s => s.Status == GrantReleaseStatuses.Cancelled),
                notRecorded = scholars.Count(s => s.Status == "NotRecorded"),
                releasedAmount = scholars.Where(s => s.Received).Sum(s => s.Amount ?? 0m),
                scholars,
            });
        }

        /// <summary>
        /// GET /api/scholarship-releases/scholar/{scholarId} — every release on record for one
        /// scholar, newest period first. Backs the ledger on a scholar's detail page.
        /// </summary>
        [HttpGet("scholar/{scholarId}")]
        public async Task<IActionResult> ForScholar(string scholarId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            if (!IsStaff() && scholarId != currentUserId) return Forbid();

            var items = await db.ScholarshipReleases
                .Where(r => r.ScholarId == scholarId)
                .OrderByDescending(r => r.AcademicYear)
                .ThenByDescending(r => r.Semester)
                .Select(Project)
                .ToListAsync();

            return Ok(items);
        }

        /// <summary>
        /// GET /api/scholarship-releases/periods — periods that already have releases, plus the
        /// active semester, so a picker never starts empty.
        /// </summary>
        [HttpGet("periods")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Periods()
        {
            var recorded = await db.ScholarshipReleases
                .Select(r => new { r.AcademicYear, r.Semester })
                .Distinct()
                .ToListAsync();

            var active = await db.ActiveSemesters.OrderByDescending(a => a.UpdatedAt).FirstOrDefaultAsync();

            var all = recorded
                .Select(p => (p.AcademicYear, p.Semester))
                .ToHashSet();

            if (active is not null)
            {
                // Offer both semesters of the current year and the whole-year slot, whether or
                // not anything has been recorded against them yet.
                all.Add((active.AcademicYear, 1));
                all.Add((active.AcademicYear, 2));
                all.Add((active.AcademicYear, ScholarshipFrequencies.WholeYearSemester));
            }

            var ordered = all
                .OrderByDescending(p => AcademicPeriod.SortKey(p.Item1, p.Item2))
                .Select(p => new
                {
                    academicYear = p.Item1,
                    semester = p.Item2,
                    label = PeriodLabel(p.Item1, p.Item2),
                })
                .ToList();

            return Ok(new
            {
                activeAcademicYear = active?.AcademicYear,
                activeSemester = active?.Semester,
                periods = ordered,
            });
        }

        // POST /api/scholarship-releases  — record (or update) one scholar's payout for a period
        [HttpPost]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Upsert(ScholarshipReleaseRequest dto)
        {
            var type = await db.ScholarshipTypes.FindAsync(dto.ScholarshipTypeId);
            if (type is null) return BadRequest(new { message = "Scholarship type not found." });

            var periodError = ValidatePeriod(type.Frequency, dto.AcademicYear, dto.Semester, out var year);
            if (periodError is not null) return BadRequest(new { message = periodError });

            var amountError = ValidateAmount(dto.Amount);
            if (amountError is not null) return BadRequest(new { message = amountError });

            var scholar = await db.Users.FirstOrDefaultAsync(u => u.Id == dto.ScholarId);
            if (scholar is null) return BadRequest(new { message = "Scholar not found." });

            var holdsType = await db.ScholarProfiles
                .AnyAsync(sp => sp.UserId == dto.ScholarId && sp.ScholarshipTypeId == dto.ScholarshipTypeId);
            if (!holdsType)
                return BadRequest(new { message = $"{scholar.FullName} is not registered under {type.Name}." });

            var existing = await db.ScholarshipReleases.FirstOrDefaultAsync(r =>
                r.ScholarId == dto.ScholarId &&
                r.ScholarshipTypeId == dto.ScholarshipTypeId &&
                r.AcademicYear == year &&
                r.Semester == dto.Semester);

            if (existing is not null)
            {
                if (existing.Status == GrantReleaseStatuses.Released)
                    return BadRequest(new { message = "This period has already been released and can no longer be edited." });

                existing.Amount = dto.Amount;
                existing.Notes = Trim(dto.Notes);
                db.Audit(this, "UpdateScholarshipRelease",
                    $"Updated {type.Name} release for {scholar.FullName} — {PeriodLabel(year, dto.Semester)}");
                await db.SaveChangesAsync();
                return Ok(new { existing.Id, updated = true });
            }

            var release = new ScholarshipRelease
            {
                ScholarId = dto.ScholarId,
                ScholarshipTypeId = dto.ScholarshipTypeId,
                AcademicYear = year,
                Semester = dto.Semester,
                Amount = dto.Amount,
                Notes = Trim(dto.Notes),
                RecordedById = User.FindFirstValue(ClaimTypes.NameIdentifier),
            };

            db.ScholarshipReleases.Add(release);
            db.Audit(this, "CreateScholarshipRelease",
                $"Scheduled {type.Name} release of {dto.Amount:N2} for {scholar.FullName} — {PeriodLabel(year, dto.Semester)}");
            await db.SaveChangesAsync();

            return Ok(new { release.Id, updated = false });
        }

        /// <summary>
        /// POST /api/scholarship-releases/generate — open a pending row for every scholar
        /// holding the type who has none for the period. Idempotent: run it twice and the
        /// second run creates nothing.
        /// </summary>
        [HttpPost("generate")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Generate(GenerateReleasesRequest dto)
        {
            var type = await db.ScholarshipTypes.FindAsync(dto.ScholarshipTypeId);
            if (type is null) return BadRequest(new { message = "Scholarship type not found." });

            if (!ScholarshipFrequencies.IsRecurring(type.Frequency))
                return BadRequest(new
                {
                    message = $"{type.Name} is a one-time scholarship, so it has no per-period releases. " +
                              "Change its frequency to per semester or per year first, or record a one-time grant instead."
                });

            var periodError = ValidatePeriod(type.Frequency, dto.AcademicYear, dto.Semester, out var year);
            if (periodError is not null) return BadRequest(new { message = periodError });

            var amount = dto.Amount ?? type.Amount ?? 0m;
            var amountError = ValidateAmount(amount);
            if (amountError is not null)
                return BadRequest(new
                {
                    message = amount <= 0
                        ? $"{type.Name} has no standard amount set, so an amount is required here."
                        : amountError
                });

            /* Only scholars still holding the scholarship. Selecting every profile pointing at
               the type meant a period rollover opened a pending payout for every alumnus who
               had ever held it, and each one then sat in the monitor as unpaid. */
            var holders = await db.ScholarProfiles
                .Where(sp => sp.ScholarshipTypeId == dto.ScholarshipTypeId
                          && LifecycleStatuses.Holding.Contains(sp.LifecycleStatus))
                .Select(sp => sp.UserId)
                .ToListAsync();

            var already = await db.ScholarshipReleases
                .Where(r => r.ScholarshipTypeId == dto.ScholarshipTypeId
                         && r.AcademicYear == year
                         && r.Semester == dto.Semester)
                .Select(r => r.ScholarId)
                .ToListAsync();

            var missing = holders.Except(already).ToList();

            var recordedById = User.FindFirstValue(ClaimTypes.NameIdentifier);
            foreach (var scholarId in missing)
            {
                db.ScholarshipReleases.Add(new ScholarshipRelease
                {
                    ScholarId = scholarId,
                    ScholarshipTypeId = dto.ScholarshipTypeId,
                    AcademicYear = year,
                    Semester = dto.Semester,
                    Amount = amount,
                    RecordedById = recordedById,
                });
            }

            if (missing.Count > 0)
                db.Audit(this, "GenerateScholarshipReleases",
                    $"Opened {missing.Count} pending {type.Name} release(s) for {PeriodLabel(year, dto.Semester)} at {amount:N2} each");

            await db.SaveChangesAsync();

            _ = notifications.BroadcastAsync("AnalyticsChanged");

            return Ok(new
            {
                created = missing.Count,
                skipped = already.Count,
                holders = holders.Count,
                amount,
            });
        }

        // PATCH /api/scholarship-releases/{id}/release
        [HttpPatch("{id}/release")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Release(int id, ReleaseScholarshipRequest dto)
        {
            var release = await db.ScholarshipReleases
                .Include(r => r.Scholar)
                .Include(r => r.ScholarshipType)
                .FirstOrDefaultAsync(r => r.Id == id);
            if (release is null) return NotFound();

            if (release.Status != GrantReleaseStatuses.Pending)
                return BadRequest(new { message = $"Only a pending release can be released (this one is {release.Status})." });

            var releasedAt = dto.ReleasedAt ?? DateTime.UtcNow;
            if (releasedAt > DateTime.UtcNow.AddDays(1))
                return BadRequest(new { message = "Release date cannot be in the future." });
            // A typing slip in the year (0202) would otherwise enter the disbursement record,
            // which cannot be edited once released.
            if (releasedAt < new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc))
                return BadRequest(new { message = "Release date must be in the year 2000 or later." });

            release.Status = GrantReleaseStatuses.Released;
            release.ReleasedAt = releasedAt;
            release.ReferenceNo = Trim(dto.ReferenceNo);

            var period = PeriodLabel(release.AcademicYear, release.Semester);
            db.Audit(this, "ReleaseScholarship",
                $"Released {release.ScholarshipType.Name} ({release.Amount:N2}) to {release.Scholar.FullName} for {period}" +
                (string.IsNullOrWhiteSpace(release.ReferenceNo) ? "" : $" — ref {release.ReferenceNo}"));
            await db.SaveChangesAsync();

            await notifications.CreateAsync(
                release.ScholarId,
                "Scholarship released",
                $"Your {release.ScholarshipType.Name} for {period} (PHP {release.Amount:N2}) has been released" +
                (string.IsNullOrWhiteSpace(release.ReferenceNo) ? "." : $" under reference {release.ReferenceNo}."),
                NotificationCategories.Account,
                "/my-profile");

            _ = notifications.BroadcastAsync("AnalyticsChanged");
            return Ok(new { release.Status, release.ReleasedAt, release.ReferenceNo });
        }

        // PATCH /api/scholarship-releases/{id}/cancel
        [HttpPatch("{id}/cancel")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Cancel(int id, CancelReleaseRequest dto)
        {
            var release = await db.ScholarshipReleases
                .Include(r => r.Scholar)
                .Include(r => r.ScholarshipType)
                .FirstOrDefaultAsync(r => r.Id == id);
            if (release is null) return NotFound();

            if (release.Status == GrantReleaseStatuses.Released)
                return BadRequest(new { message = "A released payout cannot be cancelled — it is part of the disbursement record." });
            if (release.Status == GrantReleaseStatuses.Cancelled)
                return BadRequest(new { message = "This release is already cancelled." });
            if (string.IsNullOrWhiteSpace(dto.Reason))
                return BadRequest(new { message = "A reason is required when cancelling a release." });

            release.Status = GrantReleaseStatuses.Cancelled;
            release.Notes = string.IsNullOrWhiteSpace(release.Notes)
                ? $"Cancelled: {dto.Reason.Trim()}"
                : $"{release.Notes}\nCancelled: {dto.Reason.Trim()}";

            db.Audit(this, "CancelScholarshipRelease",
                $"Cancelled {release.ScholarshipType.Name} release for {release.Scholar.FullName} " +
                $"({PeriodLabel(release.AcademicYear, release.Semester)}) — {dto.Reason.Trim()}");
            await db.SaveChangesAsync();

            _ = notifications.BroadcastAsync("AnalyticsChanged");
            return Ok(new { release.Status });
        }

        // DELETE /api/scholarship-releases/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Delete(int id)
        {
            var release = await db.ScholarshipReleases.FindAsync(id);
            if (release is null) return NotFound();

            if (release.Status == GrantReleaseStatuses.Released)
                return BadRequest(new { message = "A released payout is part of the disbursement record and cannot be deleted." });

            db.Audit(this, "DeleteScholarshipRelease", $"Deleted scholarship release #{id}");
            db.ScholarshipReleases.Remove(release);
            await db.SaveChangesAsync();
            return NoContent();
        }

        /* ── helpers ────────────────────────────────────────── */

        private bool IsStaff() =>
            User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

        /// <summary>
        /// The shared row shape for every list endpoint. Kept as an expression tree rather than
        /// a method so EF composes it into SQL instead of pulling entities into memory first.
        /// </summary>
        private static readonly System.Linq.Expressions.Expression<Func<ScholarshipRelease, ReleaseRow>> Project = r => new ReleaseRow(
            r.Id,
            r.ScholarId,
            r.Scholar.MiddleName != null
                ? r.Scholar.FirstName + " " + r.Scholar.MiddleName + " " + r.Scholar.LastName
                : r.Scholar.FirstName + " " + r.Scholar.LastName,
            r.Scholar.Email,
            r.ScholarshipTypeId,
            r.ScholarshipType.Name,
            r.ScholarshipType.Frequency,
            r.AcademicYear,
            r.Semester,
            r.Semester == ScholarshipFrequencies.WholeYearSemester
                ? r.AcademicYear + " (whole year)"
                : r.AcademicYear + " · Sem " + r.Semester,
            r.Amount,
            r.Status,
            r.ReleasedAt,
            r.ReferenceNo,
            r.Notes,
            r.RecordedBy != null ? r.RecordedBy.FirstName + " " + r.RecordedBy.LastName : null,
            r.CreatedAt);

        private static string PeriodLabel(string academicYear, int semester) =>
            semester == ScholarshipFrequencies.WholeYearSemester
                ? $"{academicYear} (whole year)"
                : $"{academicYear} · Sem {semester}";

        /// <summary>
        /// Checks the period against the scholarship's own frequency — a per-year scholarship
        /// has no semester 1, and a per-semester one has no whole-year slot. Returns null when
        /// valid and hands back the normalised academic year.
        /// </summary>
        private static string? ValidatePeriod(string frequency, string? academicYear, int semester, out string year)
        {
            year = academicYear?.Trim() ?? string.Empty;

            if (!ScholarshipFrequencies.IsRecurring(frequency))
                return "This scholarship is one-time, so it has no per-period releases.";

            var expected = ScholarshipFrequencies.SemestersFor(frequency);
            if (!expected.Contains(semester))
                return frequency == ScholarshipFrequencies.PerYear
                    ? "This scholarship pays once a year, so its releases are recorded against the whole academic year."
                    : "This scholarship pays per semester, so a semester of 1 or 2 is required.";

            // Semester 0 can't go through AcademicPeriod.TryParse (it only knows 1 and 2), so
            // the year is checked against semester 1 and the real semester validated above.
            if (!AcademicPeriod.TryParse(year, semester == ScholarshipFrequencies.WholeYearSemester ? 1 : semester, out var parsed, out var error))
                return error;

            year = parsed.AcademicYear;
            return null;
        }

        private static string? ValidateAmount(decimal amount)
        {
            if (amount <= 0) return "Amount must be greater than zero.";
            if (amount > 10_000_000m) return "Amount looks too large — please check the figure.";
            return null;
        }

        private static string? Trim(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    /// <summary>One release as the client sees it. Shared by every list endpoint.</summary>
    public record ReleaseRow(
        int Id,
        string ScholarId,
        string ScholarName,
        string? ScholarEmail,
        int ScholarshipTypeId,
        string ScholarshipTypeName,
        string Frequency,
        string AcademicYear,
        int Semester,
        string PeriodLabel,
        decimal Amount,
        string Status,
        DateTime? ReleasedAt,
        string? ReferenceNo,
        string? Notes,
        string? RecordedBy,
        DateTime CreatedAt);

    public record ScholarshipReleaseRequest(
        string ScholarId,
        int ScholarshipTypeId,
        string AcademicYear,
        int Semester,
        decimal Amount,
        string? Notes);

    public record GenerateReleasesRequest(
        int ScholarshipTypeId,
        string AcademicYear,
        int Semester,
        decimal? Amount);

    public record ReleaseScholarshipRequest(string? ReferenceNo, DateTime? ReleasedAt);

    public record CancelReleaseRequest(string Reason);
}
