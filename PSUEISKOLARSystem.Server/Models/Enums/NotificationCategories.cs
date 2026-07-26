namespace PSUEISKOLARSystem.Server.Models.Enums
{
    // Notification category keys shared by the notification pipeline and the client.
    // Keep these values in sync with the client (src/constants/notifications.js).
    public static class NotificationCategories
    {
        public const string DocumentStatus = "DocumentStatus";
        public const string Announcement   = "Announcement";
        public const string Deadline       = "Deadline";
        public const string Message        = "Message";
        public const string Account        = "Account";

        public static readonly string[] All =
        [
            DocumentStatus,
            Announcement,
            Deadline,
            Message,
            Account
        ];
    }
}
