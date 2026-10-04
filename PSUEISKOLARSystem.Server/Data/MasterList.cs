using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Interfaces;
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
                // A scholar line for a past grantee stays open: when they sign up as a scholar
                // they are asked to reuse their grantee account, which turns it into their
                // scholar account (see AuthService.RegisterScholarAsync).
                if (scholarUserId is null)
                    return "this student already has a grantee account — it becomes their scholar account when they sign up";

                // A scholar already holding a different scholarship matched again: a student may
                // hold one scholarship at a time, so the line is left open and the office is told
                // (see CrossMatchConflict) rather than the account being moved silently.
                if (await FindConflictAsync(db, line) is { } conflict)
                    return $"{conflict.ScholarName} already holds {conflict.CurrentScholarship} — flagged for the office to review";

                // A scholar line for an existing scholar just links the two.
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

        /// <summary>
        /// A scholar account matched again by the cross-matching of another scholarship type:
        /// who the scholar is, the scholarship they hold, the one whose list they matched, and
        /// the details that matched.
        /// </summary>
        public sealed record CrossMatchConflict(
            int LineId,
            string ScholarUserId,
            string StudentId,
            string ScholarName,
            string CurrentScholarship,
            int? MatchedScholarshipTypeId,
            string MatchedScholarship,
            string MatchedOn,
            DateTime ListedAt);

        /// <summary>
        /// Null unless this scholar line belongs to a student who already has a scholar account
        /// under a different scholarship type.
        /// </summary>
        public static async Task<CrossMatchConflict?> FindConflictAsync(ApplicationDbContext db, EligibilityRecord line)
        {
            if (line.Kind != EligibilityKinds.Scholar || line.ScholarshipTypeId is null) return null;
            var holder = await db.ScholarProfiles
                .Where(sp => sp.StudentId == line.StudentId
                          && sp.ScholarshipTypeId != null
                          && sp.ScholarshipTypeId != line.ScholarshipTypeId)
                .Select(sp => new
                {
                    sp.UserId,
                    sp.StudentId,
                    Name = sp.User.LastName + ", " + sp.User.FirstName + (sp.User.MiddleName != null ? " " + sp.User.MiddleName : ""),
                    Current = sp.ScholarshipType!.Name,
                })
                .FirstOrDefaultAsync();
            if (holder is null) return null;

            var matched = line.ScholarshipType?.Name
                ?? await db.ScholarshipTypes.Where(t => t.Id == line.ScholarshipTypeId).Select(t => t.Name).FirstOrDefaultAsync()
                ?? "another scholarship";
            return new CrossMatchConflict(line.Id, holder.UserId, holder.StudentId, holder.Name, holder.Current,
                line.ScholarshipTypeId, matched, await DescribeMatchAsync(db, line), line.CreatedAt);
        }

        /// <summary>Every open cross-match conflict — the report on the Scholarship Check page.</summary>
        public static async Task<List<CrossMatchConflict>> FindAllConflictsAsync(ApplicationDbContext db)
        {
            var lines = await db.EligibilityRecords
                .Include(e => e.ScholarshipType)
                .Include(e => e.Campus)
                .Where(e => e.ClaimedByUserId == null
                         && e.Kind == EligibilityKinds.Scholar
                         && db.ScholarProfiles.Any(sp => sp.StudentId == e.StudentId
                                                      && sp.ScholarshipTypeId != null
                                                      && sp.ScholarshipTypeId != e.ScholarshipTypeId))
                .ToListAsync();
            var result = new List<CrossMatchConflict>();
            foreach (var line in lines)
                if (await FindConflictAsync(db, line) is { } c) result.Add(c);
            return result.OrderByDescending(c => c.ListedAt).ToList();
        }

        /// <summary>The data the office set on the line that the scholar matched.</summary>
        private static async Task<string> DescribeMatchAsync(ApplicationDbContext db, EligibilityRecord line)
        {
            var parts = new List<string>
            {
                $"student no. {line.StudentId}",
                $"name {line.LastName}, {line.FirstName}{(line.MiddleName is null ? "" : " " + line.MiddleName)}",
            };
            if (line.CampusId is int cid)
            {
                var campus = line.Campus?.Name ?? await db.Campuses.Where(c => c.Id == cid).Select(c => c.Name).FirstOrDefaultAsync();
                parts.Add($"campus {campus}");
            }
            return string.Join(", ", parts);
        }

        /// <summary>Tells every administrator and coordinator about a cross-match conflict.</summary>
        public static async Task NotifyConflictAsync(ApplicationDbContext db, INotificationService notifications, CrossMatchConflict c)
        {
            var staff = await (
                from u in db.Users
                join ur in db.UserRoles on u.Id equals ur.UserId
                join r in db.Roles on ur.RoleId equals r.Id
                where u.IsActive && (r.Name == UserRoles.Administrator || r.Name == UserRoles.ScholarshipCoordinator)
                select u.Id).Distinct().ToListAsync();

            await notifications.CreateForManyAsync(
                staff,
                "Scholar matched another scholarship",
                $"{c.ScholarName} ({c.StudentId}) already holds {c.CurrentScholarship} but matched the cross-matching list of " +
                $"{c.MatchedScholarship} on {c.MatchedOn}. A student may hold only one scholarship — review it on the Scholarship Check page.",
                NotificationCategories.Account,
                "/scholarship-verification");
        }

        /// <summary>
        /// Records every unclaimed Grantee line waiting on this student number against the
        /// given scholar account. Covers scholars whose profile is created or re-numbered by
        /// the office rather than through sign-up: a grant the office listed for them earlier
        /// lands on their profile automatically. Returns how many grants were recorded.
        /// The caller saves.
        /// </summary>
        public static async Task<int> ClaimWaitingGrantLinesAsync(
            ApplicationDbContext db, string userId, string studentId, string? actorId)
        {
            var sid = NormalizeStudentId(studentId);
            if (sid.Length == 0) return 0;

            var lines = await db.EligibilityRecords
                .Include(e => e.GrantType)
                .Where(e => e.ClaimedByUserId == null
                         && e.Kind == EligibilityKinds.Grantee
                         && e.StudentId == sid)
                .ToListAsync();

            foreach (var line in lines)
                ClaimGranteeLine(db, line, userId, actorId);
            return lines.Count;
        }
    }
}
