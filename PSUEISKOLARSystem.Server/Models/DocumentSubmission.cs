using System.ComponentModel.DataAnnotations;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Models
{
    public class DocumentSubmission
    {
        public int Id { get; set; }

        [Required]
        public string ScholarId { get; set; } = string.Empty;
        public ApplicationUser Scholar { get; set; } = null!;

        public int RequirementId { get; set; }
        public DocumentRequirement Requirement { get; set; } = null!;

        [Required, MaxLength(260)]
        public string FileName { get; set; } = string.Empty;

        [Required, MaxLength(260)]
        public string StoredFileName { get; set; } = string.Empty;

        [Required, MaxLength(100)]
        public string ContentType { get; set; } = string.Empty;

        public long FileSizeBytes { get; set; }

        public DocumentStatus Status { get; set; } = DocumentStatus.Pending;

        [MaxLength(1000)]
        public string? FeedbackNote { get; set; }

        public string? ReviewedById { get; set; }
        public ApplicationUser? ReviewedBy { get; set; }

        public DateTime? ReviewedAt { get; set; }

        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

        [Required, MaxLength(20)]
        public string AcademicYear { get; set; } = string.Empty;

        public int Semester { get; set; }

        public ICollection<DocumentStatusHistory> StatusHistory { get; set; } = [];
    }
}
