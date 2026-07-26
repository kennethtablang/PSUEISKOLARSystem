namespace PSUEISKOLARSystem.Server.Models.Enums
{
    /// <summary>
    /// Encoding helpers for <see cref="ApplicationUser.MutedNotificationCategories"/>.
    /// The column holds a pipe-wrapped list ("|Deadline|Message|") so that a
    /// <c>Contains("|Deadline|")</c> predicate stays translatable to SQL and can't
    /// match a category whose name is a prefix of another.
    /// </summary>
    public static class NotificationMuting
    {
        // Categories a user is allowed to silence. Account notices (approvals, password
        // changes, lockouts) are never mutable — they are the ones that matter most.
        public static readonly string[] Mutable =
        [
            NotificationCategories.DocumentStatus,
            NotificationCategories.Announcement,
            NotificationCategories.Deadline,
            NotificationCategories.Message,
        ];

        public static string Token(string category) => $"|{category}|";

        public static IReadOnlyList<string> Parse(string? stored) =>
            string.IsNullOrWhiteSpace(stored)
                ? []
                : stored.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .Where(c => Mutable.Contains(c))
                        .Distinct()
                        .ToList();

        /// <summary>Normalises a caller-supplied selection into the stored form (null when empty).</summary>
        public static string? Encode(IEnumerable<string>? categories)
        {
            var valid = (categories ?? [])
                .Where(c => Mutable.Contains(c))
                .Distinct()
                .ToList();

            return valid.Count == 0 ? null : $"|{string.Join('|', valid)}|";
        }
    }
}
