using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    public class AcademicProgram
    {
        public int Id { get; set; }

        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required, MaxLength(20)]
        public string Code { get; set; } = string.Empty;

        /// <summary>
        /// Optional field of specialisation, for programs offered in several majors — e.g.
        /// "Operations Management" for BS Business Administration. Each major is its own
        /// program row (with its own code) so scholars can be placed in the right one.
        /// </summary>
        [MaxLength(150)]
        public string? Major { get; set; }

        /// <summary>"BS Business Administration (Major in Operations Management)".</summary>
        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public string DisplayName => Display(Name, Major);

        public static string Display(string name, string? major) =>
            string.IsNullOrWhiteSpace(major) ? name : $"{name} (Major in {major})";

        public ICollection<ScholarProfile> Scholars { get; set; } = [];
        public ICollection<CampusProgram> Campuses { get; set; } = [];
    }
}
