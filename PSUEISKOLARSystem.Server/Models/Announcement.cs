using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

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

        public int? TargetScholarshipTypeId { get; set; }
        public ScholarshipType? TargetScholarshipType { get; set; }

        public int? TargetProgramId { get; set; }
        public AcademicProgram? TargetProgram { get; set; }

        // Named scholars. When any are present they are the whole audience and the
        // role/type/program filters above are ignored (see AnnouncementRecipient).
        public ICollection<AnnouncementRecipient> Recipients { get; set; } = [];

        // Scheduling (add-on). PublishAt in the future hides the announcement from its
        // audience until the publisher service releases it; PublishedAt is stamped once
        // the notifications/emails have gone out so they can never be sent twice.
        public DateTime? PublishAt { get; set; }
        public DateTime? PublishedAt { get; set; }

        [NotMapped]
        public bool IsScheduled => PublishedAt is null && PublishAt is not null && PublishAt > DateTime.UtcNow;

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
