using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    public class DocumentRequirement
    {
        public int Id { get; set; }

        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public bool IsRequired { get; set; } = true;

        // Checklist presentation (add-on). Requirements are ordered by DisplayOrder first
        // so an admin can put "Certificate of Registration" ahead of "2x2 Photo"; ties fall
        // back to name. GroupName buckets related documents under a heading in the UI.
        public int DisplayOrder { get; set; }

        [MaxLength(60)]
        public string? GroupName { get; set; }

        // Stored file name of an example/sample image shown to scholars (add-on).
        [MaxLength(260)]
        public string? SampleImagePath { get; set; }

        public int? ScholarshipTypeId { get; set; }
        public ScholarshipType? ScholarshipType { get; set; }

        public bool IsActive { get; set; } = true;

        public ICollection<DocumentSubmission> Submissions { get; set; } = [];
        public ICollection<ScholarshipTypeRequirement> ScholarshipTypes { get; set; } = [];
    }
}
