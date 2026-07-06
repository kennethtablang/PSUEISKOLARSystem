namespace PSUEISKOLARSystem.Server.Services
{
    public class LocalFileStorageService(IConfiguration config) : IFileStorageService
    {
        private static readonly HashSet<string> AllowedExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"];
        private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

        private string BasePath => config["FileStorage:BasePath"]
            ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");

        public async Task<(string StoredFileName, long SizeBytes)> SaveAsync(IFormFile file)
        {
            if (file.Length > MaxFileSizeBytes)
                throw new InvalidOperationException("File size exceeds the 10 MB limit.");

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext))
                throw new InvalidOperationException($"File type '{ext}' is not allowed. Accepted: PDF, JPG, PNG, WEBP, DOC, DOCX.");

            if (!await HasValidSignatureAsync(file, ext))
                throw new InvalidOperationException("The file content does not match its extension. Please upload a genuine, uncorrupted file.");

            Directory.CreateDirectory(BasePath);
            var stored = $"{Guid.NewGuid()}{ext}";
            var path = Path.Combine(BasePath, stored);

            await using var stream = File.Create(path);
            await file.CopyToAsync(stream);

            return (stored, file.Length);
        }

        // Verify the file's leading "magic bytes" match its claimed extension, so a
        // renamed executable/script can't be uploaded as a COR/ID (defence in depth).
        private static async Task<bool> HasValidSignatureAsync(IFormFile file, string ext)
        {
            var header = new byte[8];
            await using (var probe = file.OpenReadStream())
            {
                int read = 0;
                while (read < header.Length)
                {
                    int n = await probe.ReadAsync(header.AsMemory(read));
                    if (n == 0) break;
                    read += n;
                }
                if (read < header.Length) Array.Resize(ref header, read);
            }

            bool Starts(params byte[] sig) =>
                header.Length >= sig.Length && header.Take(sig.Length).SequenceEqual(sig);

            return ext switch
            {
                ".pdf"           => Starts(0x25, 0x50, 0x44, 0x46),                          // %PDF
                ".jpg" or ".jpeg" => Starts(0xFF, 0xD8, 0xFF),                               // JPEG SOI
                ".png"           => Starts(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),  // PNG
                ".webp"          => Starts(0x52, 0x49, 0x46, 0x46),                          // RIFF (WEBP container)
                ".doc"           => Starts(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1),  // OLE2 compound
                ".docx"          => Starts(0x50, 0x4B, 0x03, 0x04),                          // ZIP (PK..)
                _                => false,
            };
        }

        public Task<(Stream Stream, string ContentType)> GetAsync(string storedFileName, string originalContentType)
        {
            var path = Path.Combine(BasePath, storedFileName);
            if (!File.Exists(path))
                throw new FileNotFoundException("File not found.", storedFileName);

            Stream stream = File.OpenRead(path);
            return Task.FromResult((stream, originalContentType));
        }

        public Task DeleteAsync(string storedFileName)
        {
            var path = Path.Combine(BasePath, storedFileName);
            if (File.Exists(path)) File.Delete(path);
            return Task.CompletedTask;
        }
    }
}
