namespace PSUEISKOLARSystem.Server.Services
{
    public interface IFileStorageService
    {
        Task<(string StoredFileName, long SizeBytes)> SaveAsync(IFormFile file);
        Task<(Stream Stream, string ContentType)> GetAsync(string storedFileName, string originalContentType);
        Task DeleteAsync(string storedFileName);
    }
}
