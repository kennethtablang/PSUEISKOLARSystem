using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// Facts that applied migrations have already baked into raw SQL.
/// <para>
/// A migration is immutable history: once it has run against a database, its SQL cannot be
/// corrected. So where a migration writes an enum's <i>numeric</i> value rather than its name,
/// reordering that enum silently changes what the already-applied SQL meant — and nothing
/// fails, it just quietly means something else. These tests are the tripwire.
/// </para>
/// </summary>
public class MigrationAssumptionTests
{
    [Fact]
    public void Document_status_numbers_are_fixed_by_AddIntegrityIndexes()
    {
        /* 20260805195721_AddIntegrityIndexes reconciles duplicate submissions with
               WHERE Status <> 2  …  UPDATE … SET Status = 2
           and the filtered unique index it creates carries the same literal. Renumbering
           DocumentStatus would leave that index filtering on the wrong state and the
           reconciliation having marked rows with a status nobody meant. */
        Assert.Equal(0, (int)DocumentStatus.Pending);
        Assert.Equal(1, (int)DocumentStatus.Verified);
        Assert.Equal(2, (int)DocumentStatus.Incomplete);
    }

    [Fact]
    public void Deadline_reminder_stage_numbers_are_fixed_by_AddDeadlineReminderStage()
    {
        /* 20260806004339_AddDeadlineReminderStage backfills
               UPDATE SubmissionDeadlines SET ReminderStage = 1 WHERE RemindersSentAt IS NOT NULL
           to mean "the early warning already went out". The sweep also compares stages with
           `<`, so the order carries meaning beyond the names. */
        Assert.Equal(0, (int)DeadlineReminderStage.None);
        Assert.Equal(1, (int)DeadlineReminderStage.Approaching);
        Assert.Equal(2, (int)DeadlineReminderStage.Final);
        Assert.Equal(3, (int)DeadlineReminderStage.Missed);

        Assert.True(DeadlineReminderStage.None < DeadlineReminderStage.Approaching);
        Assert.True(DeadlineReminderStage.Approaching < DeadlineReminderStage.Final);
        Assert.True(DeadlineReminderStage.Final < DeadlineReminderStage.Missed);
    }
}
