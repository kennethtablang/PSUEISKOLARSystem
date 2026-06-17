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

        public decimal MinimumGwa { get; set; } = 2.50m;

        public bool IsActive { get; set; } = true;

        public ICollection<ScholarProfile> Scholars { get; set; } = [];
    }
}
