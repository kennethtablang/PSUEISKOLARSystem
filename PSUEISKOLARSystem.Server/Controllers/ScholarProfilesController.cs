using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
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
                .Include(sp => sp.Program)
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.Grades.OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester).Take(1))
                .AsQueryable();

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

            return Ok(new
            {
                total,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(total / (double)pageSize),
                items = profiles.Select(sp => Map(sp, ledger.GetValueOrDefault(sp.UserId))),
            });
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
                .Include(sp => sp.Program)
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.Grades.OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester).Take(1))
                .FirstOrDefaultAsync(sp => sp.UserId == userId);

            if (profile is null) return NotFound(new { message = "Scholar profile not found." });

            var ledger = await LoadLedgerAsync([userId]);
            return Ok(Map(profile, ledger.GetValueOrDefault(userId)));
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
            var profiles = await db.ScholarProfiles
                .Include(sp => sp.User)
                .Include(sp => sp.ScholarshipType)
                .ToListAsync();

            var assignments = await db.ScholarshipAssignments
                .Include(a => a.ScholarshipType)
                .ToListAsync();

            var byScholar = assignments.GroupBy(a => a.ScholarId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var duplicateStudentIds = profiles
                .Where(p => !string.IsNullOrWhiteSpace(p.StudentId))
                .GroupBy(p => p.StudentId, StringComparer.OrdinalIgnoreCase)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

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
                               string.Join(", ", open.Select(a => a.ScholarshipType.Name)));
                    severity = "error";
                }

                if (p.ScholarshipTypeId is not null && open.Count == 0)
                {
                    issues.Add($"Profile shows {p.ScholarshipType?.Name} but there is no assignment record for it.");
                    if (severity != "error") severity = "warning";
                }

                if (p.ScholarshipTypeId is null && open.Count == 1)
                {
                    issues.Add($"An open assignment for {open[0].ScholarshipType.Name} exists but the profile has no scholarship set.");
                    if (severity != "error") severity = "warning";
                }

                if (open.Count == 1 && p.ScholarshipTypeId is not null && open[0].ScholarshipTypeId != p.ScholarshipTypeId)
                {
                    issues.Add($"Profile says {p.ScholarshipType?.Name} but the open assignment is {open[0].ScholarshipType.Name}.");
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
                    p.User.FullName,
                    p.User.Email,
                    p.StudentId,
                    p.ScholarshipType?.Name,
                    p.User.ApprovalStatus,
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

        // PATCH /api/scholars/{userId}/lifecycle  — set scholarship lifecycle status (FR-18)
        [HttpPatch("{userId}/lifecycle")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> SetLifecycle(string userId, LifecycleRequest dto)
        {
            var allowed = new[] { "Active", "Renewed", "Lapsed", "Suspended", "Graduated" };
            if (!allowed.Contains(dto.Status))
                return BadRequest(new { message = "Invalid lifecycle status." });

            var profile = await db.ScholarProfiles.Include(sp => sp.User)
                .FirstOrDefaultAsync(sp => sp.UserId == userId);
            if (profile is null) return NotFound(new { message = "Scholar profile not found." });


            profile.LifecycleStatus = dto.Status;
            db.AuditLogs.Add(new AuditLog
            {
                UserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!,
                Action = "SetLifecycleStatus",
                Details = $"Set {profile.User.FullName} scholarship status to {dto.Status}.",
            });
            await db.SaveChangesAsync();
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
                    Program = profile.Program?.Name,
                    ScholarshipType = profile.ScholarshipType?.Name,
                    profile.YearLevel,
                    profile.LifecycleStatus,
                    profile.ContactNumber,
                    profile.BirthDate,
                    profile.Address,
                },
                Grades = profile.Grades.Select(g => new { g.AcademicYear, g.Semester, g.Gwa, g.MeetsRequirement, g.Remarks }),
                Documents = documents,
            };

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


            // A student number must identify exactly one scholar — a duplicate is the usual
            // symptom of the same student registering twice.
            var studentId = dto.StudentId.Trim();
            var studentIdTaken = await db.ScholarProfiles
                .AnyAsync(sp => sp.UserId != userId && sp.StudentId == studentId);
            if (studentIdTaken)
                return BadRequest(new { message = $"Student ID {studentId} is already registered to another scholar." });

            var profile = await db.ScholarProfiles.FirstOrDefaultAsync(sp => sp.UserId == userId);
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
            profile.ProgramId = dto.ProgramId;
            profile.ScholarshipTypeId = dto.ScholarshipTypeId;
            profile.YearLevel = dto.YearLevel;
            profile.ContactNumber = dto.ContactNumber;
            profile.BirthDate = dto.BirthDate;
            profile.Address = dto.Address;

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

            // A grade can't be recorded for a period later than the active academic semester.
            var active = await db.ActiveSemesters.FirstOrDefaultAsync();
            if (active is not null && IsLaterPeriod(dto.AcademicYear, dto.Semester, active.AcademicYear, active.Semester))
                return BadRequest(new { message =
                    $"Cannot record a grade for A.Y. {dto.AcademicYear} Semester {dto.Semester} — it is later than the active period (A.Y. {active.AcademicYear} Semester {active.Semester})." });


            var meetsRequirement = profile.ScholarshipType is null || dto.Gwa <= profile.ScholarshipType.MinimumGwa;

            var grade = new AcademicGrade
            {
                ScholarProfileId = profile.Id,
                AcademicYear = dto.AcademicYear,
                Semester = dto.Semester,
                Gwa = dto.Gwa,
                MeetsRequirement = meetsRequirement,
                Remarks = dto.Remarks,
                RecordedById = User.FindFirstValue(ClaimTypes.NameIdentifier)
            };

            db.AcademicGrades.Add(grade);
            db.Audit(this, "AddGrade", $"Recorded GWA {dto.Gwa} for {profile.User.FullName} ({dto.AcademicYear} Sem {dto.Semester})");
            await db.SaveChangesAsync();
            _ = notifications.BroadcastAsync("AnalyticsChanged");
            return Ok(new { grade.Id, grade.MeetsRequirement });
        }

        // True when (year, sem) is strictly later than the reference period.
        // Academic year is the leading 4-digit year of a "YYYY-YYYY" string; if it
        // can't be parsed we can't compare, so we don't block.
        private static bool IsLaterPeriod(string year, int semester, string refYear, int refSemester)
        {
            static int? StartYear(string ay) =>
                int.TryParse(ay?.Split('-')[0], out var y) ? y : null;

            var y1 = StartYear(year);
            var y2 = StartYear(refYear);
            if (y1 is null || y2 is null) return false;

            return y1 > y2 || (y1 == y2 && semester > refSemester);
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
                LatestGwa = latest?.Gwa,
                MeetsRequirement = latest?.MeetsRequirement,
            };
        }

        public record LifecycleRequest(string Status);
    }
}
