using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.Exceptions;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// <c>AuthService.RegisterScholarAsync</c> — the scholar supplies their own profile at sign-up,
/// so staff only have to review it. A rejected profile must never leave an account behind.
/// </summary>
public class ScholarRegistrationTests
{
    private static async Task<(int programId, int typeId)> SeedLookupsAsync(AuthHost host, int? slotLimit = null)
    {
        var program = new AcademicProgram { Name = "BS Computer Science", Code = "BSCS" };
        var type = new ScholarshipType { Name = "LGU", SlotLimit = slotLimit };
        host.Db.AddRange(program, type);
        await host.Db.SaveChangesAsync();
        return (program.Id, type.Id);
    }

    private static RegisterScholarRequestDto Request(string email, string studentId, int programId, int typeId) => new()
    {
        FirstName = "Ana",
        LastName = "Reyes",
        Email = email,
        Password = "Str0ng!Passw0rd",
        StudentId = studentId,
        ProgramId = programId,
        ScholarshipTypeId = typeId,
        YearLevel = 2,
    };

    [Fact]
    public async Task Registration_creates_the_profile_and_the_scholarship_ledger_row()
    {
        using var host = new AuthHost();
        var (programId, typeId) = await SeedLookupsAsync(host);

        var user = await host.Auth.RegisterScholarAsync(Request("ana@psu.edu.ph", "22-LN-5555", programId, typeId));

        var profile = await host.Db.ScholarProfiles.SingleAsync(sp => sp.UserId == user.Id);
        Assert.Equal("22-LN-5555", profile.StudentId);
        Assert.Equal(typeId, profile.ScholarshipTypeId);
        Assert.Equal(2, profile.YearLevel);
        Assert.Contains(host.Db.ScholarshipAssignments, a => a.ScholarId == user.Id && a.EndedAt == null);
        Assert.Equal(ApprovalStatuses.Pending, user.ApprovalStatus);
    }

    [Fact]
    public async Task A_taken_student_id_is_refused_without_creating_the_account()
    {
        using var host = new AuthHost();
        var (programId, typeId) = await SeedLookupsAsync(host);
        await host.Auth.RegisterScholarAsync(Request("first@psu.edu.ph", "22-LN-5555", programId, typeId));

        await Assert.ThrowsAsync<BadRequestException>(() =>
            host.Auth.RegisterScholarAsync(Request("second@psu.edu.ph", "22-LN-5555", programId, typeId)));

        Assert.Null(await host.Users.FindByEmailAsync("second@psu.edu.ph"));
    }

    [Fact]
    public async Task A_full_scholarship_is_refused_and_the_account_is_removed()
    {
        using var host = new AuthHost();
        var (programId, typeId) = await SeedLookupsAsync(host, slotLimit: 1);
        await host.Auth.RegisterScholarAsync(Request("first@psu.edu.ph", "22-LN-0001", programId, typeId));

        await Assert.ThrowsAsync<BadRequestException>(() =>
            host.Auth.RegisterScholarAsync(Request("second@psu.edu.ph", "22-LN-0002", programId, typeId)));

        Assert.Null(await host.Users.FindByEmailAsync("second@psu.edu.ph"));
        Assert.Single(host.Db.ScholarProfiles);
    }
}
