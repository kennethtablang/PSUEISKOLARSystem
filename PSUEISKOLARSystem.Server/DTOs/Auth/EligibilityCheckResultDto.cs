namespace PSUEISKOLARSystem.Server.DTOs.Auth
{
    public class EligibilityCheckResultDto
    {
        public bool Matched { get; set; }

        /// <summary>Scholar or Grantee — the kind of account the details would open.</summary>
        public string? Kind { get; set; }

        public string? ScholarshipTypeName { get; set; }
        public List<string> GrantTypeNames { get; set; } = [];

        /// <summary>Why there was no match, when there was none.</summary>
        public string? Message { get; set; }
    }
}
