using PSUEISKOLARSystem.Server.DTOs.Analytics;
using PSUEISKOLARSystem.Server.DTOs.Announcements;

namespace PSUEISKOLARSystem.Server.DTOs.Dashboard
{
    /// <summary>
    /// Everything the dashboard renders, for whichever role asked.
    /// <para>
    /// The page used to assemble this itself out of eleven separate calls — each with its own
    /// auth, its own queries, and its own failure mode — which made the first screen every user
    /// sees the slowest one in the system, and gave it a set of partial states where four cards
    /// loaded and three showed errors. Exactly one of <see cref="Scholar"/> and
    /// <see cref="Staff"/> is populated.
    /// </para>
    /// </summary>
    public sealed record DashboardDto(
        string Role,
        IReadOnlyList<AnnouncementDto> Announcements,
        ScholarDashboardDto? Scholar,
        StaffDashboardDto? Staff);

    /// <param name="Gwa">Null until the scholar has a grade on record.</param>
    /// <param name="Deadlines">
    /// The next three that are still open — future, and not already verified.
    /// </param>
    public sealed record ScholarDashboardDto(
        ComplianceDto Compliance,
        ScholarGwaDto? Gwa,
        IReadOnlyList<UpcomingDeadlineDto> Deadlines);

    public sealed record ComplianceDto(
        int TotalRequired,
        int VerifiedCount,
        int PendingCount,
        IReadOnlyList<string> IncompleteItems,
        string? ScholarshipTypeName,
        string AcademicYear,
        int Semester,
        IReadOnlyList<DocumentTrackDto>? Documents = null);

    /// <summary>
    /// One document on the scholar's checklist for the active period, for the tracker on the
    /// dashboard: where it stands (null when nothing was submitted) and whether its deadline
    /// passed with nothing submitted — in which case uploading is locked.
    /// </summary>
    public sealed record DocumentTrackDto(
        int RequirementId,
        string Name,
        bool IsRequired,
        string? Status,
        DateTime? SubmittedAt,
        DateTime? ReviewedAt,
        string? FeedbackNote,
        DateTime? DueDate,
        bool Missed);

    public sealed record ScholarGwaDto(
        decimal LatestGwa,
        decimal? MinimumGwa,
        string? ScholarshipTypeName,
        bool MeetsRequirement);

    public sealed record UpcomingDeadlineDto(
        int Id,
        int RequirementId,
        string RequirementName,
        DateTime DueDate);

    /// <param name="Coordinators">Active coordinator headcount. Administrators only.</param>
    /// <param name="RenewalCount">Scholars sitting in Lapsed or Suspended, i.e. needing a decision.</param>
    public sealed record StaffDashboardDto(
        OverviewDto Overview,
        int? Coordinators,
        int RenewalCount,
        int PendingApprovals,
        GrantSummaryDto Grants,
        IReadOnlyList<ActivityEntryDto> Activity);

    public sealed record GrantSummaryDto(
        int TotalGrants,
        decimal TotalAmount,
        int PendingCount,
        decimal PendingAmount,
        int ReleasedCount,
        decimal ReleasedAmount,
        int CancelledCount);

    public sealed record ActivityEntryDto(
        int Id,
        string UserName,
        string Action,
        string? Details,
        DateTime TimestampUtc);
}
