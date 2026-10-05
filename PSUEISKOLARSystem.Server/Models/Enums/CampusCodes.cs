namespace PSUEISKOLARSystem.Server.Models.Enums
{
    /// <summary>
    /// The campus codes the scholarship office uses — on cross-matching lists, in student
    /// numbers (23-LN-0001) and on the import template.
    /// </summary>
    public static class CampusCodes
    {
        public const string Lingayen = "LN";
        public const string Binmaley = "BIN";
        public const string SanCarlos = "SC";
        public const string Alaminos = "ALA";
        public const string SantaMaria = "SM";
        public const string Urdaneta = "URD";
        public const string Asingan = "ASIN";
        public const string Infanta = "INF";
        public const string Bayambang = "BY";

        /// <summary>
        /// Codes the system used before the office's own were adopted. Existing databases are
        /// renamed at startup, and lists still written with an old code import without error.
        /// </summary>
        public static readonly IReadOnlyDictionary<string, string> Legacy = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["LIN"] = Lingayen,
            ["SCC"] = SanCarlos,
            ["STM"] = SantaMaria,
            ["ASI"] = Asingan,
            ["BAY"] = Bayambang,
        };

        /// <summary>The current code for <paramref name="code"/>, translating a legacy one.</summary>
        public static string Normalize(string code)
        {
            var c = code.Trim().ToUpperInvariant();
            return Legacy.TryGetValue(c, out var current) ? current : c;
        }
    }
}
