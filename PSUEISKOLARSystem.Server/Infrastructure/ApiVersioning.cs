using Microsoft.AspNetCore.Mvc.ApplicationModels;

namespace PSUEISKOLARSystem.Server.Infrastructure
{
    /// <summary>
    /// URL-segment API versioning without touching a single controller.
    /// <para>
    /// Every <c>api/…</c> route gains a <c>api/v1/…</c> twin, so <c>/api/v1/scholars</c> is the
    /// canonical, documented address while the original <c>/api/scholars</c> keeps working for
    /// the SPA and any bookmarked integration. When a breaking change is needed, add a v2
    /// controller under <c>api/v2/…</c>; v1 callers are unaffected, and the unversioned
    /// aliases can then be retired on a published date without a flag day.
    /// </para>
    /// </summary>
    public static class ApiVersioning
    {
        public const string CurrentVersion = "v1";
        public const string Prefix = "api/" + CurrentVersion + "/";

        private const string LegacyPrefix = "api/";

        public class RouteConvention : IApplicationModelConvention
        {
            public void Apply(ApplicationModel application)
            {
                foreach (var controller in application.Controllers)
                {
                    foreach (var selector in controller.Selectors.ToList())
                    {
                        var template = selector.AttributeRouteModel?.Template;
                        if (template is null) continue;
                        if (!template.StartsWith(LegacyPrefix, StringComparison.OrdinalIgnoreCase)) continue;
                        if (template.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase)) continue;

                        // A copy of the existing selector, re-pointed at the versioned path.
                        // [controller]/[action] tokens survive — they are expanded later.
                        controller.Selectors.Add(new SelectorModel(selector)
                        {
                            AttributeRouteModel = new AttributeRouteModel
                            {
                                Template = Prefix + template[LegacyPrefix.Length..],
                            },
                        });
                    }
                }
            }
        }
    }
}
