namespace PSUEISKOLARSystem.Server.Models
{
    public class AuditLog
    {
        public int Id { get; set; }

        public required string UserId { get; set; }

        public required string Action { get; set; }

        public string? Details { get; set; }

        public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
    }
}
