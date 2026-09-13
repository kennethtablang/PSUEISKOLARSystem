namespace PSUEISKOLARSystem.Server.Models.Enums
{
    /// <summary>
    /// How far a deadline has progressed through its notice sequence.
    /// <para>
    /// The sequence used to be a single boolean in disguise — <c>RemindersSentAt</c>, set once
    /// and then filtered on — so a deadline produced exactly one notice, some days out, and
    /// then nothing: no second warning as the date closed in, and no word at all to the
    /// scholar or the office when it passed unmet. For a compliance system the silence after
    /// the date was the more serious half.
    /// </para>
    /// <para>
    /// Stages only ever move forward, and a deadline enters at whichever stage is due when the
    /// sweep first sees it — a deadline recorded after its date goes straight to
    /// <see cref="Missed"/> rather than sending a reminder about a day that has gone.
    /// </para>
    /// </summary>
    public enum DeadlineReminderStage
    {
        /// <summary>Nothing sent yet.</summary>
        None = 0,

        /// <summary>The early warning, <c>SystemSettings.DeadlineReminderDays</c> ahead.</summary>
        Approaching = 1,

        /// <summary>Last call, within <see cref="Services.DeadlineReminderService.FinalNoticeWindow"/> of the due date.</summary>
        Final = 2,

        /// <summary>The date has passed. The scholar is told, and the office gets a digest.</summary>
        Missed = 3,
    }
}
