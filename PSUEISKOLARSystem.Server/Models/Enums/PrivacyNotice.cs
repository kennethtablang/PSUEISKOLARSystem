namespace PSUEISKOLARSystem.Server.Models.Enums
{
    // Current data-privacy notice version. Bump this whenever the notice text
    // changes — users who accepted an older version are re-prompted for consent.
    // Keep in sync with the client (src/constants/privacy.js).
    public static class PrivacyNotice
    {
        public const string CurrentVersion = "1.0";
    }
}
