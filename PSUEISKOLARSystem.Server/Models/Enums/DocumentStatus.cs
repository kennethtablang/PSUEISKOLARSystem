namespace PSUEISKOLARSystem.Server.Models.Enums
{
    /// <summary>
    /// Where a submitted document stands. The values are stored as numbers, so the order is
    /// fixed: <see cref="Rejected"/> was called Incomplete (same value, 2) and
    /// <see cref="UnderReview"/> was added after it.
    /// <para>
    /// The scholar follows a document along Submitted (Pending) → Under review → Verified, or
    /// → Rejected, after which it needs to be resubmitted.
    /// </para>
    /// </summary>
    public enum DocumentStatus
    {
        /// <summary>Submitted, not yet opened by the office.</summary>
        Pending = 0,

        Verified = 1,

        /// <summary>Not accepted; the scholar has to resubmit. Formerly "Incomplete".</summary>
        Rejected = 2,

        /// <summary>The office has opened it and is deciding.</summary>
        UnderReview = 3,
    }

    public static class DocumentStatuses
    {
        /// <summary>Still waiting on a decision — submitted or being reviewed.</summary>
        public static bool AwaitingDecision(DocumentStatus s) => s is DocumentStatus.Pending or DocumentStatus.UnderReview;

        /// <summary>Reads a status from the API, accepting the old name "Incomplete" for Rejected.</summary>
        public static bool TryParse(string? raw, out DocumentStatus status)
        {
            if (string.Equals(raw?.Trim(), "Incomplete", StringComparison.OrdinalIgnoreCase))
            {
                status = DocumentStatus.Rejected;
                return true;
            }
            return Enum.TryParse(raw?.Trim(), true, out status) && Enum.IsDefined(status);
        }
    }
}
