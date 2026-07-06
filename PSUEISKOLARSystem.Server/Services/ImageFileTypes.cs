namespace PSUEISKOLARSystem.Server.Services
{
    // Shared image type helpers used by the announcement and requirement-sample
    // image endpoints (previously duplicated in both controllers).
    public static class ImageFileTypes
    {
        public static readonly HashSet<string> Extensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".png", ".jpg", ".jpeg", ".webp",
        };

        public static string ContentTypeFor(string fileName) =>
            Path.GetExtension(fileName).ToLowerInvariant() switch
            {
                ".png"  => "image/png",
                ".webp" => "image/webp",
                _       => "image/jpeg",
            };
    }
}
