using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using Xunit;

namespace PSUEISKOLARSystem.Server.Tests;

// Covers the per-scholarship slot quota enforced by ScholarshipRegistry.
public class SlotQuotaTests
{
    private const string Staff = "admin";

    private static ApplicationDbContext Seeded(int? slotLimit)
    {
        var db = TestDb.New();
        var type = db.AddType(1, "Capped Scholarship");
        type.SlotLimit = slotLimit;
        db.AddType(2, "Uncapped Scholarship");
        db.SaveChanges();
        return db;
    }

    // Puts `count` scholars on type 1 via their profile pointer, which is what occupancy counts.
    private static void FillSlots(ApplicationDbContext db, int count)
    {
        for (int i = 0; i < count; i++)
        {
            db.AddScholar($"holder{i}");
            db.AddProfile($"holder{i}", 1);
        }
        db.SaveChanges();
    }

    [Fact]
    public async Task Assignment_is_refused_once_every_slot_is_taken()
    {
        using var db = Seeded(slotLimit: 2);
        FillSlots(db, 2);
        db.AddScholar("newcomer");
        await db.SaveChangesAsync();

        var rejection = await ScholarshipRegistry.SetAsync(db, "newcomer", 1, Staff, actorIsStaff: true);

        Assert.NotNull(rejection);
        Assert.Contains("full", rejection);
        Assert.Empty(await db.ScholarshipAssignments.Where(a => a.ScholarId == "newcomer").ToListAsync());
    }

    [Fact]
    public async Task Assignment_succeeds_while_a_slot_remains()
    {
        using var db = Seeded(slotLimit: 3);
        FillSlots(db, 2);
        db.AddScholar("newcomer");
        await db.SaveChangesAsync();

        var rejection = await ScholarshipRegistry.SetAsync(db, "newcomer", 1, Staff, actorIsStaff: true);
        await db.SaveChangesAsync();

        Assert.Null(rejection);
        Assert.Single(await db.ScholarshipAssignments.Where(a => a.ScholarId == "newcomer").ToListAsync());
    }

    [Fact]
    public async Task A_null_limit_means_unlimited()
    {
        using var db = Seeded(slotLimit: null);
        FillSlots(db, 25);
        db.AddScholar("newcomer");
        await db.SaveChangesAsync();

        var rejection = await ScholarshipRegistry.SetAsync(db, "newcomer", 1, Staff, actorIsStaff: true);

        Assert.Null(rejection);
    }

    [Fact]
    public async Task A_scholar_already_on_the_scholarship_does_not_consume_a_second_slot()
    {
        // A full scholarship whose last holder is re-saved (e.g. an unrelated profile edit that
        // re-runs SetAsync) must not be blocked by their own occupancy.
        using var db = Seeded(slotLimit: 1);
        FillSlots(db, 1);
        await db.SaveChangesAsync();

        var rejection = await ScholarshipRegistry.SetAsync(db, "holder0", 1, Staff, actorIsStaff: true);

        Assert.Null(rejection);
    }

    [Fact]
    public async Task Filled_slots_are_counted_from_the_profile_pointer()
    {
        using var db = Seeded(slotLimit: 10);
        FillSlots(db, 4);

        Assert.Equal(4, await ScholarshipRegistry.CountFilledSlotsAsync(db, 1));
        Assert.Equal(3, await ScholarshipRegistry.CountFilledSlotsAsync(db, 1, excludingScholarId: "holder0"));
        Assert.Equal(0, await ScholarshipRegistry.CountFilledSlotsAsync(db, 2));
    }
}
