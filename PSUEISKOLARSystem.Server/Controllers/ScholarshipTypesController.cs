using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/scholarship-types")]
    [Authorize]
    public class ScholarshipTypesController(ApplicationDbContext db) : ControllerBase
    {
        // GET /api/scholarship-types  — list all with their linked requirement IDs
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var types = await db.ScholarshipTypes
                .Include(st => st.Requirements)
                    .ThenInclude(str => str.Requirement)
                .OrderBy(st => st.Name)
                .ToListAsync();

            return Ok(types.Select(st => new
            {
                st.Id,
                st.Name,
                st.Description,
                st.MinimumGwa,
                st.IsActive,
                RequirementIds = st.Requirements.Select(r => r.RequirementId).ToList(),
                Requirements = st.Requirements.Select(r => new
                {
                    r.RequirementId,
                    r.Requirement.Name,
                    r.Requirement.IsRequired,
                }).ToList(),
            }));
        }

        // POST /api/scholarship-types
        [HttpPost]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Create(ScholarshipTypeRequest dto)
        {
            var st = new ScholarshipType
            {
                Name = dto.Name.Trim(),
                Description = dto.Description?.Trim(),
                MinimumGwa = dto.MinimumGwa,
            };
            db.ScholarshipTypes.Add(st);
            await db.SaveChangesAsync();

            await SetRequirements(st.Id, dto.RequirementIds);

            return Ok(new { st.Id });
        }

        // PUT /api/scholarship-types/{id}
        [HttpPut("{id}")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Update(int id, ScholarshipTypeRequest dto)
        {
            var st = await db.ScholarshipTypes.FindAsync(id);
            if (st is null) return NotFound();

            st.Name = dto.Name.Trim();
            st.Description = dto.Description?.Trim();
            st.MinimumGwa = dto.MinimumGwa;

            await SetRequirements(id, dto.RequirementIds);
            await db.SaveChangesAsync();

            return NoContent();
        }

        // PATCH /api/scholarship-types/{id}/toggle-active
        [HttpPatch("{id}/toggle-active")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> ToggleActive(int id)
        {
            var st = await db.ScholarshipTypes.FindAsync(id);
            if (st is null) return NotFound();
            st.IsActive = !st.IsActive;
            await db.SaveChangesAsync();
            return Ok(new { st.IsActive });
        }

        // DELETE /api/scholarship-types/{id}  — hard delete only if no scholars are linked
        [HttpDelete("{id}")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Delete(int id)
        {
            var st = await db.ScholarshipTypes
                .Include(s => s.Scholars)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (st is null) return NotFound();

            if (st.Scholars.Any())
                return BadRequest(new { message = "Cannot delete a scholarship type that has scholars assigned. Deactivate it instead." });

            db.ScholarshipTypes.Remove(st);
            await db.SaveChangesAsync();
            return NoContent();
        }

        private async Task SetRequirements(int scholarshipTypeId, List<int> requirementIds)
        {
            var existing = await db.ScholarshipTypeRequirements
                .Where(str => str.ScholarshipTypeId == scholarshipTypeId)
                .ToListAsync();

            db.ScholarshipTypeRequirements.RemoveRange(existing);

            var valid = await db.DocumentRequirements
                .Where(dr => dr.IsActive && requirementIds.Contains(dr.Id))
                .Select(dr => dr.Id)
                .ToListAsync();

            db.ScholarshipTypeRequirements.AddRange(
                valid.Select(rid => new ScholarshipTypeRequirement
                {
                    ScholarshipTypeId = scholarshipTypeId,
                    RequirementId = rid,
                }));

            await db.SaveChangesAsync();
        }
    }

    public record ScholarshipTypeRequest(
        string Name,
        string? Description,
        decimal MinimumGwa,
        List<int> RequirementIds);
}
