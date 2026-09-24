using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    /// <summary>
    /// Campuses, the programmes (courses) each one offers, and the programme list itself.
    /// Reads are anonymous because the sign-up form needs them; every write is admin-only.
    /// </summary>
    [ApiController]
    [Route("api/campuses")]
    [Authorize(Roles = UserRoles.Administrator)]
    public class CampusesController(ApplicationDbContext db) : ControllerBase
    {
        // GET /api/campuses?includeInactive=false
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
        {
            // Inactive campuses are only shown to an administrator managing them.
            var showInactive = includeInactive && User.IsInRole(UserRoles.Administrator);

            var campuses = await db.Campuses
                .Where(c => showInactive || c.IsActive)
                .OrderBy(c => c.Name)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.Code,
                    c.IsActive,
                    ProgramIds = c.Programs.Select(p => p.ProgramId).ToList(),
                    ScholarCount = db.ScholarProfiles.Count(sp => sp.CampusId == c.Id),
                    GranteeCount = db.GranteeProfiles.Count(gp => gp.CampusId == c.Id),
                })
                .ToListAsync();

            return Ok(campuses);
        }

        // POST /api/campuses
        [HttpPost]
        public async Task<IActionResult> Create(CampusRequest dto)
        {
            var code = dto.Code.Trim().ToUpperInvariant();
            if (await db.Campuses.AnyAsync(c => c.Code == code))
                return BadRequest(new { message = $"A campus with code {code} already exists." });

            var campus = new Campus { Name = dto.Name.Trim(), Code = code, IsActive = dto.IsActive };
            db.Campuses.Add(campus);
            db.Audit(this, "CreateCampus", $"Added campus {campus.Name} ({code})");
            await db.SaveChangesAsync();
            return Ok(new { campus.Id });
        }

        // PUT /api/campuses/{id}
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, CampusRequest dto)
        {
            var campus = await db.Campuses.FindAsync(id);
            if (campus is null) return NotFound();

            var code = dto.Code.Trim().ToUpperInvariant();
            if (await db.Campuses.AnyAsync(c => c.Id != id && c.Code == code))
                return BadRequest(new { message = $"A campus with code {code} already exists." });

            campus.Name = dto.Name.Trim();
            campus.Code = code;
            campus.IsActive = dto.IsActive;
            db.Audit(this, "UpdateCampus", $"Updated campus {campus.Name} ({code})");
            await db.SaveChangesAsync();
            return NoContent();
        }

        // PUT /api/campuses/{id}/programs — replaces the list of programmes the campus offers.
        [HttpPut("{id:int}/programs")]
        public async Task<IActionResult> SetPrograms(int id, CampusProgramsRequest dto)
        {
            var campus = await db.Campuses.Include(c => c.Programs).FirstOrDefaultAsync(c => c.Id == id);
            if (campus is null) return NotFound();

            var wanted = (dto.ProgramIds ?? []).Distinct().ToHashSet();
            var valid = await db.AcademicPrograms.Where(p => wanted.Contains(p.Id)).Select(p => p.Id).ToListAsync();
            if (valid.Count != wanted.Count)
                return BadRequest(new { message = "One or more of the selected programs no longer exist." });

            campus.Programs = campus.Programs.Where(cp => wanted.Contains(cp.ProgramId)).ToList();
            foreach (var pid in wanted.Where(pid => campus.Programs.All(cp => cp.ProgramId != pid)))
                campus.Programs.Add(new CampusProgram { CampusId = id, ProgramId = pid });

            db.Audit(this, "SetCampusPrograms", $"{campus.Name} now offers {wanted.Count} program(s)");
            await db.SaveChangesAsync();
            return NoContent();
        }

        // DELETE /api/campuses/{id}
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var campus = await db.Campuses.FindAsync(id);
            if (campus is null) return NotFound();

            var inUse = await db.ScholarProfiles.AnyAsync(sp => sp.CampusId == id)
                     || await db.GranteeProfiles.AnyAsync(gp => gp.CampusId == id);
            if (inUse)
                return BadRequest(new { message = $"{campus.Name} has scholars or grantees on record. Deactivate it instead of deleting it." });

            db.Audit(this, "DeleteCampus", $"Deleted campus {campus.Name}");
            db.Campuses.Remove(campus);
            await db.SaveChangesAsync();
            return NoContent();
        }

        /* ── Programs ─────────────────────────────────────────── */

        // POST /api/campuses/programs
        [HttpPost("programs")]
        public async Task<IActionResult> CreateProgram(ProgramRequest dto)
        {
            var code = dto.Code.Trim().ToUpperInvariant();
            if (await db.AcademicPrograms.AnyAsync(p => p.Code == code))
                return BadRequest(new { message = $"A program with code {code} already exists." });

            var program = new AcademicProgram { Name = dto.Name.Trim(), Code = code };
            foreach (var cid in (dto.CampusIds ?? []).Distinct())
                program.Campuses.Add(new CampusProgram { CampusId = cid });

            db.AcademicPrograms.Add(program);
            db.Audit(this, "CreateProgram", $"Added program {program.Name} ({code})");
            await db.SaveChangesAsync();
            return Ok(new { program.Id });
        }

        // PUT /api/campuses/programs/{id}
        [HttpPut("programs/{id:int}")]
        public async Task<IActionResult> UpdateProgram(int id, ProgramRequest dto)
        {
            var program = await db.AcademicPrograms.FindAsync(id);
            if (program is null) return NotFound();

            var code = dto.Code.Trim().ToUpperInvariant();
            if (await db.AcademicPrograms.AnyAsync(p => p.Id != id && p.Code == code))
                return BadRequest(new { message = $"A program with code {code} already exists." });

            program.Name = dto.Name.Trim();
            program.Code = code;
            db.Audit(this, "UpdateProgram", $"Updated program {program.Name} ({code})");
            await db.SaveChangesAsync();
            return NoContent();
        }

        // DELETE /api/campuses/programs/{id}
        [HttpDelete("programs/{id:int}")]
        public async Task<IActionResult> DeleteProgram(int id)
        {
            var program = await db.AcademicPrograms.FindAsync(id);
            if (program is null) return NotFound();

            var inUse = await db.ScholarProfiles.AnyAsync(sp => sp.ProgramId == id)
                     || await db.GranteeProfiles.AnyAsync(gp => gp.ProgramId == id);
            if (inUse)
                return BadRequest(new { message = $"{program.Name} is recorded on scholar or grantee profiles and cannot be deleted." });

            db.Audit(this, "DeleteProgram", $"Deleted program {program.Name}");
            db.AcademicPrograms.Remove(program);
            await db.SaveChangesAsync();
            return NoContent();
        }
    }

    public record CampusRequest(
        [Required, MaxLength(100)] string Name,
        [Required, MaxLength(20)] string Code,
        bool IsActive = true);

    public record CampusProgramsRequest(List<int>? ProgramIds);

    public record ProgramRequest(
        [Required, MaxLength(200)] string Name,
        [Required, MaxLength(20)] string Code,
        List<int>? CampusIds);
}
