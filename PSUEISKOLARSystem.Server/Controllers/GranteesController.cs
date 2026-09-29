using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs;
using PSUEISKOLARSystem.Server.DTOs.Scholars;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    /// <summary>
    /// Grantee accounts: students who receive one-time grants without holding a scholarship.
    /// Staff list and review them here; a grantee reads (and partly edits) their own profile.
    /// </summary>
    [ApiController]
    [Route("api/grantees")]
    [Authorize]
    public class GranteesController(ApplicationDbContext db) : ControllerBase
    {
        private const string StaffRoles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}";

        // GET /api/grantees?campusId=&programId=&grantTypeId=&active=&search=&page=&pageSize=
        [HttpGet]
        [Authorize(Roles = StaffRoles)]
        public async Task<IActionResult> GetAll(
            [FromQuery] int? campusId,
            [FromQuery] int? programId,
            [FromQuery] int? grantTypeId,
            [FromQuery] bool? active,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = db.GranteeProfiles.AsQueryable();
            if (campusId is int cid) query = query.Where(g => g.CampusId == cid);
            if (programId is int pid) query = query.Where(g => g.ProgramId == pid);
            if (grantTypeId is int gt) query = query.Where(g => db.OneTimeGrants.Any(x => x.ScholarId == g.UserId && x.GrantTypeId == gt));
            if (active is bool a) query = query.Where(g => g.User.IsActive == a);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(g =>
                    g.StudentId.Contains(s) ||
                    (g.User.FirstName + " " + g.User.LastName).Contains(s) ||
                    (g.User.Email != null && g.User.Email.Contains(s)));
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderBy(g => g.User.LastName).ThenBy(g => g.User.FirstName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(g => new
                {
                    g.UserId,
                    FullName = g.User.MiddleName != null
                        ? g.User.FirstName + " " + g.User.MiddleName + " " + g.User.LastName
                        : g.User.FirstName + " " + g.User.LastName,
                    g.User.Email,
                    g.User.IsActive,
                    g.StudentId,
                    CampusName = g.Campus != null ? g.Campus.Name : null,
                    ProgramCode = g.Program != null ? g.Program.Code : null,
                    g.YearLevel,
                    g.CreatedAt,
                    Grants = db.OneTimeGrants
                        .Where(x => x.ScholarId == g.UserId)
                        .OrderByDescending(x => x.AwardedOn)
                        .Select(x => new { x.Id, x.Title, x.Amount, x.ReleaseStatus, x.ReleasedAt })
                        .ToList(),
                })
                .ToListAsync();

            return Ok(PagedResult<object>.From(items.Cast<object>().ToList(), total, page, pageSize));
        }

        // GET /api/grantees/{userId}
        [HttpGet("{userId}")]
        public async Task<IActionResult> Get(string userId)
        {
            if (!IsStaff() && CurrentUserId != userId) return Forbid();

            var g = await db.GranteeProfiles
                .Include(x => x.User)
                .Include(x => x.Campus)
                .Include(x => x.Program)
                .FirstOrDefaultAsync(x => x.UserId == userId);
            if (g is null) return NotFound(new { message = "Grantee profile not found." });

            var grants = await db.OneTimeGrants
                .Where(x => x.ScholarId == userId)
                .OrderByDescending(x => x.AwardedOn)
                .Select(x => new
                {
                    x.Id,
                    x.Title,
                    GrantTypeName = x.GrantType != null ? x.GrantType.Name : null,
                    ScheduledReleaseDate = x.GrantType != null ? x.GrantType.ScheduledDate : null,
                    x.Source,
                    x.Amount,
                    x.AwardedOn,
                    x.ReleaseStatus,
                    x.ReleasedAt,
                    x.ReferenceNo,
                })
                .ToListAsync();

            return Ok(new
            {
                g.UserId,
                g.User.FirstName,
                g.User.MiddleName,
                g.User.LastName,
                g.User.FullName,
                g.User.Email,
                g.User.IsActive,
                HasAvatar = g.User.AvatarPath != null,
                g.StudentId,
                g.CampusId,
                CampusName = g.Campus?.Name,
                g.ProgramId,
                ProgramName = g.Program?.Name,
                ProgramCode = g.Program?.Code,
                g.YearLevel,
                g.ContactNumber,
                g.BirthDate,
                g.Address,
                g.CreatedAt,
                Personal = PersonalDetailsDto.From(g.Personal),
                Grants = grants,
            });
        }

        /// <summary>
        /// PUT /api/grantees/{userId}. A grantee may change only their contact number and
        /// address; everything else was matched against the master list and is staff-only.
        /// </summary>
        [HttpPut("{userId}")]
        public async Task<IActionResult> Update(string userId, UpdateGranteeRequest dto)
        {
            var isStaff = IsStaff();
            if (!isStaff && CurrentUserId != userId) return Forbid();

            var g = await db.GranteeProfiles.Include(x => x.User).FirstOrDefaultAsync(x => x.UserId == userId);
            if (g is null) return NotFound(new { message = "Grantee profile not found." });

            g.ContactNumber = string.IsNullOrWhiteSpace(dto.ContactNumber) ? null : dto.ContactNumber.Trim();
            g.Address = string.IsNullOrWhiteSpace(dto.Address) ? null : dto.Address.Trim();

            if (isStaff)
            {
                if (dto.CampusId is int cid && !await db.Campuses.AnyAsync(c => c.Id == cid))
                    return BadRequest(new { message = "The selected campus does not exist." });
                if (dto.ProgramId is int pid && !await db.AcademicPrograms.AnyAsync(p => p.Id == pid))
                    return BadRequest(new { message = "The selected course does not exist." });

                if (dto.CampusId is not null) g.CampusId = dto.CampusId;
                if (dto.ProgramId is not null) g.ProgramId = dto.ProgramId;
                if (dto.YearLevel is int y) g.YearLevel = y;
                if (dto.BirthDate is not null) g.BirthDate = dto.BirthDate.Value.Date;
                if (dto.Personal is not null)
                {
                    var error = dto.Personal.Validate();
                    if (error is not null) return BadRequest(new { message = error });
                    dto.Personal.ApplyTo(g.Personal);
                }
            }

            db.Audit(this, "UpdateGranteeProfile", $"Updated grantee profile for {g.User.FullName} ({g.StudentId})");
            await db.SaveChangesAsync();
            return NoContent();
        }

        private string CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        private bool IsStaff() =>
            User.IsInRole(UserRoles.Administrator) || User.IsInRole(UserRoles.ScholarshipCoordinator);
    }

    public record UpdateGranteeRequest(
        [MaxLength(20), RegularExpression(@"^(09\d{9}|\+639\d{9})$", ErrorMessage = "Contact number must be a valid PH mobile number (+63 9XX XXX XXXX).")]
        string? ContactNumber,
        [MaxLength(500)] string? Address,
        int? CampusId,
        int? ProgramId,
        [Range(1, 6)] int? YearLevel,
        DateTime? BirthDate,
        PersonalDetailsDto? Personal);
}
