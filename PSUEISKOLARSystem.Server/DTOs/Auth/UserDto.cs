namespace PSUEISKOLARSystem.Server.DTOs.Auth
{
    public class UserDto
    {
        public string Id { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string? MiddleName { get; set; }
        public string LastName { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public bool TwoFactorEnabled { get; set; }

        // Admin verification of a self-registered scholar: Pending | Approved | Rejected.
        public string ApprovalStatus { get; set; } = string.Empty;
        public string? ApprovalNote { get; set; }
        public DateTime? ApprovalDecidedAt { get; set; }
        public DateTime? ConsentAcceptedAt { get; set; }
        public string? ConsentVersion { get; set; }
        public bool EmailAnnouncements { get; set; }
        public bool EmailDocumentStatus { get; set; }
        public bool EmailDeadlines { get; set; }

        // NotificationCategories the user has silenced in the bell.
        public List<string> MutedInAppCategories { get; set; } = [];

        // True when a profile photo has been uploaded; fetch it from /api/users/{id}/avatar.
        public bool HasAvatar { get; set; }
    }
}
