using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    public class Announcement
    {
        public int Id { get; set; }

        [Required, MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? TargetRole { get; set; }

        public int? TargetCampusId { get; set; }
        public Campus? TargetCampus { get; set; }

        public int? TargetScholarshipTypeId { get; set; }
        public ScholarshipType? TargetScholarshipType { get; set; }

        public int? TargetProgramId { get; set; }
        public AcademicProgram? TargetProgram { get; set; }

        public DateTime? ExpiresAt { get; set; }

        // Optional attached image (stored file name) (add-on).
        [MaxLength(260)]
        public string? ImagePath { get; set; }

        // Optional intended action key (e.g. SubmitDocuments) — scholars get a click-through
        // button that navigates to the relevant page (add-on).
        [MaxLength(40)]
        public string? IntentAction { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public string CreatedById { get; set; } = string.Empty;
        public ApplicationUser CreatedBy { get; set; } = null!;
    }
}
