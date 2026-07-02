namespace PSUEISKOLARSystem.Server.Models
{
    public class ScholarshipTypeRequirement
    {
        public int ScholarshipTypeId { get; set; }
        public ScholarshipType ScholarshipType { get; set; } = null!;

        public int RequirementId { get; set; }
        public DocumentRequirement Requirement { get; set; } = null!;
    }
}
