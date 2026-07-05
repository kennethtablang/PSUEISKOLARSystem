using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    // A message in a scholar<->coordinator conversation (FR-17).
    // A thread is identified by (ScholarId, RequirementId): all messages sharing
    // those keys form one conversation. RequirementId is optional (general thread).
    public class Message
    {
        public int Id { get; set; }

        // The scholar the conversation belongs to (fixed party).
        [Required]
        public string ScholarId { get; set; } = string.Empty;
        public ApplicationUser Scholar { get; set; } = null!;

        // Optional link to the document requirement the thread is about (FR-17.1).
        public int? RequirementId { get; set; }
        public DocumentRequirement? Requirement { get; set; }

        // Who wrote this message (scholar or a coordinator/admin).
        [Required]
        public string SenderId { get; set; } = string.Empty;
        public ApplicationUser Sender { get; set; } = null!;

        [Required, MaxLength(2000)]
        public string Body { get; set; } = string.Empty;

        public bool ReadByScholar { get; set; }
        public bool ReadByStaff { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
