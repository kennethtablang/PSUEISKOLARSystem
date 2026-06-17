using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;

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

        [HttpGet("scholarship-types")]
        public async Task<IActionResult> GetScholarshipTypes()
        {
            var types = await db.ScholarshipTypes
                .Where(st => st.IsActive)
                .OrderBy(st => st.Name)
                .Select(st => new { st.Id, st.Name, st.Description, st.MinimumGwa })
                .ToListAsync();
            return Ok(types);
        }
    }
}
