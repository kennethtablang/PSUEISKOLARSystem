using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;

namespace PSUEISKOLARSystem.Server.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string FirstName { get; set; } = string.Empty;
        public string? MiddleName { get; set; }
        public string LastName { get; set; } = string.Empty;

        [NotMapped]
        public string FullName => string.IsNullOrWhiteSpace(MiddleName)
            ? $"{FirstName} {LastName}".Trim()
            : $"{FirstName} {MiddleName} {LastName}".Trim();

        public int? CampusId { get; set; }
        public Campus? Campus { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastLoginAt { get; set; }

        // Data Privacy Act (RA 10173) consent capture (FR-19).
        public DateTime? ConsentAcceptedAt { get; set; }
        [System.ComponentModel.DataAnnotations.MaxLength(20)]
        public string? ConsentVersion { get; set; }

        // Per-category email notification preferences (FR-20). Critical account/security
        // emails are always sent regardless of these flags.
        public bool EmailAnnouncements { get; set; } = true;
        public bool EmailDocumentStatus { get; set; } = true;
        public bool EmailDeadlines { get; set; } = true;
    }
}
