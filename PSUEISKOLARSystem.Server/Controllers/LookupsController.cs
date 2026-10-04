using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LookupsController(ApplicationDbContext db) : ControllerBase
    {
        // Anonymous so the scholar sign-up form can offer the program and scholarship pickers.
        [HttpGet("programs")]
        [AllowAnonymous]
        // ?campusId= narrows the list to the courses that campus offers.
        public async Task<IActionResult> GetPrograms([FromQuery] int? campusId)
        {
            var query = db.AcademicPrograms.AsQueryable();
            if (campusId is int cid)
                query = query.Where(p => p.Campuses.Any(c => c.CampusId == cid));

            var programs = await query
                .OrderBy(p => p.Name).ThenBy(p => p.Major)
                .Select(p => new
                {
                    p.Id,
                    // Shown everywhere a program is picked; carries the major when there is one.
                    Name = p.Major == null ? p.Name : p.Name + " (Major in " + p.Major + ")",
                    BaseName = p.Name,
                    p.Major,
                    p.Code,
                    CampusIds = p.Campuses.Select(c => c.CampusId).ToList(),
                })
                .ToListAsync();
            return Ok(programs);
        }

        // GET /api/lookups/scholars?search=&limit=
        // Lightweight picker feed for the announcement recipient selector and the staff-side
        // "new conversation" dialog — id + name + student number only.
        [HttpGet("scholars")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> GetScholars([FromQuery] string? search, [FromQuery] int limit = 50, [FromQuery] bool includeGrantees = false)
        {
            limit = Math.Clamp(limit, 1, 200);

            // ?includeGrantees=true widens the picker to grantee accounts — used where a grant is
            // being recorded, since a grant can go to either.
            var roleNames = includeGrantees
                ? new[] { UserRoles.Scholar, UserRoles.Grantee }
                : new[] { UserRoles.Scholar };
            var roleIds = await db.Roles
                .Where(r => roleNames.Contains(r.Name))
                .Select(r => r.Id)
                .ToListAsync();

            var query = db.Users
                .Where(u => u.IsActive && db.UserRoles.Any(ur => ur.UserId == u.Id && roleIds.Contains(ur.RoleId)));

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                var matchingIds = db.ScholarProfiles
                    .Where(sp => EF.Functions.Like(sp.StudentId.ToLower(), $"%{s}%"))
                    .Select(sp => sp.UserId)
                    .Concat(db.GranteeProfiles
                        .Where(gp => EF.Functions.Like(gp.StudentId.ToLower(), $"%{s}%"))
                        .Select(gp => gp.UserId));

                query = query.Where(u =>
                    EF.Functions.Like((u.FirstName + " " + u.LastName).ToLower(), $"%{s}%") ||
                    (u.Email != null && EF.Functions.Like(u.Email.ToLower(), $"%{s}%")) ||
                    matchingIds.Contains(u.Id));
            }

            var scholars = await query
                .OrderBy(u => u.LastName).ThenBy(u => u.FirstName)
                .Take(limit)
                .Select(u => new
                {
                    u.Id,
                    FullName = u.MiddleName != null
                        ? u.FirstName + " " + u.MiddleName + " " + u.LastName
                        : u.FirstName + " " + u.LastName,
                    u.Email,
                    StudentId = db.ScholarProfiles.Where(sp => sp.UserId == u.Id).Select(sp => sp.StudentId).FirstOrDefault()
                        ?? db.GranteeProfiles.Where(gp => gp.UserId == u.Id).Select(gp => gp.StudentId).FirstOrDefault(),
                    IsGrantee = db.GranteeProfiles.Any(gp => gp.UserId == u.Id),
                    ScholarshipType = db.ScholarProfiles.Where(sp => sp.UserId == u.Id)
                        .Select(sp => sp.ScholarshipType != null ? sp.ScholarshipType.Name : null).FirstOrDefault(),
                })
                .ToListAsync();

            return Ok(scholars);
        }

        [HttpGet("scholarship-types")]
        [AllowAnonymous]
        public async Task<IActionResult> GetScholarshipTypes()
        {
            var types = await db.ScholarshipTypes
                .Where(st => st.IsActive)
                .OrderBy(st => st.Name)
                .Select(st => new
                {
                    st.Id,
                    st.Name,
                    st.Description,
                    st.Category,
                    st.MinimumGwa,
                    st.SlotLimit,
                    st.Frequency,
                    st.Amount,
                    // Slot figures so a picker can show "3 of 50 left" and grey out full ones
                    // before the save is rejected.
                    ScholarCount = db.ScholarProfiles.Count(sp => sp.ScholarshipTypeId == st.Id),
                    AvailableSlots = st.SlotLimit == null
                        ? (int?)null
                        : st.SlotLimit.Value - db.ScholarProfiles.Count(sp => sp.ScholarshipTypeId == st.Id),
                    IsFull = st.SlotLimit != null &&
                             db.ScholarProfiles.Count(sp => sp.ScholarshipTypeId == st.Id) >= st.SlotLimit.Value,
                })
                .ToListAsync();
            return Ok(types);
        }
    }
}
