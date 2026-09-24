using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Data
{
    /// <summary>
    /// Cross-matching of sign-ups against the office's master list
    /// (<see cref="EligibilityRecord"/>). This replaced manual approval of self-registered
    /// scholars: the list is the approval, decided in advance.
    /// <para>
    /// A student matches a line when the student number, first name and last name agree
    /// (case and spacing ignored), the middle name agrees when both sides give one, and the
    /// campus agrees when the line names one. Only unclaimed lines match, so one line opens
    /// exactly one account.
    /// </para>
    /// </summary>
    public static partial class MasterList
    {
        [GeneratedRegex(@"\s+")]
        private static partial Regex Whitespace();

        /// <summary>Names are stored and compared upper-case with single spaces.</summary>
        public static string NormalizeName(string? value) =>
            Whitespace().Replace(value?.Trim() ?? string.Empty, " ").ToUpperInvariant();

        public static string? NormalizeOptionalName(string? value)
        {
            var n = NormalizeName(value);
            return n.Length == 0 ? null : n;
        }

        public static string NormalizeStudentId(string? value) =>
            (value ?? string.Empty).Trim().ToUpperInvariant();

        /// <summary>Unclaimed lines matching the student's details, scholar lines first.</summary>
        public static async Task<List<EligibilityRecord>> FindMatchesAsync(
            ApplicationDbContext db, string studentId, string firstName, string lastName, string? middleName, int? campusId)
        {
            var sid = NormalizeStudentId(studentId);
            var first = NormalizeName(firstName);
            var last = NormalizeName(lastName);
            var middle = NormalizeOptionalName(middleName);

            var candidates = await db.EligibilityRecords
                .Include(e => e.ScholarshipType)
                .Include(e => e.GrantType)
                .Where(e => e.ClaimedByUserId == null
                         && e.StudentId == sid
                         && e.FirstName == first
                         && e.LastName == last)
                .ToListAsync();

            return candidates
                .Where(e => e.MiddleName is null || middle is null || e.MiddleName == middle)
                .Where(e => e.CampusId is null || e.CampusId == campusId)
                .OrderBy(e => e.Kind == EligibilityKinds.Scholar ? 0 : 1)
                .ToList();
        }

        /// <summary>
        /// Records the grant a Grantee line entitles its student to, against the given account,
        /// and marks the line claimed. The caller saves.
        /// </summary>
        public static void ClaimGranteeLine(ApplicationDbContext db, EligibilityRecord line, string userId, string? actorId)
        {
            var type = line.GrantType;
            db.OneTimeGrants.Add(new OneTimeGrant
            {
                ScholarId = userId,
                GrantTypeId = line.GrantTypeId,
                Title = type?.Name ?? "One-time grant",
                Purpose = type?.Description,
                Source = type?.Sponsor,
                Amount = line.GrantAmount ?? type?.DefaultAmount ?? 0m,
                AwardedOn = DateTime.UtcNow,
                Notes = "Recorded from the master list.",
                RecordedById = actorId,
            });
            line.ClaimedByUserId = userId;
            line.ClaimedAt = DateTime.UtcNow;
        }

        /// <summary>
        /// When the office adds a line for a student who already has an account — a scholar
        /// who has just been awarded a grant, or a past grantee receiving another — the line
        /// is applied straight away instead of waiting for a sign-up that will never come.
        /// Returns a short description of what happened, or null when no account exists yet.
        /// The caller saves.
        /// </summary>
        public static async Task<string?> ApplyToExistingAccountAsync(ApplicationDbContext db, EligibilityRecord line, string? actorId)
        {
            var scholarUserId = await db.ScholarProfiles
                .Where(sp => sp.StudentId == line.StudentId)
                .Select(sp => sp.UserId)
                .FirstOrDefaultAsync();

            var granteeUserId = scholarUserId is null
                ? await db.GranteeProfiles
                    .Where(gp => gp.StudentId == line.StudentId)
                    .Select(gp => gp.UserId)
                    .FirstOrDefaultAsync()
                : null;

            var userId = scholarUserId ?? granteeUserId;
            if (userId is null) return null;

            if (line.Kind == EligibilityKinds.Scholar)
            {
                // A scholar line for an existing scholar just links the two.
                if (scholarUserId is null) return null;
                line.ClaimedByUserId = scholarUserId;
                line.ClaimedAt = DateTime.UtcNow;
                return "linked to the existing scholar account";
            }

            if (line.GrantType is null && line.GrantTypeId is int typeId)
                line.GrantType = await db.GrantTypes.FindAsync(typeId);

            ClaimGranteeLine(db, line, userId, actorId);

            // A deactivated grantee receiving a new grant needs their account back.
            if (granteeUserId is not null)
            {
                var user = await db.Users.FindAsync(granteeUserId);
                if (user is not null && !user.IsActive) user.IsActive = true;
            }

            return scholarUserId is not null
                ? "grant recorded on the existing scholar's profile"
                : "grant recorded on the existing grantee account";
        }
    }
}
