namespace PSUEISKOLARSystem.Server.Services
{
    public class LocalFileStorageService(IConfiguration config) : IFileStorageService
    {
        private static readonly HashSet<string> AllowedExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
        private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB

        private string BasePath => config["FileStorage:BasePath"]
            ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");

        public async Task<(string StoredFileName, long SizeBytes)> SaveAsync(IFormFile file)
        {
            if (file.Length > MaxFileSizeBytes)
                throw new InvalidOperationException("File size exceeds the 10 MB limit.");

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext))
                throw new InvalidOperationException($"File type '{ext}' is not allowed. Accepted: PDF, JPG, PNG, DOC, DOCX.");

            Directory.CreateDirectory(BasePath);
            var stored = $"{Guid.NewGuid()}{ext}";
            var path = Path.Combine(BasePath, stored);

            await using var stream = File.Create(path);
            await file.CopyToAsync(stream);

            return (stored, file.Length);
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
