using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Data
{
    /// <summary>
    /// The "have you finished setting up your profile?" rule, in one place.
    /// <para>
    /// A freshly registered scholar has an account but no <see cref="ScholarProfile"/>, so the
    /// system cannot tell which requirements apply to them, which deadlines they are subject
    /// to, or whether their GWA clears their scholarship. Letting them submit in that state
    /// produces documents that belong to nobody's checklist, so the profile has to come first.
    /// </para>
    /// The client shows a blocking gate for this, but the gate is a courtesy — the API is what
    /// actually enforces it, since a scholar can call the endpoints directly.
    /// </summary>
    public static class ScholarOnboarding
    {
        /// <summary>The fields a scholar must fill in before the system can place them.</summary>
        public static bool IsComplete(ScholarProfile? profile) =>
            profile is not null
            && !string.IsNullOrWhiteSpace(profile.StudentId)
            && profile.ProgramId is not null
            && profile.ScholarshipTypeId is not null;

        public static async Task<bool> IsCompleteAsync(ApplicationDbContext db, string scholarId)
        {
            var profile = await db.ScholarProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.UserId == scholarId);
            return IsComplete(profile);
        }

        /// <summary>
        /// The message shown when an incomplete profile blocks an action. Names the missing
        /// fields rather than saying "incomplete", so the scholar knows what to go and fill in.
        /// </summary>
        public static string BlockedMessage(ScholarProfile? profile)
        {
            var missing = new List<string>();
            if (profile is null || string.IsNullOrWhiteSpace(profile.StudentId)) missing.Add("student ID");
            if (profile?.ProgramId is null) missing.Add("program");
            if (profile?.ScholarshipTypeId is null) missing.Add("scholarship type");

            var fields = missing.Count switch
            {
                0 => "your profile details",
                1 => missing[0],
                _ => string.Join(", ", missing.Take(missing.Count - 1)) + " and " + missing[^1],
            };

            var verb = missing.Count == 1 ? "is" : "are";
            return $"Please finish setting up your scholar profile first — your {fields} {verb} " +
                   "still needed. Open My Profile to complete it.";
        }
    }
}
