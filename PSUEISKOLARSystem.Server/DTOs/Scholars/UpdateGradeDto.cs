using System.ComponentModel.DataAnnotations;

namespace PSUEISKOLARSystem.Server.DTOs.Scholars
{
    /// <summary>
    /// Correcting an already-recorded grade. The period is not editable — a grade filed against
    /// the wrong semester is a different record, so it is deleted and re-added rather than
    /// moved, which keeps the audit trail readable.
    /// </summary>
    public class UpdateGradeDto
    {
        [Range(1.0, 5.0, ErrorMessage = "GWA must be between 1.00 and 5.00.")]
        public decimal Gwa { get; set; }

        [MaxLength(500)]
        public string? Remarks { get; set; }
    }
}
