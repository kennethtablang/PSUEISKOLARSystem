using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PSUEISKOLARSystem.Server.DTOs.Dashboard;
using PSUEISKOLARSystem.Server.Models.Enums;
using PSUEISKOLARSystem.Server.Services;

namespace PSUEISKOLARSystem.Server.Controllers
{
    /// <summary>
    /// The whole dashboard in one response, shaped for the caller's role.
    /// <para>
    /// The role is taken from the token, not from a query parameter: a dashboard is a view of
    /// what <i>you</i> are entitled to see, and letting the client name the role would be an
    /// invitation to ask for the administrator's.
    /// </para>
    /// </summary>
    [ApiController]
    [Route("api/dashboard")]
    [Authorize]
    public class DashboardController(DashboardQueries dashboard) : ControllerBase
    {
        [HttpGet]
        public async Task<ActionResult<DashboardDto>> Get(CancellationToken ct)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var role = User.FindFirstValue(ClaimTypes.Role) ?? UserRoles.Scholar;

            return role is UserRoles.Administrator or UserRoles.ScholarshipCoordinator
                ? Ok(await dashboard.ForStaffAsync(userId, role, ct))
                : Ok(await dashboard.ForScholarAsync(userId, role, ct));
        }
    }
}
