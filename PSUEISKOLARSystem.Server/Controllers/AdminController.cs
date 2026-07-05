using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/admin")]
    [Authorize(Roles = UserRoles.Administrator)]
    public class AdminController(ApplicationDbContext db, IServiceProvider services) : ControllerBase
    {
        // POST /api/admin/seed-sample-data — populate sample accounts + data (idempotent).
        [HttpPost("seed-sample-data")]
        public async Task<IActionResult> SeedSampleData()
        {
            var result = await SampleDataSeeder.SeedAsync(services);
            if (!result.AlreadySeeded)
            {
                db.Audit(this, "SeedSampleData",
                    $"Seeded {result.Scholars} scholars, {result.Coordinators} coordinators, {result.Grades} grades, {result.Announcements} announcements");
                await db.SaveChangesAsync();
            }
            return Ok(result);
        }
    }
}
