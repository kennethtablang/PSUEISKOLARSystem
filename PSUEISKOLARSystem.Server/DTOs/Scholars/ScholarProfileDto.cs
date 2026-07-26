namespace PSUEISKOLARSystem.Server.DTOs.Scholars
{
    public class ScholarProfileDto
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;

        // True when a profile photo exists; fetch it from /api/avatars/{userId}.
        public bool HasAvatar { get; set; }

        public string StudentId { get; set; } = string.Empty;
        public int? ProgramId { get; set; }
        public string? ProgramName { get; set; }
        public string? ProgramCode { get; set; }
        public int? ScholarshipTypeId { get; set; }
        public string? ScholarshipTypeName { get; set; }
        public string? ScholarshipTypeCategory { get; set; }
        public decimal? MinimumGwa { get; set; }

        public int YearLevel { get; set; }
        public string LifecycleStatus { get; set; } = "Active";
        public string? ContactNumber { get; set; }
        public DateTime? BirthDate { get; set; }
        public string? Address { get; set; }
        public DateTime EnrolledAt { get; set; }

        public decimal? LatestGwa { get; set; }
        public bool? MeetsRequirement { get; set; }

        // Admin verification of the registration: Pending | Approved | Rejected.
        public string ApprovalStatus { get; set; } = string.Empty;
        public string? ApprovalNote { get; set; }
        public DateTime? ApprovalDecidedAt { get; set; }

        // Scholarship ledger: when the current scholarship was assigned, and how many
        // scholarships this scholar has ever been registered under (1 is the norm).
        public DateTime? ScholarshipAssignedAt { get; set; }
        public int ScholarshipRecordCount { get; set; }
    }
}
