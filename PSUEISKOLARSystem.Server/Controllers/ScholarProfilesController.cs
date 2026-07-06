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
        // Coordinators are scoped to their assigned campus; admins see all (FR-8.6/8.7).
        private int? CoordinatorCampusScope()
        {
            if (User.IsInRole(UserRoles.Administrator)) return null; // no restriction
            if (User.IsInRole(UserRoles.ScholarshipCoordinator)
                && int.TryParse(User.FindFirstValue("campusId"), out var c))
                return c;
            return null;
        }

        [HttpGet]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> GetAll(
            [FromQuery] int? campusId,
            [FromQuery] int? programId,
            [FromQuery] int? scholarshipTypeId,
            [FromQuery] string? search,
            [FromQuery] bool? meetsRequirement,
            [FromQuery] string? lifecycleStatus,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = db.ScholarProfiles
                .Include(sp => sp.User).ThenInclude(u => u.Campus)
                .Include(sp => sp.Program)
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.Grades.OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester).Take(1))
                .AsQueryable();

            // Campus scoping for coordinators (FR-8.6).
            var scope = CoordinatorCampusScope();
            if (scope.HasValue)
                query = query.Where(sp => sp.User.CampusId == scope);

            if (campusId.HasValue)
                query = query.Where(sp => sp.User.CampusId == campusId);
            if (!string.IsNullOrWhiteSpace(lifecycleStatus))
                query = query.Where(sp => sp.LifecycleStatus == lifecycleStatus);
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

            return Ok(new
            {
                total,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(total / (double)pageSize),
                items = profiles.Select(Map),
            });
        }

        [HttpGet("{userId}")]
        public async Task<IActionResult> GetByUserId(string userId)
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var isAdminOrCoord = User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);

            if (!isAdminOrCoord && currentUserId != userId)
                return Forbid();

            var profile = await db.ScholarProfiles
                .Include(sp => sp.User).ThenInclude(u => u.Campus)
                .Include(sp => sp.Program)
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.Grades.OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester).Take(1))
                .FirstOrDefaultAsync(sp => sp.UserId == userId);

            if (profile is null) return NotFound(new { message = "Scholar profile not found." });

            // Coordinators may only view scholars in their campus (FR-8.6).
            var scope = CoordinatorCampusScope();
            if (scope.HasValue && profile.User.CampusId != scope) return Forbid();

            return Ok(Map(profile));
        }

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

            var scope = CoordinatorCampusScope();
            if (scope.HasValue && profile.User.CampusId != scope) return Forbid();

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
                .Include(sp => sp.User).ThenInclude(u => u.Campus)
                .Include(sp => sp.Program)
                .Include(sp => sp.ScholarshipType)
                .Include(sp => sp.Grades)
                .FirstOrDefaultAsync(sp => sp.UserId == userId);
            if (profile is null) return NotFound(new { message = "Scholar profile not found." });

            // Coordinators may only export scholars in their campus (FR-8.6).
            var scope = CoordinatorCampusScope();
            if (scope.HasValue && profile.User.CampusId != scope) return Forbid();

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
                    Campus = profile.User.Campus?.Name,
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

            // Coordinators may only edit scholars in their campus (FR-8.6).
            var scope = CoordinatorCampusScope();
            if (scope.HasValue && user.CampusId != scope) return Forbid();

            var profile = await db.ScholarProfiles.FirstOrDefaultAsync(sp => sp.UserId == userId);
            if (profile is null)
            {
                profile = new ScholarProfile { UserId = userId };
                db.ScholarProfiles.Add(profile);
            }

            profile.StudentId = dto.StudentId;
            profile.ProgramId = dto.ProgramId;
            profile.ScholarshipTypeId = dto.ScholarshipTypeId;
            profile.YearLevel = dto.YearLevel;
            profile.ContactNumber = dto.ContactNumber;
            profile.BirthDate = dto.BirthDate;
            profile.Address = dto.Address;

            db.Audit(this, "UpdateScholarProfile", $"Updated profile for {user.FullName} (student {dto.StudentId})");
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

            // Coordinators may only view grades for scholars in their campus (FR-8.6).
            var scope = CoordinatorCampusScope();
            if (scope.HasValue && profile.User.CampusId != scope) return Forbid();

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

            // Coordinators may only record grades for scholars in their campus (FR-8.6).
            var scope = CoordinatorCampusScope();
            if (scope.HasValue && profile.User.CampusId != scope) return Forbid();

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

        private static ScholarProfileDto Map(ScholarProfile sp)
        {
            var latest = sp.Grades.OrderByDescending(g => g.AcademicYear).ThenByDescending(g => g.Semester).FirstOrDefault();
            return new ScholarProfileDto
            {
                Id = sp.Id,
                UserId = sp.UserId,
                FullName = sp.User.FullName,
                Email = sp.User.Email ?? string.Empty,
                CampusId = sp.User.CampusId,
                CampusName = sp.User.Campus?.Name,
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
