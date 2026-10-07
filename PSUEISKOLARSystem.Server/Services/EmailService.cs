using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Settings;

namespace PSUEISKOLARSystem.Server.Services
{
    public class EmailService(
        IOptions<EmailSettings> options,
        ILogger<EmailService> logger,
        IServiceScopeFactory scopeFactory) : IEmailService
    {
        private readonly EmailSettings _s = options.Value;

        /* Batch state. An announcement to 400 scholars used to be 400 TLS handshakes, 400
           SMTP authentications and 400 identical System Settings reads, against a Gmail relay
           that rate-limits on exactly that. Inside a batch the connection and the policy read
           are made once and reused.

           Instance fields are safe because EmailService is scoped and a batch is driven by a
           sequential foreach — the batch belongs to one caller for its duration. */
        private SmtpClient? _batchClient;
        private bool _inBatch;
        private bool _batchEmailEnabled;

        /// <summary>
        /// Opens one SMTP connection for a run of sends. Dispose the returned handle when the
        /// run finishes — <c>await using</c> is the intended shape. Sends made outside a batch
        /// are unaffected and still connect per message.
        /// </summary>
        public async Task<IAsyncDisposable> BeginBatchAsync()
        {
            _batchEmailEnabled = await EmailEnabledAsync();
            _inBatch = true;
            // The connection itself is opened on the first send, so a batch whose recipients
            // all turn out to have opted out costs nothing.
            return new BatchHandle(this);
        }

        private sealed class BatchHandle(EmailService owner) : IAsyncDisposable
        {
            public ValueTask DisposeAsync() => owner.EndBatchAsync();
        }

        private async ValueTask EndBatchAsync()
        {
            _inBatch = false;
            await DropBatchClientAsync(graceful: true);
        }

        private async ValueTask DropBatchClientAsync(bool graceful)
        {
            if (_batchClient is null) return;
            try
            {
                if (graceful && _batchClient.IsConnected)
                    await _batchClient.DisconnectAsync(true);
            }
            catch
            {
                // The batch is over either way; a failed goodbye changes nothing.
            }
            _batchClient.Dispose();
            _batchClient = null;
        }

        /// <summary>
        /// One switch for all outbound mail. Read here rather than at each of the ten call
        /// sites, so turning email off genuinely means nothing leaves the server — in-app
        /// notifications carry on unaffected.
        /// </summary>
        private async Task<bool> EmailEnabledAsync()
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Data.ApplicationDbContext>();
            var policy = await Data.SystemSettingsStore.GetAsync(db);
            return policy.EmailEnabled;
        }

        private async Task<SmtpClient> ConnectedBatchClientAsync()
        {
            if (_batchClient is { IsConnected: true, IsAuthenticated: true })
                return _batchClient;

            await DropBatchClientAsync(graceful: false);

            var client = new SmtpClient();
            await client.ConnectAsync(_s.SmtpHost, _s.SmtpPort, SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(_s.Username, _s.Password);
            _batchClient = client;
            return client;
        }

        // Central SMTP send with a short retry and logging so failures are visible
        // (previously call sites swallowed exceptions with no trace).
        private async Task SendMessageAsync(MimeMessage message)
        {
            const int maxAttempts = 3;

            var enabled = _inBatch ? _batchEmailEnabled : await EmailEnabledAsync();
            if (!enabled)
            {
                logger.LogInformation(
                    "Email '{Subject}' suppressed — outbound email is switched off in System Settings.",
                    message.Subject);
                return;
            }

            var recipients = string.Join(", ", message.To.Mailboxes.Select(m => m.Address));

            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    string serverResponse;
                    if (_inBatch)
                    {
                        var client = await ConnectedBatchClientAsync();
                        serverResponse = await client.SendAsync(message);
                    }
                    else
                    {
                        using var client = new SmtpClient();
                        await client.ConnectAsync(_s.SmtpHost, _s.SmtpPort, SecureSocketOptions.StartTls);
                        await client.AuthenticateAsync(_s.Username, _s.Password);
                        serverResponse = await client.SendAsync(message);
                        await client.DisconnectAsync(true);
                    }

                    // Logged on success too: "the student never got it" is otherwise
                    // indistinguishable from "it was never sent".
                    logger.LogInformation("Email '{Subject}' to {Recipients} accepted by relay on attempt {Attempt}: {Response}",
                        message.Subject, recipients, attempt, serverResponse);
                    return;
                }
                catch (Exception ex) when (attempt < maxAttempts)
                {
                    logger.LogWarning(ex, "Email '{Subject}' to {Recipients} failed on attempt {Attempt}/{Max}; retrying.", message.Subject, recipients, attempt, maxAttempts);

                    // The shared connection is the likeliest casualty — the relay may have
                    // dropped it or hit a per-connection limit. Throw it away so the retry
                    // opens a fresh one rather than replaying into a dead socket.
                    await DropBatchClientAsync(graceful: false);
                    await Task.Delay(TimeSpan.FromSeconds(2 * attempt));
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Email '{Subject}' to {Recipients} failed after {Max} attempts.", message.Subject, recipients, maxAttempts);
                    await DropBatchClientAsync(graceful: false);
                    throw;
                }
            }
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string toName, string resetLink)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_s.FromName, _s.From));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = "Reset Your EIskolarSystem Password";

            message.Body = new BodyBuilder
            {
                HtmlBody = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#e8edf5;font-family:Arial,sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding:32px 16px;">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

                            <!-- Header -->
                            <tr>
                              <td style="background:#002570;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                                <div style="display:inline-flex;align-items:center;gap:12px;">
                                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#ffd030,#e0a000);
                                              display:inline-flex;align-items:center;justify-content:center;
                                              font-weight:900;font-size:11px;color:#1a0e00;">PSU</div>
                                  <div style="text-align:left;">
                                    <div style="font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.3px;">e-Iskolar</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">Lingayen Campus</div>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            <!-- Body -->
                            <tr>
                              <td style="background:#fff;padding:36px 32px;">
                                <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0d1a33;letter-spacing:-0.5px;">
                                  Password Reset
                                </h2>
                                <p style="margin:0 0 20px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Hello <strong>{toName}</strong>,
                                </p>
                                <p style="margin:0 0 28px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  We received a request to reset the password for your EIskolarSystem account.
                                  Click the button below to choose a new password.
                                </p>

                                <div style="text-align:center;margin:32px 0;">
                                  <a href="{resetLink}"
                                     style="display:inline-block;background:#002570;color:#f5b800;
                                            padding:15px 36px;border-radius:12px;font-weight:900;
                                            font-size:15px;text-decoration:none;letter-spacing:-0.2px;
                                            box-shadow:0 4px 0 #001040;">
                                    Reset Password
                                  </a>
                                </div>

                                <p style="margin:28px 0 0;font-size:12px;color:#7a8aaa;line-height:1.7;
                                          padding:16px;background:#f4f6fa;border-radius:10px;">
                                  If the button doesn't work, copy and paste this link into your browser:<br/>
                                  <a href="{resetLink}" style="color:#003087;word-break:break-all;">{resetLink}</a>
                                </p>

                                <p style="margin:20px 0 0;font-size:12px;color:#9aaabb;line-height:1.6;">
                                  This link expires in <strong>24 hours</strong>. If you did not request a password
                                  reset, you can safely ignore this email — your password will not change.
                                </p>
                              </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                              <td style="background:#001040;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.28);">
                                  PSU e-Iskolar &middot; Scholar Profiling and Records Management System<br/>
                                  Pangasinan State University &ndash; Lingayen Campus
                                </p>
                              </td>
                            </tr>

                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                    """
            }.ToMessageBody();

            await SendMessageAsync(message);
        }

        public async Task SendEmailVerificationAsync(string toEmail, string toName, string verifyLink)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_s.FromName, _s.From));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = "Verify Your PSU e-Iskolar Account";

            message.Body = new BodyBuilder
            {
                HtmlBody = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#e8edf5;font-family:Arial,sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding:32px 16px;">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

                            <!-- Header -->
                            <tr>
                              <td style="background:#002570;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                                <div style="display:inline-flex;align-items:center;gap:12px;">
                                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#ffd030,#e0a000);
                                              display:inline-flex;align-items:center;justify-content:center;
                                              font-weight:900;font-size:11px;color:#1a0e00;">PSU</div>
                                  <div style="text-align:left;">
                                    <div style="font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.3px;">e-Iskolar</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">Lingayen Campus</div>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            <!-- Body -->
                            <tr>
                              <td style="background:#fff;padding:36px 32px;">
                                <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0d1a33;letter-spacing:-0.5px;">
                                  Verify Your Email Address
                                </h2>
                                <p style="margin:0 0 20px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Hello <strong>{toName}</strong>,
                                </p>
                                <p style="margin:0 0 28px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Thank you for registering with PSU e-Iskolar. Please verify your email address
                                  by clicking the button below to activate your account.
                                </p>

                                <div style="text-align:center;margin:32px 0;">
                                  <a href="{verifyLink}"
                                     style="display:inline-block;background:#002570;color:#f5b800;
                                            padding:15px 36px;border-radius:12px;font-weight:900;
                                            font-size:15px;text-decoration:none;letter-spacing:-0.2px;
                                            box-shadow:0 4px 0 #001040;">
                                    Verify My Account
                                  </a>
                                </div>

                                <p style="margin:28px 0 0;font-size:12px;color:#7a8aaa;line-height:1.7;
                                          padding:16px;background:#f4f6fa;border-radius:10px;">
                                  If the button doesn't work, copy and paste this link into your browser:<br/>
                                  <a href="{verifyLink}" style="color:#003087;word-break:break-all;">{verifyLink}</a>
                                </p>

                                <p style="margin:20px 0 0;font-size:12px;color:#9aaabb;line-height:1.6;">
                                  This link expires in <strong>24 hours</strong>. If you did not create an account,
                                  you can safely ignore this email.
                                </p>

                                <div style="margin:20px 0 0;padding:14px 16px;background:#fffbea;border-radius:10px;
                                            border:1px solid rgba(245,184,0,0.35);">
                                  <p style="margin:0;font-size:12px;color:#7a5c00;line-height:1.6;">
                                    <strong>&#9888; Can't find this email?</strong> Check your <strong>spam</strong> or
                                    <strong>junk</strong> folder. If it's there, mark it as "Not Spam" so future
                                    emails reach your inbox.
                                  </p>
                                </div>
                              </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                              <td style="background:#001040;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.28);">
                                  PSU e-Iskolar &middot; Scholar Profiling and Records Management System<br/>
                                  Pangasinan State University &ndash; Lingayen Campus
                                </p>
                              </td>
                            </tr>

                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                    """
            }.ToMessageBody();

            await SendMessageAsync(message);
        }

        public async Task SendTwoFactorCodeAsync(string toEmail, string toName, string code)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_s.FromName, _s.From));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = "Your EIskolarSystem Login Code";

            message.Body = new BodyBuilder
            {
                HtmlBody = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#e8edf5;font-family:Arial,sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding:32px 16px;">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

                            <tr>
                              <td style="background:#002570;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                                <div style="display:inline-flex;align-items:center;gap:12px;">
                                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#ffd030,#e0a000);
                                              display:inline-flex;align-items:center;justify-content:center;
                                              font-weight:900;font-size:11px;color:#1a0e00;">PSU</div>
                                  <div style="text-align:left;">
                                    <div style="font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.3px;">e-Iskolar</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">Lingayen Campus</div>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            <tr>
                              <td style="background:#fff;padding:36px 32px;text-align:center;">
                                <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0d1a33;letter-spacing:-0.5px;">
                                  Login Verification
                                </h2>
                                <p style="margin:0 0 28px;font-size:14px;color:#4a5a7a;line-height:1.6;text-align:left;">
                                  Hello <strong>{toName}</strong>, use the code below to complete your sign-in.
                                  This code expires in <strong>10 minutes</strong>.
                                </p>

                                <div style="margin:0 auto 28px;display:inline-block;
                                            background:#f4f6fa;border-radius:16px;
                                            padding:20px 48px;border:2px solid rgba(0,48,135,0.12);">
                                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;
                                            text-transform:uppercase;color:#7a8aaa;">Your code</p>
                                  <p style="margin:0;font-size:38px;font-weight:900;letter-spacing:0.18em;
                                            color:#002570;font-family:monospace;">{code}</p>
                                </div>

                                <p style="margin:0;font-size:12px;color:#9aaabb;line-height:1.6;text-align:left;">
                                  If you did not attempt to sign in, your password may be compromised.
                                  Please reset it immediately.
                                </p>
                              </td>
                            </tr>

                            <tr>
                              <td style="background:#001040;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.28);">
                                  PSU e-Iskolar &middot; Scholar Profiling and Records Management System<br/>
                                  Pangasinan State University &ndash; Lingayen Campus
                                </p>
                              </td>
                            </tr>

                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                    """
            }.ToMessageBody();

            await SendMessageAsync(message);
        }

        public async Task SendRecoveryEmailCodeAsync(string toEmail, string toName, string code)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_s.FromName, _s.From));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = "Confirm Your EIskolarSystem Recovery Email";

            message.Body = new BodyBuilder
            {
                HtmlBody = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#e8edf5;font-family:Arial,sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding:32px 16px;">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

                            <tr>
                              <td style="background:#002570;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                                <div style="display:inline-flex;align-items:center;gap:12px;">
                                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#ffd030,#e0a000);
                                              display:inline-flex;align-items:center;justify-content:center;
                                              font-weight:900;font-size:11px;color:#1a0e00;">PSU</div>
                                  <div style="text-align:left;">
                                    <div style="font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.3px;">e-Iskolar</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">Lingayen Campus</div>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            <tr>
                              <td style="background:#fff;padding:36px 32px;text-align:center;">
                                <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0d1a33;letter-spacing:-0.5px;">
                                  Confirm Recovery Email
                                </h2>
                                <p style="margin:0 0 28px;font-size:14px;color:#4a5a7a;line-height:1.6;text-align:left;">
                                  Hello <strong>{toName}</strong>, enter the code below in your e-Iskolar profile to use this address for account recovery.
                                  This code expires in <strong>10 minutes</strong>.
                                </p>

                                <div style="margin:0 auto 28px;display:inline-block;
                                            background:#f4f6fa;border-radius:16px;
                                            padding:20px 48px;border:2px solid rgba(0,48,135,0.12);">
                                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.1em;
                                            text-transform:uppercase;color:#7a8aaa;">Your code</p>
                                  <p style="margin:0;font-size:38px;font-weight:900;letter-spacing:0.18em;
                                            color:#002570;font-family:monospace;">{code}</p>
                                </div>

                                <p style="margin:0;font-size:12px;color:#9aaabb;line-height:1.6;text-align:left;">
                                  Once confirmed, password-reset links for your account can be sent here.
                                  If you did not ask for this, ignore this email — nothing will change.
                                </p>
                              </td>
                            </tr>

                            <tr>
                              <td style="background:#001040;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.28);">
                                  PSU e-Iskolar &middot; Scholar Profiling and Records Management System<br/>
                                  Pangasinan State University &ndash; Lingayen Campus
                                </p>
                              </td>
                            </tr>

                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                    """
            }.ToMessageBody();

            await SendMessageAsync(message);
        }

        public async Task SendDocumentUploadConfirmationAsync(string toEmail, string toName, string requirementName, string academicYear, int semester)
        {
            var semLabel = semester == 1 ? "1st Semester" : "2nd Semester";
            toName = Enc(toName);
            requirementName = Enc(requirementName);
            academicYear = Enc(academicYear);

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_s.FromName, _s.From));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = $"Document Submitted: {requirementName}";

            message.Body = new BodyBuilder
            {
                HtmlBody = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#e8edf5;font-family:Arial,sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding:32px 16px;">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                            <tr>
                              <td style="background:#002570;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                                <div style="display:inline-flex;align-items:center;gap:12px;">
                                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#ffd030,#e0a000);
                                              display:inline-flex;align-items:center;justify-content:center;
                                              font-weight:900;font-size:11px;color:#1a0e00;">PSU</div>
                                  <div style="text-align:left;">
                                    <div style="font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.3px;">e-Iskolar</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">Lingayen Campus</div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#fff;padding:36px 32px;">
                                <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0d1a33;letter-spacing:-0.5px;">
                                  Document Submitted
                                </h2>
                                <p style="margin:0 0 20px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Hello <strong>{toName}</strong>,
                                </p>
                                <p style="margin:0 0 16px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Your document has been successfully received and is now awaiting coordinator review.
                                </p>
                                <div style="padding:16px 20px;background:#f4f6fa;border-radius:12px;border-left:4px solid #002570;margin-bottom:20px;">
                                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#7a8aaa;">Submitted Document</p>
                                  <p style="margin:0;font-size:16px;font-weight:900;color:#0d1a33;">{requirementName}</p>
                                  <p style="margin:4px 0 0;font-size:13px;color:#4a5a7a;">{academicYear} &middot; {semLabel}</p>
                                </div>
                                <p style="margin:0;font-size:12px;color:#9aaabb;line-height:1.6;">
                                  You will be notified once your coordinator reviews this document. Log in to PSU e-Iskolar to track your submission status.
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#001040;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.28);">
                                  PSU e-Iskolar &middot; Scholar Profiling and Records Management System<br/>
                                  Pangasinan State University &ndash; Lingayen Campus
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                    """
            }.ToMessageBody();

            await SendMessageAsync(message);
        }

        /// <summary>
        /// The email behind the "Email me about deadlines" preference. That toggle existed on
        /// My Profile, was stored, was migrated — and no code read it, because the reminder
        /// service only ever raised an in-app notification. Its two siblings
        /// (EmailDocumentStatus, EmailAnnouncements) were honoured; this one was not.
        /// </summary>
        public async Task SendDeadlineReminderAsync(string toEmail, string toName, string requirementName, DateTime dueDate, string academicYear, int semester, bool overdue = false)
        {
            var semLabel = semester == 1 ? "1st Semester" : "2nd Semester";
            var daysLeft = (int)Math.Ceiling((dueDate - DateTime.UtcNow).TotalDays);

            // The same template covers the notice sent after the date has passed. Telling
            // someone a requirement is "due in -2 days" is worse than not writing at all.
            var heading = overdue ? "Deadline Missed" : "Deadline Approaching";
            var urgency = overdue
                ? "is past its deadline"
                : daysLeft <= 1 ? "is due tomorrow" : $"is due in {daysLeft} days";
            var closing = overdue
                ? "Message your scholarship coordinator to arrange a late submission."
                : "Log in to PSU e-Iskolar to upload it.";
            var dueLabel = overdue ? "Was due" : "Due";

            toName = Enc(toName);
            requirementName = Enc(requirementName);
            academicYear = Enc(academicYear);

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_s.FromName, _s.From));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = $"{heading}: {requirementName}";

            message.Body = new BodyBuilder
            {
                HtmlBody = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#e8edf5;font-family:Arial,sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding:32px 16px;">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                            <tr>
                              <td style="background:#002570;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                                <div style="display:inline-flex;align-items:center;gap:12px;">
                                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#ffd030,#e0a000);
                                              display:inline-flex;align-items:center;justify-content:center;
                                              font-weight:900;font-size:11px;color:#1a0e00;">PSU</div>
                                  <div style="text-align:left;">
                                    <div style="font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.3px;">e-Iskolar</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">Lingayen Campus</div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#fff;padding:36px 32px;">
                                <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0d1a33;letter-spacing:-0.5px;">
                                  {heading}
                                </h2>
                                <p style="margin:0 0 20px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Hello <strong>{toName}</strong>,
                                </p>
                                <p style="margin:0 0 16px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  One of your scholarship requirements {urgency} and has not been submitted yet.
                                </p>
                                <div style="padding:16px 20px;background:#fff8e6;border-radius:12px;border-left:4px solid #e0a000;margin-bottom:20px;">
                                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#7a8aaa;">Requirement</p>
                                  <p style="margin:0;font-size:16px;font-weight:900;color:#0d1a33;">{requirementName}</p>
                                  <p style="margin:4px 0 0;font-size:13px;color:#4a5a7a;">{academicYear} &middot; {semLabel}</p>
                                  <p style="margin:8px 0 0;font-size:13px;font-weight:700;color:#8a5a00;">{dueLabel} {dueDate:MMMM d, yyyy}</p>
                                </div>
                                <p style="margin:0;font-size:12px;color:#9aaabb;line-height:1.6;">
                                  {closing} You can turn these emails off under My Profile &rsaquo; Notification preferences.
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#001040;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.28);">
                                  PSU e-Iskolar &middot; Scholar Profiling and Records Management System<br/>
                                  Pangasinan State University &ndash; Lingayen Campus
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                    """
            }.ToMessageBody();

            await SendMessageAsync(message);
        }

        public async Task SendAnnouncementEmailAsync(string toEmail, string toName, string title, string content)
        {
            toName = Enc(toName);
            title = Enc(title);
            content = Enc(content);

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_s.FromName, _s.From));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = $"New Announcement: {title}";

            message.Body = new BodyBuilder
            {
                HtmlBody = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#e8edf5;font-family:Arial,sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding:32px 16px;">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                            <tr>
                              <td style="background:#002570;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                                <div style="display:inline-flex;align-items:center;gap:12px;">
                                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#ffd030,#e0a000);
                                              display:inline-flex;align-items:center;justify-content:center;
                                              font-weight:900;font-size:11px;color:#1a0e00;">PSU</div>
                                  <div style="text-align:left;">
                                    <div style="font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.3px;">e-Iskolar</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">Lingayen Campus</div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#fff;padding:36px 32px;">
                                <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#7a8aaa;">New Announcement</p>
                                <h2 style="margin:0 0 20px;font-size:22px;font-weight:900;color:#0d1a33;letter-spacing:-0.5px;">
                                  {title}
                                </h2>
                                <p style="margin:0 0 20px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Hello <strong>{toName}</strong>,
                                </p>
                                <div style="padding:20px;background:#f4f6fa;border-radius:12px;margin-bottom:20px;">
                                  <p style="margin:0;font-size:14px;color:#0d1a33;line-height:1.7;white-space:pre-line;">{content}</p>
                                </div>
                                <p style="margin:0;font-size:12px;color:#9aaabb;line-height:1.6;">
                                  Log in to PSU e-Iskolar to view all announcements and manage your documents.
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#001040;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.28);">
                                  PSU e-Iskolar &middot; Scholar Profiling and Records Management System<br/>
                                  Pangasinan State University &ndash; Lingayen Campus
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                    """
            }.ToMessageBody();

            await SendMessageAsync(message);
        }

        public async Task SendScholarWelcomeAsync(string toEmail, string toName, string tempPassword, string verifyLink)
        {
            toName = Enc(toName);

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_s.FromName, _s.From));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = "Welcome to PSU e-Iskolar — Your Account Details";

            message.Body = new BodyBuilder
            {
                HtmlBody = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#e8edf5;font-family:Arial,sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding:32px 16px;">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                            <tr>
                              <td style="background:#002570;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                                <div style="display:inline-flex;align-items:center;gap:12px;">
                                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#ffd030,#e0a000);
                                              display:inline-flex;align-items:center;justify-content:center;
                                              font-weight:900;font-size:11px;color:#1a0e00;">PSU</div>
                                  <div style="text-align:left;">
                                    <div style="font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.3px;">e-Iskolar</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">Scholar Records System</div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#fff;padding:36px 32px;">
                                <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0d1a33;letter-spacing:-0.5px;">
                                  Welcome to PSU e-Iskolar
                                </h2>
                                <p style="margin:0 0 20px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Hello <strong>{toName}</strong>,
                                </p>
                                <p style="margin:0 0 20px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  An administrator has created a scholar account for you. Use the temporary
                                  credentials below to sign in, then verify your email to activate your account.
                                </p>
                                <div style="padding:16px 20px;background:#f4f6fa;border-radius:12px;border-left:4px solid #002570;margin-bottom:20px;">
                                  <p style="margin:0 0 6px;font-size:12px;color:#4a5a7a;">Email: <strong>{toEmail}</strong></p>
                                  <p style="margin:0;font-size:12px;color:#4a5a7a;">Temporary password:
                                    <strong style="font-family:monospace;font-size:15px;color:#002570;">{tempPassword}</strong>
                                  </p>
                                </div>
                                <div style="text-align:center;margin:28px 0;">
                                  <a href="{verifyLink}"
                                     style="display:inline-block;background:#002570;color:#f5b800;
                                            padding:15px 36px;border-radius:12px;font-weight:900;
                                            font-size:15px;text-decoration:none;letter-spacing:-0.2px;
                                            box-shadow:0 4px 0 #001040;">
                                    Verify My Account
                                  </a>
                                </div>
                                <p style="margin:20px 0 0;font-size:12px;color:#9aaabb;line-height:1.6;">
                                  For your security, please change your temporary password after signing in.
                                  If the button doesn't work, paste this link into your browser:<br/>
                                  <a href="{verifyLink}" style="color:#003087;word-break:break-all;">{verifyLink}</a>
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#001040;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.28);">
                                  PSU e-Iskolar &middot; Scholar Profiling and Records Management System<br/>
                                  Pangasinan State University
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                    """
            }.ToMessageBody();

            await SendMessageAsync(message);
        }

        // HTML-encode any value that carries user-authored or free-text content before it
        // is interpolated into an email body, to prevent HTML/script injection.
        private static string Enc(string? value) => System.Net.WebUtility.HtmlEncode(value ?? string.Empty);

        public async Task SendMessageEmailAsync(string toEmail, string toName, string senderName, string messagePreview)
        {
            toName = Enc(toName);
            senderName = Enc(senderName);
            messagePreview = Enc(messagePreview);

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_s.FromName, _s.From));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = $"New message from {senderName}";

            message.Body = new BodyBuilder
            {
                HtmlBody = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#e8edf5;font-family:Arial,sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding:32px 16px;">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                            <tr>
                              <td style="background:#002570;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                                <div style="display:inline-flex;align-items:center;gap:12px;">
                                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#ffd030,#e0a000);
                                              display:inline-flex;align-items:center;justify-content:center;
                                              font-weight:900;font-size:11px;color:#1a0e00;">PSU</div>
                                  <div style="text-align:left;">
                                    <div style="font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.3px;">e-Iskolar</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">Messages</div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#fff;padding:36px 32px;">
                                <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0d1a33;letter-spacing:-0.5px;">
                                  New Message
                                </h2>
                                <p style="margin:0 0 20px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Hello <strong>{toName}</strong>, you received a new message from <strong>{senderName}</strong>.
                                </p>
                                <div style="padding:16px 20px;background:#f4f6fa;border-radius:12px;border-left:4px solid #002570;margin-bottom:20px;">
                                  <p style="margin:0;font-size:14px;color:#0d1a33;line-height:1.6;white-space:pre-line;">{messagePreview}</p>
                                </div>
                                <p style="margin:0;font-size:12px;color:#9aaabb;line-height:1.6;">
                                  Log in to PSU e-Iskolar and open Messages to reply.
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#001040;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.28);">
                                  PSU e-Iskolar &middot; Scholar Profiling and Records Management System<br/>
                                  Pangasinan State University
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                    """
            }.ToMessageBody();

            await SendMessageAsync(message);
        }

        public async Task SendScholarApprovalDecisionAsync(string toEmail, string toName, bool approved, string? scholarshipName, string? note)
        {
            toName = Enc(toName);
            var scholarship = scholarshipName is null ? null : Enc(scholarshipName);
            var noteHtml = string.IsNullOrWhiteSpace(note)
                ? ""
                : $"""
                    <div style="margin:16px 0 0;padding:14px 16px;border-radius:10px;background:#f4f6fb;border-left:4px solid #002570;">
                      <div style="font-size:11px;font-weight:700;color:#7a8aaa;text-transform:uppercase;letter-spacing:0.06em;">Note from the office</div>
                      <div style="font-size:14px;color:#4a5a7a;line-height:1.6;margin-top:4px;">{Enc(note)}</div>
                    </div>
                    """;

            var heading = approved ? "Registration Approved" : "Registration Not Approved";
            var badgeBg = approved ? "#d4f5e2" : "#fee2e2";
            var badgeColor = approved ? "#0a5a3a" : "#991b1b";
            var body = approved
                ? $"""
                    <p style="margin:0 0 12px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                      Your scholar registration has been verified by the scholarship office
                      {(scholarship is null ? "" : $"for <strong>{scholarship}</strong>")}.
                      You now have full access to PSU e-Iskolar and can start submitting your
                      document requirements.
                    </p>
                    """
                : """
                    <p style="margin:0 0 12px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                      After review, the scholarship office was unable to verify your scholar
                      registration. Your account stays active, but document submission remains
                      locked until the issue below is resolved.
                    </p>
                    """;

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_s.FromName, _s.From));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = approved
                ? "Your PSU e-Iskolar registration is approved"
                : "Action needed on your PSU e-Iskolar registration";

            message.Body = new BodyBuilder
            {
                HtmlBody = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#e8edf5;font-family:Arial,sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding:32px 16px;">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                            <tr>
                              <td style="background:#002570;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                                <div style="display:inline-flex;align-items:center;gap:12px;">
                                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#ffd030,#e0a000);
                                              display:inline-flex;align-items:center;justify-content:center;
                                              font-weight:900;font-size:11px;color:#1a0e00;">PSU</div>
                                  <div style="text-align:left;">
                                    <div style="font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.3px;">e-Iskolar</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">Lingayen Campus</div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#fff;padding:36px 32px;">
                                <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0d1a33;letter-spacing:-0.5px;">
                                  {heading}
                                </h2>
                                <p style="margin:0 0 20px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Hello <strong>{toName}</strong>,
                                </p>
                                <div style="display:inline-block;padding:8px 18px;border-radius:8px;
                                            background:{badgeBg};color:{badgeColor};font-weight:700;font-size:14px;margin-bottom:16px;">
                                  {heading}
                                </div>
                                {body}
                                {noteHtml}
                                <p style="margin:20px 0 0;font-size:12px;color:#9aaabb;line-height:1.6;">
                                  Sign in to PSU e-Iskolar to review your profile and requirements.
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#001040;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.28);">
                                  PSU e-Iskolar &middot; Scholar Profiling and Records Management System<br/>
                                  Pangasinan State University &ndash; Lingayen Campus
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                    """
            }.ToMessageBody();

            await SendMessageAsync(message);
        }

        public async Task SendDocumentStatusEmailAsync(string toEmail, string toName, string requirementName, string status, string? feedback)
        {
            bool isVerified = status == "Verified";

            toName = Enc(toName);
            requirementName = Enc(requirementName);
            feedback = feedback is null ? null : Enc(feedback);
            var (iconColor, statusLabel, statusDesc) = isVerified
                ? ("#065f46", "Verified", "Your document has been reviewed and approved.")
                : ("#991b1b", "Rejected", "Your document was rejected and needs to be resubmitted. Please review the feedback below.");

            var feedbackBlock = !string.IsNullOrWhiteSpace(feedback)
                ? $"""
                  <div style="margin:20px 0;padding:16px;background:#f4f6fa;border-radius:10px;border-left:4px solid {(isVerified ? "#10a060" : "#c03030")};">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#7a8aaa;">Coordinator Feedback</p>
                    <p style="margin:0;font-size:14px;color:#0d1a33;line-height:1.6;">{feedback}</p>
                  </div>
                  """
                : "";

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_s.FromName, _s.From));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = $"Document {statusLabel}: {requirementName}";

            message.Body = new BodyBuilder
            {
                HtmlBody = $"""
                    <!DOCTYPE html>
                    <html>
                    <body style="margin:0;padding:0;background:#e8edf5;font-family:Arial,sans-serif;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td align="center" style="padding:32px 16px;">
                          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                            <tr>
                              <td style="background:#002570;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                                <div style="display:inline-flex;align-items:center;gap:12px;">
                                  <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(145deg,#ffd030,#e0a000);
                                              display:inline-flex;align-items:center;justify-content:center;
                                              font-weight:900;font-size:11px;color:#1a0e00;">PSU</div>
                                  <div style="text-align:left;">
                                    <div style="font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.3px;">e-Iskolar</div>
                                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;">Lingayen Campus</div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#fff;padding:36px 32px;">
                                <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0d1a33;letter-spacing:-0.5px;">
                                  Document {statusLabel}
                                </h2>
                                <p style="margin:0 0 20px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Hello <strong>{toName}</strong>,
                                </p>
                                <p style="margin:0 0 12px;font-size:14px;color:#4a5a7a;line-height:1.6;">
                                  Your submission for <strong>{requirementName}</strong> has been reviewed.
                                </p>
                                <div style="display:inline-block;padding:8px 18px;border-radius:8px;
                                            background:{(isVerified ? "#d4f5e2" : "#fee2e2")};
                                            color:{iconColor};font-weight:700;font-size:14px;margin-bottom:16px;">
                                  Status: {statusLabel}
                                </div>
                                <p style="margin:0;font-size:14px;color:#4a5a7a;line-height:1.6;">{statusDesc}</p>
                                {feedbackBlock}
                                <p style="margin:20px 0 0;font-size:12px;color:#9aaabb;line-height:1.6;">
                                  Log in to PSU e-Iskolar to view your document status and resubmit if needed.
                                </p>
                              </td>
                            </tr>
                            <tr>
                              <td style="background:#001040;border-radius:0 0 16px 16px;padding:18px 32px;text-align:center;">
                                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.28);">
                                  PSU e-Iskolar &middot; Scholar Profiling and Records Management System<br/>
                                  Pangasinan State University &ndash; Lingayen Campus
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td></tr>
                      </table>
                    </body>
                    </html>
                    """
            }.ToMessageBody();

            await SendMessageAsync(message);
        }
    }
}
