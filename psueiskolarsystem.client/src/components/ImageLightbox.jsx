import { X } from 'lucide-react';
import Modal from './Modal';

/** Full-bleed image viewer used for document sample images. */
export default function ImageLightbox({ url, caption, alt = 'Image', onClose }) {
  return (
    <Modal onClose={onClose} width={1100} bare>
      <div className="relative" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center z-10"
          style={{ background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.28)' }}
        >
          <X size={16} color="#0d1a33" strokeWidth={2.5} />
        </button>
        {caption && (
          <p className="text-white text-sm font-semibold mb-2 text-center drop-shadow">{caption}</p>
        )}
        <img
          src={url}
          alt={alt}
          style={{
            maxWidth: '100%',
            maxHeight: '80dvh',
            borderRadius: 12,
            display: 'block',
            margin: '0 auto',
            boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
          }}
        />
      </div>
    </Modal>
  );
}
