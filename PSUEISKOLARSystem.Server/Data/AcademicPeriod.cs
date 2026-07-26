using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;

namespace PSUEISKOLARSystem.Server.Data
{
    /// <summary>
    /// One academic period — an academic year in <c>YYYY-YYYY</c> form plus a semester (1 or 2).
    /// <para>
    /// Periods were previously validated ad hoc (grades checked them, uploads and deadlines did
    /// not, and the active-semester setter accepted any string at all). Everything that accepts a
    /// period from a caller now goes through <see cref="TryParse"/> so the rules are stated once.
    /// </para>
    /// </summary>
    public readonly record struct AcademicPeriod(int StartYear, int Semester) : IComparable<AcademicPeriod>
    {
        private static readonly Regex YearPattern = new(@"^\d{4}-\d{4}$", RegexOptions.Compiled);

        // Guards against typos like "20255-2026" and nonsense far outside a plausible range.
        private const int MinYear = 2000;
        private const int MaxYear = 2100;

        public string AcademicYear => $"{StartYear}-{StartYear + 1}";
        public string Label => $"{AcademicYear} Sem {Semester}";

        /// <summary>
        /// Parses an academic year + semester. <paramref name="error"/> carries a user-facing
        /// reason when parsing fails.
        /// </summary>
        public static bool TryParse(string? academicYear, int semester, out AcademicPeriod period, [NotNullWhen(false)] out string? error)
        {
            period = default;

            if (string.IsNullOrWhiteSpace(academicYear))
            {
                error = "Academic year is required.";
                return false;
            }

            var trimmed = academicYear.Trim();
            if (!YearPattern.IsMatch(trimmed))
            {
                error = $"Academic year must be in the format YYYY-YYYY (e.g. 2025-2026) — got '{trimmed}'.";
                return false;
            }

            var parts = trimmed.Split('-');
            var start = int.Parse(parts[0]);
            var end = int.Parse(parts[1]);

            if (end != start + 1)
            {
                error = $"Academic year must span two consecutive years (e.g. {start}-{start + 1}).";
                return false;
            }

            if (start is < MinYear or > MaxYear)
            {
                error = $"Academic year must start between {MinYear} and {MaxYear}.";
                return false;
            }

            if (semester is not (1 or 2))
            {
                error = "Semester must be 1 or 2.";
                return false;
            }

            period = new AcademicPeriod(start, semester);
            error = null;
            return true;
        }

        /// <summary>The period immediately before this one.</summary>
        public AcademicPeriod Previous() =>
            Semester == 2 ? new AcademicPeriod(StartYear, 1) : new AcademicPeriod(StartYear - 1, 2);

        public int CompareTo(AcademicPeriod other) =>
            StartYear != other.StartYear ? StartYear.CompareTo(other.StartYear) : Semester.CompareTo(other.Semester);

        public static bool operator <(AcademicPeriod a, AcademicPeriod b) => a.CompareTo(b) < 0;
        public static bool operator >(AcademicPeriod a, AcademicPeriod b) => a.CompareTo(b) > 0;
        public static bool operator <=(AcademicPeriod a, AcademicPeriod b) => a.CompareTo(b) <= 0;
        public static bool operator >=(AcademicPeriod a, AcademicPeriod b) => a.CompareTo(b) >= 0;

        /// <summary>
        /// Sort key for a stored period string that may predate validation. Unparseable values
        /// sort first so they surface rather than hide at the end of a chart.
        /// </summary>
        public static (int, int) SortKey(string? academicYear, int semester)
        {
            if (string.IsNullOrWhiteSpace(academicYear)) return (int.MinValue, semester);
            var head = academicYear.Split('-')[0];
            return int.TryParse(head, out var y) ? (y, semester) : (int.MinValue, semester);
        }
    }
}
