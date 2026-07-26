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
    public class AdminController(ApplicationDbContext db, IServiceProvider services, DatabaseExporter exporter) : ControllerBase
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
