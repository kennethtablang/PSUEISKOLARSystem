namespace PSUEISKOLARSystem.Server.Models.Enums
{
    // Release state of a one-time financial grant awarded to a scholar.
    public static class GrantReleaseStatuses
    {
        public const string Pending   = "Pending";
        public const string Released  = "Released";
        public const string Cancelled = "Cancelled";

        public static readonly string[] All =
        [
            Pending,
            Released,
            Cancelled
        ];
    }
}
