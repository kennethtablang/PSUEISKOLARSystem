using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using Xunit;

namespace PSUEISKOLARSystem.Server.Tests;

// Covers the "strictly one scholarship per student" rule owned by ScholarshipRegistry.
public class ScholarshipRegistryTests
{
    private const string Scholar = "s1";
    private const string Staff = "admin";

    private static ApplicationDbContext Seeded()
    {
        var db = TestDb.New();
        db.AddScholar(Scholar);
        db.AddType(1, "CHED Scholarship");
        db.AddType(2, "DOST-SEI Scholarship");
        db.SaveChanges();
        return db;
    }

    [Fact]
    public async Task First_pick_by_the_scholar_opens_one_assignment()
    {
        using var db = Seeded();

        var rejection = await ScholarshipRegistry.SetAsync(db, Scholar, 1, Scholar, actorIsStaff: false);
        await db.SaveChangesAsync();

        Assert.Null(rejection);
        var rows = await db.ScholarshipAssignments.Where(a => a.ScholarId == Scholar).ToListAsync();
        Assert.Single(rows);
        Assert.Equal(1, rows[0].ScholarshipTypeId);
        Assert.Null(rows[0].EndedAt);
    }

    [Fact]
    public async Task Scholar_cannot_switch_to_a_second_scholarship()
    {
        using var db = Seeded();
        await ScholarshipRegistry.SetAsync(db, Scholar, 1, Scholar, actorIsStaff: false);
        await db.SaveChangesAsync();

        var rejection = await ScholarshipRegistry.SetAsync(db, Scholar, 2, Scholar, actorIsStaff: false);

        Assert.NotNull(rejection);
        Assert.Contains("only one scholarship", rejection);
        // The original assignment is untouched.
        var active = await ScholarshipRegistry.GetActiveAsync(db, Scholar);
        Assert.Equal(1, active!.ScholarshipTypeId);
    }

    [Fact]
    public async Task Scholar_cannot_clear_their_own_scholarship()
    {
        using var db = Seeded();
        await ScholarshipRegistry.SetAsync(db, Scholar, 1, Scholar, actorIsStaff: false);
        await db.SaveChangesAsync();

        var rejection = await ScholarshipRegistry.SetAsync(db, Scholar, null, Scholar, actorIsStaff: false);

        Assert.NotNull(rejection);
        Assert.Contains("coordinator", rejection);
        Assert.NotNull(await ScholarshipRegistry.GetActiveAsync(db, Scholar));
    }

    [Fact]
    public async Task Staff_transfer_closes_the_old_assignment_and_opens_the_new_one()
    {
        using var db = Seeded();
        await ScholarshipRegistry.SetAsync(db, Scholar, 1, Staff, actorIsStaff: true);
        await db.SaveChangesAsync();

        var rejection = await ScholarshipRegistry.SetAsync(
            db, Scholar, 2, Staff, actorIsStaff: true, reason: "Awarded a DOST slot.");
        await db.SaveChangesAsync();

        Assert.Null(rejection);

        var rows = await db.ScholarshipAssignments
            .Where(a => a.ScholarId == Scholar)
            .OrderBy(a => a.Id)
            .ToListAsync();

        Assert.Equal(2, rows.Count);
        Assert.Equal(1, rows[0].ScholarshipTypeId);
        Assert.NotNull(rows[0].EndedAt);
        Assert.Equal("Awarded a DOST slot.", rows[0].EndReason);
        Assert.Equal(2, rows[1].ScholarshipTypeId);
        Assert.Null(rows[1].EndedAt);

        // Still exactly one active scholarship after the transfer.
        Assert.Single(rows, a => a.EndedAt is null);
    }

    [Fact]
    public async Task Re_saving_the_same_scholarship_is_a_no_op()
    {
        using var db = Seeded();
        await ScholarshipRegistry.SetAsync(db, Scholar, 1, Scholar, actorIsStaff: false);
        await db.SaveChangesAsync();

        var rejection = await ScholarshipRegistry.SetAsync(db, Scholar, 1, Scholar, actorIsStaff: false);
        await db.SaveChangesAsync();

        Assert.Null(rejection);
        Assert.Equal(1, await db.ScholarshipAssignments.CountAsync(a => a.ScholarId == Scholar));
    }

    [Fact]
    public async Task An_inactive_scholarship_type_is_refused()
    {
        using var db = Seeded();
        var type = await db.ScholarshipTypes.FindAsync(2);
        type!.IsActive = false;
        await db.SaveChangesAsync();

        var rejection = await ScholarshipRegistry.SetAsync(db, Scholar, 2, Staff, actorIsStaff: true);

        Assert.NotNull(rejection);
        Assert.Contains("not accepting scholars", rejection);
    }

    [Fact]
    public async Task Staff_can_clear_a_scholarship_and_the_ledger_keeps_the_history()
    {
        using var db = Seeded();
        await ScholarshipRegistry.SetAsync(db, Scholar, 1, Staff, actorIsStaff: true);
        await db.SaveChangesAsync();

        var rejection = await ScholarshipRegistry.SetAsync(
            db, Scholar, null, Staff, actorIsStaff: true, reason: "Graduated.");
        await db.SaveChangesAsync();

        Assert.Null(rejection);
        Assert.Null(await ScholarshipRegistry.GetActiveAsync(db, Scholar));

        var history = await ScholarshipRegistry.GetHistoryAsync(db, Scholar);
        Assert.Single(history);
        Assert.Equal("Graduated.", history[0].EndReason);
    }

    [Fact]
    public async Task Backfill_opens_a_ledger_row_for_a_profile_that_predates_the_ledger()
    {
        using var db = Seeded();
        var profile = db.AddProfile(Scholar, typeId: 1);
        await db.SaveChangesAsync();

        await ScholarshipRegistry.BackfillAsync(db, profile, Staff);

        var active = await ScholarshipRegistry.GetActiveAsync(db, Scholar);
        Assert.NotNull(active);
        Assert.Equal(1, active.ScholarshipTypeId);

        // Running it again must not create a duplicate.
        await ScholarshipRegistry.BackfillAsync(db, profile, Staff);
        Assert.Equal(1, await db.ScholarshipAssignments.CountAsync(a => a.ScholarId == Scholar));
    }
}
