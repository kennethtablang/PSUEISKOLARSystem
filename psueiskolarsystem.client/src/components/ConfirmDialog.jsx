import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/**
 * Reusable confirmation dialog to replace native window.confirm().
 *
 * Usage:
 *   const [confirm, setConfirm] = useState(null);
 *   <ConfirmDialog open={!!confirm} {...confirm} onCancel={() => setConfirm(null)} />
 *   setConfirm({ title, message, confirmLabel, danger, onConfirm });
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmBtn = useRef(null);

  /* The confirm button is the natural default action here, so take focus from
     Modal's first-field default. */
  useEffect(() => {
    if (open) confirmBtn.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      onClose={onCancel}
      dismissible={!busy}
      width={400}
      variant="confirm"
      bare
    >
      <div className="clay-card-modal p-6">
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: 40, height: 40,
              background: danger ? 'rgba(220,38,38,0.12)' : 'rgba(0,48,135,0.10)',
              color: danger ? '#dc2626' : '#003087',
            }}
          >
            <AlertTriangle size={20} strokeWidth={2.4} />
          </div>
          <div className="flex-1 pt-0.5">
            <h2 className="text-base font-black mb-1" style={{ color: 'var(--text-strong)' }}>
              {title}
            </h2>
            {message && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtn}
            onClick={onConfirm}
            disabled={busy}
            className={`clay-btn ${danger ? 'clay-btn-danger' : 'clay-btn-primary'} flex-1 py-2.5 text-sm`}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
