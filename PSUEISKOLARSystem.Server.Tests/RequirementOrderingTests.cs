using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using Xunit;

namespace PSUEISKOLARSystem.Server.Tests;

// Covers the shared checklist ordering: group → display order → required → name.
public class RequirementOrderingTests
{
    private static DocumentRequirement Req(string name, string? group = null, int order = 0, bool required = true)
        => new() { Name = name, GroupName = group, DisplayOrder = order, IsRequired = required };

    [Fact]
    public void Grouped_requirements_come_before_ungrouped_ones()
    {
        var sorted = new[]
        {
            Req("Loose paper"),
            Req("Certificate of Registration", "Enrolment"),
        }.InDisplayOrder().ToList();

        Assert.Equal("Certificate of Registration", sorted[0].Name);
        Assert.Equal("Loose paper", sorted[1].Name);
    }

    [Fact]
    public void Display_order_beats_alphabetical_within_a_group()
    {
        var sorted = new[]
        {
            Req("Alpha", "Enrolment", order: 2),
            Req("Zulu",  "Enrolment", order: 1),
        }.InDisplayOrder().ToList();

        Assert.Equal("Zulu", sorted[0].Name);
        Assert.Equal("Alpha", sorted[1].Name);
    }

    [Fact]
    public void Required_documents_break_a_display_order_tie()
    {
        var sorted = new[]
        {
            Req("Optional doc", "Enrolment", order: 0, required: false),
            Req("Required doc", "Enrolment", order: 0, required: true),
        }.InDisplayOrder().ToList();

        Assert.Equal("Required doc", sorted[0].Name);
    }

    [Fact]
    public void Name_is_the_final_tiebreak_so_order_is_never_arbitrary()
    {
        var sorted = new[]
        {
            Req("Birth certificate", "Personal"),
            Req("Affidavit",         "Personal"),
        }.InDisplayOrder().ToList();

        Assert.Equal("Affidavit", sorted[0].Name);
        Assert.Equal("Birth certificate", sorted[1].Name);
    }

    [Fact]
    public void Groups_stay_contiguous_so_the_client_can_split_on_runs()
    {
        // Both UIs build headings by walking the flat list and starting a new bucket
        // whenever the group name changes — which only works if groups never interleave.
        var sorted = new[]
        {
            Req("B doc", "Beta",  order: 0),
            Req("A doc", "Alpha", order: 1),
            Req("Loose"),
            Req("A doc 2", "Alpha", order: 0),
            Req("B doc 2", "Beta",  order: 1),
        }.InDisplayOrder().Select(r => r.GroupName).ToList();

        Assert.Equal(["Alpha", "Alpha", "Beta", "Beta", null], sorted);
    }
}
