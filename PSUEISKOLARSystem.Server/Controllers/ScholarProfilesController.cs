using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs;
using PSUEISKOLARSystem.Server.DTOs.Scholars;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/scholars")]
    [Authorize]
    public class ScholarProfilesController(ApplicationDbContext db, INotificationService notifications) : ControllerBase
    {
        [HttpGet]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> GetAll(
            [FromQuery] int? campusId,
            [FromQuery] int? programId,
            [FromQuery] int? scholarshipTypeId,
            [FromQuery] string? search,
            [FromQuery] bool? meetsRequirement,
            [FromQuery] string? lifecycleStatus,
            [FromQuery] string? approvalStatus,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = db.ScholarProfiles
                .Include(sp => sp.User)
                .Include(sp => sp.Campus)
                .Include(sp => sp.Program)
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.Grades.OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester).Take(1))
                .AsQueryable();

            if (campusId.HasValue)
                query = query.Where(sp => sp.CampusId == campusId);

            if (!string.IsNullOrWhiteSpace(lifecycleStatus))
                query = query.Where(sp => sp.LifecycleStatus == lifecycleStatus);
            if (!string.IsNullOrWhiteSpace(approvalStatus))
            {
                if (!ApprovalStatuses.All.Contains(approvalStatus))
                    return BadRequest(new { message = "Invalid approval status." });
                query = query.Where(sp => sp.User.ApprovalStatus == approvalStatus);
            }
            if (programId.HasValue)
                query = query.Where(sp => sp.ProgramId == programId);
            if (scholarshipTypeId.HasValue)
                query = query.Where(sp => sp.ScholarshipTypeId == scholarshipTypeId);
            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(sp =>
                    (sp.User.FirstName + " " + sp.User.LastName).Contains(search) ||
                    sp.User.FirstName.Contains(search) ||
                    sp.User.LastName.Contains(search) ||
                    sp.StudentId.Contains(search) ||
                    (sp.User.Email != null && sp.User.Email.Contains(search)));
            if (meetsRequirement.HasValue)
                query = query.Where(sp => sp.Grades
                    .OrderByDescending(g => g.AcademicYear)
                    .ThenByDescending(g => g.Semester)
                    .Select(g => (bool?)g.MeetsRequirement)
                    .FirstOrDefault() == meetsRequirement.Value);

            var total = await query.CountAsync();

            var profiles = await query
                .OrderBy(sp => sp.User.LastName).ThenBy(sp => sp.User.FirstName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var ledger = await LoadLedgerAsync(profiles.Select(p => p.UserId).ToList());

            return Ok(PagedResult<ScholarProfileDto>.From(
                profiles.Select(sp => Map(sp, ledger.GetValueOrDefault(sp.UserId))).ToList(),
                total, page, pageSize));
        }

        // Batched scholarship-ledger lookup for a page of scholars: when the current
        // scholarship was assigned, and how many scholarships they have ever held.
        private async Task<Dictionary<string, LedgerSummary>> LoadLedgerAsync(List<string> userIds)
        {
            if (userIds.Count == 0) return [];

            var rows = await db.ScholarshipAssignments
                .Where(a => userIds.Contains(a.ScholarId))
                .GroupBy(a => a.ScholarId)
                .Select(g => new
                {
                    ScholarId = g.Key,
                    Count = g.Count(),
                    ActiveAssignedAt = g.Where(a => a.EndedAt == null).Max(a => (DateTime?)a.AssignedAt),
                })
                .ToListAsync();

            return rows.ToDictionary(r => r.ScholarId, r => new LedgerSummary(r.ActiveAssignedAt, r.Count));
        }

        private record LedgerSummary(DateTime? AssignedAt, int RecordCount);

        [HttpGet("{userId}")]
        public async Task<IActionResult> GetByUserId(string userId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isAdminOrCoord = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

            if (!isAdminOrCoord && currentUserId != userId)
                return Forbid();

            var profile = await db.ScholarProfiles
                .Include(sp => sp.User)
                .Include(sp => sp.Campus)
                .Include(sp => sp.Program)
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.Grades.OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester).Take(1))
                .FirstOrDefaultAsync(sp => sp.UserId == userId);

            if (profile is null) return NotFound(new { message = "Scholar profile not found." });

            var ledger = await LoadLedgerAsync([userId]);
            var dto = Map(profile, ledger.GetValueOrDefault(userId));
            dto.GrantCount = await db.OneTimeGrants.CountAsync(g => g.ScholarId == userId);
            return Ok(dto);
        }

        // GET /api/scholars/{userId}/scholarship-history
        // Every scholarship this scholar has been registered under. Exactly one row should
        // be open (EndedAt = null) — that is their single active scholarship.
        [HttpGet("{userId}/scholarship-history")]
        public async Task<IActionResult> GetScholarshipHistory(string userId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isAdminOrCoord = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);
            if (!isAdminOrCoord && currentUserId != userId) return Forbid();

            var history = await ScholarshipRegistry.GetHistoryAsync(db, userId);

            return Ok(history.Select(a => new
            {
                a.Id,
                a.ScholarshipTypeId,
                ScholarshipTypeName = a.ScholarshipType.Name,
                ScholarshipTypeCategory = a.ScholarshipType.Category,
                a.ScholarshipType.MinimumGwa,
                a.AssignedAt,
                AssignedBy = a.AssignedBy is null ? null : a.AssignedBy.FullName,
                a.EndedAt,
                a.EndReason,
                IsActive = a.EndedAt == null,
            }));
        }

        // GET /api/scholars/scholarship-verification
        // Verification report backing the "strictly one scholarship per student" rule: any
        // scholar whose records need a second look — more than one open assignment (should be
        // impossible), a scholarship on the profile with no ledger row, a profile/ledger
        // mismatch, a duplicated student ID, or a history of transfers.
        [HttpGet("scholarship-verification")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> GetScholarshipVerification()
        {
            /* This report is a cross-check, so it does have to consider every scholar — but it
               used to do so by materialising whole ScholarProfile and ScholarshipAssignment
               entities with their User and ScholarshipType graphs attached and tracked. The
               rows below carry only the seven and four columns the checks actually read, and
               the counting is left to the database. */

            var duplicateStudentIds = (await db.ScholarProfiles
                .AsNoTracking()
                .Where(p => p.StudentId != "")
                .GroupBy(p => p.StudentId)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToListAsync())
                // Kept case-insensitive on the client side too: SQL Server's default collation
                // already folds case, but the membership tests below must not depend on that.
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var profiles = await db.ScholarProfiles
                .AsNoTracking()
                .Select(sp => new ProfileRow(
                    sp.UserId,
                    sp.User.FirstName,
                    sp.User.MiddleName,
                    sp.User.LastName,
                    sp.User.Email,
                    sp.StudentId,
                    sp.ScholarshipTypeId,
                    sp.ScholarshipType != null ? sp.ScholarshipType.Name : null,
                    sp.User.ApprovalStatus))
                .ToListAsync();

            var assignments = await db.ScholarshipAssignments
                .AsNoTracking()
                .Select(a => new AssignmentRow(
                    a.ScholarId, a.ScholarshipTypeId, a.ScholarshipType.Name, a.EndedAt))
                .ToListAsync();

            var byScholar = assignments.GroupBy(a => a.ScholarId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var findings = new List<VerificationFinding>();

            foreach (var p in profiles)
            {
                var rows = byScholar.GetValueOrDefault(p.UserId) ?? [];
                var open = rows.Where(a => a.EndedAt is null).ToList();
                var issues = new List<string>();
                var severity = "info";

                if (open.Count > 1)
                {
                    issues.Add($"{open.Count} scholarships are open at the same time: " +
                               string.Join(", ", open.Select(a => a.ScholarshipTypeName)));
                    severity = "error";
                }

                if (p.ScholarshipTypeId is not null && open.Count == 0)
                {
                    issues.Add($"Profile shows {p.ScholarshipTypeName} but there is no assignment record for it.");
                    if (severity != "error") severity = "warning";
                }

                if (p.ScholarshipTypeId is null && open.Count == 1)
                {
                    issues.Add($"An open assignment for {open[0].ScholarshipTypeName} exists but the profile has no scholarship set.");
                    if (severity != "error") severity = "warning";
                }

                if (open.Count == 1 && p.ScholarshipTypeId is not null && open[0].ScholarshipTypeId != p.ScholarshipTypeId)
                {
                    issues.Add($"Profile says {p.ScholarshipTypeName} but the open assignment is {open[0].ScholarshipTypeName}.");
                    severity = "error";
                }

                if (!string.IsNullOrWhiteSpace(p.StudentId) && duplicateStudentIds.Contains(p.StudentId))
                {
                    issues.Add($"Student ID {p.StudentId} appears on more than one profile.");
                    severity = "error";
                }

                if (rows.Count > 1 && issues.Count == 0)
                    issues.Add($"Transferred scholarships {rows.Count - 1} time(s) — history is available for review.");

                if (issues.Count == 0) continue;

                findings.Add(new VerificationFinding(
                    p.UserId,
                    p.FullName,
                    p.Email,
                    p.StudentId,
                    p.ScholarshipTypeName,
                    p.ApprovalStatus,
                    open.Count,
                    rows.Count,
                    severity,
                    issues));
            }

            return Ok(new
            {
                totalScholars = profiles.Count,
                scholarsWithOneScholarship = profiles.Count(p => p.ScholarshipTypeId is not null),
                scholarsWithoutScholarship = profiles.Count(p => p.ScholarshipTypeId is null),
                flagged = findings.Count,
                findings = findings
                    .OrderBy(f => f.Severity == "error" ? 0 : f.Severity == "warning" ? 1 : 2)
                    .ThenBy(f => f.FullName)
                    .ToList(),
            });
        }

        private record VerificationFinding(
            string UserId,
            string FullName,
            string? Email,
            string StudentId,
            string? CurrentScholarship,
            string ApprovalStatus,
            int OpenAssignments,
            int TotalAssignments,
            string Severity,
            List<string> Issues);

        /* The two flat rows the verification report reads. Names are assembled here rather
           than through ApplicationUser.FullName because that property is [NotMapped] — reading
           it would force the whole User entity to be materialised, which is the cost this
           projection exists to avoid. */
        private record ProfileRow(
            string UserId,
            string FirstName,
            string? MiddleName,
            string LastName,
            string? Email,
            string StudentId,
            int? ScholarshipTypeId,
            string? ScholarshipTypeName,
            string ApprovalStatus)
        {
            public string FullName => string.IsNullOrWhiteSpace(MiddleName)
                ? $"{FirstName} {LastName}".Trim()
                : $"{FirstName} {MiddleName} {LastName}".Trim();
        }

        private record AssignmentRow(
            string ScholarId,
            int ScholarshipTypeId,
            string ScholarshipTypeName,
            DateTime? EndedAt);

        // PATCH /api/scholars/{userId}/lifecycle  — set scholarship lifecycle status (FR-18)
        [HttpPatch("{userId}/lifecycle")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> SetLifecycle(string userId, LifecycleRequest dto)
        {
            if (!LifecycleStatuses.IsKnown(dto.Status))
                return BadRequest(new { message = "Invalid lifecycle status." });

            var profile = await db.ScholarProfiles.Include(sp => sp.User)
                .FirstOrDefaultAsync(sp => sp.UserId == userId);
            if (profile is null) return NotFound(new { message = "Scholar profile not found." });

            var previous = profile.LifecycleStatus;
            if (previous == dto.Status) return NoContent();

            var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var wasHolding = LifecycleStatuses.IsHolding(previous);
            var nowHolding = LifecycleStatuses.IsHolding(dto.Status);

            profile.LifecycleStatus = dto.Status;

            /* The assignment ledger is the authority on who holds what, so it has to follow the
               status rather than drift from it. Leaving Active/Renewed closes the open row —
               that is what frees the slot in the history as well as in the count. */
            var active = await ScholarshipRegistry.GetActiveAsync(db, userId);
            if (wasHolding && !nowHolding && active is not null)
            {
                active.EndedAt = DateTime.UtcNow;
                active.EndedById = actorId;
                active.EndReason = $"Scholarship status set to {dto.Status}.";
            }
            else if (!wasHolding && nowHolding && active is null && profile.ScholarshipTypeId is int typeId)
            {
                // Coming back (a suspension lifted, a lapse reinstated) reopens the ledger,
                // otherwise the scholar would hold a scholarship with no record of doing so.
                db.ScholarshipAssignments.Add(new ScholarshipAssignment
                {
                    ScholarId = userId,
                    ScholarshipTypeId = typeId,
                    AssignedById = actorId,
                    AssignedAt = DateTime.UtcNow,
                });
            }

            db.AuditLogs.Add(new AuditLog
            {
                UserId = actorId,
                Action = "SetLifecycleStatus",
                Details = $"Set {profile.User.FullName} scholarship status: {previous} → {dto.Status}.",
            });
            await db.SaveChangesAsync();

            // The scholar is the person most affected by this and used to be told nothing.
            await notifications.CreateAsync(
                userId,
                "Scholarship status updated",
                $"Your scholarship status is now {dto.Status}. " +
                (nowHolding
                    ? "Keep submitting your requirements as usual."
                    : "Contact the scholarship office if you believe this is a mistake."),
                NotificationCategories.Account,
                "/my-profile");

            return NoContent();
        }

        // GET /api/scholars/{userId}/export  — data-subject access: download own personal data (FR-19.3)
        [HttpGet("{userId}/export")]
        public async Task<IActionResult> ExportData(string userId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isAdminOrCoord = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);
            if (!isAdminOrCoord && currentUserId != userId) return Forbid();

            var profile = await db.ScholarProfiles
                .Include(sp => sp.User)
                .Include(sp => sp.Campus)
                .Include(sp => sp.Program)
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.Grades)
                .FirstOrDefaultAsync(sp => sp.UserId == userId);
            if (profile is null) return NotFound(new { message = "Scholar profile not found." });


            var documents = await db.DocumentSubmissions
                .Include(d => d.Requirement)
                .Where(d => d.ScholarId == userId)
                .Select(d => new { d.FileName, Requirement = d.Requirement.Name, Status = d.Status.ToString(), d.SubmittedAt, d.AcademicYear, d.Semester })
                .ToListAsync();

            var export = new
            {
                GeneratedAt = DateTime.UtcNow,
                Account = new
                {
                    profile.User.FullName,
                    profile.User.Email,
                    profile.User.CreatedAt,
                    profile.User.LastLoginAt,
                },
                Profile = new
                {
                    profile.StudentId,
                    Campus = profile.Campus?.Name,
                    Program = profile.Program?.Name,
                    ScholarshipType = profile.ScholarshipType?.Name,
                    profile.YearLevel,
                    profile.LifecycleStatus,
                    profile.ContactNumber,
                    profile.BirthDate,
                    profile.Address,
                    profile.Personal,
                },
                Grades = profile.Grades.Select(g => new { g.AcademicYear, g.Semester, g.Gwa, g.MeetsRequirement, g.Remarks }),
                Documents = documents,
            };

            /* Under RA 10173 a subject-access disclosure is exactly the event that ought to
               leave a trace — the more so because staff can invoke it for any scholar, not
               only for themselves. Every neighbouring action here audits itself; this one
               did not. */
            db.Audit(this, "ExportScholarData",
                currentUserId == userId
                    ? "Downloaded own personal data export"
                    : $"Downloaded the personal data export for {profile.User.FullName}");
            await db.SaveChangesAsync();

            return Ok(export);
        }

        [HttpPut("{userId}")]
        public async Task<IActionResult> Upsert(string userId, UpsertScholarProfileDto dto)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isAdminOrCoord = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

            if (!isAdminOrCoord && currentUserId != userId)
                return Forbid();

            var user = await db.Users.FindAsync(userId);
            if (user is null) return NotFound(new { message = "User not found." });


            var profile = await db.ScholarProfiles.FirstOrDefaultAsync(sp => sp.UserId == userId);

            /* Everything on a scholar's profile was either cross-matched against the master
               list at sign-up (student number, name, scholarship) or is office data (campus,
               course, year level, personal and family details). A scholar may change only what
               is theirs to keep current — contact number and address; the rest goes through
               the scholarship office. */
            if (!isAdminOrCoord)
            {
                if (profile is null)
                    return BadRequest(new { message = "Your scholar profile has not been set up yet. Contact the scholarship office." });

                profile.ContactNumber = string.IsNullOrWhiteSpace(dto.ContactNumber) ? null : dto.ContactNumber.Trim();
                profile.Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();

                db.Audit(this, "UpdateScholarProfile", $"{user.FullName} updated their contact details");
                await db.SaveChangesAsync();
                return NoContent();
            }

            // A student number must identify exactly one scholar — a duplicate is the usual
            // symptom of the same student registering twice.
            var studentId = dto.StudentId.Trim().ToUpperInvariant();
            var studentIdTaken = await db.ScholarProfiles
                .AnyAsync(sp => sp.UserId != userId && sp.StudentId == studentId)
                || await db.GranteeProfiles.AnyAsync(gp => gp.StudentId == studentId);
            if (studentIdTaken)
                return BadRequest(new { message = $"Student ID {studentId} is already registered to another account." });

            if (dto.CampusId is int cid && !await db.Campuses.AnyAsync(c => c.Id == cid))
                return BadRequest(new { message = "The selected campus does not exist." });

            if (dto.Personal?.Validate() is string personalError)
                return BadRequest(new { message = personalError });

            if (profile is null)
            {
                profile = new ScholarProfile { UserId = userId };
                db.ScholarProfiles.Add(profile);
            }
            else
            {
                // Existing profiles created before the ledger existed get a row on first touch,
                // so the one-scholarship check below has something to compare against.
                await ScholarshipRegistry.BackfillAsync(db, profile, currentUserId);
            }

            // Strictly one scholarship per student: the ledger rejects a second active
            // assignment and records every transfer.
            var rejection = await ScholarshipRegistry.SetAsync(
                db, userId, dto.ScholarshipTypeId, currentUserId, isAdminOrCoord, dto.ScholarshipChangeReason);
            if (rejection is not null)
                return BadRequest(new { message = rejection });

            profile.StudentId = studentId;
            profile.CampusId = dto.CampusId ?? profile.CampusId;
            profile.ProgramId = dto.ProgramId;
            profile.ScholarshipTypeId = dto.ScholarshipTypeId;
            profile.YearLevel = dto.YearLevel;
            profile.ContactNumber = dto.ContactNumber;
            profile.BirthDate = dto.BirthDate?.Date;
            profile.Address = dto.Address;
            dto.Personal?.ApplyTo(profile.Personal);

            db.Audit(this, "UpdateScholarProfile", $"Updated profile for {user.FullName} (student {studentId})");
            await db.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("{userId}/grades")]
        public async Task<IActionResult> GetGrades(string userId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isAdminOrCoord = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

            if (!isAdminOrCoord && currentUserId != userId)
                return Forbid();

            var profile = await db.ScholarProfiles
                .Include(sp => sp.User)
                .FirstOrDefaultAsync(sp => sp.UserId == userId);
            if (profile is null) return NotFound(new { message = "Scholar profile not found." });


            var grades = await db.AcademicGrades
                .Where(g => g.ScholarProfileId == profile.Id)
                .OrderByDescending(g => g.AcademicYear)
                .ThenByDescending(g => g.Semester)
                .Select(g => new
                {
                    g.Id,
                    g.AcademicYear,
                    g.Semester,
                    g.Gwa,
                    g.MeetsRequirement,
                    g.Remarks,
                    g.RecordedAt
                })
                .ToListAsync();

            return Ok(grades);
        }

        [HttpPost("{userId}/grades")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> AddGrade(string userId, AddGradeDto dto)
        {
            var profile = await db.ScholarProfiles
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.User)
                .FirstOrDefaultAsync(sp => sp.UserId == userId);

            if (profile is null) return NotFound(new { message = "Scholar profile not found." });

            if (!AcademicPeriod.TryParse(dto.AcademicYear, dto.Semester, out var period, out var periodError))
                return BadRequest(new { message = periodError });

            // A grade can't be recorded for a period later than the active academic semester.
            var laterError = await CheckNotLaterThanActiveAsync(period);
            if (laterError is not null) return BadRequest(new { message = laterError });

            // The unique index would refuse this anyway; catching it here says why, and points
            // at the edit endpoint rather than leaving a correction as "record it again".
            var clash = await db.AcademicGrades.AnyAsync(g =>
                g.ScholarProfileId == profile.Id &&
                g.AcademicYear == period.AcademicYear &&
                g.Semester == period.Semester);

            if (clash)
                return BadRequest(new { message =
                    $"A GWA is already recorded for {period.Label}. Edit that entry instead of adding a second one." });

            var grade = new AcademicGrade
            {
                ScholarProfileId = profile.Id,
                AcademicYear = period.AcademicYear,
                Semester = period.Semester,
                Gwa = dto.Gwa,
                MeetsRequirement = MeetsRequirement(dto.Gwa, profile),
                Remarks = dto.Remarks,
                RecordedById = User.FindFirstValue(ClaimTypes.NameIdentifier)
            };

            db.AcademicGrades.Add(grade);
            db.Audit(this, "AddGrade", $"Recorded GWA {dto.Gwa} for {profile.User.FullName} ({period.Label})");
            await db.SaveChangesAsync();
            _ = notifications.BroadcastAsync("AnalyticsChanged");
            return Ok(new { grade.Id, grade.MeetsRequirement });
        }

        /// <summary>
        /// Corrects a recorded GWA. Without this a mistyped grade could only be "fixed" by
        /// adding a second row for the same period, which is exactly what made the latest-grade
        /// lookup ambiguous.
        /// </summary>
        [HttpPatch("{userId}/grades/{gradeId:int}")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> UpdateGrade(string userId, int gradeId, UpdateGradeDto dto)
        {
            var (profile, grade, failure) = await FindGradeAsync(userId, gradeId);
            if (failure is not null) return failure;

            var was = $"GWA {grade!.Gwa}";
            grade.Gwa = dto.Gwa;
            grade.Remarks = dto.Remarks;
            grade.MeetsRequirement = MeetsRequirement(dto.Gwa, profile!);
            grade.RecordedById = User.FindFirstValue(ClaimTypes.NameIdentifier);
            grade.RecordedAt = DateTime.UtcNow;

            db.Audit(this, "UpdateGrade",
                $"Corrected {was} → GWA {dto.Gwa} for {profile!.User.FullName} " +
                $"({grade.AcademicYear} Sem {grade.Semester})");
            await db.SaveChangesAsync();
            _ = notifications.BroadcastAsync("AnalyticsChanged");
            return Ok(new { grade.Id, grade.MeetsRequirement });
        }

        [HttpDelete("{userId}/grades/{gradeId:int}")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> DeleteGrade(string userId, int gradeId)
        {
            var (profile, grade, failure) = await FindGradeAsync(userId, gradeId);
            if (failure is not null) return failure;

            db.AcademicGrades.Remove(grade!);
            db.Audit(this, "DeleteGrade",
                $"Removed GWA {grade!.Gwa} for {profile!.User.FullName} " +
                $"({grade.AcademicYear} Sem {grade.Semester})");
            await db.SaveChangesAsync();
            _ = notifications.BroadcastAsync("AnalyticsChanged");
            return NoContent();
        }

        private async Task<(ScholarProfile?, AcademicGrade?, IActionResult?)> FindGradeAsync(string userId, int gradeId)
        {
            var profile = await db.ScholarProfiles
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.User)
                .FirstOrDefaultAsync(sp => sp.UserId == userId);

            if (profile is null)
                return (null, null, NotFound(new { message = "Scholar profile not found." }));

            var grade = await db.AcademicGrades
                .FirstOrDefaultAsync(g => g.Id == gradeId && g.ScholarProfileId == profile.Id);

            return grade is null
                ? (profile, null, NotFound(new { message = "Grade record not found for this scholar." }))
                : (profile, grade, null);
        }

        /// <summary>
        /// A scholarship with no GWA ceiling is met by definition; otherwise the GWA has to be
        /// at or below it (lower is better on the 1.00–5.00 scale).
        /// </summary>
        private static bool MeetsRequirement(decimal gwa, ScholarProfile profile) =>
            profile.ScholarshipType is null || gwa <= profile.ScholarshipType.MinimumGwa;

        /// <summary>
        /// Refuses a period later than the active semester. Uses <see cref="AcademicPeriod"/>
        /// rather than a local year comparison, which failed open on anything it could not parse.
        /// </summary>
        private async Task<string?> CheckNotLaterThanActiveAsync(AcademicPeriod period)
        {
            var active = await db.ActiveSemesters.FirstOrDefaultAsync();
            if (active is null) return null;
            if (!AcademicPeriod.TryParse(active.AcademicYear, active.Semester, out var activePeriod, out _))
                return null;   // the stored active period predates validation; don't block on it

            return period > activePeriod
                ? $"Cannot record a grade for {period.Label} — it is later than the active period ({activePeriod.Label})."
                : null;
        }

        private static ScholarProfileDto Map(ScholarProfile sp, LedgerSummary? ledger = null)
        {
            var latest = sp.Grades.OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester).FirstOrDefault();
            return new ScholarProfileDto
            {
                ApprovalStatus = sp.User.ApprovalStatus,
                ApprovalNote = sp.User.ApprovalNote,
                ApprovalDecidedAt = sp.User.ApprovalDecidedAt,
                ScholarshipAssignedAt = ledger?.AssignedAt,
                ScholarshipRecordCount = ledger?.RecordCount ?? 0,
                Id = sp.Id,
                UserId = sp.UserId,
                FullName = sp.User.FullName,
                Email = sp.User.Email ?? string.Empty,
                HasAvatar = sp.User.AvatarPath != null,
                StudentId = sp.StudentId,
                CampusId = sp.CampusId,
                CampusName = sp.Campus?.Name,
                ProgramId = sp.ProgramId,
                ProgramName = sp.Program?.Name,
                ProgramCode = sp.Program?.Code,
                ScholarshipTypeId = sp.ScholarshipTypeId,
                ScholarshipTypeName = sp.ScholarshipType?.Name,
                ScholarshipTypeCategory = sp.ScholarshipType?.Category,
                MinimumGwa = sp.ScholarshipType?.MinimumGwa,
                YearLevel = sp.YearLevel,
                LifecycleStatus = sp.LifecycleStatus,
                ContactNumber = sp.ContactNumber,
                BirthDate = sp.BirthDate,
                Address = sp.Address,
                EnrolledAt = sp.EnrolledAt,
                Personal = PersonalDetailsDto.From(sp.Personal),
                LatestGwa = latest?.Gwa,
                MeetsRequirement = latest?.MeetsRequirement,
            };
        }

        public record LifecycleRequest(string Status);
    }
}
