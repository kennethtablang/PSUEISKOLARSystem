using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Data
{
    /// <summary>
    /// Reads the single messaging-settings row, returning defaults when the row has never been
    /// written. Callers must not assume the row exists — nothing creates it until an admin saves.
    /// </summary>
    public static class MessagingSettingsStore
    {
        public static async Task<MessagingSettings> GetAsync(ApplicationDbContext db) =>
            await db.MessagingSettings.AsNoTracking().FirstOrDefaultAsync() ?? new MessagingSettings();
    }
}
