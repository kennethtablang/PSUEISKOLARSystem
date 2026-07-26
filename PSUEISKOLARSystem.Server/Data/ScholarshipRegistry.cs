using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Data
{
    /// <summary>
    /// Single place that owns the "strictly one scholarship per student" rule.
    /// <para>
    /// <see cref="ScholarProfile.ScholarshipTypeId"/> is the denormalised pointer to the
    /// scholar's current scholarship; <see cref="ScholarshipAssignment"/> is the ledger of
    /// every scholarship they have ever been registered under. Both are updated together so
    /// staff can verify that no second scholarship was ever slipped in.
    /// </para>
    /// </summary>
    public static class ScholarshipRegistry
    {
        public static Task<ScholarshipAssignment?> GetActiveAsync(ApplicationDbContext db, string scholarId) =>
            db.ScholarshipAssignments
                .Include(a => a.ScholarshipType)
                .FirstOrDefaultAsync(a => a.ScholarId == scholarId && a.EndedAt == null);

        public static Task<List<ScholarshipAssignment>> GetHistoryAsync(ApplicationDbContext db, string scholarId) =>
            db.ScholarshipAssignments
                .Include(a => a.ScholarshipType)
                .Include(a => a.AssignedBy)
                .Where(a => a.ScholarId == scholarId)
                .OrderByDescending(a => a.EndedAt == null)
                .ThenByDescending(a => a.AssignedAt)
                .ToListAsync();

        /// <summary>
        /// Reconciles the assignment ledger with <paramref name="requestedTypeId"/>.
        /// Does <b>not</b> call SaveChanges — the caller commits.
        /// </summary>
        /// <param name="actorIsStaff">
        /// Staff (admin/coordinator) may transfer a scholar between scholarships, which closes
        /// the previous assignment. A scholar may only pick their <i>first</i> scholarship;
        /// afterwards a change has to go through their coordinator.
        /// </param>
        /// <returns><c>null</c> when applied, otherwise a user-facing rejection message.</returns>
        public static async Task<string?> SetAsync(
            ApplicationDbContext db,
            string scholarId,
            int? requestedTypeId,
            string actorId,
            bool actorIsStaff,
            string? reason = null)
        {
            var active = await GetActiveAsync(db, scholarId);

            // Nothing changed — the common case on every profile save.
            if (active?.ScholarshipTypeId == requestedTypeId) return null;

            if (requestedTypeId is null)
            {
                if (!actorIsStaff)
                    return $"You are registered under {active!.ScholarshipType.Name}. " +
                           "Only your scholarship coordinator can remove or change it.";

                Close(active!, actorId, reason ?? "Scholarship removed by staff.");
                return null;
            }

            var type = await db.ScholarshipTypes.FirstOrDefaultAsync(t => t.Id == requestedTypeId);
            if (type is null) return "The selected scholarship type no longer exists.";
            if (!type.IsActive) return $"'{type.Name}' is not accepting scholars right now.";

            // Slot quota. Occupancy is counted from the profile pointers so the number that
            // blocks the save is the same "N scholars" figure shown on the Scholarship Types
            // page. This scholar is excluded — they are about to take one of the slots.
            if (type.SlotLimit is int limit)
            {
                var filled = await CountFilledSlotsAsync(db, type.Id, excludingScholarId: scholarId);
                if (filled >= limit)
                    return $"'{type.Name}' is full — all {limit} slot{(limit == 1 ? "" : "s")} are taken. " +
                           "Raise the slot limit or release a scholar before assigning another.";
            }

            if (active is not null)
            {
                if (!actorIsStaff)
                    return $"You are already registered under {active.ScholarshipType.Name}. " +
                           "A student may hold only one scholarship at a time — contact your " +
                           "scholarship coordinator to request a change.";

                Close(active, actorId, reason ?? $"Transferred to {type.Name}.");
            }

            db.ScholarshipAssignments.Add(new ScholarshipAssignment
            {
                ScholarId = scholarId,
                ScholarshipTypeId = type.Id,
                AssignedById = actorId,
                AssignedAt = DateTime.UtcNow,
            });

            return null;
        }

        /// <summary>
        /// How many of a scholarship type's slots are currently taken. Counts scholar profiles
        /// pointing at the type, which is the same figure the Scholarship Types page shows.
        /// </summary>
        public static Task<int> CountFilledSlotsAsync(ApplicationDbContext db, int scholarshipTypeId, string? excludingScholarId = null) =>
            db.ScholarProfiles.CountAsync(sp =>
                sp.ScholarshipTypeId == scholarshipTypeId &&
                (excludingScholarId == null || sp.UserId != excludingScholarId));

        private static void Close(ScholarshipAssignment assignment, string actorId, string reason)
        {
            assignment.EndedAt = DateTime.UtcNow;
            assignment.EndedById = actorId;
            assignment.EndReason = reason;
        }

        /// <summary>
        /// Backfills a ledger row for a scholar whose profile already points at a scholarship
        /// but who has no assignment history (data that predates the ledger, or bulk imports).
        /// Commits immediately so a following <see cref="SetAsync"/> can see the row.
        /// </summary>
        public static async Task BackfillAsync(ApplicationDbContext db, ScholarProfile profile, string? actorId)
        {
            if (profile.ScholarshipTypeId is null) return;
            if (await db.ScholarshipAssignments.AnyAsync(a => a.ScholarId == profile.UserId && a.EndedAt == null))
                return;

            db.ScholarshipAssignments.Add(new ScholarshipAssignment
            {
                ScholarId = profile.UserId,
                ScholarshipTypeId = profile.ScholarshipTypeId.Value,
                AssignedById = actorId,
                AssignedAt = profile.EnrolledAt,
            });

            await db.SaveChangesAsync();
        }
    }
}
