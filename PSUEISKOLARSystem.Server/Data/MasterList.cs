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

        /// <summary>
        /// The grantee account a student already has: by student number, or — when the office
        /// listed them as a scholar under a different number than the one they used as a
        /// grantee — by their full name. Null when they have none. The User is included.
        /// </summary>
        public static async Task<GranteeProfile?> FindGranteeAccountAsync(
            ApplicationDbContext db, string studentId, string firstName, string lastName, string? middleName)
        {
            var sid = NormalizeStudentId(studentId);
            var byNumber = await db.GranteeProfiles.Include(gp => gp.User).FirstOrDefaultAsync(gp => gp.StudentId == sid);
            if (byNumber is not null) return byNumber;

            var first = NormalizeName(firstName);
            var last = NormalizeName(lastName);
            var middle = NormalizeOptionalName(middleName);
            var byName = await db.GranteeProfiles
                .Include(gp => gp.User)
                .Where(gp => gp.User.FirstName == first && gp.User.LastName == last)
                .ToListAsync();
            // Only an unambiguous match: one account, and the middle names agree when both are given.
            var candidates = byName.Where(gp => gp.User.MiddleName is null || middle is null || gp.User.MiddleName == middle).ToList();
            return candidates.Count == 1 ? candidates[0] : null;
        }

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
        /// who has just been awarded a grant, a past grantee receiving another, or a past
        /// grantee now listed as a scholar — the line is applied straight away instead of
        /// waiting for a sign-up that will never come. Returns a short description of what
        /// happened, or null when no account exists yet. The caller saves; the ids of grantee
        /// accounts upgraded to scholar accounts are added to <paramref name="upgraded"/> so
        /// the caller can tell those students once the change is saved.
        /// </summary>
        public static async Task<string?> ApplyToExistingAccountAsync(
            ApplicationDbContext db, EligibilityRecord line, string? actorId, ICollection<string>? upgraded = null)
        {
            var scholarUserId = await db.ScholarProfiles
                .Where(sp => sp.StudentId == line.StudentId)
                .Select(sp => sp.UserId)
                .FirstOrDefaultAsync();

            /* The same student under another number: the office's lists are typed by hand. A
               single scholar account with exactly this name is that student. */
            if (scholarUserId is null)
            {
                var named = await db.ScholarProfiles
                    .Where(sp => sp.StudentId != line.StudentId
                              && sp.User.FirstName == line.FirstName && sp.User.LastName == line.LastName
                              && (line.MiddleName == null || sp.User.MiddleName == null || sp.User.MiddleName == line.MiddleName))
                    .Select(sp => sp.UserId)
                    .Take(2)
                    .ToListAsync();
                // A scholar line only goes by name when no grantee account claims the number.
                if (named.Count == 1 && (line.Kind == EligibilityKinds.Grantee
                        || !await db.GranteeProfiles.AnyAsync(gp => gp.StudentId == line.StudentId)))
                    scholarUserId = named[0];
            }

            // A grantee account, by number or by unambiguous name (see FindGranteeAccountAsync).
            var grantee = scholarUserId is null
                ? await FindGranteeAccountAsync(db, line.StudentId, line.FirstName, line.LastName, line.MiddleName)
                : null;
            var granteeUserId = grantee?.UserId;

            var userId = scholarUserId ?? granteeUserId;
            if (userId is null) return null;

            if (line.Kind == EligibilityKinds.Scholar)
            {
                /* A past grantee now listed as a scholar: their grantee account becomes their
                   scholar account at once — no second account and no second sign-up. The
                   one-time grants they received stay on it. */
                if (scholarUserId is null)
                {
                    var refusal = await UpgradeGranteeToScholarAsync(db, grantee!, line, actorId);
                    if (refusal is not null)
                        return $"this student has a grantee account that could not be upgraded yet: {refusal}";
                    upgraded?.Add(grantee!.UserId);
                    return "their grantee account was upgraded to a scholar account — their one-time grants stay on their profile";
                }

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
        /// Grantee → scholar, done by the office's listing rather than by the student signing up
        /// again. The grantee account is reactivated and becomes a scholar account: same email and
        /// password, a scholar profile built from the grantee profile, the scholarship from the
        /// line, and every one-time grant left where it is. The student confirms their year
        /// level, course and data sheet the next time they sign in (<see cref="ScholarProfile.DetailsReviewPending"/>).
        /// Returns why it could not be done (e.g. the scholarship is full), or null. The caller saves.
        /// </summary>
        public static async Task<string?> UpgradeGranteeToScholarAsync(
            ApplicationDbContext db, GranteeProfile grantee, EligibilityRecord line, string? actorId)
        {
            if (line.Kind != EligibilityKinds.Scholar || line.ScholarshipTypeId is not int typeId)
                return "the line is not for a scholarship";

            var userId = grantee.UserId;
            if (await db.ScholarProfiles.AnyAsync(sp => sp.UserId == userId || sp.StudentId == line.StudentId))
                return $"student no. {line.StudentId} is already registered to a scholar account";

            // The ledger enforces one scholarship per student and the slot quota.
            var rejection = await ScholarshipRegistry.SetAsync(db, userId, typeId, actorId ?? userId, actorIsStaff: true,
                "Grantee account upgraded to a scholar account from the cross-matching list.");
            if (rejection is not null) return rejection;

            var user = grantee.User ?? await db.Users.FirstAsync(u => u.Id == userId);
            var profile = new ScholarProfile
            {
                UserId = userId,
                // The scholar account goes by the number the scholar list uses.
                StudentId = line.StudentId,
                CampusId = line.CampusId ?? grantee.CampusId,
                ProgramId = grantee.ProgramId,
                ScholarshipTypeId = typeId,
                YearLevel = grantee.YearLevel,
                ContactNumber = grantee.ContactNumber,
                BirthDate = grantee.BirthDate,
                Address = grantee.Address,
                ConvertedFromGranteeAt = DateTime.UtcNow,
                DetailsReviewPending = true,
            };
            DTOs.Scholars.PersonalDetailsDto.From(grantee.Personal).ApplyTo(profile.Personal);
            db.ScholarProfiles.Add(profile);
            db.GranteeProfiles.Remove(grantee);

            // Grantee role out, Scholar role in. A new stamp retires sessions still carrying the old role.
            var roleIds = await db.Roles
                .Where(r => r.Name == UserRoles.Grantee || r.Name == UserRoles.Scholar)
                .ToDictionaryAsync(r => r.Name!, r => r.Id);
            if (roleIds.TryGetValue(UserRoles.Grantee, out var granteeRole))
            {
                var old = await db.UserRoles.FirstOrDefaultAsync(ur => ur.UserId == userId && ur.RoleId == granteeRole);
                if (old is not null) db.UserRoles.Remove(old);
            }
            if (roleIds.TryGetValue(UserRoles.Scholar, out var scholarRole)
                && !await db.UserRoles.AnyAsync(ur => ur.UserId == userId && ur.RoleId == scholarRole))
                db.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<string> { UserId = userId, RoleId = scholarRole });

            user.IsActive = true;
            user.SecurityStamp = Guid.NewGuid().ToString();

            line.ClaimedByUserId = userId;
            line.ClaimedAt = DateTime.UtcNow;

            db.AuditLogs.Add(new AuditLog
            {
                UserId = actorId ?? userId,
                Action = "UpgradeGranteeToScholar",
                Details = $"{user.FullName} ({line.StudentId}): grantee account upgraded to a scholar account — " +
                          "listed on a scholarship's cross-matching list; one-time grants kept",
            });
            return null;
        }

        /// <summary>
        /// Tells students whose grantee account has just become a scholar account. Call after saving.
        /// </summary>
        public static async Task NotifyUpgradedAsync(ApplicationDbContext db, INotificationService notifications, IEnumerable<string> userIds)
        {
            foreach (var userId in userIds.Distinct())
            {
                var type = await db.ScholarProfiles
                    .Where(sp => sp.UserId == userId)
                    .Select(sp => sp.ScholarshipType != null ? sp.ScholarshipType.Name : null)
                    .FirstOrDefaultAsync();
                await notifications.CreateAsync(
                    userId,
                    "Your account is now a scholar account",
                    $"The scholarship office listed you under {type ?? "a scholarship"}, so your grantee account has been upgraded to " +
                    "your scholar account. Sign in with the same email and password. Your one-time grants are still on your profile — " +
                    "please update your year level, course and details.",
                    NotificationCategories.Account,
                    "/my-profile");
            }
        }

        /// <summary>
        /// Applies every open line that points at a student who already has an account: grants
        /// for scholars and grantees, and scholar lines for past grantees (upgrading them). Lines
        /// listed before the matching account existed — or before this rule did — would otherwise
        /// stay open forever. Run at startup. Returns how many lines were applied.
        /// </summary>
        public static async Task<int> ReconcileAsync(ApplicationDbContext db, INotificationService? notifications)
        {
            var open = await db.EligibilityRecords
                .Include(e => e.GrantType)
                .Include(e => e.ScholarshipType)
                .Where(e => e.ClaimedByUserId == null
                         && (db.ScholarProfiles.Any(sp => sp.StudentId == e.StudentId
                                                      || (sp.User.FirstName == e.FirstName && sp.User.LastName == e.LastName))
                          || db.GranteeProfiles.Any(gp => gp.StudentId == e.StudentId
                                                      || (gp.User.FirstName == e.FirstName && gp.User.LastName == e.LastName))))
                .OrderBy(e => e.CreatedAt)
                .ToListAsync();

            var upgraded = new List<string>();
            var applied = 0;
            foreach (var line in open)
            {
                // A grant type closed since the line was added has paid out; leave its lines be.
                if (line.Kind == EligibilityKinds.Grantee && line.GrantType is { IsActive: false }) continue;
                if (await ApplyToExistingAccountAsync(db, line, actorId: null, upgraded) is null) continue;
                if (line.ClaimedByUserId is not null) applied++;
                // Each line is saved on its own so the next one sees the account it may have created.
                await db.SaveChangesAsync();
            }

            if (notifications is not null && upgraded.Count > 0)
                await NotifyUpgradedAsync(db, notifications, upgraded);
            return applied;
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
                $"{c.MatchedScholarship} on {c.MatchedOn}. A student may hold only one scholarship — review the student on the Master List.",
                NotificationCategories.Account,
                $"/master-list?search={Uri.EscapeDataString(c.StudentId)}");
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
