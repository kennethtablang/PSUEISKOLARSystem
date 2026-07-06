using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using PSUEISKOLARSystem.Server.Models.Enums;

namespace PSUEISKOLARSystem.Server.Hubs
{
    // Real-time push channel (FR-13, NFR-2.6). Clients connect with their JWT;
    // the default IUserIdProvider maps connections to the NameIdentifier claim,
    // so NotificationService can target a specific user via Clients.User(userId).
    [Authorize]
    public class NotificationHub : Hub
    {
        // Staff (admins + coordinators) join this group so staff-only broadcasts
        // such as "AnalyticsChanged" aren't fanned out to scholar clients.
        public const string StaffGroup = "staff";

        public override async Task OnConnectedAsync()
        {
            if (Context.User is { } user &&
                (user.IsInRole(UserRoles.Administrator) || user.IsInRole(UserRoles.ScholarshipCoordinator)))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, StaffGroup);
            }
            await base.OnConnectedAsync();
        }
    }
}
