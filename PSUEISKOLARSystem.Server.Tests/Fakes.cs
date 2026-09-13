using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// The minimum needed to drive a controller action directly: an identity, an uploaded file,
/// and the two collaborators that would otherwise reach out of the process (storage and mail).
/// </summary>
public static class Fakes
{
    /// <summary>Puts a signed-in user with the given id and role on the controller.</summary>
    public static T As<T>(this T controller, string userId, string? role = null, string? fullName = null)
        where T : ControllerBase
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId) };
        if (role is not null) claims.Add(new Claim(ClaimTypes.Role, role));
        if (fullName is not null) claims.Add(new Claim(ClaimTypes.Name, fullName));

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")),
            },
        };
        return controller;
    }

    /// <summary>An in-memory upload. Content is irrelevant — storage is faked.</summary>
    public static IFormFile File(string name = "cor.pdf", long bytes = 1024) =>
        new FormFile(new MemoryStream(Encoding.UTF8.GetBytes(new string('x', (int)bytes))), 0, bytes, "file", name)
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf",
        };

    public static BackgroundEmailer Mailer() =>
        new(new EmptyScopeFactory(), NullLogger<BackgroundEmailer>.Instance);

    /// <summary>
    /// Resolves nothing. BackgroundEmailer runs detached and logs whatever it catches, so a
    /// scope with no IEmailService in it is a send that fails quietly — which is exactly the
    /// behaviour a controller test wants: mail must never decide whether the action passed.
    /// </summary>
    private sealed class EmptyScopeFactory : IServiceScopeFactory, IServiceScope, IServiceProvider
    {
        public IServiceScope CreateScope() => this;
        public IServiceProvider ServiceProvider => this;
        public object? GetService(Type serviceType) => null;
        public void Dispose() { }
    }
}

/// <summary>Records what was written and deleted, and can be told to reject an upload.</summary>
public sealed class FakeStorage : IFileStorageService
{
    public List<string> Saved { get; } = [];
    public List<string> Deleted { get; } = [];

    /// <summary>Set to make SaveAsync fail the way the real magic-byte check does.</summary>
    public string? RejectWith { get; set; }

    public Task<(string StoredFileName, long SizeBytes)> SaveAsync(IFormFile file, FileUploadPolicy policy)
    {
        if (RejectWith is not null) throw new InvalidOperationException(RejectWith);
        var stored = $"stored-{Saved.Count + 1}-{file.FileName}";
        Saved.Add(stored);
        return Task.FromResult((stored, file.Length));
    }

    public Task<(Stream Stream, string ContentType)> GetAsync(string storedFileName, string originalContentType) =>
        Task.FromResult<(Stream, string)>((new MemoryStream(), originalContentType));

    public Task DeleteAsync(string storedFileName)
    {
        Deleted.Add(storedFileName);
        return Task.CompletedTask;
    }
}

/// <summary>Captures notifications instead of persisting or pushing them.</summary>
public sealed class FakeNotifications : INotificationService
{
    public List<(string RecipientId, string Title, string Category)> Sent { get; } = [];

    public Task CreateAsync(string recipientId, string title, string message, string category, string? linkUrl = null)
    {
        Sent.Add((recipientId, title, category));
        return Task.CompletedTask;
    }

    public Task CreateForManyAsync(IEnumerable<string> recipientIds, string title, string message, string category, string? linkUrl = null)
    {
        foreach (var id in recipientIds) Sent.Add((id, title, category));
        return Task.CompletedTask;
    }

    public Task BroadcastAsync(string eventName) => Task.CompletedTask;
}
