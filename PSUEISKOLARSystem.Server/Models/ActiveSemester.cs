namespace PSUEISKOLARSystem.Server.Models
{
    public class ActiveSemester
    {
        public int Id { get; set; }
        public string AcademicYear { get; set; } = string.Empty; // e.g. "2025-2026"
        public int Semester { get; set; } = 1;                   // 1 or 2
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public string? UpdatedById { get; set; }
        public ApplicationUser? UpdatedBy { get; set; }
    }
}
