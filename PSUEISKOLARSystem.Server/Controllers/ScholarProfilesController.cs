using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Scholars;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/scholars")]
    [Authorize]
    public class ScholarProfilesController(ApplicationDbContext db) : ControllerBase
    {
        [HttpGet]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> GetAll(
            [FromQuery] int? campusId,
            [FromQuery] int? programId,
            [FromQuery] int? scholarshipTypeId,
            [FromQuery] string? search,
            [FromQuery] bool? meetsRequirement,
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

            if (campusId.HasValue)
                query = query.Where(sp => sp.User.CampusId == campusId);
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
            return Ok(Map(profile));
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

            var profile = await db.ScholarProfiles.FirstOrDefaultAsync(sp => sp.UserId == userId);
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
                .FirstOrDefaultAsync(sp => sp.UserId == userId);

            if (profile is null) return NotFound(new { message = "Scholar profile not found." });

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
            await db.SaveChangesAsync();
            return Ok(new { grade.Id, grade.MeetsRequirement });
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
                MinimumGwa = sp.ScholarshipType?.MinimumGwa,
                YearLevel = sp.YearLevel,
                ContactNumber = sp.ContactNumber,
                BirthDate = sp.BirthDate,
                Address = sp.Address,
                EnrolledAt = sp.EnrolledAt,
                LatestGwa = latest?.Gwa,
                MeetsRequirement = latest?.MeetsRequirement,
            };
        }
    }
}
