using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using PSUEISKOLARSystem.Server.Interfaces;
using PSUEISKOLARSystem.Server.Settings;

namespace PSUEISKOLARSystem.Server.Services
{
    public class EmailService(IOptions<EmailSettings> options) : IEmailService
    {
        private readonly EmailSettings _s = options.Value;

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

            using var client = new SmtpClient();
            await client.ConnectAsync(_s.SmtpHost, _s.SmtpPort, SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(_s.Username, _s.Password);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);
        }
    }
}
