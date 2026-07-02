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

        public int? ScholarshipTypeId { get; set; }
        public ScholarshipType? ScholarshipType { get; set; }

        public bool IsActive { get; set; } = true;

        public ICollection<DocumentSubmission> Submissions { get; set; } = [];
        public ICollection<ScholarshipTypeRequirement> ScholarshipTypes { get; set; } = [];
    }
}
