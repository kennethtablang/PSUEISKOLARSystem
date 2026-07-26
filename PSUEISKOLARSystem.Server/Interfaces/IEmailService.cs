namespace PSUEISKOLARSystem.Server.Interfaces
{
    public interface IEmailService
    {
        Task SendPasswordResetEmailAsync(string toEmail, string toName, string resetLink);
        Task SendTwoFactorCodeAsync(string toEmail, string toName, string code);
        Task SendEmailVerificationAsync(string toEmail, string toName, string verifyLink);
        Task SendDocumentStatusEmailAsync(string toEmail, string toName, string requirementName, string status, string? feedback);
        Task SendDocumentUploadConfirmationAsync(string toEmail, string toName, string requirementName, string academicYear, int semester);
        Task SendAnnouncementEmailAsync(string toEmail, string toName, string title, string content);
        Task SendScholarWelcomeAsync(string toEmail, string toName, string tempPassword, string verifyLink);
        Task SendMessageEmailAsync(string toEmail, string toName, string senderName, string messagePreview);
        Task SendScholarApprovalDecisionAsync(string toEmail, string toName, bool approved, string? scholarshipName, string? note);
    }
}
