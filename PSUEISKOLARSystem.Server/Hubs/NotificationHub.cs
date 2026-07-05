using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace PSUEISKOLARSystem.Server.Hubs
{
    // Real-time push channel (FR-13, NFR-2.6). Clients connect with their JWT;
    // the default IUserIdProvider maps connections to the NameIdentifier claim,
    // so NotificationService can target a specific user via Clients.User(userId).
    [Authorize]
    public class NotificationHub : Hub
    {
    }
}
