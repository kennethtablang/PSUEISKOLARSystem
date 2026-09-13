using PSUEISKOLARSystem.Server.Interfaces;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// Sends an email <i>after</i> the response has gone back to the browser, without holding
    /// the request open for a slow SMTP round trip.
    /// <para>
    /// The naive form of this — <c>_ = emailService.SendSomethingAsync(…)</c> against the
    /// controller's own injected <see cref="IEmailService"/> — reaches past the end of the
    /// request into a scope ASP.NET Core has already disposed. It works today only because
    /// <c>EmailService</c> happens to hold nothing scoped: it takes <c>IOptions</c>, an
    /// <c>ILogger</c>, and a scope factory. Give it a <c>DbContext</c> and every one of those
    /// call sites starts throwing <c>ObjectDisposedException</c> under load, intermittently,
    /// in production. This takes its own scope so the lifetime is correct by construction.
    /// </para>
    /// <para>
    /// It also observes the result. <c>EmailService.SendAsync</c> rethrows after its third
    /// failed attempt, and a discarded task means nobody ever sees that — the retry landed,
    /// the visibility did not. A failure here is logged as an error with the recipient and
    /// what was being sent, so a silent mail outage shows up in the log rather than only in
    /// the students who never got told.
    /// </para>
    /// </summary>
    public sealed class BackgroundEmailer(IServiceScopeFactory scopeFactory, ILogger<BackgroundEmailer> logger)
    {
        /// <summary>
        /// Hands <paramref name="send"/> an <see cref="IEmailService"/> from a fresh scope and
        /// runs it detached. Returns immediately; never throws into the caller.
        /// </summary>
        /// <param name="description">
        /// What is being sent and to whom, for the log line if it fails —
        /// e.g. <c>$"document status to {email}"</c>.
        /// </param>
        public void Queue(string description, Func<IEmailService, Task> send)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    var email = scope.ServiceProvider.GetRequiredService<IEmailService>();
                    await send(email);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Background email failed ({Description}).", description);
                }
            });
        }
    }
}
