using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.DTOs.Auth;
using PSUEISKOLARSystem.Server.Exceptions;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// <c>AuthService.LoginAsync</c> — the lockout counter, the configurable threshold,
/// maintenance mode, and the two-factor hand-off.
/// <para>
/// The threshold in particular is worth pinning: Identity fixes its lockout options at
/// startup, so the configurable value only works because <c>AuthService</c> reassigns
/// <c>userManager.Options.Lockout</c> on every sign-in. Nothing about that is obvious from
/// reading the option, and a refactor that "tidies away" the reassignment would silently
/// restore the compiled-in five.
/// </para>
/// </summary>
[Collection(SystemSettingsCollection.Name)]
public class LoginTests
{
    private const string Password = "Str0ng!Passw0rd";

    private static LoginRequestDto Login(string email, string password) =>
        new() { Email = email, Password = password };

    [Fact]
    public async Task A_correct_password_returns_a_token_and_records_the_sign_in()
    {
        using var host = new AuthHost();
        await host.AddUserAsync("scholar@psu.edu.ph", Password);

        var result = await host.Auth.LoginAsync(Login("scholar@psu.edu.ph", Password));

        Assert.False(string.IsNullOrWhiteSpace(result.Token));
        Assert.Equal(UserRoles.Scholar, result.User!.Role);
        Assert.True(result.ExpiresAtUtc > DateTime.UtcNow);
        Assert.Contains(host.Db.AuditLogs, a => a.Action == "Login");
    }

    [Fact]
    public async Task An_unknown_account_and_a_wrong_password_fail_alike()
    {
        // Distinguishing them would turn the sign-in form into an account-enumeration oracle.
        using var host = new AuthHost();
        await host.AddUserAsync("scholar@psu.edu.ph", Password);

        var unknown = await Assert.ThrowsAsync<UnauthorizedException>(
            () => host.Auth.LoginAsync(Login("nobody@psu.edu.ph", Password)));
        var wrong = await Assert.ThrowsAsync<UnauthorizedException>(
            () => host.Auth.LoginAsync(Login("scholar@psu.edu.ph", "Wrong!Passw0rd")));

        Assert.Equal(unknown.Message, wrong.Message);
    }

    [Fact]
    public async Task A_deactivated_account_cannot_sign_in()
    {
        using var host = new AuthHost();
        var user = await host.AddUserAsync("archived@psu.edu.ph", Password);
        user.IsActive = false;
        await host.Users.UpdateAsync(user);

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => host.Auth.LoginAsync(Login("archived@psu.edu.ph", Password)));

        Assert.Contains(host.Db.AuditLogs, a => a.Action == "LoginFailed" && a.Details!.Contains("inactive"));
    }

    [Fact]
    public async Task The_configured_threshold_is_what_locks_the_account_not_Identitys_default()
    {
        using var host = new AuthHost();
        await host.AddUserAsync("scholar@psu.edu.ph", Password);
        await host.SetPolicyAsync(s => { s.MaxFailedLoginAttempts = 3; s.LockoutMinutes = 15; });

        for (var i = 0; i < 3; i++)
            await Assert.ThrowsAsync<UnauthorizedException>(
                () => host.Auth.LoginAsync(Login("scholar@psu.edu.ph", "Wrong!Passw0rd")));

        // The third failure trips the lock, so even the *correct* password is now refused.
        var locked = await Assert.ThrowsAsync<UnauthorizedException>(
            () => host.Auth.LoginAsync(Login("scholar@psu.edu.ph", Password)));

        Assert.Contains("temporarily locked", locked.Message);
    }

    [Fact]
    public async Task A_successful_sign_in_clears_the_failed_attempt_count()
    {
        using var host = new AuthHost();
        var user = await host.AddUserAsync("scholar@psu.edu.ph", Password);
        await host.SetPolicyAsync(s => s.MaxFailedLoginAttempts = 3);

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => host.Auth.LoginAsync(Login("scholar@psu.edu.ph", "Wrong!Passw0rd")));
        await host.Auth.LoginAsync(Login("scholar@psu.edu.ph", Password));

        var reloaded = await host.Users.FindByIdAsync(user.Id);
        Assert.Equal(0, await host.Users.GetAccessFailedCountAsync(reloaded!));
    }

    [Fact]
    public async Task Maintenance_mode_blocks_scholars_but_never_administrators()
    {
        // An administrator locked out by maintenance mode would have no way to switch it off.
        using var host = new AuthHost();
        await host.AddUserAsync("scholar@psu.edu.ph", Password);
        await host.AddUserAsync("admin@psu.edu.ph", Password, UserRoles.Administrator);
        await host.SetPolicyAsync(s =>
        {
            s.MaintenanceMode = true;
            s.MaintenanceMessage = "The system is down for maintenance.";
        });

        var blocked = await Assert.ThrowsAsync<UnauthorizedException>(
            () => host.Auth.LoginAsync(Login("scholar@psu.edu.ph", Password)));
        Assert.Equal("The system is down for maintenance.", blocked.Message);

        var admin = await host.Auth.LoginAsync(Login("admin@psu.edu.ph", Password));
        Assert.False(string.IsNullOrWhiteSpace(admin.Token));
    }

    [Fact]
    public async Task An_unverified_email_is_refused_only_while_the_policy_requires_it()
    {
        using var host = new AuthHost();
        await host.AddUserAsync("new@psu.edu.ph", Password, emailConfirmed: false);

        await host.SetPolicyAsync(s => s.RequireEmailVerification = true);
        var refused = await Assert.ThrowsAsync<UnauthorizedException>(
            () => host.Auth.LoginAsync(Login("new@psu.edu.ph", Password)));
        Assert.Contains("not been verified", refused.Message);

        await host.SetPolicyAsync(s => s.RequireEmailVerification = false);
        var allowed = await host.Auth.LoginAsync(Login("new@psu.edu.ph", Password));
        Assert.False(string.IsNullOrWhiteSpace(allowed.Token));
    }

    [Fact]
    public async Task Two_factor_returns_a_ticket_and_a_code_but_no_session_token()
    {
        using var host = new AuthHost();
        var user = await host.AddUserAsync("scholar@psu.edu.ph", Password);
        await host.Users.SetTwoFactorEnabledAsync(user, true);

        var result = await host.Auth.LoginAsync(Login("scholar@psu.edu.ph", Password));

        Assert.True(result.Requires2fa);
        Assert.False(string.IsNullOrWhiteSpace(result.TwoFaTicket));
        // No usable session until the code is right. (Token defaults to "" rather than null.)
        Assert.True(string.IsNullOrEmpty(result.Token));
        Assert.Single(host.Email.TwoFactorCodes);
    }

    [Fact]
    public async Task The_two_factor_ticket_is_not_accepted_as_a_session_token()
    {
        /* The ticket is signed with the same key as a real token, so anything that only
           checks the signature would take it. It carries no role claim, and SessionValidator
           refuses it outright — this pins the half that lives in the token itself. */
        using var host = new AuthHost();
        var user = await host.AddUserAsync("scholar@psu.edu.ph", Password);
        await host.Users.SetTwoFactorEnabledAsync(user, true);

        var result = await host.Auth.LoginAsync(Login("scholar@psu.edu.ph", Password));

        var payload = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler()
            .ReadJwtToken(result.TwoFaTicket);

        Assert.Equal("2fa", payload.Claims.First(c => c.Type == "purpose").Value);
        Assert.DoesNotContain(payload.Claims, c => c.Type == System.Security.Claims.ClaimTypes.Role);
    }

    [Fact]
    public async Task A_session_token_is_pinned_to_the_accounts_security_stamp()
    {
        // The stamp is what makes a password change end every other session — without the
        // claim, SessionValidator has nothing to compare and revocation quietly stops working.
        using var host = new AuthHost();
        await host.AddUserAsync("scholar@psu.edu.ph", Password);

        var result = await host.Auth.LoginAsync(Login("scholar@psu.edu.ph", Password));
        var payload = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler()
            .ReadJwtToken(result.Token);

        var stamp = payload.Claims.FirstOrDefault(c => c.Type == "stamp")?.Value;
        var user = await host.Db.Users.AsNoTracking().FirstAsync(u => u.Email == "scholar@psu.edu.ph");

        Assert.False(string.IsNullOrWhiteSpace(stamp));
        Assert.Equal(user.SecurityStamp, stamp);
    }
}
