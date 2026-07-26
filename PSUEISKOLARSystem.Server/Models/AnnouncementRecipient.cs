namespace PSUEISKOLARSystem.Server.Models
{
    /// <summary>
    /// Names one scholar an announcement is addressed to.
    /// <para>
    /// When an announcement has any recipients, they are the <b>only</b> audience — the
    /// role/scholarship-type/program filters are ignored, because "send this to these three
    /// scholars" should not also be narrowed by a stale program filter. An announcement with no
    /// recipients keeps the broadcast behaviour and uses the filters.
    /// </para>
    /// </summary>
    public class AnnouncementRecipient
    {
        public int AnnouncementId { get; set; }
        public Announcement Announcement { get; set; } = null!;

        public string ScholarId { get; set; } = string.Empty;
        public ApplicationUser Scholar { get; set; } = null!;
    }
}
