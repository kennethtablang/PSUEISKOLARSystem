using System.ComponentModel.DataAnnotations;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Models
{
    // A due date for a document requirement within a specific academic period (FR-16.1).
    public class SubmissionDeadline
    {
        public int Id { get; set; }

        public int RequirementId { get; set; }
        public DocumentRequirement Requirement { get; set; } = null!;

        [Required, MaxLength(20)]
        public string AcademicYear { get; set; } = string.Empty; // e.g. "2025-2026"

        public int Semester { get; set; } // 1 or 2

        public DateTime DueDate { get; set; }

        // When the most recent notice for this deadline went out (FR-16.4).
        public DateTime? RemindersSentAt { get; set; }

        // Which notices have already been sent. See DeadlineReminderStage for why this is a
        // sequence rather than the single "reminders have been sent" flag it started as.
        public DeadlineReminderStage ReminderStage { get; set; } = DeadlineReminderStage.None;

        public string? CreatedById { get; set; }
        public ApplicationUser? CreatedBy { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
