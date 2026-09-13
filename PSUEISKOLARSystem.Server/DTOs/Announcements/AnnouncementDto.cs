namespace PSUEISKOLARSystem.Server.DTOs.Announcements
{
    /// <summary>
    /// One announcement as the client renders it. Shared by the Announcements page and the
    /// dashboard feed so the two cannot disagree about the shape.
    /// </summary>
    /// <param name="TargetScholarshipTypeId">
    /// The audience filters carry their ids as well as their names because the editor prefills
    /// from this payload. Sending only the names meant the dropdowns opened blank on an
    /// existing announcement, and saving it — even after changing nothing but the title —
    /// posted null for both and silently wiped the targeting. Not a disclosure: the
    /// corresponding names are already here.
    /// </param>
    /// <param name="RecipientIds">
    /// Empty for scholars — the named audience is management information, and a scholar being
    /// able to read off who else was written to is a disclosure, not a feature.
    /// </param>
    public sealed record AnnouncementDto(
        int Id,
        string Title,
        string Content,
        string? TargetRole,
        int? TargetScholarshipTypeId,
        string? TargetScholarshipType,
        int? TargetProgramId,
        string? TargetProgram,
        DateTime? ExpiresAt,
        DateTime? PublishAt,
        bool IsScheduled,
        string? IntentAction,
        bool HasImage,
        DateTime CreatedAt,
        IReadOnlyList<string> RecipientIds,
        IReadOnlyList<string> RecipientNames,
        int RecipientCount,
        string CreatedBy);
}
