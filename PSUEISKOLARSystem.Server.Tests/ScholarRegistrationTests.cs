using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.DTOs.Scholars;
using PSUEISKOLARSystem.Server.Exceptions;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// <c>AuthService.RegisterScholarAsync</c> — sign-up is cross-matched against the master list
/// instead of waiting for approval. A match opens the account at once; a miss, or a rejected
/// profile, must never leave an account behind.
/// </summary>
[Collection(SystemSettingsCollection.Name)]
public class ScholarRegistrationTests
{
    private record Lookups(int CampusId, int ProgramId, int TypeId);

    private static async Task<Lookups> SeedLookupsAsync(AuthHost host, int? slotLimit = null)
    {
        var campus = new Campus { Name = "Lingayen Campus", Code = "LIN" };
        var program = new AcademicProgram { Name = "BS Computer Science", Code = "BSCS" };
        var type = new ScholarshipType { Name = "LGU", SlotLimit = slotLimit };
        host.Db.AddRange(campus, program, type);
        await host.Db.SaveChangesAsync();
        host.Db.CampusPrograms.Add(new CampusProgram { CampusId = campus.Id, ProgramId = program.Id });
        await host.Db.SaveChangesAsync();
        return new(campus.Id, program.Id, type.Id);
    }

    private static async Task AddLineAsync(AuthHost host, string kind, string studentId, int? typeId = null, int? grantTypeId = null)
    {
        host.Db.EligibilityRecords.Add(new EligibilityRecord
        {
            Kind = kind,
            StudentId = studentId,
            FirstName = "ANA",
            LastName = "REYES",
            ScholarshipTypeId = typeId,
            GrantTypeId = grantTypeId,
            GrantAmount = grantTypeId is null ? null : 5000m,
        });
        await host.Db.SaveChangesAsync();
    }

    private static RegisterScholarRequestDto Request(string email, string studentId, Lookups l) => new()
    {
        FirstName = "ana",           // typed lower-case: stored and matched upper-case
        LastName = "Reyes",
        Email = email,
        Password = "Str0ng!Passw0rd",
        StudentId = studentId,
        CampusId = l.CampusId,
        ProgramId = l.ProgramId,
        YearLevel = 2,
        ContactNumber = "+639171234567",
        BirthDate = new DateTime(2004, 6, 9),
        Address = "Lingayen, Pangasinan",
        Personal = new PersonalDetailsDto { Sex = "Female", CivilStatus = "Single", Is4PsBeneficiary = true },
        ConsentAccepted = true,
    };

    [Fact]
    public async Task A_matching_scholar_is_accepted_at_once_with_the_listed_scholarship()
    {
        using var host = new AuthHost();
        var l = await SeedLookupsAsync(host);
        await AddLineAsync(host, EligibilityKinds.Scholar, "22-LN-5555", typeId: l.TypeId);

        var user = await host.Auth.RegisterScholarAsync(Request("ana@psu.edu.ph", "22-ln-5555", l));

        var profile = await host.Db.ScholarProfiles.SingleAsync(sp => sp.UserId == user.Id);
        Assert.Equal("22-LN-5555", profile.StudentId);
        Assert.Equal(l.TypeId, profile.ScholarshipTypeId);
        Assert.Equal(l.CampusId, profile.CampusId);
        Assert.True(profile.Personal.Is4PsBeneficiary);
        Assert.Equal("ANA", user.FirstName);
        Assert.Equal(UserRoles.Scholar, user.Role);
        Assert.Equal(ApprovalStatuses.Approved, user.ApprovalStatus);
        Assert.Contains(host.Db.ScholarshipAssignments, a => a.ScholarId == user.Id && a.EndedAt == null);
        Assert.NotNull((await host.Db.EligibilityRecords.SingleAsync()).ClaimedByUserId);
    }

    [Fact]
    public async Task A_student_not_on_the_list_cannot_create_an_account()
    {
        using var host = new AuthHost();
        var l = await SeedLookupsAsync(host);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            host.Auth.RegisterScholarAsync(Request("ana@psu.edu.ph", "22-LN-5555", l)));

        Assert.Null(await host.Users.FindByEmailAsync("ana@psu.edu.ph"));
    }

    // Revision 5: students sign up with a personal email they actually read, not only a
    // @psu.edu.ph address.
    [Fact]
    public async Task A_personal_email_is_accepted()
    {
        using var host = new AuthHost();
        var l = await SeedLookupsAsync(host);
        await AddLineAsync(host, EligibilityKinds.Scholar, "22-LN-5555", typeId: l.TypeId);

        var user = await host.Auth.RegisterScholarAsync(Request("ana@gmail.com", "22-LN-5555", l));

        Assert.Equal("ana@gmail.com", user.Email);
        Assert.Equal(UserRoles.Scholar, user.Role);
    }

    [Fact]
    public async Task A_grantee_line_opens_a_grantee_account_with_the_grant_recorded()
    {
        using var host = new AuthHost();
        var l = await SeedLookupsAsync(host);
        var grant = new GrantType { Name = "Tulong Dunong", DefaultAmount = 7500m };
        host.Db.GrantTypes.Add(grant);
        await host.Db.SaveChangesAsync();
        await AddLineAsync(host, EligibilityKinds.Grantee, "22-LN-7777", grantTypeId: grant.Id);

        var user = await host.Auth.RegisterScholarAsync(Request("ana@psu.edu.ph", "22-LN-7777", l));

        Assert.Equal(UserRoles.Grantee, user.Role);
        Assert.Empty(host.Db.ScholarProfiles);
        Assert.Single(host.Db.GranteeProfiles, g => g.UserId == user.Id);
        var recorded = await host.Db.OneTimeGrants.SingleAsync();
        Assert.Equal(user.Id, recorded.ScholarId);
        Assert.Equal(5000m, recorded.Amount);   // the line's amount wins over the type default
    }

    [Fact]
    public async Task A_scholar_who_is_also_a_grantee_stays_a_scholar_and_gets_the_grant()
    {
        using var host = new AuthHost();
        var l = await SeedLookupsAsync(host);
        var grant = new GrantType { Name = "Tulong Dunong" };
        host.Db.GrantTypes.Add(grant);
        await host.Db.SaveChangesAsync();
        await AddLineAsync(host, EligibilityKinds.Scholar, "22-LN-5555", typeId: l.TypeId);
        await AddLineAsync(host, EligibilityKinds.Grantee, "22-LN-5555", grantTypeId: grant.Id);

        var user = await host.Auth.RegisterScholarAsync(Request("ana@psu.edu.ph", "22-LN-5555", l));

        Assert.Equal(UserRoles.Scholar, user.Role);
        Assert.Empty(host.Db.GranteeProfiles);
        Assert.Single(host.Db.OneTimeGrants, g => g.ScholarId == user.Id && g.GrantTypeId == grant.Id);
    }

    /// <summary>Signs a grantee up, then deactivates them the way closing the grant type does.</summary>
    private static async Task<(UserDto Grantee, GrantType Grant)> DeactivatedGranteeAsync(AuthHost host, Lookups l, string studentId)
    {
        var grant = new GrantType { Name = "Tulong Dunong", DefaultAmount = 7500m };
        host.Db.GrantTypes.Add(grant);
        await host.Db.SaveChangesAsync();
        await AddLineAsync(host, EligibilityKinds.Grantee, studentId, grantTypeId: grant.Id);

        var grantee = await host.Auth.RegisterScholarAsync(Request("ana@psu.edu.ph", studentId, l));
        var user = await host.Db.Users.SingleAsync(u => u.Id == grantee.Id);
        user.IsActive = false;
        await host.Db.SaveChangesAsync();
        return (grantee, grant);
    }

    [Fact]
    public async Task A_past_grantee_listed_as_a_scholar_is_offered_their_existing_account()
    {
        using var host = new AuthHost();
        var l = await SeedLookupsAsync(host);
        await DeactivatedGranteeAsync(host, l, "22-LN-7777");
        await AddLineAsync(host, EligibilityKinds.Scholar, "22-LN-7777", typeId: l.TypeId);

        var check = await host.Auth.CheckEligibilityAsync(new EligibilityCheckRequestDto
        {
            StudentId = "22-LN-7777", FirstName = "Ana", LastName = "Reyes", CampusId = l.CampusId,
        });

        Assert.True(check.Matched);
        Assert.Equal(EligibilityKinds.Scholar, check.Kind);
        Assert.True(check.ExistingGranteeAccount);
        Assert.EndsWith("@psu.edu.ph", check.ExistingAccountEmail);
        Assert.DoesNotContain("ana@", check.ExistingAccountEmail);   // masked
    }

    [Fact]
    public async Task A_past_grantee_becomes_a_scholar_on_the_same_account_and_keeps_their_grants()
    {
        using var host = new AuthHost();
        var l = await SeedLookupsAsync(host);
        var (grantee, grant) = await DeactivatedGranteeAsync(host, l, "22-LN-7777");
        await AddLineAsync(host, EligibilityKinds.Scholar, "22-LN-7777", typeId: l.TypeId);

        var prefill = await host.Auth.GetGranteeAccountForConversionAsync(new GranteeAccountLookupDto
        {
            StudentId = "22-LN-7777", FirstName = "Ana", LastName = "Reyes", CampusId = l.CampusId,
            Email = "ana@psu.edu.ph", Password = "Str0ng!Passw0rd",
        });
        Assert.Equal(1, prefill.GrantCount);
        Assert.Equal(l.ProgramId, prefill.ProgramId);

        var updated = Request("ana@psu.edu.ph", "22-LN-7777", l);
        updated.YearLevel = 3;
        var scholar = await host.Auth.RegisterScholarAsync(updated);

        host.Db.ChangeTracker.Clear();
        Assert.Equal(grantee.Id, scholar.Id);   // no second account
        Assert.Equal(UserRoles.Scholar, scholar.Role);
        var user = await host.Db.Users.SingleAsync();
        Assert.True(user.IsActive);
        Assert.Equal([UserRoles.Scholar], await host.Users.GetRolesAsync(user));

        Assert.Empty(host.Db.GranteeProfiles);
        var profile = await host.Db.ScholarProfiles.SingleAsync();
        Assert.Equal(l.TypeId, profile.ScholarshipTypeId);
        Assert.Equal(3, profile.YearLevel);
        Assert.Single(host.Db.OneTimeGrants, g => g.ScholarId == grantee.Id && g.GrantTypeId == grant.Id);
        Assert.All(host.Db.EligibilityRecords, e => Assert.Equal(grantee.Id, e.ClaimedByUserId));
    }

    [Fact]
    public async Task A_past_grantee_cannot_convert_with_the_wrong_password()
    {
        using var host = new AuthHost();
        var l = await SeedLookupsAsync(host);
        await DeactivatedGranteeAsync(host, l, "22-LN-7777");
        await AddLineAsync(host, EligibilityKinds.Scholar, "22-LN-7777", typeId: l.TypeId);

        var attempt = Request("ana@psu.edu.ph", "22-LN-7777", l);
        attempt.Password = "Wr0ng!Passw0rd";
        await Assert.ThrowsAsync<BadRequestException>(() => host.Auth.RegisterScholarAsync(attempt));

        host.Db.ChangeTracker.Clear();
        Assert.Empty(host.Db.ScholarProfiles);
        Assert.Single(host.Db.GranteeProfiles);
        Assert.False((await host.Db.Users.SingleAsync()).IsActive);
    }

    [Fact]
    public async Task A_grantee_with_no_scholar_line_cannot_convert()
    {
        using var host = new AuthHost();
        var l = await SeedLookupsAsync(host);
        await DeactivatedGranteeAsync(host, l, "22-LN-7777");

        await Assert.ThrowsAsync<BadRequestException>(() =>
            host.Auth.RegisterScholarAsync(Request("ana@psu.edu.ph", "22-LN-7777", l)));
        Assert.Empty(host.Db.ScholarProfiles);
    }

    [Fact]
    public async Task A_full_scholarship_is_refused_and_the_account_is_removed()
    {
        using var host = new AuthHost();
        var l = await SeedLookupsAsync(host, slotLimit: 1);
        await AddLineAsync(host, EligibilityKinds.Scholar, "22-LN-0001", typeId: l.TypeId);
        host.Db.EligibilityRecords.Add(new EligibilityRecord
        {
            Kind = EligibilityKinds.Scholar, StudentId = "22-LN-0002", FirstName = "ANA", LastName = "REYES", ScholarshipTypeId = l.TypeId,
        });
        await host.Db.SaveChangesAsync();
        await host.Auth.RegisterScholarAsync(Request("first@psu.edu.ph", "22-LN-0001", l));

        await Assert.ThrowsAsync<BadRequestException>(() =>
            host.Auth.RegisterScholarAsync(Request("second@psu.edu.ph", "22-LN-0002", l)));

        Assert.Null(await host.Users.FindByEmailAsync("second@psu.edu.ph"));
        Assert.Single(host.Db.ScholarProfiles);
    }
}
