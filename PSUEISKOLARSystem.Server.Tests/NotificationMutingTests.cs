using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Hubs;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;
using Xunit;

namespace PSUEISKOLARSystem.Server.Tests;

// Covers per-user in-app notification muting: the encoding and the delivery filter.
public class NotificationMutingTests
{
    /* ── Encoding ── */

    [Fact]
    public void Encode_wraps_and_delimits_so_a_token_lookup_cannot_partially_match()
    {
        var stored = NotificationMuting.Encode([NotificationCategories.Deadline, NotificationCategories.Message]);

        Assert.Equal("|Deadline|Message|", stored);
        Assert.Contains(NotificationMuting.Token(NotificationCategories.Deadline), stored);
        Assert.Contains(NotificationMuting.Token(NotificationCategories.Message), stored);
        Assert.DoesNotContain(NotificationMuting.Token(NotificationCategories.Announcement), stored);
    }

    [Fact]
    public void Encode_drops_unmutable_and_unknown_categories()
    {
        // Account notices must always reach the user, so they can never be encoded.
        Assert.Null(NotificationMuting.Encode([NotificationCategories.Account, "Nonsense"]));
    }

    [Fact]
    public void Encode_returns_null_for_an_empty_selection()
    {
        Assert.Null(NotificationMuting.Encode([]));
        Assert.Null(NotificationMuting.Encode(null));
    }

    [Fact]
    public void Parse_round_trips_an_encoded_selection()
    {
        var stored = NotificationMuting.Encode([NotificationCategories.Announcement, NotificationCategories.Deadline]);

        Assert.Equal(
            [NotificationCategories.Announcement, NotificationCategories.Deadline],
            NotificationMuting.Parse(stored));
    }

    [Fact]
    public void Parse_treats_null_and_blank_as_nothing_muted()
    {
        Assert.Empty(NotificationMuting.Parse(null));
        Assert.Empty(NotificationMuting.Parse(""));
    }

    /* ── Delivery ── */

    private static (ApplicationDbContext Db, NotificationService Service) Seeded()
    {
        var db = TestDb.New();
        var muted = db.AddScholar("muted");
        muted.MutedNotificationCategories = NotificationMuting.Encode([NotificationCategories.Deadline]);
        db.AddScholar("listening");
        db.SaveChanges();

        return (db, new NotificationService(db, new NoOpHubContext()));
    }

    [Fact]
    public async Task A_muted_category_is_not_persisted_for_that_user()
    {
        var (db, service) = Seeded();
        using var _ = db;

        await service.CreateAsync("muted", "Due soon", "COR", NotificationCategories.Deadline);

        Assert.Empty(await db.Notifications.ToListAsync());
    }

    [Fact]
    public async Task Other_categories_still_reach_a_user_who_muted_one()
    {
        var (db, service) = Seeded();
        using var _ = db;

        await service.CreateAsync("muted", "New post", "Body", NotificationCategories.Announcement);

        Assert.Single(await db.Notifications.ToListAsync());
    }

    [Fact]
    public async Task Account_notices_are_delivered_even_if_somehow_listed_as_muted()
    {
        using var db = TestDb.New();
        var user = db.AddScholar("stubborn");
        // Bypass Encode to simulate a hand-edited row claiming Account is muted.
        user.MutedNotificationCategories = "|Account|";
        await db.SaveChangesAsync();
        var service = new NotificationService(db, new NoOpHubContext());

        await service.CreateAsync("stubborn", "Password changed", "Body", NotificationCategories.Account);

        Assert.Single(await db.Notifications.ToListAsync());
    }

    [Fact]
    public async Task A_broadcast_skips_only_the_users_who_muted_the_category()
    {
        var (db, service) = Seeded();
        using var _ = db;

        await service.CreateForManyAsync(
            ["muted", "listening"], "Due soon", "COR", NotificationCategories.Deadline);

        var recipients = await db.Notifications.Select(n => n.RecipientId).ToListAsync();
        Assert.Equal(["listening"], recipients);
    }

    // The service pushes over SignalR after saving; these tests only care about persistence.
    private sealed class NoOpHubContext : IHubContext<NotificationHub>
    {
        public IHubClients Clients { get; } = new NoOpClients();
        public IGroupManager Groups { get; } = new NoOpGroups();

        private sealed class NoOpClients : IHubClients
        {
            private static readonly IClientProxy Proxy = new NoOpProxy();
            public IClientProxy All => Proxy;
            public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => Proxy;
            public IClientProxy Client(string connectionId) => Proxy;
            public IClientProxy Clients(IReadOnlyList<string> connectionIds) => Proxy;
            public IClientProxy Group(string groupName) => Proxy;
            public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => Proxy;
            public IClientProxy Groups(IReadOnlyList<string> groupNames) => Proxy;
            public IClientProxy User(string userId) => Proxy;
            public IClientProxy Users(IReadOnlyList<string> userIds) => Proxy;
        }

        private sealed class NoOpProxy : IClientProxy
        {
            public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
                => Task.CompletedTask;
        }

        private sealed class NoOpGroups : IGroupManager
        {
            public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
                => Task.CompletedTask;
            public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
                => Task.CompletedTask;
        }
    }
}
