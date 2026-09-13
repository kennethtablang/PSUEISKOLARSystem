namespace PSUEISKOLARSystem.Server.DTOs
{
    /// <summary>
    /// One page of a list, in the shape every paged endpoint returns.
    /// <para>
    /// This was written out as an anonymous object seven times, and the copies had already
    /// drifted: five carried <c>totalPages</c> and two did not, so the Users and Activity Log
    /// pages each recomputed it in the browser. The page-count arithmetic — with its
    /// division-by-zero and its rounding — now exists once.
    /// </para>
    /// </summary>
    public sealed record PagedResult<T>(
        int Total,
        int Page,
        int PageSize,
        int TotalPages,
        IReadOnlyList<T> Items)
    {
        /// <summary>
        /// Wraps a page of items, deriving <see cref="TotalPages"/>. An empty list still
        /// reports one page, so a caller rendering "Page 1 of 0" is not possible.
        /// </summary>
        public static PagedResult<T> From(IReadOnlyList<T> items, int total, int page, int pageSize) =>
            new(total, page, pageSize, PageCount(total, pageSize), items);

        public static int PageCount(int total, int pageSize) =>
            pageSize <= 0 ? 1 : Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
    }
}
