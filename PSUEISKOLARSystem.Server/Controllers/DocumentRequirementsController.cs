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
        public async Task<IActionResult> GetAll([FromQuery] int? scholarshipTypeId, [FromQuery] bool sharedOnly = false)
        {
            var query = db.DocumentRequirements
                .Where(dr => dr.IsActive)
                .AsQueryable();

            // The shared catalog excludes documents that exist only for one scholarship type;
            // those are managed from the Scholarship Types page.
            if (sharedOnly)
                query = query.Where(dr => dr.ScholarshipTypeId == null);

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
                .InDisplayOrder()
                .Select(dr => new
                {
                    dr.Id,
                    dr.Name,
                    dr.Description,
                    dr.IsRequired,
                    dr.DisplayOrder,
                    dr.GroupName,
                    HasSample = dr.SampleImagePath != null,
                    // Non-null when this document belongs to a single scholarship type.
                    dr.ScholarshipTypeId,
                    OwnerTypeName = dr.ScholarshipType != null ? dr.ScholarshipType.Name : null,
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
            var error = Validate(dto);
            if (error is not null) return BadRequest(new { message = error });

            var req = new DocumentRequirement
            {
                Name = dto.Name.Trim(),
                Description = dto.Description?.Trim(),
                IsRequired = dto.IsRequired,
                GroupName = Trim(dto.GroupName),
                // New documents land at the end of their group rather than jumping to the top.
                DisplayOrder = dto.DisplayOrder ?? await NextDisplayOrderAsync(Trim(dto.GroupName)),
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

            var error = Validate(dto);
            if (error is not null) return BadRequest(new { message = error });

            var newGroup = Trim(dto.GroupName);
            // Moving to a different group without an explicit position appends it there.
            if (dto.DisplayOrder is null && !string.Equals(newGroup, req.GroupName, StringComparison.OrdinalIgnoreCase))
                req.DisplayOrder = await NextDisplayOrderAsync(newGroup, excludingId: id);
            else if (dto.DisplayOrder is int order)
                req.DisplayOrder = order;

            req.Name = dto.Name.Trim();
            req.Description = dto.Description?.Trim();
            req.IsRequired = dto.IsRequired;
            req.GroupName = newGroup;

            db.Audit(this, "UpdateRequirement", $"Updated document requirement #{id} '{req.Name}'");
            await db.SaveChangesAsync();
            return NoContent();
        }

        // PUT /api/document-requirements/order  — persist a drag-free reorder: the client
        // sends the requirement ids in the order they should appear and each gets its index.
        [HttpPut("order")]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Reorder(List<int> orderedIds)
        {
            if (orderedIds is null || orderedIds.Count == 0)
                return BadRequest(new { message = "No requirements were supplied." });

            var requirements = await db.DocumentRequirements
                .Where(dr => orderedIds.Contains(dr.Id))
                .ToListAsync();

            foreach (var req in requirements)
                req.DisplayOrder = orderedIds.IndexOf(req.Id);

            db.Audit(this, "ReorderRequirements", $"Reordered {requirements.Count} document requirement(s)");
            await db.SaveChangesAsync();
            return NoContent();
        }

        // GET /api/document-requirements/groups  — existing group names, for the editor's picker.
        [HttpGet("groups")]
        public async Task<IActionResult> GetGroups()
        {
            var groups = await db.DocumentRequirements
                .Where(dr => dr.IsActive && dr.GroupName != null)
                .Select(dr => dr.GroupName!)
                .Distinct()
                .OrderBy(g => g)
                .ToListAsync();
            return Ok(groups);
        }

        // The next free slot at the end of a group (0 when the group is empty).
        private async Task<int> NextDisplayOrderAsync(string? groupName, int? excludingId = null)
        {
            var max = await db.DocumentRequirements
                .Where(dr => dr.IsActive && dr.GroupName == groupName && (excludingId == null || dr.Id != excludingId))
                .Select(dr => (int?)dr.DisplayOrder)
                .MaxAsync();
            return (max ?? -1) + 1;
        }

        private static string? Trim(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private static string? Validate(DocumentRequirementRequest dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return "A document name is required.";
            if (dto.Name.Trim().Length > 200)
                return "Document names must be 200 characters or fewer.";
            if (dto.GroupName?.Trim().Length > 60)
                return "Group names must be 60 characters or fewer.";
            if (dto.DisplayOrder is int order && order < 0)
                return "Display order cannot be negative.";
            return null;
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
        bool IsRequired,
        // Optional checklist heading; null puts the document in the ungrouped bucket.
        string? GroupName = null,
        // Null appends to the end of the group instead of forcing a position.
        int? DisplayOrder = null);
}
