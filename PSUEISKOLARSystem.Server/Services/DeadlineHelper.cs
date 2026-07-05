using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Services
{
    public record ApplicableScholar(string Id, string FullName, string? CampusName);

    public static class DeadlineHelper
    {
        // Active scholars to whom a requirement applies, mirroring the fallback semantics
        // of DocumentRequirementsController.GetAll: a scholar sees a requirement if they have
        // no scholarship type, or their type has no configured requirement links, or their
        // type is explicitly linked to this requirement.
        public static async Task<List<ApplicableScholar>> GetApplicableScholarsAsync(ApplicationDbContext db, int requirementId)
        {
            var configuredTypeIds = (await db.ScholarshipTypeRequirements
                .Select(str => str.ScholarshipTypeId)
                .Distinct()
                .ToListAsync())
                .ToHashSet();

            var typesLinkedToReq = (await db.ScholarshipTypeRequirements
                .Where(str => str.RequirementId == requirementId)
                .Select(str => str.ScholarshipTypeId)
                .ToListAsync())
                .ToHashSet();

            var scholars = await (
                from u in db.Users
                join ur in db.UserRoles on u.Id equals ur.UserId
                join r in db.Roles on ur.RoleId equals r.Id
                where r.Name == UserRoles.Scholar && u.IsActive
                from sp in db.ScholarProfiles.Where(p => p.UserId == u.Id).DefaultIfEmpty()
                select new
                {
                    u.Id,
                    u.FirstName,
                    u.MiddleName,
                    u.LastName,
                    CampusName = u.Campus != null ? u.Campus.Name : null,
                    ScholarshipTypeId = (int?)(sp != null ? sp.ScholarshipTypeId : null),
                })
                .ToListAsync();

            bool Applies(int? typeId)
            {
                if (typeId is null) return true;                       // no type → sees all
                if (!configuredTypeIds.Contains(typeId.Value)) return true; // type has no links → sees all
                return typesLinkedToReq.Contains(typeId.Value);        // type configured → must be linked
            }

            return scholars
                .Where(s => Applies(s.ScholarshipTypeId))
                .Select(s => new ApplicableScholar(
                    s.Id,
                    s.MiddleName != null
                        ? $"{s.FirstName} {s.MiddleName} {s.LastName}"
                        : $"{s.FirstName} {s.LastName}",
                    s.CampusName))
                .ToList();
        }
    }
}
