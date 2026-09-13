namespace PSUEISKOLARSystem.Server.Infrastructure
{
    /// <summary>
    /// Response headers for the application shell.
    /// <para>
    /// <c>DocumentsController.Preview</c> already sends a tight, sandboxing CSP with the files
    /// it serves — that is the right place for it, because an uploaded file is untrusted
    /// content. This covers the other half: the app's own pages, which shipped with no CSP, no
    /// clickjacking defence, and no referrer policy at all.
    /// </para>
    /// <para>
    /// It matters more here than in most apps because the session token lives in
    /// <c>localStorage</c> (see the audit's §3.2): any script that executes on the page can
    /// read it outright, so keeping foreign script from executing is the whole mitigation.
    /// </para>
    /// </summary>
    public static class SecurityHeaders
    {
        /* Notes on the loosest two directives, so nobody tightens them by guesswork and
           breaks the app:

           style-src keeps 'unsafe-inline' because the client styles almost everything through
           React's inline `style={{…}}` prop, which the browser treats as an inline style. That
           is ~800 call sites; removing the allowance means moving all of them to classes first
           (the audit's §5.2).

           frame-src allows blob: because MyDocumentsPage previews a submitted document in an
           iframe pointed at an object URL — the bytes arrive over authenticated fetch, so
           there is no URL the iframe could load directly instead.

           frame-ancestors is 'self' rather than 'none' for the same reason: a blob: document
           inherits the policy of the page that created it, so 'none' would have the preview
           iframe refuse to be framed by the page that just opened it. 'self' still blocks
           every cross-origin framing, which is the clickjacking case that matters. */
        private const string ContentSecurityPolicy =
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob:; " +
            "font-src 'self' data:; " +
            "connect-src 'self'; " +          // same-origin covers the SignalR wss: hub
            "frame-src 'self' blob:; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self'; " +
            "frame-ancestors 'self'";

        /// <summary>
        /// Adds the headers to every response.
        /// </summary>
        /// <param name="sendCsp">
        /// False in development, where Swagger UI's inline bootstrap script would be blocked by
        /// <c>script-src 'self'</c>. The clickjacking and referrer headers still apply there.
        /// </param>
        public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app, bool sendCsp)
        {
            return app.Use(async (context, next) =>
            {
                var headers = context.Response.Headers;

                // frame-ancestors supersedes X-Frame-Options in modern browsers; the older
                // header is kept for the ones that never learned the CSP directive, and
                // matches it at SAMEORIGIN rather than DENY (see the note above the policy).
                headers["X-Frame-Options"] = "SAMEORIGIN";
                headers["X-Content-Type-Options"] = "nosniff";
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

                // Nothing in the app uses the camera, microphone, or location; saying so keeps
                // an injected script from prompting the user for them under our origin.
                headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), interest-cohort=()";

                if (sendCsp)
                    headers["Content-Security-Policy"] = ContentSecurityPolicy;

                await next();
            });
        }
    }
}
