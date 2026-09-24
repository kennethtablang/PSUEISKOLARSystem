namespace PSUEISKOLARSystem.Server.Models.Enums
{
    /// <summary>What an <see cref="Models.EligibilityRecord"/> entitles its student to.</summary>
    public static class EligibilityKinds
    {
        public const string Scholar = "Scholar";
        public const string Grantee = "Grantee";

        public static readonly string[] All = [Scholar, Grantee];
    }
}
