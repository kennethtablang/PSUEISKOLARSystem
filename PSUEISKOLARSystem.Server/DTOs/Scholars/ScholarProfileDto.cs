namespace PSUEISKOLARSystem.Server.DTOs.Scholars
{
    public class ScholarProfileDto
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? CampusName { get; set; }
        public int? CampusId { get; set; }

        public string StudentId { get; set; } = string.Empty;
        public int? ProgramId { get; set; }
        public string? ProgramName { get; set; }
        public string? ProgramCode { get; set; }
        public int? ScholarshipTypeId { get; set; }
        public string? ScholarshipTypeName { get; set; }
        public decimal? MinimumGwa { get; set; }

        public int YearLevel { get; set; }
        public string? ContactNumber { get; set; }
        public DateTime? BirthDate { get; set; }
        public string? Address { get; set; }
        public DateTime EnrolledAt { get; set; }

        public decimal? LatestGwa { get; set; }
        public bool? MeetsRequirement { get; set; }
    }
}
