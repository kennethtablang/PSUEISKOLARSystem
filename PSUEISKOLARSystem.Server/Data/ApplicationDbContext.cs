using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using PSUEISKOLARSystem.Server.Models;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Data
{
    public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : IdentityDbContext<ApplicationUser>(options)
    {
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
        public DbSet<ScholarshipType> ScholarshipTypes => Set<ScholarshipType>();
        public DbSet<AcademicProgram> AcademicPrograms => Set<AcademicProgram>();
        public DbSet<ScholarProfile> ScholarProfiles => Set<ScholarProfile>();
        public DbSet<AcademicGrade> AcademicGrades => Set<AcademicGrade>();
        public DbSet<Announcement> Announcements => Set<Announcement>();
        public DbSet<DocumentRequirement> DocumentRequirements => Set<DocumentRequirement>();
        public DbSet<DocumentSubmission> DocumentSubmissions => Set<DocumentSubmission>();
        public DbSet<ActiveSemester> ActiveSemesters => Set<ActiveSemester>();
        public DbSet<ScholarshipTypeRequirement> ScholarshipTypeRequirements => Set<ScholarshipTypeRequirement>();
        public DbSet<DocumentStatusHistory> DocumentStatusHistories => Set<DocumentStatusHistory>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<SubmissionDeadline> SubmissionDeadlines => Set<SubmissionDeadline>();
        public DbSet<Message> Messages => Set<Message>();
        public DbSet<ScholarshipAssignment> ScholarshipAssignments => Set<ScholarshipAssignment>();
        public DbSet<OneTimeGrant> OneTimeGrants => Set<OneTimeGrant>();
        public DbSet<ScholarshipRelease> ScholarshipReleases => Set<ScholarshipRelease>();
        public DbSet<AnnouncementRecipient> AnnouncementRecipients => Set<AnnouncementRecipient>();
        public DbSet<MessagingSettings> MessagingSettings => Set<MessagingSettings>();
        public DbSet<SystemSettings> SystemSettings => Set<SystemSettings>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<ScholarProfile>()
                .HasOne(sp => sp.User)
                .WithOne()
                .HasForeignKey<ScholarProfile>(sp => sp.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<ScholarProfile>()
                .HasOne(sp => sp.ScholarshipType)
                .WithMany(st => st.Scholars)
                .HasForeignKey(sp => sp.ScholarshipTypeId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<ScholarProfile>()
                .HasOne(sp => sp.Program)
                .WithMany(p => p.Scholars)
                .HasForeignKey(sp => sp.ProgramId)
                .OnDelete(DeleteBehavior.SetNull);

            /* A student number identifies exactly one scholar. This was checked in application
               code only, which races: two concurrent PUTs with the same number both passed the
               check and both committed. The Scholarship Check report exists partly to *detect*
               that corruption — it has one less finding to make now.

               Filtered, because a profile row is created before onboarding fills the number in
               and several of those legitimately share the empty string. */
            builder.Entity<ScholarProfile>()
                .HasIndex(sp => sp.StudentId)
                .HasFilter("[StudentId] <> ''")
                .IsUnique();

            builder.Entity<AcademicGrade>()
                .HasOne(g => g.ScholarProfile)
                .WithMany(sp => sp.Grades)
                .HasForeignKey(g => g.ScholarProfileId)
                .OnDelete(DeleteBehavior.Cascade);

            /* One GWA per scholar per period. Without this, a semester recorded twice left
               every compliance figure resting on
               `OrderByDescending(AcademicYear).ThenByDescending(Semester).First()`, which is
               undefined between two rows in the same period — MeetsRequirement could flip
               between page loads. Correcting a grade is now a PATCH, not a second insert. */
            builder.Entity<AcademicGrade>()
                .HasIndex(g => new { g.ScholarProfileId, g.AcademicYear, g.Semester })
                .IsUnique();

            builder.Entity<AcademicGrade>()
                .HasOne(g => g.RecordedBy)
                .WithMany()
                .HasForeignKey(g => g.RecordedById)
                .OnDelete(DeleteBehavior.ClientSetNull);

            builder.Entity<Announcement>()
                .HasOne(a => a.CreatedBy)
                .WithMany()
                .HasForeignKey(a => a.CreatedById)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Announcement>()
                .HasOne(a => a.TargetScholarshipType)
                .WithMany()
                .HasForeignKey(a => a.TargetScholarshipTypeId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<Announcement>()
                .HasOne(a => a.TargetProgram)
                .WithMany()
                .HasForeignKey(a => a.TargetProgramId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<ScholarshipType>()
                .Property(st => st.MinimumGwa)
                .HasPrecision(3, 2);

            builder.Entity<AcademicGrade>()
                .Property(g => g.Gwa)
                .HasPrecision(3, 2);

            builder.Entity<DocumentRequirement>()
                .HasOne(dr => dr.ScholarshipType)
                .WithMany()
                .HasForeignKey(dr => dr.ScholarshipTypeId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<DocumentSubmission>()
                .HasOne(ds => ds.Scholar)
                .WithMany()
                .HasForeignKey(ds => ds.ScholarId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<DocumentSubmission>()
                .HasOne(ds => ds.Requirement)
                .WithMany(dr => dr.Submissions)
                .HasForeignKey(ds => ds.RequirementId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<DocumentSubmission>()
                .HasOne(ds => ds.ReviewedBy)
                .WithMany()
                .HasForeignKey(ds => ds.ReviewedById)
                .OnDelete(DeleteBehavior.ClientSetNull);

            /* One live submission per requirement per period — the invariant Upload has always
               described in a comment and enforced with a chain of `if`s. Incomplete rows are
               excluded because a rejected attempt is kept as history and the scholar is
               expected to submit again alongside it, which is why the filter matches the
               `Status != Incomplete` predicate Upload uses to find the existing row. */
            builder.Entity<DocumentSubmission>()
                .HasIndex(ds => new { ds.ScholarId, ds.RequirementId, ds.AcademicYear, ds.Semester })
                .HasFilter($"[Status] <> {(int)DocumentStatus.Incomplete}")
                .IsUnique();

            // The largest table in the system, and analytics, the deadline report, and every
            // per-scholar checklist all filter on these two.
            builder.Entity<DocumentSubmission>()
                .HasIndex(ds => new { ds.ScholarId, ds.Status });

            builder.Entity<DocumentSubmission>()
                .HasIndex(ds => new { ds.AcademicYear, ds.Semester, ds.Status });

            builder.Entity<ActiveSemester>()
                .HasOne(a => a.UpdatedBy)
                .WithMany()
                .HasForeignKey(a => a.UpdatedById)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<ScholarshipTypeRequirement>()
                .HasKey(str => new { str.ScholarshipTypeId, str.RequirementId });

            builder.Entity<ScholarshipTypeRequirement>()
                .HasOne(str => str.ScholarshipType)
                .WithMany(st => st.Requirements)
                .HasForeignKey(str => str.ScholarshipTypeId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<ScholarshipTypeRequirement>()
                .HasOne(str => str.Requirement)
                .WithMany(dr => dr.ScholarshipTypes)
                .HasForeignKey(str => str.RequirementId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<DocumentStatusHistory>()
                .HasOne(h => h.Submission)
                .WithMany(ds => ds.StatusHistory)
                .HasForeignKey(h => h.SubmissionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<DocumentStatusHistory>()
                .HasOne(h => h.ChangedBy)
                .WithMany()
                .HasForeignKey(h => h.ChangedById)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Notification>()
                .HasOne(n => n.Recipient)
                .WithMany()
                .HasForeignKey(n => n.RecipientId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<Notification>()
                .HasIndex(n => new { n.RecipientId, n.IsRead });

            // ActivityLogPage pages over this newest-first, optionally filtered by actor.
            builder.Entity<AuditLog>()
                .HasIndex(a => new { a.UserId, a.TimestampUtc });

            builder.Entity<AuditLog>()
                .HasIndex(a => a.TimestampUtc);

            builder.Entity<SubmissionDeadline>()
                .HasOne(d => d.Requirement)
                .WithMany()
                .HasForeignKey(d => d.RequirementId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<SubmissionDeadline>()
                .HasOne(d => d.CreatedBy)
                .WithMany()
                .HasForeignKey(d => d.CreatedById)
                .OnDelete(DeleteBehavior.SetNull);

            // One deadline per requirement per academic period.
            builder.Entity<SubmissionDeadline>()
                .HasIndex(d => new { d.RequirementId, d.AcademicYear, d.Semester })
                .IsUnique();

            // Two FKs to ApplicationUser → Restrict to avoid multiple cascade paths.
            builder.Entity<Message>()
                .HasOne(m => m.Scholar)
                .WithMany()
                .HasForeignKey(m => m.ScholarId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Message>()
                .HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Message>()
                .HasOne(m => m.Requirement)
                .WithMany()
                .HasForeignKey(m => m.RequirementId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<Message>()
                .HasIndex(m => new { m.ScholarId, m.RequirementId });

            /* ── Scholarship assignment history (strictly one active per scholar) ── */

            builder.Entity<ScholarshipAssignment>()
                .HasOne(a => a.Scholar)
                .WithMany()
                .HasForeignKey(a => a.ScholarId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<ScholarshipAssignment>()
                .HasOne(a => a.ScholarshipType)
                .WithMany()
                .HasForeignKey(a => a.ScholarshipTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            // Actor FKs are nulled out before a user is deleted (see UsersController.Delete)
            // to avoid multiple cascade paths into ApplicationUser.
            builder.Entity<ScholarshipAssignment>()
                .HasOne(a => a.AssignedBy)
                .WithMany()
                .HasForeignKey(a => a.AssignedById)
                .OnDelete(DeleteBehavior.ClientSetNull);

            // The single-active-scholarship rule, enforced in the database.
            builder.Entity<ScholarshipAssignment>()
                .HasIndex(a => a.ScholarId)
                .HasFilter("[EndedAt] IS NULL")
                .IsUnique();

            builder.Entity<ScholarshipAssignment>()
                .HasIndex(a => new { a.ScholarId, a.AssignedAt });

            /* ── One-time grants ── */

            builder.Entity<OneTimeGrant>()
                .HasOne(g => g.Scholar)
                .WithMany()
                .HasForeignKey(g => g.ScholarId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<OneTimeGrant>()
                .HasOne(g => g.RecordedBy)
                .WithMany()
                .HasForeignKey(g => g.RecordedById)
                .OnDelete(DeleteBehavior.ClientSetNull);

            builder.Entity<OneTimeGrant>()
                .Property(g => g.Amount)
                .HasPrecision(12, 2);

            builder.Entity<OneTimeGrant>()
                .HasIndex(g => new { g.ScholarId, g.AwardedOn });

            // Restrict, not Cascade: a type that has paid out grants is part of the
            // disbursement record and must not disappear with them.
            builder.Entity<OneTimeGrant>()
                .HasOne(g => g.ScholarshipType)
                .WithMany()
                .HasForeignKey(g => g.ScholarshipTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<ScholarshipType>()
                .Property(t => t.Amount)
                .HasPrecision(12, 2);

            /* ── Recurring scholarship releases (per semester / per year) ── */

            builder.Entity<ScholarshipRelease>()
                .HasOne(r => r.Scholar)
                .WithMany()
                .HasForeignKey(r => r.ScholarId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<ScholarshipRelease>()
                .HasOne(r => r.ScholarshipType)
                .WithMany()
                .HasForeignKey(r => r.ScholarshipTypeId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<ScholarshipRelease>()
                .HasOne(r => r.RecordedBy)
                .WithMany()
                .HasForeignKey(r => r.RecordedById)
                .OnDelete(DeleteBehavior.ClientSetNull);

            builder.Entity<ScholarshipRelease>()
                .Property(r => r.Amount)
                .HasPrecision(12, 2);

            // One payout per scholar, per scholarship, per period — the rule that keeps the
            // monitor honest. A double release has to be a deliberate edit, not a stray insert.
            builder.Entity<ScholarshipRelease>()
                .HasIndex(r => new { r.ScholarId, r.ScholarshipTypeId, r.AcademicYear, r.Semester })
                .IsUnique();

            builder.Entity<ScholarshipRelease>()
                .HasIndex(r => new { r.ScholarshipTypeId, r.AcademicYear, r.Semester });

            /* ── Per-scholar announcement recipients ── */

            builder.Entity<AnnouncementRecipient>()
                .HasKey(r => new { r.AnnouncementId, r.ScholarId });

            builder.Entity<AnnouncementRecipient>()
                .HasOne(r => r.Announcement)
                .WithMany(a => a.Recipients)
                .HasForeignKey(r => r.AnnouncementId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<AnnouncementRecipient>()
                .HasOne(r => r.Scholar)
                .WithMany()
                .HasForeignKey(r => r.ScholarId)
                .OnDelete(DeleteBehavior.Cascade);

            /* ── System settings (single row) ── */

            builder.Entity<SystemSettings>()
                .HasOne(s => s.UpdatedBy)
                .WithMany()
                .HasForeignKey(s => s.UpdatedById)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<SystemSettings>()
                .Property(s => s.DefaultMinimumGwa)
                .HasPrecision(4, 2);

            /* ── Messaging settings (single row) ── */

            builder.Entity<MessagingSettings>()
                .HasOne(s => s.UpdatedBy)
                .WithMany()
                .HasForeignKey(s => s.UpdatedById)
                .OnDelete(DeleteBehavior.SetNull);

            MarkDateTimesAsUtc(builder);
        }

        /// <summary>
        /// Every timestamp this system writes is UTC (<c>DateTime.UtcNow</c>, or an ISO string
        /// with a <c>Z</c> from the client), but SQL Server's <c>datetime2</c> keeps no kind, so
        /// values came back as <see cref="DateTimeKind.Unspecified"/> and were serialised with
        /// no offset — <c>"2026-01-15T00:00:00"</c>. Browsers read that as <i>local</i> time, so
        /// in Manila every stored timestamp displayed eight hours early: a notification from a
        /// minute ago read "8h ago", and a freshly created record showed a different time from
        /// the same record reloaded. Stamping the kind on read makes the API emit the <c>Z</c>.
        /// <para>
        /// <c>ScholarProfile.BirthDate</c> is excluded: it is a calendar date, not an instant,
        /// and must not move with the viewer's time zone.
        /// </para>
        /// </summary>
        private static void MarkDateTimesAsUtc(ModelBuilder builder)
        {
            var utc = new ValueConverter<DateTime, DateTime>(
                v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v,
                v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

            var utcNullable = new ValueConverter<DateTime?, DateTime?>(
                v => v.HasValue && v.Value.Kind == DateTimeKind.Local ? v.Value.ToUniversalTime() : v,
                v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

            foreach (var entity in builder.Model.GetEntityTypes())
            {
                foreach (var property in entity.GetProperties())
                {
                    if (entity.ClrType == typeof(ScholarProfile) && property.Name == nameof(ScholarProfile.BirthDate))
                        continue;

                    if (property.ClrType == typeof(DateTime))
                        property.SetValueConverter(utc);
                    else if (property.ClrType == typeof(DateTime?))
                        property.SetValueConverter(utcNullable);
                }
            }
        }
    }
}
