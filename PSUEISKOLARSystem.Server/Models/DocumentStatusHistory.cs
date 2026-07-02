using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    public class DocumentStatusHistory
    {
        public int Id { get; set; }

        public int SubmissionId { get; set; }
        public DocumentSubmission Submission { get; set; } = null!;

        [MaxLength(20)]
        public string Status { get; set; } = string.Empty;   // Pending / Verified / Incomplete

        [MaxLength(1000)]
        public string? Note { get; set; }

        public string ChangedById { get; set; } = string.Empty;
        public ApplicationUser ChangedBy { get; set; } = null!;

        public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    }
}
