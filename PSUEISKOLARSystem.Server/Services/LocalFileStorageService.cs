namespace PSUEISKOLARSystem.Server.Services
{
    public class LocalFileStorageService(IConfiguration config) : IFileStorageService
    {
        private string BasePath => config["FileStorage:BasePath"]
            ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");

        public async Task<(string StoredFileName, long SizeBytes)> SaveAsync(IFormFile file, FileUploadPolicy policy)
        {
            if (file.Length > policy.MaxBytes)
                throw new InvalidOperationException($"File size exceeds the {policy.MaxDescription} limit.");

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!policy.Extensions.Contains(ext))
                throw new InvalidOperationException($"File type '{ext}' is not allowed. Accepted: {policy.Description}.");

            if (!await HasValidSignatureAsync(file, ext))
                throw new InvalidOperationException("The file content does not match its extension. Please upload a genuine, uncorrupted file.");

            Directory.CreateDirectory(BasePath);
            var stored = $"{Guid.NewGuid()}{ext}";
            var path = Path.Combine(BasePath, stored);

            await using var stream = File.Create(path);
            await file.CopyToAsync(stream);

            return (stored, file.Length);
        }

        /* Verify the file's leading "magic bytes" match its claimed extension, so a renamed
           executable/script can't be uploaded as a COR/ID (defence in depth).

           The table has to keep pace with the extension list an administrator can edit in
           System Settings. Where a type genuinely has no signature to check (plain text) —
           or is one nobody anticipated — the file is allowed through on the strength of the
           size and extension checks that already ran. Refusing it instead would mean adding
           `xlsx` to the allowed list produced "does not match its extension" on every
           upload, which reads as a bug rather than a policy. */
        private static async Task<bool> HasValidSignatureAsync(IFormFile file, string ext)
        {
            var header = new byte[12];
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

            bool At(int offset, params byte[] sig) =>
                header.Length >= offset + sig.Length && header.Skip(offset).Take(sig.Length).SequenceEqual(sig);

            // A ZIP container: docx, xlsx, and pptx are all OPC packages underneath.
            bool Zip() => Starts(0x50, 0x4B, 0x03, 0x04)
                       || Starts(0x50, 0x4B, 0x05, 0x06)
                       || Starts(0x50, 0x4B, 0x07, 0x08);

            // Microsoft's pre-2007 OLE2 compound document: doc, xls, ppt.
            bool Ole2() => Starts(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1);

            return ext switch
            {
                ".pdf"                      => Starts(0x25, 0x50, 0x44, 0x46),                          // %PDF
                ".jpg" or ".jpeg"           => Starts(0xFF, 0xD8, 0xFF),                                // JPEG SOI
                ".png"                      => Starts(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),  // PNG
                ".webp"                     => Starts(0x52, 0x49, 0x46, 0x46)                           // RIFF…
                                            && At(8, 0x57, 0x45, 0x42, 0x50),                           // …WEBP
                ".gif"                      => Starts(0x47, 0x49, 0x46, 0x38),                          // GIF8
                ".bmp"                      => Starts(0x42, 0x4D),                                      // BM
                ".doc" or ".xls" or ".ppt"  => Ole2(),
                ".docx" or ".xlsx" or ".pptx" or ".zip" => Zip(),
                _                           => true,   // no signature to check — see the note above
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
