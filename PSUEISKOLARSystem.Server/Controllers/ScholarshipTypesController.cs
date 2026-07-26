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

            var scholarCounts = await db.ScholarProfiles
                .Where(sp => sp.ScholarshipTypeId != null)
                .GroupBy(sp => sp.ScholarshipTypeId!.Value)
                .Select(g => new { TypeId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.TypeId, x => x.Count);

            return Ok(types.Select(st => new
            {
                st.Id,
                st.Name,
                st.Description,
                st.Category,
                st.MinimumGwa,
                st.IsActive,
                st.SlotLimit,
                ScholarCount = scholarCounts.GetValueOrDefault(st.Id),
                // Null SlotLimit means uncapped, so there are no "available" slots to report.
                AvailableSlots = st.SlotLimit is int cap
                    ? Math.Max(0, cap - scholarCounts.GetValueOrDefault(st.Id))
                    : (int?)null,
                IsFull = st.SlotLimit is int limit && scholarCounts.GetValueOrDefault(st.Id) >= limit,
                // Shared requirements only — type-specific "other documents" are listed separately
                // so the checklist in the editor stays meaningful.
                RequirementIds = st.Requirements
                    .Where(r => r.Requirement.IsActive && r.Requirement.ScholarshipTypeId == null)
                    .Select(r => r.RequirementId)
                    .ToList(),
                Requirements = st.Requirements
                    .Where(r => r.Requirement.IsActive)
                    .Select(r => r.Requirement)
                    .InDisplayOrder()
                    .Select(r => new
                    {
                        RequirementId = r.Id,
                        r.Name,
                        r.Description,
                        r.IsRequired,
                        r.GroupName,
                        r.DisplayOrder,
                        HasSample = r.SampleImagePath != null,
                        IsTypeSpecific = r.ScholarshipTypeId == st.Id,
                    })
                    .ToList(),
            }));
        }

        // GET /api/scholarship-types/{id}  — full detail for the read-only view modal
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var st = await db.ScholarshipTypes
                .Include(t => t.Requirements)
                    .ThenInclude(str => str.Requirement)
                .FirstOrDefaultAsync(t => t.Id == id);
            if (st is null) return NotFound();

            var requirements = st.Requirements
                .Where(r => r.Requirement.IsActive)
                .Select(r => r.Requirement)
                .InDisplayOrder()
                .ToList();

            var scholarCount = await db.ScholarProfiles.CountAsync(sp => sp.ScholarshipTypeId == id);
            var compliantCount = await db.ScholarProfiles
                .Where(sp => sp.ScholarshipTypeId == id)
                .CountAsync(sp => sp.Grades
                    .OrderByDescending(g => g.AcademicYear)
                    .ThenByDescending(g => g.Semester)
                    .Select(g => (bool?)g.MeetsRequirement)
                    .FirstOrDefault() == true);

            var lifecycleBreakdown = await db.ScholarProfiles
                .Where(sp => sp.ScholarshipTypeId == id)
                .GroupBy(sp => sp.LifecycleStatus)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync();

            return Ok(new
            {
                st.Id,
                st.Name,
                st.Description,
                st.Category,
                st.MinimumGwa,
                st.IsActive,
                st.SlotLimit,
                ScholarCount = scholarCount,
                AvailableSlots = st.SlotLimit is int cap ? Math.Max(0, cap - scholarCount) : (int?)null,
                IsFull = st.SlotLimit is int limit && scholarCount >= limit,
                CompliantCount = compliantCount,
                LifecycleBreakdown = lifecycleBreakdown,
                SharedRequirements = requirements
                    .Where(r => r.ScholarshipTypeId == null)
                    .Select(r => new { r.Id, r.Name, r.Description, r.IsRequired, r.GroupName, r.DisplayOrder, HasSample = r.SampleImagePath != null }),
                OtherDocuments = requirements
                    .Where(r => r.ScholarshipTypeId == id)
                    .Select(r => new { r.Id, r.Name, r.Description, r.IsRequired, r.GroupName, r.DisplayOrder, HasSample = r.SampleImagePath != null }),
            });
        }

        // GET /api/scholarship-types/{id}/other-documents
        // Documents that belong only to this scholarship type (not part of the shared catalog).
        [HttpGet("{id}/other-documents")]
        public async Task<IActionResult> GetOtherDocuments(int id)
        {
            if (!await db.ScholarshipTypes.AnyAsync(t => t.Id == id)) return NotFound();

            var docs = await db.DocumentRequirements
                .Where(dr => dr.IsActive && dr.ScholarshipTypeId == id)
                .InDisplayOrder()
                .Select(dr => new
                {
                    dr.Id,
                    dr.Name,
                    dr.Description,
                    dr.IsRequired,
                    dr.GroupName,
                    dr.DisplayOrder,
                    HasSample = dr.SampleImagePath != null,
                })
                .ToListAsync();

            return Ok(docs);
        }

        // POST /api/scholarship-types
        [HttpPost]
        [Authorize(Roles = UserRoles.Administrator)]
        public async Task<IActionResult> Create(ScholarshipTypeRequest dto)
        {
            var error = Validate(dto);
            if (error is not null) return BadRequest(new { message = error });

            var name = dto.Name.Trim();
            if (await db.ScholarshipTypes.AnyAsync(t => t.Name == name))
                return BadRequest(new { message = $"A scholarship type named '{name}' already exists." });

            var st = new ScholarshipType
            {
                Name = name,
                Description = Trim(dto.Description),
                Category = Trim(dto.Category),
                MinimumGwa = dto.MinimumGwa,
                SlotLimit = dto.SlotLimit,
            };
            db.ScholarshipTypes.Add(st);
            db.Audit(this, "CreateScholarshipType", $"Created scholarship type '{st.Name}'");
            await db.SaveChangesAsync();

            await SyncOtherDocumentsAsync(st.Id, dto.OtherDocuments);
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

            var error = Validate(dto);
            if (error is not null) return BadRequest(new { message = error });

            var name = dto.Name.Trim();
            if (await db.ScholarshipTypes.AnyAsync(t => t.Id != id && t.Name == name))
                return BadRequest(new { message = $"A scholarship type named '{name}' already exists." });

            // Lowering the cap below the scholars already on the scholarship would leave the
            // tracker showing a negative balance and can't be undone by the system.
            if (dto.SlotLimit is int newLimit)
            {
                var filled = await ScholarshipRegistry.CountFilledSlotsAsync(db, id);
                if (newLimit < filled)
                    return BadRequest(new
                    {
                        message = $"{filled} scholar(s) already hold this scholarship, so the slot limit " +
                                  $"cannot be set below {filled}."
                    });
            }

            st.Name = name;
            st.Description = Trim(dto.Description);
            st.Category = Trim(dto.Category);
            st.MinimumGwa = dto.MinimumGwa;
            st.SlotLimit = dto.SlotLimit;

            db.Audit(this, "UpdateScholarshipType", $"Updated scholarship type #{id} '{st.Name}'");
            await db.SaveChangesAsync();

            await SyncOtherDocumentsAsync(id, dto.OtherDocuments);
            await SetRequirements(id, dto.RequirementIds);

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
            db.Audit(this, "ToggleScholarshipType", $"Set scholarship type #{id} '{st.Name}' to {(st.IsActive ? "Active" : "Inactive")}");
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

            if (await db.ScholarshipAssignments.AnyAsync(a => a.ScholarshipTypeId == id))
                return BadRequest(new { message = "This scholarship type appears in a scholar's assignment history and must be kept for auditing. Deactivate it instead." });

            // Retire its type-specific documents alongside it.
            await db.DocumentRequirements
                .Where(dr => dr.ScholarshipTypeId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(dr => dr.IsActive, false));

            db.Audit(this, "DeleteScholarshipType", $"Deleted scholarship type #{id} '{st.Name}'");
            db.ScholarshipTypes.Remove(st);
            await db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Reconciles the documents that exist only for this scholarship type. Documents the
        /// caller dropped are deactivated (never hard-deleted — scholars may already have
        /// submitted against them); new ones are created and linked to the type.
        /// </summary>
        private async Task SyncOtherDocumentsAsync(int scholarshipTypeId, List<OtherDocumentRequest>? requested)
        {
            requested ??= [];

            var existing = await db.DocumentRequirements
                .Where(dr => dr.ScholarshipTypeId == scholarshipTypeId && dr.IsActive)
                .ToListAsync();

            var keptIds = requested.Where(d => d.Id.HasValue).Select(d => d.Id!.Value).ToHashSet();

            foreach (var doc in existing.Where(e => !keptIds.Contains(e.Id)))
                doc.IsActive = false;

            foreach (var req in requested)
            {
                var name = req.Name?.Trim();
                if (string.IsNullOrWhiteSpace(name)) continue;

                if (req.Id.HasValue)
                {
                    var doc = existing.FirstOrDefault(e => e.Id == req.Id.Value);
                    if (doc is null) continue;   // not ours to edit
                    doc.Name = name;
                    doc.Description = Trim(req.Description);
                    doc.IsRequired = req.IsRequired;
                }
                else
                {
                    db.DocumentRequirements.Add(new DocumentRequirement
                    {
                        Name = name,
                        Description = Trim(req.Description),
                        IsRequired = req.IsRequired,
                        ScholarshipTypeId = scholarshipTypeId,
                    });
                }
            }

            await db.SaveChangesAsync();
        }

        private async Task SetRequirements(int scholarshipTypeId, List<int> requirementIds)
        {
            var existing = await db.ScholarshipTypeRequirements
                .Where(str => str.ScholarshipTypeId == scholarshipTypeId)
                .ToListAsync();

            db.ScholarshipTypeRequirements.RemoveRange(existing);

            // Shared requirements the admin ticked, plus every document that belongs only to
            // this type (those are always required of its scholars).
            var shared = await db.DocumentRequirements
                .Where(dr => dr.IsActive && dr.ScholarshipTypeId == null && requirementIds.Contains(dr.Id))
                .Select(dr => dr.Id)
                .ToListAsync();

            var typeSpecific = await db.DocumentRequirements
                .Where(dr => dr.IsActive && dr.ScholarshipTypeId == scholarshipTypeId)
                .Select(dr => dr.Id)
                .ToListAsync();

            db.ScholarshipTypeRequirements.AddRange(
                shared.Concat(typeSpecific).Distinct().Select(rid => new ScholarshipTypeRequirement
                {
                    ScholarshipTypeId = scholarshipTypeId,
                    RequirementId = rid,
                }));

            await db.SaveChangesAsync();
        }

        private static string? Trim(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private static string? Validate(ScholarshipTypeRequest dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return "A scholarship type name is required.";
            if (dto.Name.Trim().Length > 150)
                return "Name must be 150 characters or fewer.";
            if (dto.MinimumGwa < 1.00m || dto.MinimumGwa > 5.00m)
                return "Minimum GWA must be between 1.00 and 5.00.";
            if (dto.SlotLimit is int slots && slots < 1)
                return "The slot limit must be at least 1. Leave it blank for an unlimited scholarship.";

            var names = (dto.OtherDocuments ?? [])
                .Select(d => d.Name?.Trim())
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .ToList();

            if (names.Any(n => n!.Length > 200))
                return "Document names must be 200 characters or fewer.";
            if (names.Count != names.Distinct(StringComparer.OrdinalIgnoreCase).Count())
                return "Each additional document must have a distinct name.";

            return null;
        }
    }

    public record ScholarshipTypeRequest(
        string Name,
        string? Description,
        string? Category,
        decimal MinimumGwa,
        // Null = unlimited; otherwise the maximum number of scholars who may hold it at once.
        int? SlotLimit,
        List<int> RequirementIds,
        List<OtherDocumentRequest>? OtherDocuments);

    // A document required only by this scholarship type. Id is null for a new one.
    public record OtherDocumentRequest(
        int? Id,
        string? Name,
        string? Description,
        bool IsRequired);
}
