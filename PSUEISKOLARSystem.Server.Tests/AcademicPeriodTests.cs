using PSUEISKOLARSystem.Server.Data;
using Xunit;

namespace PSUEISKOLARSystem.Server.Tests;

// The period rules that uploads, deadlines and the active-semester setter all now share.
public class AcademicPeriodTests
{
    [Theory]
    [InlineData("2025-2026", 1)]
    [InlineData("2025-2026", 2)]
    [InlineData(" 2025-2026 ", 1)]   // trimmed
    public void Valid_periods_parse(string year, int semester)
    {
        Assert.True(AcademicPeriod.TryParse(year, semester, out var p, out var error));
        Assert.Null(error);
        Assert.Equal("2025-2026", p.AcademicYear);
        Assert.Equal(semester, p.Semester);
    }

    [Theory]
    [InlineData(null,          1, "required")]
    [InlineData("",            1, "required")]
    [InlineData("2025",        1, "YYYY-YYYY")]
    [InlineData("2025/2026",   1, "YYYY-YYYY")]
    [InlineData("abcd-efgh",   1, "YYYY-YYYY")]
    [InlineData("20255-2026",  1, "YYYY-YYYY")]
    [InlineData("2025-2027",   1, "consecutive")]   // not consecutive
    [InlineData("2025-2025",   1, "consecutive")]
    [InlineData("1899-1900",   1, "between")]       // out of range
    [InlineData("2025-2026",   0, "Semester")]
    [InlineData("2025-2026",   3, "Semester")]
    public void Invalid_periods_are_rejected_with_a_reason(string? year, int semester, string expectedFragment)
    {
        Assert.False(AcademicPeriod.TryParse(year, semester, out _, out var error));
        Assert.NotNull(error);
        Assert.Contains(expectedFragment, error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Periods_order_by_year_then_semester()
    {
        AcademicPeriod P(string y, int s)
        {
            Assert.True(AcademicPeriod.TryParse(y, s, out var p, out _));
            return p;
        }

        var y25s1 = P("2025-2026", 1);
        var y25s2 = P("2025-2026", 2);
        var y26s1 = P("2026-2027", 1);

        Assert.True(y25s1 < y25s2);
        Assert.True(y25s2 < y26s1);
        Assert.True(y26s1 > y25s1);
        Assert.Equal(y25s1, P("2025-2026", 1));
    }

    [Fact]
    public void Previous_steps_back_across_the_year_boundary()
    {
        Assert.True(AcademicPeriod.TryParse("2025-2026", 2, out var sem2, out _));
        var prev = sem2.Previous();
        Assert.Equal("2025-2026", prev.AcademicYear);
        Assert.Equal(1, prev.Semester);

        var beforeThat = prev.Previous();
        Assert.Equal("2024-2025", beforeThat.AcademicYear);
        Assert.Equal(2, beforeThat.Semester);
    }

    [Fact]
    public void Label_reads_as_the_ui_shows_it()
    {
        Assert.True(AcademicPeriod.TryParse("2025-2026", 2, out var p, out _));
        Assert.Equal("2025-2026 Sem 2", p.Label);
    }

    [Fact]
    public void SortKey_orders_stored_strings_and_puts_unparseable_ones_first()
    {
        var rows = new[] { ("2026-2027", 1), ("bogus", 2), ("2025-2026", 2), ("2025-2026", 1) };

        var ordered = rows
            .OrderBy(r => AcademicPeriod.SortKey(r.Item1, r.Item2))
            .Select(r => r.Item1 + " S" + r.Item2)
            .ToArray();

        Assert.Equal(
            ["bogus S2", "2025-2026 S1", "2025-2026 S2", "2026-2027 S1"],
            ordered);
    }
}
