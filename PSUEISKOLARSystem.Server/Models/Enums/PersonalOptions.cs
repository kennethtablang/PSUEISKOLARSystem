namespace PSUEISKOLARSystem.Server.Models.Enums
{
    /// <summary>
    /// The fixed answer sets on the Scholar's Data sheet. Keep in sync with the client
    /// (src/constants/personal.js).
    /// </summary>
    public static class PersonalOptions
    {
        public static readonly string[] Sex = ["Male", "Female"];

        public static readonly string[] CivilStatus = ["Single", "Married", "Separated", "Widowed"];

        public static readonly string[] Education =
        [
            "Elementary Level",
            "Elementary Graduate",
            "High School Level",
            "High School Graduate",
            "College Level",
            "College Graduate",
        ];

        public static readonly string[] SupportSource = ["Parents", "Sibling", "Relative", "Others", "Myself"];

        /// <summary>Institutional e-mail domain every self-registered account must use.</summary>
        public const string InstitutionalDomain = "psu.edu.ph";
    }
}
