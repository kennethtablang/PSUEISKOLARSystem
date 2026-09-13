using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;
using Xunit;

namespace PSUEISKOLARSystem.Server.Tests;

/// <summary>
/// The escalation rule behind deadline notices. A deadline used to send one notice and then
/// go quiet forever — including when it passed unmet — so what is pinned here is that the
/// stage is decided by the date alone, and that the sweep can never send the same notice
/// twice or walk a deadline backwards.
/// </summary>
public class DeadlineReminderStageTests
{
    private static readonly DateTime Now = new(2026, 3, 10, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Far_from_the_date_it_is_the_early_warning()
    {
        Assert.Equal(
            DeadlineReminderStage.Approaching,
            DeadlineReminderService.StageDueFor(Now.AddDays(3), Now));
    }

    [Fact]
    public void Within_a_day_it_escalates_to_the_last_call()
    {
        Assert.Equal(
            DeadlineReminderStage.Final,
            DeadlineReminderService.StageDueFor(Now.AddHours(20), Now));
    }

    [Fact]
    public void Exactly_at_the_final_window_is_still_the_last_call()
    {
        Assert.Equal(
            DeadlineReminderStage.Final,
            DeadlineReminderService.StageDueFor(Now + DeadlineReminderService.FinalNoticeWindow, Now));
    }

    [Fact]
    public void Once_the_date_passes_it_is_a_missed_notice()
    {
        Assert.Equal(
            DeadlineReminderStage.Missed,
            DeadlineReminderService.StageDueFor(Now.AddMinutes(-1), Now));
    }

    [Fact]
    public void A_deadline_recorded_after_its_date_goes_straight_to_missed()
    {
        // No point telling someone a requirement is "due in -40 days": a backfilled deadline
        // skips the reminders it can no longer usefully send.
        Assert.Equal(
            DeadlineReminderStage.Missed,
            DeadlineReminderService.StageDueFor(Now.AddDays(-40), Now));
    }

    [Theory]
    [InlineData(DeadlineReminderStage.Approaching)]
    [InlineData(DeadlineReminderStage.Final)]
    [InlineData(DeadlineReminderStage.Missed)]
    public void A_stage_already_sent_is_not_sent_again(DeadlineReminderStage recorded)
    {
        // The sweep's guard is `stage <= recorded → skip`. Running the pass twice in a row
        // against an unchanged clock must therefore be a no-op the second time.
        var dueDate = recorded switch
        {
            DeadlineReminderStage.Approaching => Now.AddDays(3),
            DeadlineReminderStage.Final => Now.AddHours(6),
            _ => Now.AddDays(-2),
        };

        var stage = DeadlineReminderService.StageDueFor(dueDate, Now);

        Assert.Equal(recorded, stage);
        Assert.False(stage > recorded, "the pass would have re-sent a notice it had already sent");
    }

    [Fact]
    public void Stages_only_ever_move_forward_as_the_date_approaches()
    {
        var due = Now.AddDays(5);

        var early = DeadlineReminderService.StageDueFor(due, due.AddDays(-5));
        var late = DeadlineReminderService.StageDueFor(due, due.AddHours(-2));
        var after = DeadlineReminderService.StageDueFor(due, due.AddHours(1));

        Assert.True(early < late);
        Assert.True(late < after);
    }
}
