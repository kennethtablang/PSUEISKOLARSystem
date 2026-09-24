using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    /// <summary>
    /// A PSU campus. Scholars and grantees pick the campus they study at when they sign up,
    /// and the programme list they are offered is narrowed to what that campus runs
    /// (<see cref="CampusProgram"/>). Releases are also scheduled campus by campus, because the
    /// campuses do not all receive on the same day.
    /// </summary>
    public class Campus
    {
        public int Id { get; set; }

        [Required, MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required, MaxLength(20)]
        public string Code { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public ICollection<CampusProgram> Programs { get; set; } = [];
    }

    /// <summary>Which programmes a campus offers.</summary>
    public class CampusProgram
    {
        public int CampusId { get; set; }
        public Campus Campus { get; set; } = null!;

        public int ProgramId { get; set; }
        public AcademicProgram Program { get; set; } = null!;
    }
}
