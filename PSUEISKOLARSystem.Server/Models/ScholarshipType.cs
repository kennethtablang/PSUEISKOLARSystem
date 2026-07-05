using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    public class ScholarshipType
    {
        public int Id { get; set; }

        [Required, MaxLength(150)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        // High-level categorization, e.g. Government, Private, Institutional, Local (FR add-on).
        [MaxLength(50)]
        public string? Category { get; set; }

        public decimal MinimumGwa { get; set; } = 2.50m;

        public bool IsActive { get; set; } = true;

        public ICollection<ScholarProfile> Scholars { get; set; } = [];
        public ICollection<ScholarshipTypeRequirement> Requirements { get; set; } = [];
    }
}
