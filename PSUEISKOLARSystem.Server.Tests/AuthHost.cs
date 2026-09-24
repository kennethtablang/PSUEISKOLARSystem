using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Mappings;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;
using PSUEISKOLARSystem.Server.Settings;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// A container just large enough to run <see cref="AuthService"/> for real.
/// <para>
/// Sign-in is the one path where hand-rolling the collaborators would test the mock rather
/// than the code: the lockout counter, the password hash and the security stamp all live
/// inside <c>UserManager</c>, and the configurable threshold works precisely by reassigning
/// <c>userManager.Options.Lockout</c> per request. Wiring real Identity against an in-memory
/// store keeps those behaviours in the test.
/// </para>
/// </summary>
public sealed class AuthHost : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly IServiceScope _scope;

    public ApplicationDbContext Db { get; }
    public UserManager<ApplicationUser> Users { get; }
    public IAuthService Auth { get; }
    public FakeEmail Email { get; } = new();

    public AuthHost()
    {
        var services = new ServiceCollection();
        services.AddLogging(b => b.SetMinimumLevel(LogLevel.None));
        services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString()));

        services
            .AddIdentity<ApplicationUser, IdentityRole>(o =>
            {
                o.Password.RequiredLength = 8;
                o.User.RequireUniqueEmail = true;
                o.Lockout.AllowedForNewUsers = true;
                o.SignIn.RequireConfirmedEmail = false;
            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        services.AddAutoMapper(_ => { }, typeof(AuthMappingProfile));
        services.AddSingleton<IEmailService>(Email);
        services.AddSingleton<BackgroundEmailer>();
        services.AddSingleton(Options.Create(new JwtSettings
        {
            Key = "test-key-that-is-comfortably-longer-than-thirty-two-characters",
            Issuer = "test",
            Audience = "test",
            ExpiryMinutes = 60,
        }));
        services.AddSingleton(Options.Create(new EmailSettings { AppBaseUrl = "https://localhost" }));
        services.AddScoped<IAuthService, AuthService>();

        _provider = services.BuildServiceProvider();
        _scope = _provider.CreateScope();

        Db = _scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Users = _scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        Auth = _scope.ServiceProvider.GetRequiredService<IAuthService>();

        var roles = _scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var name in UserRoles.All)
            roles.CreateAsync(new IdentityRole(name)).GetAwaiter().GetResult();
    }

    /// <summary>Creates a confirmed, active account with a known password.</summary>
    public async Task<ApplicationUser> AddUserAsync(
        string email, string password, string role = UserRoles.Scholar, bool emailConfirmed = true)
    {
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            FirstName = "Test",
            LastName = "User",
            EmailConfirmed = emailConfirmed,
        };
        var created = await Users.CreateAsync(user, password);
        Assert.True(created.Succeeded, string.Join("; ", created.Errors.Select(e => e.Description)));
        await Users.AddToRoleAsync(user, role);
        return user;
    }

    /// <summary>Saves a settings row and drops the store's process-wide cache.</summary>
    public async Task SetPolicyAsync(Action<SystemSettings> configure)
    {
        var settings = await Db.SystemSettings.FirstOrDefaultAsync();
        if (settings is null)
        {
            settings = new SystemSettings();
            Db.SystemSettings.Add(settings);
        }
        configure(settings);
        await Db.SaveChangesAsync();
        SystemSettingsStore.Invalidate();
    }

    public void Dispose()
    {
        // The cache is static, so a policy set here must not leak into the next test class.
        SystemSettingsStore.Invalidate();
        _scope.Dispose();
        _provider.Dispose();
    }

    /// <summary>Records what would have been sent.</summary>
    public sealed class FakeEmail : IEmailService
    {
        public List<string> TwoFactorCodes { get; } = [];

        public Task SendTwoFactorCodeAsync(string toEmail, string toName, string code)
        {
            TwoFactorCodes.Add(code);
            return Task.CompletedTask;
        }

        public Task<IAsyncDisposable> BeginBatchAsync() => Task.FromResult<IAsyncDisposable>(new NoBatch());
        public Task SendPasswordResetEmailAsync(string toEmail, string toName, string resetLink) => Task.CompletedTask;
        public Task SendEmailVerificationAsync(string toEmail, string toName, string verifyLink) => Task.CompletedTask;
        public Task SendDocumentUploadConfirmationAsync(string toEmail, string toName, string requirementName, string academicYear, int semester) => Task.CompletedTask;
        public Task SendDocumentStatusEmailAsync(string toEmail, string toName, string requirementName, string status, string? feedback) => Task.CompletedTask;
        public Task SendDeadlineReminderAsync(string toEmail, string toName, string requirementName, DateTime dueDate, string academicYear, int semester, bool overdue = false) => Task.CompletedTask;
        public Task SendAnnouncementEmailAsync(string toEmail, string toName, string title, string content) => Task.CompletedTask;
        public Task SendScholarWelcomeAsync(string toEmail, string toName, string tempPassword, string verifyLink) => Task.CompletedTask;
        public Task SendMessageEmailAsync(string toEmail, string toName, string senderName, string messagePreview) => Task.CompletedTask;
        public Task SendScholarApprovalDecisionAsync(string toEmail, string toName, bool approved, string? scholarshipName, string? note) => Task.CompletedTask;

        private sealed class NoBatch : IAsyncDisposable
        {
            public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        }
    }
}
