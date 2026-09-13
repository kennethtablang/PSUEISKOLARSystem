namespace PSUEISKOLARSystem.Server.Models.Enums
{
    /// <summary>
    /// Where a scholar stands in their scholarship (FR-18).
    /// <para>
    /// This was previously an inline <c>new[] { … }</c> in the one endpoint that set it, and
    /// nothing else consulted it — the status was displayed and filtered on but never gated
    /// anything. A Graduated scholar therefore kept occupying a slot, kept having payouts
    /// generated for them at every period rollover, and kept receiving deadline reminders;
    /// suspending a scholar had no effect on anything at all.
    /// </para>
    /// <see cref="Holding"/> is the predicate those three call sites now go through.
    /// </summary>
    public static class LifecycleStatuses
    {
        /// <summary>Currently on the scholarship.</summary>
        public const string Active = "Active";

        /// <summary>Renewed for another term — still on the scholarship.</summary>
        public const string Renewed = "Renewed";

        /// <summary>Fell out of the scholarship (missed requirements, GWA, or enrolment).</summary>
        public const string Lapsed = "Lapsed";

        /// <summary>Temporarily held, pending a decision. Not paid, not chased for documents.</summary>
        public const string Suspended = "Suspended";

        /// <summary>Finished their programme. The slot is free.</summary>
        public const string Graduated = "Graduated";

        public static readonly string[] All = [Active, Renewed, Lapsed, Suspended, Graduated];

        /// <summary>
        /// Statuses that count as holding the scholarship: the scholar occupies a slot, is
        /// included when releases are generated, and is expected to keep submitting documents.
        /// Everything else has left it, one way or another.
        /// </summary>
        public static readonly string[] Holding = [Active, Renewed];

        public static bool IsHolding(string? status) =>
            // A profile row that predates the field, or one left blank, is treated as Active —
            // the default the column itself carries.
            string.IsNullOrWhiteSpace(status) || Array.IndexOf(Holding, status) >= 0;

        public static bool IsKnown(string? status) =>
            status is not null && Array.IndexOf(All, status) >= 0;
    }
}
