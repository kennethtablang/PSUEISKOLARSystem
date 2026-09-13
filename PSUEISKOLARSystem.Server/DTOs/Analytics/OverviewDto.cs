namespace PSUEISKOLARSystem.Server.DTOs.Analytics
{
    /// <summary>
    /// The scholar-and-submission snapshot behind the Data Visualization page and the staff
    /// dashboard. Typed rather than anonymous so both callers are provably reading the same
    /// shape, and so Swagger documents it as something other than <c>object</c>.
    /// </summary>
    /// <param name="NoGwa">Scholars with no grade on record — neither compliant nor flagged.</param>
    /// <param name="AvailablePeriods">
    /// Every period that has submissions, computed <i>before</i> the period filter so the
    /// dropdown that drives the filter does not empty itself out when one is chosen.
    /// </param>
    public sealed record OverviewDto(
        int TotalScholars,
        int Compliant,
        int NonCompliant,
        int NoGwa,
        IReadOnlyList<ProgramCountDto> ByProgram,
        IReadOnlyList<ScholarshipTypeCountDto> ByScholarshipType,
        SubmissionCountsDto Submissions,
        IReadOnlyList<PeriodSubmissionsDto> ByPeriod,
        IReadOnlyList<PeriodOptionDto> AvailablePeriods);

    public sealed record ProgramCountDto(string Program, int Count);

    public sealed record ScholarshipTypeCountDto(string Type, int Count);

    public sealed record SubmissionCountsDto(int Total, int Verified, int Pending, int Incomplete);

    public sealed record PeriodSubmissionsDto(string Period, int Total, int Verified, int Pending, int Incomplete);

    public sealed record PeriodOptionDto(string AcademicYear, int Semester, string Label);
}
