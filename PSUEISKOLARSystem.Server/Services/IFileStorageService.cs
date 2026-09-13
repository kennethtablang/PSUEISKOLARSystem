namespace PSUEISKOLARSystem.Server.Services
{
    public interface IFileStorageService
    {
        /// <summary>
        /// Writes the file to storage after checking it against <paramref name="policy"/> and
        /// verifying its magic bytes. Throws <see cref="InvalidOperationException"/> with a
        /// user-facing message if any check fails.
        /// </summary>
        Task<(string StoredFileName, long SizeBytes)> SaveAsync(IFormFile file, FileUploadPolicy policy);
        Task<(Stream Stream, string ContentType)> GetAsync(string storedFileName, string originalContentType);
        Task DeleteAsync(string storedFileName);
    }
}
