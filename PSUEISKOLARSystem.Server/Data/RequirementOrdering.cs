using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Data
{
    /// <summary>
    /// The one definition of how a document checklist is ordered, so the admin catalog, the
    /// scholarship-type editor, and the scholar's own checklist all agree.
    /// <para>
    /// Grouped documents come first in group name order (ungrouped fall to the bottom under
    /// "Other"), then the admin's explicit <see cref="DocumentRequirement.DisplayOrder"/>,
    /// then required before optional, and finally name so the order is never arbitrary.
    /// </para>
    /// </summary>
    public static class RequirementOrdering
    {
        public static IOrderedQueryable<DocumentRequirement> InDisplayOrder(this IQueryable<DocumentRequirement> source) =>
            source.OrderBy(dr => dr.GroupName == null)
                  .ThenBy(dr => dr.GroupName)
                  .ThenBy(dr => dr.DisplayOrder)
                  .ThenBy(dr => dr.IsRequired ? 0 : 1)
                  .ThenBy(dr => dr.Name);

        public static IOrderedEnumerable<DocumentRequirement> InDisplayOrder(this IEnumerable<DocumentRequirement> source) =>
            source.OrderBy(dr => dr.GroupName == null)
                  .ThenBy(dr => dr.GroupName, StringComparer.OrdinalIgnoreCase)
                  .ThenBy(dr => dr.DisplayOrder)
                  .ThenBy(dr => dr.IsRequired ? 0 : 1)
                  .ThenBy(dr => dr.Name, StringComparer.OrdinalIgnoreCase);

        /// <summary>Heading shown for requirements the admin has not put in a group.</summary>
        public const string UngroupedLabel = "Other documents";
    }
}
