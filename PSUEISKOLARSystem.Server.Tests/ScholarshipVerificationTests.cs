using Microsoft.AspNetCore.Mvc;
using PSUEISKOLARSystem.Server.Controllers;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// The report behind "strictly one scholarship per student". It is the system's own audit of
/// its money records, so it is worth pinning that each kind of inconsistency is still detected
/// — the report was rewritten to read flat projections instead of whole entity graphs, and a
/// silent regression here would mean the checks stop finding things rather than failing loudly.
/// </summary>
public class ScholarshipVerificationTests
{
    /// <summary>Findings, keyed by scholar id, as the endpoint would return them.</summary>
    private static async Task<Dictionary<string, (string Severity, List<string> Issues)>> RunAsync(
        ApplicationDbContext db)
    {
        var controller = new ScholarProfilesController(db, new NoOpNotifications());
        var result = await controller.GetScholarshipVerification();
        var payload = Assert.IsType<OkObjectResult>(result).Value!;

        var findings = (System.Collections.IEnumerable)payload.GetType()
            .GetProperty("findings")!.GetValue(payload)!;

        var map = new Dictionary<string, (string, List<string>)>();
        foreach (var f in findings)
        {
            var t = f.GetType();
            map[(string)t.GetProperty("UserId")!.GetValue(f)!] = (
                (string)t.GetProperty("Severity")!.GetValue(f)!,
                (List<string>)t.GetProperty("Issues")!.GetValue(f)!);
        }
        return map;
    }

    private static void Assign(ApplicationDbContext db, string scholarId, int typeId, DateTime? endedAt = null)
        => db.ScholarshipAssignments.Add(new ScholarshipAssignment
        {
            ScholarId = scholarId,
            ScholarshipTypeId = typeId,
            AssignedAt = DateTime.UtcNow.AddYears(-1),
            EndedAt = endedAt,
        });

    [Fact]
    public async Task A_clean_scholar_produces_no_finding()
    {
        using var db = TestDb.New();
        db.AddType(1, "CHED");
        db.AddScholar("clean");
        db.AddProfile("clean", 1);
        db.SaveChanges();
        Assign(db, "clean", 1);
        db.SaveChanges();

        Assert.Empty(await RunAsync(db));
    }

    [Fact]
    public async Task Two_open_assignments_are_an_error()
    {
        using var db = TestDb.New();
        db.AddType(1, "CHED");
        db.AddType(2, "DOST");
        db.AddScholar("double");
        db.AddProfile("double", 1);
        db.SaveChanges();
        Assign(db, "double", 1);
        Assign(db, "double", 2);
        db.SaveChanges();

        var findings = await RunAsync(db);

        Assert.Equal("error", findings["double"].Severity);
        Assert.Contains(findings["double"].Issues, i => i.Contains("open at the same time"));
    }

    [Fact]
    public async Task A_scholarship_on_the_profile_with_no_ledger_row_is_a_warning()
    {
        using var db = TestDb.New();
        db.AddType(1, "CHED");
        db.AddScholar("unrecorded");
        db.AddProfile("unrecorded", 1);
        db.SaveChanges();

        var findings = await RunAsync(db);

        Assert.Equal("warning", findings["unrecorded"].Severity);
        Assert.Contains(findings["unrecorded"].Issues, i => i.Contains("no assignment record"));
    }

    [Fact]
    public async Task A_profile_disagreeing_with_its_open_assignment_is_an_error()
    {
        using var db = TestDb.New();
        db.AddType(1, "CHED");
        db.AddType(2, "DOST");
        db.AddScholar("mismatch");
        db.AddProfile("mismatch", 1);
        db.SaveChanges();
        Assign(db, "mismatch", 2);
        db.SaveChanges();

        var findings = await RunAsync(db);

        Assert.Equal("error", findings["mismatch"].Severity);
        Assert.Contains(findings["mismatch"].Issues, i => i.Contains("CHED") && i.Contains("DOST"));
    }

    [Fact]
    public async Task A_duplicated_student_id_flags_both_scholars()
    {
        using var db = TestDb.New();
        db.AddType(1, "CHED");
        db.AddScholar("a");
        db.AddScholar("b");
        var pa = db.AddProfile("a", null);
        var pb = db.AddProfile("b", null);
        pa.StudentId = "21-0001";
        pb.StudentId = "21-0001";
        db.SaveChanges();

        var findings = await RunAsync(db);

        Assert.Equal(2, findings.Count);
        Assert.All(findings.Values, f => Assert.Equal("error", f.Severity));
        Assert.All(findings.Values, f => Assert.Contains(f.Issues, i => i.Contains("more than one profile")));
    }

    [Fact]
    public async Task A_closed_assignment_reads_as_a_transfer_not_a_fault()
    {
        using var db = TestDb.New();
        db.AddType(1, "CHED");
        db.AddType(2, "DOST");
        db.AddScholar("moved");
        db.AddProfile("moved", 2);
        db.SaveChanges();
        Assign(db, "moved", 1, endedAt: DateTime.UtcNow.AddMonths(-6));
        Assign(db, "moved", 2);
        db.SaveChanges();

        var findings = await RunAsync(db);

        Assert.Equal("info", findings["moved"].Severity);
        Assert.Contains(findings["moved"].Issues, i => i.Contains("Transferred"));
    }

    private sealed class NoOpNotifications : INotificationService
    {
        public Task CreateAsync(string recipientId, string title, string message, string category, string? linkUrl = null)
            => Task.CompletedTask;

        public Task CreateForManyAsync(IEnumerable<string> recipientIds, string title, string message, string category, string? linkUrl = null)
            => Task.CompletedTask;

        public Task BroadcastAsync(string eventName) => Task.CompletedTask;
    }
}
