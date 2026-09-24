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
            [FromQuery] int semester,
            [FromQuery] int? campusId,
            [FromQuery] int? yearLevel)
        {
            var type = await db.ScholarshipTypes.FindAsync(scholarshipTypeId);
            if (type is null) return NotFound(new { message = "Scholarship type not found." });

            var periodError = ValidatePeriod(type.Frequency, academicYear, semester, out var year);
            if (periodError is not null) return BadRequest(new { message = periodError });

            // The holders of the scholarship are the denormalised pointers on the profiles —
            // the same source the slot tracker counts, so the two never disagree.
            var holders = db.ScholarProfiles.Where(sp => sp.ScholarshipTypeId == scholarshipTypeId);
            if (campusId is int cid) holders = holders.Where(sp => sp.CampusId == cid);
            if (yearLevel is int yl) holders = holders.Where(sp => sp.YearLevel == yl);

            var rows = await holders
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
                    sp.CampusId,
                    CampusName = sp.Campus != null ? sp.Campus.Name : null,
                    sp.YearLevel,
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
                            r.ScheduledDate,
                            r.YearLevel,
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
                r.CampusId,
                r.CampusName,
                ProfileYearLevel = r.YearLevel,
                ReleaseYearLevel = r.Release?.YearLevel,
                ScheduledDate = r.Release?.ScheduledDate,
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

            var profileInfo = await db.ScholarProfiles
                .Where(sp => sp.UserId == dto.ScholarId && sp.ScholarshipTypeId == dto.ScholarshipTypeId)
                .Select(sp => new { sp.YearLevel, sp.CampusId })
                .FirstOrDefaultAsync();
            if (profileInfo is null)
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
                existing.ScheduledDate = dto.ScheduledDate?.Date ?? existing.ScheduledDate;
                existing.YearLevel = dto.YearLevel ?? existing.YearLevel;
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
                ScheduledDate = dto.ScheduledDate?.Date,
                YearLevel = dto.YearLevel ?? profileInfo?.YearLevel,
                CampusId = profileInfo?.CampusId,
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

        /// <summary>
        /// POST /api/scholarship-releases/schedule — schedules one scholarship type's payout for
        /// a period in a single step: the campuses receiving on the chosen date, the year level
        /// being paid, and the scholars included (all holders in those campuses, or a hand-picked
        /// subset). Existing pending rows are rescheduled; released ones are left alone.
        /// </summary>
        [HttpPost("schedule")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> Schedule(ScheduleReleasesRequest dto)
        {
            var type = await db.ScholarshipTypes.FindAsync(dto.ScholarshipTypeId);
            if (type is null) return BadRequest(new { message = "Scholarship type not found." });

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

            if (dto.ScheduledDate is null)
                return BadRequest(new { message = "Choose the release date." });
            var scheduledDate = dto.ScheduledDate.Value.Date;
            if (scheduledDate.Year < 2000)
                return BadRequest(new { message = "Release date must be in the year 2000 or later." });

            if (dto.YearLevel is int y && (y < 1 || y > 6))
                return BadRequest(new { message = "Year level must be between 1 and 6." });

            var campusIds = (dto.CampusIds ?? []).Distinct().ToList();
            if (campusIds.Count == 0)
                return BadRequest(new { message = "Choose at least one campus that receives on this date." });

            var holders = db.ScholarProfiles
                .Where(sp => sp.ScholarshipTypeId == dto.ScholarshipTypeId
                          && LifecycleStatuses.Holding.Contains(sp.LifecycleStatus)
                          && sp.CampusId != null && campusIds.Contains(sp.CampusId.Value));

            if (dto.FilterYearLevel is int fy) holders = holders.Where(sp => sp.YearLevel == fy);

            var selected = await holders
                .Select(sp => new { sp.UserId, sp.CampusId, sp.YearLevel })
                .ToListAsync();

            if (dto.ScholarIds is { Count: > 0 })
            {
                var wanted = dto.ScholarIds.ToHashSet();
                selected = selected.Where(s => wanted.Contains(s.UserId)).ToList();
            }

            if (selected.Count == 0)
                return BadRequest(new { message = "No scholars holding this scholarship match the selected campuses and year level." });

            var ids = selected.Select(s => s.UserId).ToList();
            var existing = await db.ScholarshipReleases
                .Where(r => r.ScholarshipTypeId == dto.ScholarshipTypeId
                         && r.AcademicYear == year
                         && r.Semester == dto.Semester
                         && ids.Contains(r.ScholarId))
                .ToDictionaryAsync(r => r.ScholarId);

            var recordedById = User.FindFirstValue(ClaimTypes.NameIdentifier);
            int created = 0, rescheduled = 0, skipped = 0;

            foreach (var s in selected)
            {
                if (existing.TryGetValue(s.UserId, out var row))
                {
                    if (row.Status != GrantReleaseStatuses.Pending) { skipped++; continue; }
                    row.Amount = amount;
                    row.ScheduledDate = scheduledDate;
                    row.CampusId = s.CampusId;
                    row.YearLevel = dto.YearLevel ?? s.YearLevel;
                    if (!string.IsNullOrWhiteSpace(dto.Notes)) row.Notes = dto.Notes.Trim();
                    rescheduled++;
                    continue;
                }

                db.ScholarshipReleases.Add(new ScholarshipRelease
                {
                    ScholarId = s.UserId,
                    ScholarshipTypeId = dto.ScholarshipTypeId,
                    AcademicYear = year,
                    Semester = dto.Semester,
                    Amount = amount,
                    ScheduledDate = scheduledDate,
                    CampusId = s.CampusId,
                    YearLevel = dto.YearLevel ?? s.YearLevel,
                    Notes = Trim(dto.Notes),
                    RecordedById = recordedById,
                });
                created++;
            }

            var campusNames = await db.Campuses.Where(c => campusIds.Contains(c.Id)).Select(c => c.Name).ToListAsync();
            db.Audit(this, "ScheduleScholarshipReleases",
                $"Scheduled {type.Name} for {PeriodLabel(year, dto.Semester)} on {scheduledDate:MMM d, yyyy} " +
                $"({string.Join(", ", campusNames)}): {created} new, {rescheduled} rescheduled at {amount:N2} each");
            await db.SaveChangesAsync();

            // Tell each scholar when to expect it.
            foreach (var s in selected.Where(s => !existing.TryGetValue(s.UserId, out var r) || r.Status == GrantReleaseStatuses.Pending))
                await notifications.CreateAsync(
                    s.UserId,
                    "Scholarship release scheduled",
                    $"Your {type.Name} for {PeriodLabel(year, dto.Semester)} (PHP {amount:N2}) is scheduled for release on {scheduledDate:MMMM d, yyyy}.",
                    NotificationCategories.Account,
                    "/my-profile");

            _ = notifications.BroadcastAsync("AnalyticsChanged");
            return Ok(new { created, rescheduled, skipped, total = selected.Count, amount });
        }

        /// <summary>
        /// POST /api/scholarship-releases/release-batch — marks several pending releases as
        /// released in one go, typically everyone who received on the scheduled day.
        /// </summary>
        [HttpPost("release-batch")]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> ReleaseBatch(ReleaseBatchRequest dto)
        {
            var ids = (dto.ReleaseIds ?? []).Distinct().ToList();
            if (ids.Count == 0) return BadRequest(new { message = "Select at least one release." });

            var releasedAt = dto.ReleasedAt ?? DateTime.UtcNow;
            if (releasedAt > DateTime.UtcNow.AddDays(1))
                return BadRequest(new { message = "Release date cannot be in the future." });
            if (releasedAt < new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc))
                return BadRequest(new { message = "Release date must be in the year 2000 or later." });

            var releases = await db.ScholarshipReleases
                .Include(r => r.ScholarshipType)
                .Where(r => ids.Contains(r.Id) && r.Status == GrantReleaseStatuses.Pending)
                .ToListAsync();

            foreach (var r in releases)
            {
                r.Status = GrantReleaseStatuses.Released;
                r.ReleasedAt = releasedAt;
                if (!string.IsNullOrWhiteSpace(dto.ReferenceNo)) r.ReferenceNo = dto.ReferenceNo.Trim();
            }

            if (releases.Count > 0)
                db.Audit(this, "ReleaseScholarshipBatch",
                    $"Marked {releases.Count} scholarship release(s) as released" +
                    (string.IsNullOrWhiteSpace(dto.ReferenceNo) ? "" : $" — ref {dto.ReferenceNo.Trim()}"));
            await db.SaveChangesAsync();

            foreach (var r in releases)
                await notifications.CreateAsync(
                    r.ScholarId,
                    "Scholarship released",
                    $"Your {r.ScholarshipType.Name} for {PeriodLabel(r.AcademicYear, r.Semester)} (PHP {r.Amount:N2}) has been released.",
                    NotificationCategories.Account,
                    "/my-profile");

            _ = notifications.BroadcastAsync("AnalyticsChanged");
            return Ok(new { released = releases.Count, skipped = ids.Count - releases.Count });
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
            r.CreatedAt,
            r.ScheduledDate,
            r.YearLevel,
            r.Campus != null ? r.Campus.Name : null);

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
        DateTime CreatedAt,
        DateTime? ScheduledDate,
        int? YearLevel,
        string? CampusName);

    public record ScholarshipReleaseRequest(
        string ScholarId,
        int ScholarshipTypeId,
        string AcademicYear,
        int Semester,
        decimal Amount,
        string? Notes,
        DateTime? ScheduledDate = null,
        int? YearLevel = null);

    public record GenerateReleasesRequest(
        int ScholarshipTypeId,
        string AcademicYear,
        int Semester,
        decimal? Amount);

    public record ReleaseScholarshipRequest(string? ReferenceNo, DateTime? ReleasedAt);

    public record ScheduleReleasesRequest(
        int ScholarshipTypeId,
        string AcademicYear,
        int Semester,
        DateTime? ScheduledDate,
        decimal? Amount,
        List<int>? CampusIds,
        // Narrows the holders to one year level before selection.
        int? FilterYearLevel,
        // The year level recorded on the release; null keeps each scholar's own.
        int? YearLevel,
        // Hand-picked scholars; null or empty means every matching holder.
        List<string>? ScholarIds,
        string? Notes);

    public record ReleaseBatchRequest(List<int>? ReleaseIds, DateTime? ReleasedAt, string? ReferenceNo);

    public record CancelReleaseRequest(string Reason);
}
