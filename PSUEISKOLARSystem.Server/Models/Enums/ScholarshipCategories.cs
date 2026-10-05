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
    }
}
