using PSUEISKOLARSystem.Server.Exceptions;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// Staff sign in with an office address that may be an inbox nobody opens. A confirmed
/// personal recovery address lets them reset a forgotten password through it.
/// </summary>
[Collection(SystemSettingsCollection.Name)]
public class RecoveryEmailTests
{
    private const string Password = "Admin@12345";

    [Fact]
    public async Task A_confirmed_recovery_address_receives_the_reset_link()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@psu.edu.ph", Password, UserRoles.Administrator);

        await host.Auth.SendRecoveryEmailCodeAsync(admin.Id, "myself@gmail.com", Password);
        var (to, code) = Assert.Single(host.Email.RecoveryCodes);
        Assert.Equal("myself@gmail.com", to);

        var dto = await host.Auth.ConfirmRecoveryEmailAsync(admin.Id, "myself@gmail.com", code);
        Assert.Equal("myself@gmail.com", dto.RecoveryEmail);

        // Typing the recovery address on the sign-in page finds the admin account; so does
        // the sign-in address.
        Assert.True(await host.Auth.ForgotPasswordAsync("myself@gmail.com"));
        Assert.True(await host.Auth.ForgotPasswordAsync("admin@psu.edu.ph"));
    }

    [Fact]
    public async Task Changing_or_removing_it_voids_reset_links_already_sent()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@psu.edu.ph", Password, UserRoles.Administrator);
        await host.Auth.SendRecoveryEmailCodeAsync(admin.Id, "myself@gmail.com", Password);
        await host.Auth.ConfirmRecoveryEmailAsync(admin.Id, "myself@gmail.com", host.Email.RecoveryCodes[0].Code);

        // A link that went to the recovery inbox before it was removed.
        var user = (await host.Users.FindByIdAsync(admin.Id))!;
        var outstanding = await host.Users.GeneratePasswordResetTokenAsync(user);

        await host.Auth.RemoveRecoveryEmailAsync(admin.Id, Password);

        user = (await host.Users.FindByIdAsync(admin.Id))!;
        Assert.False(await host.Users.VerifyUserTokenAsync(user,
            host.Users.Options.Tokens.PasswordResetTokenProvider,
            Microsoft.AspNetCore.Identity.UserManager<PSUEISKOLARSystem.Server.Models.ApplicationUser>.ResetPasswordTokenPurpose,
            outstanding));
        Assert.Null(user.RecoveryEmail);
    }

    [Fact]
    public async Task A_code_only_confirms_the_address_it_was_sent_to()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@psu.edu.ph", Password, UserRoles.Administrator);

        await host.Auth.SendRecoveryEmailCodeAsync(admin.Id, "myself@gmail.com", Password);
        var (_, code) = Assert.Single(host.Email.RecoveryCodes);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            host.Auth.ConfirmRecoveryEmailAsync(admin.Id, "someone-else@gmail.com", code));
        Assert.False(await host.Auth.ForgotPasswordAsync("someone-else@gmail.com"));
    }

    [Fact]
    public async Task Setting_one_needs_the_password_and_a_staff_account()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@psu.edu.ph", Password, UserRoles.Administrator);
        var scholar = await host.AddUserAsync("scholar@gmail.com", Password, UserRoles.Scholar);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            host.Auth.SendRecoveryEmailCodeAsync(admin.Id, "myself@gmail.com", "wrong-password"));
        await Assert.ThrowsAsync<BadRequestException>(() =>
            host.Auth.SendRecoveryEmailCodeAsync(scholar.Id, "other@gmail.com", Password));
        Assert.Empty(host.Email.RecoveryCodes);
    }

    [Fact]
    public async Task Another_accounts_address_cannot_be_used()
    {
        using var host = new AuthHost();
        var admin = await host.AddUserAsync("admin@psu.edu.ph", Password, UserRoles.Administrator);
        await host.AddUserAsync("scholar@gmail.com", Password, UserRoles.Scholar);

        await Assert.ThrowsAsync<BadRequestException>(() =>
            host.Auth.SendRecoveryEmailCodeAsync(admin.Id, "scholar@gmail.com", Password));
        await Assert.ThrowsAsync<BadRequestException>(() =>
            host.Auth.SendRecoveryEmailCodeAsync(admin.Id, "admin@psu.edu.ph", Password));
    }

    [Fact]
    public async Task An_unknown_address_finds_nothing()
    {
        using var host = new AuthHost();
        await host.AddUserAsync("admin@psu.edu.ph", Password, UserRoles.Administrator);

        Assert.False(await host.Auth.ForgotPasswordAsync("nobody@gmail.com"));
    }
}

public class ScholarshipCategoryTests
{
    [Theory]
    [InlineData("CHED Scholarship", "Government")]
    [InlineData("PSU Institutional Scholarship", "Government")]
    [InlineData("Local Government Unit (LGU)", "Government")]
    [InlineData("SM Foundation Scholarship", "Private")]
    [InlineData("Notes for Tomorrow Grant", "Private")]
    [InlineData(null, "Private")]
    public void A_type_saved_without_a_category_is_placed_by_its_name(string? name, string expected) =>
        Assert.Equal(expected, ScholarshipCategories.FromName(name));
}
