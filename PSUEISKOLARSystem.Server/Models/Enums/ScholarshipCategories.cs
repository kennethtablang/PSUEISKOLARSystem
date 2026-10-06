namespace PSUEISKOLARSystem.Server.Models.Enums
{
    /// <summary>A scholarship type is funded either by government or privately — nothing finer.</summary>
    public static class ScholarshipCategories
    {
        public const string Government = "Government";
        public const string Private = "Private";

        public static readonly string[] All = [Government, Private];

        /// <summary>
        /// Where a category from before the two-way split lands: institutional (PSU, a state
        /// university) and local-government scholarships are public money; the rest private.
        /// </summary>
        public static string FromLegacy(string? category) => category?.Trim().ToLowerInvariant() switch
        {
            "government" or "institutional" or "local (lgu)" or "local" or "lgu" => Government,
            _ => Private,
        };

        // Funders whose name marks a scholarship as public money.
        private static readonly string[] GovernmentMarkers =
        [
            "ched", "dost", "psu", "lgu", "local government", "government", "institutional",
            "tes", "tdp", "unifast", "dswd", "owwa", "provincial", "municipal", "city",
        ];

        /// <summary>
        /// Where a type saved without a category lands: government when its name names a
        /// public funder (CHED, DOST, PSU, an LGU…), otherwise private.
        /// </summary>
        public static string FromName(string? name)
        {
            var words = (name ?? "").ToLowerInvariant();
            return GovernmentMarkers.Any(m => System.Text.RegularExpressions.Regex.IsMatch(
                words, $@"(^|[^a-z]){System.Text.RegularExpressions.Regex.Escape(m)}([^a-z]|$)"))
                ? Government
                : Private;
        }
    }
}
