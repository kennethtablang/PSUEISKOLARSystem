namespace PSUEISKOLARSystem.Server.Models.Enums
{
    public static class UserRoles
    {
        public const string Administrator = "Administrator";
        public const string ScholarshipCoordinator = "ScholarshipCoordinator";
        public const string Scholar = "Scholar";

        public static readonly string[] All =
        [
            Administrator,
            ScholarshipCoordinator,
            Scholar
        ];
    }
}
