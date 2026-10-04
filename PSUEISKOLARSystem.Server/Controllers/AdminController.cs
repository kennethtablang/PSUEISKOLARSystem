using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/admin")]
    [Authorize(Roles = UserRoles.Administrator)]
    public class AdminController(
        ApplicationDbContext db,
        IServiceProvider services,
        DatabaseExporter exporter,
        IWebHostEnvironment environment) : ControllerBase
    {
        // GET /api/admin/backup — one-click snapshot of every table as a ZIP of CSVs.
        [HttpGet("backup")]
        public async Task<IActionResult> Backup(CancellationToken ct)
        {
            var actor = User.Identity?.Name ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";
            var archive = await exporter.CreateArchiveAsync(actor, ct);

            db.Audit(this, "ExportDatabase", $"Downloaded a full data export ({archive.Length / 1024} KB)");
            await db.SaveChangesAsync(ct);

            return File(archive, "application/zip", $"psu-eiskolar-backup_{DateTime.UtcNow:yyyyMMdd-HHmm}.zip");
        }

        // POST /api/admin/seed-sample-data — populate sample accounts + data (idempotent).
        [HttpPost("seed-sample-data")]
        public async Task<IActionResult> SeedSampleData()
        {
            /* The sample coordinators and scholars all share a password that is written in the
               source code. On a live deployment one click would have created staff accounts
               anyone who had read the repository could sign in to — with access to every
               scholar's personal record. Sample data is for development databases only. */
            if (!environment.IsDevelopment())
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    message = "Sample data can only be added on a development server. It is disabled here because the sample accounts use a publicly known password.",
                });

            var result = await SampleDataSeeder.SeedAsync(services);
            await Revision4SampleSeeder.SeedAsync(services);
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
