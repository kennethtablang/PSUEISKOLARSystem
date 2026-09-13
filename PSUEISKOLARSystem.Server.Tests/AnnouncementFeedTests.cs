using PSUEISKOLARSystem.Server.Data;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// Who may see which announcement, and what the editor needs back to re-save one unchanged.
/// <para>
/// The targeting rule is not simple — named recipients override the audience filters, a
/// scheduled post is invisible to its audience but visible to managers, expiry applies to
/// everyone — and it is read by both the Announcements page and the dashboard. A drift here
/// either leaks an announcement to the wrong scholar or hides one from the right scholar.
/// </para>
/// </summary>
public class AnnouncementFeedTests
{
    private const string Author = "coord-1";

    private static ApplicationDbContext Seeded()
    {
        var db = TestDb.New();
        db.AddType(1, "CHED");
        db.AddType(2, "DOST");
        db.AcademicPrograms.Add(new AcademicProgram { Id = 1, Name = "BSCS", Code = "BSCS" });
        db.AcademicPrograms.Add(new AcademicProgram { Id = 2, Name = "BSIT", Code = "BSIT" });
        db.AddScholar(Author);
        db.SaveChanges();
        return db;
    }

    private static Announcement Post(
        ApplicationDbContext db, string title,
        int? typeId = null, int? programId = null, string? role = null,
        DateTime? publishAt = null, DateTime? expiresAt = null)
    {
        var a = new Announcement
        {
            Title = title,
            Content = "…",
            CreatedById = Author,
            TargetScholarshipTypeId = typeId,
            TargetProgramId = programId,
            TargetRole = role,
            PublishAt = publishAt,
            ExpiresAt = expiresAt,
            IsActive = true,
        };
        db.Announcements.Add(a);
        db.SaveChanges();
        return a;
    }

    /// <summary>A scholar on CHED / BSCS.</summary>
    private static string AddReader(ApplicationDbContext db, int? typeId = 1, int? programId = 1)
    {
        db.AddScholar("reader");
        var profile = db.AddProfile("reader", typeId);
        profile.ProgramId = programId;
        db.SaveChanges();
        return "reader";
    }

    [Fact]
    public async Task An_untargeted_announcement_reaches_everyone()
    {
        using var db = Seeded();
        var reader = AddReader(db);
        Post(db, "Campus-wide notice");

        var feed = await AnnouncementFeed.LoadAsync(db, reader, UserRoles.Scholar);

        Assert.Single(feed);
    }

    [Fact]
    public async Task Audience_filters_exclude_a_scholar_who_does_not_match()
    {
        using var db = Seeded();
        var reader = AddReader(db, typeId: 1, programId: 1);
        Post(db, "For CHED", typeId: 1);
        Post(db, "For DOST", typeId: 2);
        Post(db, "For BSIT", programId: 2);

        var feed = await AnnouncementFeed.LoadAsync(db, reader, UserRoles.Scholar);

        Assert.Equal("For CHED", Assert.Single(feed).Title);
    }

    [Fact]
    public async Task Named_recipients_override_the_audience_filters_entirely()
    {
        // Addressed to a named scholar, but filtered to a scholarship they do not hold. The
        // naming wins — otherwise a coordinator writing to one person would get silence.
        using var db = Seeded();
        var reader = AddReader(db, typeId: 1);
        var post = Post(db, "Just for you", typeId: 2);
        db.AnnouncementRecipients.Add(new AnnouncementRecipient { AnnouncementId = post.Id, ScholarId = reader });
        db.SaveChanges();

        var feed = await AnnouncementFeed.LoadAsync(db, reader, UserRoles.Scholar);

        Assert.Equal("Just for you", Assert.Single(feed).Title);
    }

    [Fact]
    public async Task A_named_announcement_does_not_reach_anyone_else()
    {
        using var db = Seeded();
        var reader = AddReader(db);
        db.AddScholar("other");
        db.SaveChanges();

        var post = Post(db, "Private note");
        db.AnnouncementRecipients.Add(new AnnouncementRecipient { AnnouncementId = post.Id, ScholarId = "other" });
        db.SaveChanges();

        Assert.Empty(await AnnouncementFeed.LoadAsync(db, reader, UserRoles.Scholar));
    }

    [Fact]
    public async Task A_scheduled_post_is_hidden_from_its_audience_but_visible_to_managers()
    {
        using var db = Seeded();
        var reader = AddReader(db);
        Post(db, "Goes out on Monday", publishAt: DateTime.UtcNow.AddDays(3));

        Assert.Empty(await AnnouncementFeed.LoadAsync(db, reader, UserRoles.Scholar));
        Assert.Single(await AnnouncementFeed.LoadAsync(db, Author, UserRoles.ScholarshipCoordinator));
    }

    [Fact]
    public async Task An_expired_announcement_is_hidden_from_managers_too()
    {
        using var db = Seeded();
        Post(db, "Last semester's notice", expiresAt: DateTime.UtcNow.AddDays(-1));

        Assert.Empty(await AnnouncementFeed.LoadAsync(db, Author, UserRoles.ScholarshipCoordinator));
    }

    [Fact]
    public async Task A_scholar_never_sees_who_else_was_written_to()
    {
        using var db = Seeded();
        var reader = AddReader(db);
        db.AddScholar("other");
        db.SaveChanges();

        var post = Post(db, "To two people");
        db.AnnouncementRecipients.Add(new AnnouncementRecipient { AnnouncementId = post.Id, ScholarId = reader });
        db.AnnouncementRecipients.Add(new AnnouncementRecipient { AnnouncementId = post.Id, ScholarId = "other" });
        db.SaveChanges();

        var asScholar = Assert.Single(await AnnouncementFeed.LoadAsync(db, reader, UserRoles.Scholar));
        Assert.Empty(asScholar.RecipientIds);
        Assert.Empty(asScholar.RecipientNames);

        var asManager = Assert.Single(await AnnouncementFeed.LoadAsync(db, Author, UserRoles.ScholarshipCoordinator));
        Assert.Equal(2, asManager.RecipientIds.Count);
    }

    [Fact]
    public async Task The_payload_carries_the_audience_ids_the_editor_prefills_from()
    {
        /* It used to carry only the display names. The editor's dropdowns therefore opened
           blank on an existing announcement, and saving it — even after changing nothing but
           the title — posted null for both filters and silently wiped the targeting. */
        using var db = Seeded();
        Post(db, "For CHED / BSCS", typeId: 1, programId: 1);

        var row = Assert.Single(await AnnouncementFeed.LoadAsync(db, Author, UserRoles.ScholarshipCoordinator));

        Assert.Equal(1, row.TargetScholarshipTypeId);
        Assert.Equal(1, row.TargetProgramId);
        Assert.Equal("CHED", row.TargetScholarshipType);
        Assert.Equal("BSCS", row.TargetProgram);
    }
}
