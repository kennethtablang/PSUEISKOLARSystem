namespace PSUEISKOLARSystem.Server.DTOs.Auth
{
    public class EligibilityCheckResultDto
    {
        public bool Matched { get; set; }

        /// <summary>Scholar or Grantee — the kind of account the details would open.</summary>
        public string? Kind { get; set; }

        public string? ScholarshipTypeName { get; set; }
        public List<string> GrantTypeNames { get; set; } = [];

        /// <summary>
        /// True when the details match a scholar line but the student already has a grantee
        /// account. Instead of opening a second account, sign-up asks them to sign in with it
        /// and turns that account into their scholar account (keeping its grant history).
        /// </summary>
        public bool ExistingGranteeAccount { get; set; }

        /// <summary>The existing account's email, partly masked, so the student knows which one.</summary>
        public string? ExistingAccountEmail { get; set; }

        /// <summary>Why there was no match, when there was none.</summary>
        public string? Message { get; set; }
    }
}
