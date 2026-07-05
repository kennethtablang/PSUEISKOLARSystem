using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Data
{
    public static class AuditExtensions
    {
        // Queues an audit entry for the acting user. The caller's SaveChangesAsync persists it,
        // so it commits in the same transaction as the operation being recorded.
        public static void Audit(this ApplicationDbContext db, ControllerBase controller, string action, string details)
        {
            var userId = controller.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "system";
            db.AuditLogs.Add(new AuditLog { UserId = userId, Action = action, Details = details });
        }
    }
}
