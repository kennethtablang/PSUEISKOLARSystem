namespace PSUEISKOLARSystem.Server.Interfaces
{
    public interface IEmailService
    {
        Task SendPasswordResetEmailAsync(string toEmail, string toName, string resetLink);
        Task SendTwoFactorCodeAsync(string toEmail, string toName, string code);
        Task SendEmailVerificationAsync(string toEmail, string toName, string verifyLink);
    }
}
