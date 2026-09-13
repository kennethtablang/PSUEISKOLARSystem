using Microsoft.EntityFrameworkCore;
using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Data
{
    /// <summary>
    /// Reads the single system-settings row, falling back to the model's defaults when an
    /// administrator has never saved one. Callers must not assume the row exists.
    /// <para>
    /// The row is read on the request path (uploads, sign-ins), so it is cached for a short
    /// window rather than re-queried per call. The window is deliberately short: an admin
    /// flipping maintenance mode expects it to bite within seconds, not on the next restart.
    /// </para>
    /// </summary>
    public static class SystemSettingsStore
    {
        private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(15);
        private static SystemSettings? _cached;
        private static DateTime _cachedAt = DateTime.MinValue;
        private static readonly SemaphoreSlim Gate = new(1, 1);

        public static async Task<SystemSettings> GetAsync(ApplicationDbContext db)
        {
            if (_cached is not null && DateTime.UtcNow - _cachedAt < CacheFor) return _cached;

            await Gate.WaitAsync();
            try
            {
                if (_cached is not null && DateTime.UtcNow - _cachedAt < CacheFor) return _cached;
                _cached = await db.SystemSettings.AsNoTracking().FirstOrDefaultAsync() ?? new SystemSettings();
                _cachedAt = DateTime.UtcNow;
                return _cached;
            }
            finally { Gate.Release(); }
        }

        /// <summary>Drops the cache so the next read sees a just-saved change immediately.</summary>
        public static void Invalidate()
        {
            _cached = null;
            _cachedAt = DateTime.MinValue;
        }
    }
}
