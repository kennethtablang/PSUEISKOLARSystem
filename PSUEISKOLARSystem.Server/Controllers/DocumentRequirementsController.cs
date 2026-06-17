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
                .Include(dr => dr.ScholarshipType)
                .Where(dr => dr.IsActive)
                .AsQueryable();

            if (scholarshipTypeId.HasValue)
                query = query.Where(dr => dr.ScholarshipTypeId == null || dr.ScholarshipTypeId == scholarshipTypeId);

            var result = await query
                .OrderBy(dr => dr.IsRequired ? 0 : 1)
                .ThenBy(dr => dr.Name)
                .Select(dr => new
                {
                    dr.Id,
                    dr.Name,
                    dr.Description,
                    dr.IsRequired,
                    dr.ScholarshipTypeId,
                    ScholarshipTypeName = dr.ScholarshipType != null ? dr.ScholarshipType.Name : null,
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
                Name = dto.Name,
                Description = dto.Description,
                IsRequired = dto.IsRequired,
                ScholarshipTypeId = dto.ScholarshipTypeId,
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
            req.Name = dto.Name;
            req.Description = dto.Description;
            req.IsRequired = dto.IsRequired;
            req.ScholarshipTypeId = dto.ScholarshipTypeId;
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
        bool IsRequired,
        int? ScholarshipTypeId);
}
