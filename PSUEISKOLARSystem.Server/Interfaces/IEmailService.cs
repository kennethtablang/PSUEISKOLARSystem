namespace PSUEISKOLARSystem.Server.Interfaces
{
    public interface IEmailService
    {
        Task SendPasswordResetEmailAsync(string toEmail, string toName, string resetLink);
        Task SendTwoFactorCodeAsync(string toEmail, string toName, string code);
        // Confirms a staff member owns the personal address they want reset links sent to.
        Task SendRecoveryEmailCodeAsync(string toEmail, string toName, string code);
        Task SendEmailVerificationAsync(string toEmail, string toName, string verifyLink);
        Task SendDocumentStatusEmailAsync(string toEmail, string toName, string requirementName, string status, string? feedback);
        Task SendDocumentUploadConfirmationAsync(string toEmail, string toName, string requirementName, string academicYear, int semester);
        /// <summary>
        /// Opens one SMTP connection for a run of sends; dispose the handle when the run ends
        /// (<c>await using</c>). Without it every message in a bulk send opens its own TLS
        /// connection and authenticates again, which is both slow and the fastest way to get
        /// rate-limited by the relay. Sends outside a batch are unaffected.
        /// </summary>
        Task<IAsyncDisposable> BeginBatchAsync();

        // overdue: the same template phrased for a deadline that has already passed.
        Task SendDeadlineReminderAsync(string toEmail, string toName, string requirementName, DateTime dueDate, string academicYear, int semester, bool overdue = false);
        Task SendAnnouncementEmailAsync(string toEmail, string toName, string title, string content);
        Task SendScholarWelcomeAsync(string toEmail, string toName, string tempPassword, string verifyLink);
        Task SendMessageEmailAsync(string toEmail, string toName, string senderName, string messagePreview);
        Task SendScholarApprovalDecisionAsync(string toEmail, string toName, bool approved, string? scholarshipName, string? note);
    }
}
