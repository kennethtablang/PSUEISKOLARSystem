using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.DTOs.Scholars;
using PSUEISKOLARSystem.Server.Exceptions;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// Revision 6 — accounts follow the office's lists. A grantee put on a scholarship's
/// cross-matching list is upgraded to a scholar account on the spot (no second sign-up), and a
/// scholar put on a grant type's list has the grant recorded on their profile. Lines left open
/// from before are applied by <see cref="MasterList.ReconcileAsync"/>.
/// </summary>
[Collection(SystemSettingsCollection.Name)]
public class GranteeUpgradeTests
{
    private record Lookups(int CampusId, int ProgramId, int TypeId, GrantType Grant);

    private static async Task<Lookups> SeedAsync(AuthHost host)
    {
        var campus = new Campus { Name = "Urdaneta City Campus", Code = "URD" };
        var program = new AcademicProgram { Name = "BS Agriculture", Code = "BSA" };
        var type = new ScholarshipType { Name = "CHED Scholarship" };
        var grant = new GrantType { Name = "Educational Assistance Program", DefaultAmount = 5000m };
        host.Db.AddRange(campus, program, type, grant);
        await host.Db.SaveChangesAsync();
        host.Db.CampusPrograms.Add(new CampusProgram { CampusId = campus.Id, ProgramId = program.Id });
        await host.Db.SaveChangesAsync();
        return new(campus.Id, program.Id, type.Id, grant);
    }

    private static EligibilityRecord Line(string kind, string studentId, int? typeId = null, int? grantTypeId = null) => new()
    {
        Kind = kind,
        StudentId = studentId,
        FirstName = "ROMEO",
        LastName = "PADILLA",
        MiddleName = "CRUZ",
        ScholarshipTypeId = typeId,
        GrantTypeId = grantTypeId,
    };

    private static RegisterScholarRequestDto Request(string studentId, Lookups l) => new()
    {
        FirstName = "Romeo",
        MiddleName = "Cruz",
        LastName = "Padilla",
        Email = "romeo@gmail.com",
        Password = "Str0ng!Passw0rd",
        StudentId = studentId,
        CampusId = l.CampusId,
        ProgramId = l.ProgramId,
        YearLevel = 2,
        ContactNumber = "+639185550202",
        Address = "Urdaneta, Pangasinan",
        Personal = new PersonalDetailsDto { Sex = "Male", CivilStatus = "Single", Is4PsBeneficiary = true },
        ConsentAccepted = true,
    };

    /// <summary>A grantee who signed up from a grant line and was closed once it was released.</summary>
    private static async Task<UserDto> ReleasedGranteeAsync(AuthHost host, Lookups l, string studentId = "24-URD-0202")
    {
        host.Db.EligibilityRecords.Add(Line(EligibilityKinds.Grantee, studentId, grantTypeId: l.Grant.Id));
        await host.Db.SaveChangesAsync();
        var grantee = await host.Auth.RegisterScholarAsync(Request(studentId, l));
        var user = await host.Db.Users.SingleAsync(u => u.Id == grantee.Id);
        user.IsActive = false;
        await host.Db.SaveChangesAsync();
        return grantee;
    }

    /// <summary>What MasterListController does when staff add a line.</summary>
    private static async Task<(string? Applied, List<string> Upgraded)> ListAsync(AuthHost host, EligibilityRecord line)
    {
        var upgraded = new List<string>();
        var applied = await MasterList.ApplyToExistingAccountAsync(host.Db, line, actorId: null, upgraded);
        host.Db.EligibilityRecords.Add(line);
        await host.Db.SaveChangesAsync();
        return (applied, upgraded);
    }

    [Fact]
    public async Task Listing_a_grantee_as_a_scholar_upgrades_their_account_and_keeps_their_grants()
    {
        using var host = new AuthHost();
        var l = await SeedAsync(host);
        var grantee = await ReleasedGranteeAsync(host, l);

        var (applied, upgraded) = await ListAsync(host, Line(EligibilityKinds.Scholar, "24-URD-0202", typeId: l.TypeId));

        Assert.Contains("upgraded", applied);
        Assert.Equal([grantee.Id], upgraded);
        Assert.Empty(host.Db.GranteeProfiles);

        var profile = await host.Db.ScholarProfiles.SingleAsync();
        Assert.Equal(grantee.Id, profile.UserId);
        Assert.Equal(l.TypeId, profile.ScholarshipTypeId);
        Assert.Equal(l.ProgramId, profile.ProgramId);          // carried over from the grantee profile
        Assert.Equal(2, profile.YearLevel);
        Assert.True(profile.Personal.Is4PsBeneficiary);
        Assert.True(profile.DetailsReviewPending);
        Assert.NotNull(profile.ConvertedFromGranteeAt);

        var user = await host.Users.FindByIdAsync(grantee.Id);
        Assert.True(user!.IsActive);
        var roles = await host.Users.GetRolesAsync(user);
        Assert.Equal([UserRoles.Scholar], roles);

        // The grant they received as a grantee is still theirs.
        Assert.Single(host.Db.OneTimeGrants, g => g.ScholarId == grantee.Id && g.GrantTypeId == l.Grant.Id);
        Assert.All(host.Db.EligibilityRecords, e => Assert.Equal(grantee.Id, e.ClaimedByUserId));
    }

    [Fact]
    public async Task A_full_scholarship_leaves_the_grantee_account_alone()
    {
        using var host = new AuthHost();
        var l = await SeedAsync(host);
        var type = await host.Db.ScholarshipTypes.SingleAsync();
        type.SlotLimit = 0;
        var grantee = await ReleasedGranteeAsync(host, l);

        var (applied, upgraded) = await ListAsync(host, Line(EligibilityKinds.Scholar, "24-URD-0202", typeId: l.TypeId));

        Assert.Contains("could not be upgraded", applied);
        Assert.Empty(upgraded);
        Assert.Single(host.Db.GranteeProfiles, g => g.UserId == grantee.Id);
        Assert.Empty(host.Db.ScholarProfiles);
    }

    [Fact]
    public async Task An_upgraded_student_trying_to_sign_up_again_is_told_to_sign_in()
    {
        using var host = new AuthHost();
        var l = await SeedAsync(host);
        await ReleasedGranteeAsync(host, l);
        await ListAsync(host, Line(EligibilityKinds.Scholar, "24-URD-0202", typeId: l.TypeId));

        var check = await host.Auth.CheckEligibilityAsync(new EligibilityCheckRequestDto
        {
            StudentId = "24-URD-0202", FirstName = "Romeo", LastName = "Padilla", MiddleName = "Cruz", CampusId = l.CampusId,
        });
        Assert.False(check.Matched);
        Assert.Contains("upgraded to a scholar account", check.Message);

        var ex = await Assert.ThrowsAsync<BadRequestException>(() => host.Auth.RegisterScholarAsync(Request("24-URD-0202", l)));
        Assert.Contains("upgraded to a scholar account", ex.Message);
    }

    [Fact]
    public async Task Listing_a_scholar_on_a_grant_records_the_grant_on_their_profile()
    {
        using var host = new AuthHost();
        var l = await SeedAsync(host);
        host.Db.EligibilityRecords.Add(Line(EligibilityKinds.Scholar, "24-LN-0101", typeId: l.TypeId));
        await host.Db.SaveChangesAsync();
        var scholar = await host.Auth.RegisterScholarAsync(Request("24-LN-0101", l));

        var (applied, _) = await ListAsync(host, Line(EligibilityKinds.Grantee, "24-LN-0101", grantTypeId: l.Grant.Id));

        Assert.Contains("scholar's profile", applied);
        var grant = await host.Db.OneTimeGrants.SingleAsync();
        Assert.Equal(scholar.Id, grant.ScholarId);
        Assert.Equal(5000m, grant.Amount);
        Assert.Empty(host.Db.GranteeProfiles);
    }

    [Fact]
    public async Task Reconcile_applies_lines_left_open_from_before()
    {
        using var host = new AuthHost();
        var l = await SeedAsync(host);
        host.Db.EligibilityRecords.Add(Line(EligibilityKinds.Scholar, "24-LN-0101", typeId: l.TypeId));
        await host.Db.SaveChangesAsync();
        var scholar = await host.Auth.RegisterScholarAsync(Request("24-LN-0101", l));

        // Put on a grant list directly, the way a line added before this rule was left open.
        host.Db.EligibilityRecords.Add(Line(EligibilityKinds.Grantee, "24-LN-0101", grantTypeId: l.Grant.Id));
        await host.Db.SaveChangesAsync();
        Assert.Empty(host.Db.OneTimeGrants);

        var notifications = new FakeNotifications();
        var applied = await MasterList.ReconcileAsync(host.Db, notifications);

        Assert.Equal(1, applied);
        Assert.Single(host.Db.OneTimeGrants, g => g.ScholarId == scholar.Id);
        Assert.Equal(0, await MasterList.ReconcileAsync(host.Db, notifications));   // nothing left to do
    }

    [Fact]
    public async Task Reconcile_upgrades_a_grantee_left_waiting_on_a_scholar_line()
    {
        using var host = new AuthHost();
        var l = await SeedAsync(host);
        var grantee = await ReleasedGranteeAsync(host, l);
        host.Db.EligibilityRecords.Add(Line(EligibilityKinds.Scholar, "24-URD-0202", typeId: l.TypeId));
        await host.Db.SaveChangesAsync();

        var notifications = new FakeNotifications();
        await MasterList.ReconcileAsync(host.Db, notifications);

        Assert.Single(host.Db.ScholarProfiles, sp => sp.UserId == grantee.Id);
        Assert.Contains(notifications.Sent, n => n.RecipientId == grantee.Id);
    }
}
