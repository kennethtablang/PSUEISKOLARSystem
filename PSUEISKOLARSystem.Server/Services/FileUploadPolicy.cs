using PSUEISKOLARSystem.Server.Models;

namespace PSUEISKOLARSystem.Server.Services
{
    /// <summary>
    /// What one upload endpoint accepts: a size ceiling and a set of extensions.
    /// <para>
    /// The storage layer used to carry its own hardcoded copy of both, which quietly
    /// disagreed with <see cref="SystemSettings"/>. Raising <c>MaxUploadMb</c> to 20 let a
    /// 15 MB file past the controller only for storage to refuse it with "exceeds the 10 MB
    /// limit" — the setting looked like it worked and did not. The caller now states the
    /// policy, so there is exactly one place each value comes from.
    /// </para>
    /// </summary>
    public sealed record FileUploadPolicy(long MaxBytes, IReadOnlySet<string> Extensions, string Description)
    {
        /// <summary>Scholar document uploads, as configured in System Settings.</summary>
        public static FileUploadPolicy ForDocuments(SystemSettings settings) => new(
            (long)settings.MaxUploadMb * 1024 * 1024,
            settings.ExtensionSet(),
            settings.AllowedFileExtensions);

        /// <summary>
        /// Avatars, announcement images, and requirement samples. These are decoration
        /// rather than records, so they are not administrator-configurable: 4 MB is already
        /// far more than a photo displayed at 96px needs.
        /// </summary>
        public static readonly FileUploadPolicy Images =
            new(4L * 1024 * 1024, ImageFileTypes.Extensions, "PNG, JPG, or WEBP");

        public string MaxDescription => MaxBytes >= 1024 * 1024
            ? $"{MaxBytes / 1024 / 1024} MB"
            : $"{MaxBytes / 1024} KB";
    }
}
