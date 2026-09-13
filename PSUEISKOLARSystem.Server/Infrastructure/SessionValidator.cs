using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PSUEISKOLARSystem.Server.Data;

namespace PSUEISKOLARSystem.Server.Infrastructure
{
    /// <summary>
    /// Re-checks the account behind a bearer token on every request.
    /// <para>
    /// A JWT is a bearer credential: once signed it stays valid until it expires, and nothing
    /// inside it knows the account was since deactivated or had its password changed. Without
    /// this hook, <c>IsActive = false</c> is only consulted at
    /// <c>AuthService.LoginAsync</c> — so deactivating someone leaves them fully signed in for
    /// the remainder of <c>JwtSettings.ExpiryMinutes</c>, an hour of access after the office
    /// believes it removed them.
    /// </para>
    /// <para>
    /// <c>ApprovalStatus</c> is deliberately <b>not</b> checked here. A rejected scholar is
    /// still allowed to sign in — that is how they are shown the rejection and its note (see
    /// <c>DocumentsController</c>:127) — so refusing their token would break the intended flow
    /// rather than harden anything.
    /// </para>
    /// <para>
    /// The check is one primary-key read of three columns, cached for <see cref="CacheFor"/>,
    /// so steady state is a dictionary lookup per request. Callers that revoke access
    /// (<c>UsersController.SetActive</c> and its bulk archive) call <see cref="Invalidate"/>,
    /// making revocation immediate; the TTL is only the backstop for paths that forget to.
    /// </para>
    /// </summary>
    public sealed class SessionValidator(IMemoryCache cache)
    {
        /// <summary>How long an account snapshot is trusted without re-reading the database.</summary>
        private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

        /// <summary>Claim carrying the Identity security stamp as it stood when the token was issued.</summary>
        public const string StampClaim = "stamp";

        private sealed record AccountState(bool IsActive, string? SecurityStamp);

        private static string CacheKey(string userId) => $"session-state:{userId}";

        /// <summary>
        /// Drops the cached snapshot for one account so the very next request re-reads it.
        /// Call this from anywhere that revokes access.
        /// </summary>
        public void Invalidate(string userId) => cache.Remove(CacheKey(userId));

        /// <summary>
        /// Wired to <c>JwtBearerEvents.OnTokenValidated</c>: runs after the signature and
        /// lifetime check, and fails the request if the account no longer backs the token.
        /// </summary>
        public async Task ValidateAsync(TokenValidatedContext context)
        {
            var principal = context.Principal;

            // A two-factor ticket is a half-authenticated credential meant only for
            // POST /auth/login-2fa, which validates it by hand. It carries no role claim, so
            // role-guarded endpoints already refuse it — but a bare [Authorize] would not.
            if (principal?.FindFirstValue("purpose") == "2fa")
            {
                context.Fail("A two-factor ticket is not a session token.");
                return;
            }

            var userId = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                context.Fail("The token carries no subject.");
                return;
            }

            var db = context.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
            var state = await GetAsync(db, userId);

            if (state is null)
            {
                context.Fail("The account no longer exists.");
                return;
            }

            if (!state.IsActive)
            {
                context.Fail("The account has been deactivated.");
                return;
            }

            // Identity rotates the security stamp on password reset and password change, so
            // those now end every other session. Tokens minted before this claim existed carry
            // no stamp; they are allowed to run out their remaining lifetime rather than
            // signing the whole campus out the moment this deploys.
            var presented = principal!.FindFirstValue(StampClaim);
            if (!string.IsNullOrEmpty(presented) && presented != state.SecurityStamp)
                context.Fail("The credentials for this account have changed.");
        }

        private async Task<AccountState?> GetAsync(ApplicationDbContext db, string userId)
        {
            if (cache.TryGetValue(CacheKey(userId), out AccountState? cached))
                return cached;

            // Projected to an anonymous type and shaped afterwards: EF only has to translate
            // two column reads, with no constructor for it to bind.
            var row = await db.Users
                .AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.IsActive, u.SecurityStamp })
                .FirstOrDefaultAsync();

            var state = row is null ? null : new AccountState(row.IsActive, row.SecurityStamp);

            // A miss is cached too, so a token for a deleted account cannot be used to
            // hammer the users table.
            cache.Set(CacheKey(userId), state, CacheFor);
            return state;
        }
    }
}
