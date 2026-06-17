using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using System.Security.Claims;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/active-semester")]
    [Authorize]
    public class ActiveSemesterController(ApplicationDbContext db) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var config = await db.ActiveSemesters
                .Include(a => a.UpdatedBy)
                .FirstOrDefaultAsync();

            if (config is null) return NotFound(new { message = "Active semester not configured." });

            return Ok(new
            {
                config.AcademicYear,
                config.Semester,
                config.UpdatedAt,
                UpdatedByName = config.UpdatedBy?.FullName,
            });
        }

        [HttpPut]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Update(ActiveSemesterRequest dto)
        {
            if (dto.Semester is not (1 or 2))
                return BadRequest(new { message = "Semester must be 1 or 2." });

            if (string.IsNullOrWhiteSpace(dto.AcademicYear))
                return BadRequest(new { message = "Academic year is required." });

            var config = await db.ActiveSemesters.FirstOrDefaultAsync();
            if (config is null)
            {
                config = new ActiveSemester();
                db.ActiveSemesters.Add(config);
            }

            config.AcademicYear = dto.AcademicYear.Trim();
            config.Semester = dto.Semester;
            config.UpdatedAt = DateTime.UtcNow;
            config.UpdatedById = User.FindFirstValue(ClaimTypes.NameIdentifier);
            await db.SaveChangesAsync();

            return Ok(new { config.AcademicYear, config.Semester, config.UpdatedAt });
        }
    }

    public record ActiveSemesterRequest(string AcademicYear, int Semester);
}
