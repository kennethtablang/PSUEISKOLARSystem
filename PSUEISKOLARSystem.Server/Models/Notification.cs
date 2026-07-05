using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    public class Notification
    {
        public int Id { get; set; }

        [Required]
        public string RecipientId { get; set; } = string.Empty;
        public ApplicationUser Recipient { get; set; } = null!;

        [Required, MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required, MaxLength(1000)]
        public string Message { get; set; } = string.Empty;

        // e.g. DocumentStatus, Announcement, Deadline, Message, Account
        [MaxLength(50)]
        public string Category { get; set; } = "General";

        // Client-side route to deep-link the user to the relevant record (FR-14.4)
        [MaxLength(300)]
        public string? LinkUrl { get; set; }

        public bool IsRead { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? ReadAt { get; set; }
    }
}
