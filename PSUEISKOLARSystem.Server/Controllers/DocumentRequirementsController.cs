using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/document-requirements")]
    [Authorize]
    public class DocumentRequirementsController(ApplicationDbContext db) : ControllerBase
    {
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] int? scholarshipTypeId)
        {
            var query = db.DocumentRequirements
                .Where(dr => dr.IsActive)
                .AsQueryable();

            if (scholarshipTypeId.HasValue)
            {
                // Use the junction table: only show requirements linked to this scholarship type.
                // If the type has no requirements configured yet, fall back to showing all.
                var linkedIds = await db.ScholarshipTypeRequirements
                    .Where(str => str.ScholarshipTypeId == scholarshipTypeId)
                    .Select(str => str.RequirementId)
                    .ToListAsync();

                if (linkedIds.Count > 0)
                    query = query.Where(dr => linkedIds.Contains(dr.Id));
            }

            var result = await query
                .OrderBy(dr => dr.IsRequired ? 0 : 1)
                .ThenBy(dr => dr.Name)
                .Select(dr => new
                {
                    dr.Id,
                    dr.Name,
                    dr.Description,
                    dr.IsRequired,
                })
                .ToListAsync();

            return Ok(result);
        }

        [HttpPost]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Create(DocumentRequirementRequest dto)
        {
            var req = new DocumentRequirement
            {
                Name = dto.Name.Trim(),
                Description = dto.Description?.Trim(),
                IsRequired = dto.IsRequired,
            };
            db.DocumentRequirements.Add(req);
            await db.SaveChangesAsync();
            return Ok(new { req.Id });
        }

        [HttpPut("{id}")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Update(int id, DocumentRequirementRequest dto)
        {
            var req = await db.DocumentRequirements.FindAsync(id);
            if (req is null) return NotFound();
            req.Name = dto.Name.Trim();
            req.Description = dto.Description?.Trim();
            req.IsRequired = dto.IsRequired;
            await db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Delete(int id)
        {
            var req = await db.DocumentRequirements.FindAsync(id);
            if (req is null) return NotFound();
            req.IsActive = false;
            await db.SaveChangesAsync();
            return NoContent();
        }
    }

    public record DocumentRequirementRequest(
        string Name,
        string? Description,
        bool IsRequired);
}
