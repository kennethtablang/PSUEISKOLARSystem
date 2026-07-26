using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.Models
{
    /// <summary>
    /// Single-row configuration for the scholar↔coordinator inbox, mirroring how
    /// <see cref="ActiveSemester"/> is stored.
    /// </summary>
    public class MessagingSettings
    {
        public int Id { get; set; }

        /// <summary>
        /// When on, the first scholar message in a thread gets an immediate acknowledgement so
        /// the scholar knows it landed. Sent once per thread, never in reply to staff.
        /// </summary>
        public bool AutoReplyEnabled { get; set; } = true;

        [MaxLength(1000)]
        public string AutoReplyMessage { get; set; } =
            "Thanks for your message — the Scholarship Office has received it. " +
            "A coordinator will reply within 2 working days. " +
            "Office hours: Monday to Friday, 8:00 AM – 5:00 PM.";

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public string? UpdatedById { get; set; }
        public ApplicationUser? UpdatedBy { get; set; }
    }
}
