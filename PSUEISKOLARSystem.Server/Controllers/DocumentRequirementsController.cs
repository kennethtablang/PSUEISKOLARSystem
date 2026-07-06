using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Controllers
{
    [ApiController]
    [Route("api/document-requirements")]
    [Authorize]
    public class DocumentRequirementsController(ApplicationDbContext db, IFileStorageService storage) : ControllerBase
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
                    HasSample = dr.SampleImagePath != null,
                })
                .ToListAsync();

            return Ok(result);
        }

        // POST /api/document-requirements/{id}/sample  — upload an example image (admin)
        [HttpPost("{id}/sample")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> UploadSample(int id, IFormFile file)
        {
            var req = await db.DocumentRequirements.FindAsync(id);
            if (req is null) return NotFound();

            if (file is null || file.Length == 0)
                return BadRequest(new { message = "No image uploaded." });
            var ext = Path.GetExtension(file.FileName);
            if (!ImageFileTypes.Extensions.Contains(ext))
                return BadRequest(new { message = "Sample must be an image (PNG, JPG, or WEBP)." });

            try
            {
                var (stored, _) = await storage.SaveAsync(file);
                if (req.SampleImagePath is not null)
                    await storage.DeleteAsync(req.SampleImagePath);
                req.SampleImagePath = stored;
                await db.SaveChangesAsync();
                return Ok(new { hasSample = true });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // GET /api/document-requirements/{id}/sample  — serve the example image (any authenticated user)
        [HttpGet("{id}/sample")]
        public async Task<IActionResult> GetSample(int id)
        {
            var req = await db.DocumentRequirements.FindAsync(id);
            if (req?.SampleImagePath is null) return NotFound();

            try
            {
                var (stream, contentType) = await storage.GetAsync(req.SampleImagePath, ImageFileTypes.ContentTypeFor(req.SampleImagePath));
                Response.Headers["X-Content-Type-Options"] = "nosniff";
                return File(stream, contentType, enableRangeProcessing: true);
            }
            catch (FileNotFoundException)
            {
                return NotFound();
            }
        }

        // DELETE /api/document-requirements/{id}/sample  (admin)
        [HttpDelete("{id}/sample")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> DeleteSample(int id)
        {
            var req = await db.DocumentRequirements.FindAsync(id);
            if (req is null) return NotFound();
            if (req.SampleImagePath is not null)
            {
                await storage.DeleteAsync(req.SampleImagePath);
                req.SampleImagePath = null;
                await db.SaveChangesAsync();
            }
            return NoContent();
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
            db.Audit(this, "CreateRequirement", $"Created document requirement '{req.Name}'");
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
            db.Audit(this, "UpdateRequirement", $"Updated document requirement #{id} '{req.Name}'");
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
            db.Audit(this, "DeleteRequirement", $"Deleted document requirement #{id} '{req.Name}'");
            await db.SaveChangesAsync();
            return NoContent();
        }

        // GET /api/document-requirements/{id}/scholarship-types
        // Returns the ids of scholarship types this requirement is linked to.
        [HttpGet("{id}/scholarship-types")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> GetScholarshipTypes(int id)
        {
            if (!await db.DocumentRequirements.AnyAsync(r => r.Id == id)) return NotFound();
            var typeIds = await db.ScholarshipTypeRequirements
                .Where(str => str.RequirementId == id)
                .Select(str => str.ScholarshipTypeId)
                .ToListAsync();
            return Ok(typeIds);
        }

        // PUT /api/document-requirements/{id}/scholarship-types  — bulk-assign this
        // requirement to many scholarship types at once (FR-16).
        [HttpPut("{id}/scholarship-types")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> SetScholarshipTypes(int id, List<int> scholarshipTypeIds)
        {
            var req = await db.DocumentRequirements.FindAsync(id);
            if (req is null) return NotFound();

            var existing = await db.ScholarshipTypeRequirements
                .Where(str => str.RequirementId == id)
                .ToListAsync();
            db.ScholarshipTypeRequirements.RemoveRange(existing);

            var validTypeIds = await db.ScholarshipTypes
                .Where(t => scholarshipTypeIds.Contains(t.Id))
                .Select(t => t.Id)
                .ToListAsync();

            db.ScholarshipTypeRequirements.AddRange(
                validTypeIds.Select(tid => new ScholarshipTypeRequirement { RequirementId = id, ScholarshipTypeId = tid }));

            db.Audit(this, "SetRequirementScholarshipTypes",
                $"Assigned requirement #{id} '{req.Name}' to {validTypeIds.Count} scholarship type(s)");
            await db.SaveChangesAsync();
            return NoContent();
        }
    }

    public record DocumentRequirementRequest(
        string Name,
        string? Description,
        bool IsRequired);
}
