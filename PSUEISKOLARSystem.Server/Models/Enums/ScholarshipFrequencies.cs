namespace PSUEISKOLARSystem.Server.Models.Enums
{
    /// <summary>
    /// How often a scholarship pays out. This is what decides whether a scholarship is
    /// monitored through the release ledger (<see cref="Models.ScholarshipRelease"/>) and
    /// how many rows a scholar is expected to have per academic year.
    /// </summary>
    public static class ScholarshipFrequencies
    {
        /// <summary>Paid once for the whole scholarship — nothing recurring to monitor.</summary>
        public const string OneTime = "OneTime";

        /// <summary>Paid every semester: two expected releases per academic year.</summary>
        public const string PerSemester = "PerSemester";

        /// <summary>Paid once per academic year, recorded against semester 0.</summary>
        public const string PerYear = "PerYear";

        public static readonly string[] All = [OneTime, PerSemester, PerYear];

        /// <summary>Semester 0 is the marker for a whole-year release, which has no semester.</summary>
        public const int WholeYearSemester = 0;

        /// <summary>The semesters a scholarship on this frequency is expected to pay out in.</summary>
        public static int[] SemestersFor(string frequency) => frequency switch
        {
            PerSemester => [1, 2],
            PerYear => [WholeYearSemester],
            _ => [],
        };

        public static bool IsRecurring(string frequency) =>
            frequency is PerSemester or PerYear;
    }
}
