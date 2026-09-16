import { FileX } from 'lucide-react';

/**
 * Renders a submitted document inline from a blob URL (see previewFile in api/documents).
 * PDFs and images display in place; anything else the server refuses to serve inline, so it
 * gets a "use Download" placeholder instead.
 */
export default function DocumentPreview({ preview }) {
  const { url, contentType, fileName } = preview;
  const isPdf   = contentType === 'application/pdf';
  const isImage = contentType?.startsWith('image/');

  if (isPdf) {
    return (
      <iframe
        src={url}
        title={fileName}
        className="w-full h-full"
        style={{ border: 'none', display: 'block' }}
      />
    );
  }

  if (isImage) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 overflow-auto">
        <img
          src={url}
          alt={fileName}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
        />
      </div>
    );
  }

  // Word docs and other unsupported types
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(0,37,112,0.07)', border: '1.5px solid rgba(0,37,112,0.12)' }}>
        <FileX size={28} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <p className="font-bold text-sm mb-1" style={{ color: 'var(--text-strong)' }}>Preview Not Available</p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)', maxWidth: 240 }}>
          This file type cannot be previewed in the browser. Use the Download button to open it.
        </p>
      </div>
    </div>
  );
}
