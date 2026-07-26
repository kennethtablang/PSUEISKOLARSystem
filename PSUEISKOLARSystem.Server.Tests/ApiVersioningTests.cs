using System.Reflection;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using PSUEISKOLARSystem.Server.Infrastructure;
using Xunit;

namespace PSUEISKOLARSystem.Server.Tests;

// Covers the convention that gives every api/… route a canonical api/v1/… twin.
public class ApiVersioningTests
{
    private static ControllerModel ControllerWith(params string[] templates)
    {
        var controller = new ControllerModel(typeof(ApiVersioningTests).GetTypeInfo(), []);
        foreach (var template in templates)
        {
            controller.Selectors.Add(new SelectorModel
            {
                AttributeRouteModel = new AttributeRouteModel { Template = template },
            });
        }
        return controller;
    }

    private static List<string?> Apply(params string[] templates)
    {
        var controller = ControllerWith(templates);
        var application = new ApplicationModel();
        application.Controllers.Add(controller);

        new ApiVersioning.RouteConvention().Apply(application);

        return controller.Selectors.Select(s => s.AttributeRouteModel?.Template).ToList();
    }

    [Fact]
    public void A_versioned_alias_is_added_alongside_the_original_route()
    {
        var templates = Apply("api/scholars");

        Assert.Contains("api/scholars", templates);
        Assert.Contains("api/v1/scholars", templates);
        Assert.Equal(2, templates.Count);
    }

    [Fact]
    public void Route_tokens_survive_so_they_can_still_be_expanded()
    {
        Assert.Contains("api/v1/[controller]", Apply("api/[controller]"));
    }

    [Fact]
    public void An_already_versioned_route_is_left_alone()
    {
        // Guards against a v2 controller silently gaining a duplicate v1 route.
        var templates = Apply("api/v1/scholars");

        Assert.Single(templates);
    }

    [Fact]
    public void Routes_outside_the_api_prefix_are_ignored()
    {
        var templates = Apply("hubs/notifications");

        Assert.Single(templates);
    }

    [Fact]
    public void Every_versioned_alias_is_unique_so_routing_cannot_become_ambiguous()
    {
        var templates = Apply("api/scholars", "api/users");

        Assert.Equal(templates.Count, templates.Distinct().Count());
    }
}
