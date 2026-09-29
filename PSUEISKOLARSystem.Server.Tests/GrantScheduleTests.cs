using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Scholars;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// Revision 3: grants released automatically on the grant type's release date, grants the
/// office listed before a scholar's profile existed, and the split parent names.
/// </summary>
public class GrantScheduleTests
{
    private static OneTimeGrant Pending(string scholarId, GrantType type, decimal amount = 7500m) => new()
    {
        ScholarId = scholarId,
        GrantTypeId = type.Id,
        Title = type.Name,
        Amount = amount,
        ReleaseStatus = GrantReleaseStatuses.Pending,
    };

    [Fact]
    public async Task Pending_grants_are_released_once_their_release_day_arrives()
    {
        using var db = TestDb.New();
        db.AddScholar("s1");
        var due = new GrantType { Id = 1, Name = "TDP", ScheduledDate = GrantReleaseService.PhilippineToday() };
        var later = new GrantType { Id = 2, Name = "Tulong Dunong", ScheduledDate = GrantReleaseService.PhilippineToday().AddDays(3) };
        var unscheduled = new GrantType { Id = 3, Name = "Calamity Aid" };
        db.GrantTypes.AddRange(due, later, unscheduled);
        db.OneTimeGrants.AddRange(Pending("s1", due), Pending("s1", later), Pending("s1", unscheduled));
        await db.SaveChangesAsync();
        var notifications = new FakeNotifications();

        var released = await GrantReleaseService.ReleaseDueAsync(db, notifications);

        Assert.Equal(1, released);
        var grants = await db.OneTimeGrants.ToDictionaryAsync(g => g.GrantTypeId!.Value);
        Assert.Equal(GrantReleaseStatuses.Released, grants[1].ReleaseStatus);
        Assert.NotNull(grants[1].ReleasedAt);
        Assert.Equal(GrantReleaseStatuses.Pending, grants[2].ReleaseStatus);
        Assert.Equal(GrantReleaseStatuses.Pending, grants[3].ReleaseStatus);
        Assert.Single(notifications.Sent, n => n.RecipientId == "s1");
    }

    [Fact]
    public async Task A_second_pass_releases_nothing_twice()
    {
        using var db = TestDb.New();
        db.AddScholar("s1");
        var type = new GrantType { Id = 1, Name = "TDP", ScheduledDate = GrantReleaseService.PhilippineToday().AddDays(-2) };
        db.GrantTypes.Add(type);
        db.OneTimeGrants.Add(Pending("s1", type));
        db.OneTimeGrants.Add(new OneTimeGrant
        {
            ScholarId = "s1", GrantTypeId = 1, Title = "TDP", Amount = 100m, ReleaseStatus = GrantReleaseStatuses.Cancelled,
        });
        await db.SaveChangesAsync();

        Assert.Equal(1, await GrantReleaseService.ReleaseDueAsync(db, new FakeNotifications()));
        Assert.Equal(0, await GrantReleaseService.ReleaseDueAsync(db, new FakeNotifications()));
        Assert.Single(db.OneTimeGrants, g => g.ReleaseStatus == GrantReleaseStatuses.Cancelled);
    }

    [Fact]
    public async Task A_grant_listed_before_the_scholar_profile_existed_lands_on_it()
    {
        using var db = TestDb.New();
        db.AddScholar("s1");
        var type = new GrantType { Id = 1, Name = "TDP", DefaultAmount = 7500m };
        db.GrantTypes.Add(type);
        db.EligibilityRecords.Add(new EligibilityRecord
        {
            Kind = EligibilityKinds.Grantee, StudentId = "23-LN-0001", FirstName = "ANA", LastName = "REYES", GrantTypeId = 1,
        });
        await db.SaveChangesAsync();

        var recorded = await MasterList.ClaimWaitingGrantLinesAsync(db, "s1", "23-ln-0001", actorId: "admin");
        await db.SaveChangesAsync();

        Assert.Equal(1, recorded);
        var grant = await db.OneTimeGrants.SingleAsync();
        Assert.Equal("s1", grant.ScholarId);
        Assert.Equal(7500m, grant.Amount);
        Assert.Equal("s1", (await db.EligibilityRecords.SingleAsync()).ClaimedByUserId);
        Assert.Equal(0, await MasterList.ClaimWaitingGrantLinesAsync(db, "s1", "23-LN-0001", "admin"));
    }

    [Fact]
    public void Parent_names_are_stored_in_parts_and_as_the_sheet_form()
    {
        var p = new PersonalDetails();
        new PersonalDetailsDto
        {
            FatherLastName = " cruz ", FatherFirstName = "dante", FatherMiddleName = "mendoza", FatherOccupation = "painter",
            MotherLastName = "cruz", MotherFirstName = "maria",
        }.ApplyTo(p);

        Assert.Equal("CRUZ", p.FatherLastName);
        Assert.Equal("CRUZ, DANTE MENDOZA", p.FatherName);
        Assert.Equal("PAINTER", p.FatherOccupation);
        Assert.Equal("CRUZ, MARIA", p.MotherName);
        Assert.Null(p.MotherMiddleName);
    }
}
