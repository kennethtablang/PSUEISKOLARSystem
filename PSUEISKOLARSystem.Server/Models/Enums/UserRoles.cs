namespace PSUEISKOLARSystem.Server.Models.Enums
{
    public static class UserRoles
    {
        public const string Administrator = "Administrator";
        public const string ScholarshipCoordinator = "ScholarshipCoordinator";
        public const string Scholar = "Scholar";

        // A student who receives one-time grants but holds no scholarship. The account is
        // created by cross-matching the master list and deactivated once the grant is released.
        public const string Grantee = "Grantee";

        public static readonly string[] All =
        [
            Administrator,
            ScholarshipCoordinator,
            Scholar,
            Grantee
        ];
    }
}
