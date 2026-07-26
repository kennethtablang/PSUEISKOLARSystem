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
            // This value is the reference every other period check compares against, so it has
            // to be a well-formed period rather than any non-empty string.
            if (!AcademicPeriod.TryParse(dto.AcademicYear, dto.Semester, out var period, out var error))
                return BadRequest(new { message = error });

            var config = await db.ActiveSemesters.FirstOrDefaultAsync();
            if (config is null)
            {
                config = new ActiveSemester();
                db.ActiveSemesters.Add(config);
            }

            config.AcademicYear = period.AcademicYear;
            config.Semester = period.Semester;
            config.UpdatedAt = DateTime.UtcNow;
            config.UpdatedById = User.FindFirstValue(ClaimTypes.NameIdentifier);
            db.Audit(this, "SetActiveSemester", $"Set active semester to {config.AcademicYear} Semester {config.Semester}");
            await db.SaveChangesAsync();

            return Ok(new { config.AcademicYear, config.Semester, config.UpdatedAt });
        }
    }

    public record ActiveSemesterRequest(string AcademicYear, int Semester);
}
