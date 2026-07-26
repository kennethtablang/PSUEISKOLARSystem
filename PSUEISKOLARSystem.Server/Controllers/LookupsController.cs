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
        [HttpGet("programs")]
        public async Task<IActionResult> GetPrograms()
        {
            var programs = await db.AcademicPrograms
                .OrderBy(p => p.Name)
                .Select(p => new { p.Id, p.Name, p.Code })
                .ToListAsync();
            return Ok(programs);
        }

        // GET /api/lookups/scholars?search=&limit=
        // Lightweight picker feed for the announcement recipient selector and the staff-side
        // "new conversation" dialog — id + name + student number only.
        [HttpGet("scholars")]
        [Authorize(Roles = $"{UserRoles.Administrator},{UserRoles.ScholarshipCoordinator}")]
        public async Task<IActionResult> GetScholars([FromQuery] string? search, [FromQuery] int limit = 50)
        {
            limit = Math.Clamp(limit, 1, 200);

            var scholarRoleId = await db.Roles
                .Where(r => r.Name == UserRoles.Scholar)
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            var query = db.Users
                .Where(u => u.IsActive && db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == scholarRoleId));

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                var matchingIds = db.ScholarProfiles
                    .Where(sp => EF.Functions.Like(sp.StudentId.ToLower(), $"%{s}%"))
                    .Select(sp => sp.UserId);

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
                    StudentId = db.ScholarProfiles.Where(sp => sp.UserId == u.Id).Select(sp => sp.StudentId).FirstOrDefault(),
                    ScholarshipType = db.ScholarProfiles.Where(sp => sp.UserId == u.Id)
                        .Select(sp => sp.ScholarshipType != null ? sp.ScholarshipType.Name : null).FirstOrDefault(),
                })
                .ToListAsync();

            return Ok(scholars);
        }

        [HttpGet("scholarship-types")]
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
