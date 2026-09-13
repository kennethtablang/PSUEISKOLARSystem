using System.ComponentModel.DataAnnotations;
using PSUEISKOLARSystem.Server.Models.Enums;

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

        // Maximum number of scholars that may hold this scholarship at once.
        // Null means unlimited — the slot tracker then reports "No cap".
        public int? SlotLimit { get; set; }

        public bool IsActive { get; set; } = true;

        /// <summary>
        /// How often the scholarship pays out — see <see cref="ScholarshipFrequencies"/>.
        /// A recurring type (per semester / per year) is monitored release-by-release in
        /// <see cref="ScholarshipRelease"/>; a one-time type is not.
        /// </summary>
        [MaxLength(20)]
        public string Frequency { get; set; } = ScholarshipFrequencies.PerSemester;

        /// <summary>
        /// The standard amount for one release, pre-filled when recording a release or a
        /// grant. Null when the amount varies per scholar and is always keyed in by hand.
        /// </summary>
        public decimal? Amount { get; set; }

        public ICollection<ScholarProfile> Scholars { get; set; } = [];
        public ICollection<ScholarshipTypeRequirement> Requirements { get; set; } = [];
    }
}
