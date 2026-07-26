namespace PSUEISKOLARSystem.Server.Models.Enums
{
    // Admin verification state of a self-registered scholar account.
    // Accounts created by an administrator are Approved on creation; scholars who
    // sign themselves up start Pending and must be verified before they can submit.
    public static class ApprovalStatuses
    {
        public const string Pending  = "Pending";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";

        public static readonly string[] All =
        [
            Pending,
            Approved,
            Rejected
        ];
    }
}
