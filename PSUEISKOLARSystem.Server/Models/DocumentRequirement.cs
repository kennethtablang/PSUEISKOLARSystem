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
