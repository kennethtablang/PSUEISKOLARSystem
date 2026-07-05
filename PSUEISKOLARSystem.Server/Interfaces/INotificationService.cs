namespace PSUEISKOLARSystem.Server.Interfaces
{
    public interface INotificationService
    {
        // Persist a notification for one user and push it in real time.
        Task CreateAsync(string recipientId, string title, string message, string category, string? linkUrl = null);

        // Persist notifications for many users and push each in real time.
        Task CreateForManyAsync(IEnumerable<string> recipientIds, string title, string message, string category, string? linkUrl = null);
    }
}
