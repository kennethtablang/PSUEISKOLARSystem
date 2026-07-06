namespace PSUEISKOLARSystem.Server.Models.Enums
{
    // Valid announcement "intended action" keys shared with the client.
    // Keep in sync with the client (src/api/announcements.js ANNOUNCEMENT_INTENTS).
    public static class AnnouncementIntents
    {
        public const string SubmitDocuments    = "SubmitDocuments";
        public const string UpdateProfile      = "UpdateProfile";
        public const string ContactCoordinator = "ContactCoordinator";

        public static readonly string[] All =
        [
            SubmitDocuments,
            UpdateProfile,
            ContactCoordinator
        ];

        public static bool IsValid(string? key) => key is not null && All.Contains(key);
    }
}
