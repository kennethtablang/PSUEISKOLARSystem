import { createContext, useContext, useState, useCallback, useRef } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

const UIContext = createContext(null);
let idSeq = 0;

const TOAST_STYLE = {
  // Theme tokens, not literals: the success toast was a bright mint slab in dark mode.
  success: { bg: 'var(--tone-ok-bg)', border: 'var(--tone-ok-border)', color: 'var(--tone-ok-fg)', Icon: CheckCircle },
  error:   { bg: 'var(--danger-bg)', border: 'var(--danger-border)', color: 'var(--danger)', Icon: AlertTriangle },
  info:    { bg: 'var(--accent-soft-bg)', border: 'var(--accent-soft-border)', color: 'var(--accent)', Icon: Info },
};

/**
 * App-wide UI helpers: transient toasts and a promise-based confirm dialog,
 * replacing native alert()/confirm() for a consistent look.
 *
 *   const toast = useToast();      toast('Saved', 'success');
 *   const confirm = useConfirm();  if (!(await confirm({ message: 'Delete?' }))) return;
 */
export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const resolverRef = useRef(null);

  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);

  const toast = useCallback((message, type = 'info') => {
    const id = ++idSeq;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  const confirm = useCallback(opts => new Promise(resolve => {
    // A new prompt replaces any still open; settle that one as "cancelled" rather than
    // leaving its caller awaiting a promise that never resolves.
    resolverRef.current?.(false);
    resolverRef.current = resolve;
    setConfirmState(typeof opts === 'string' ? { message: opts } : opts);
  }), []);

  function closeConfirm(result) {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setConfirmState(null);
  }

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}

      <div aria-live="polite" style={{ position: 'fixed', top: 16, right: 16, left: 16, marginLeft: 'auto', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, maxWidth: 380, pointerEvents: 'none' }}>
        {toasts.map(t => {
          const s = TOAST_STYLE[t.type] ?? TOAST_STYLE.info;
          return (
            <div key={t.id} className="fade-up" role={t.type === 'error' ? 'alert' : 'status'}
              style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 14, fontSize: 13.5, fontWeight: 500, background: s.bg, color: s.color, border: `1.5px solid ${s.border}`, boxShadow: '0 8px 24px rgba(0,20,60,0.14)' }}>
              <s.Icon size={16} strokeWidth={2.4} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" style={{ flexShrink: 0, opacity: 0.6, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', padding: 0 }}>
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? 'Are you sure?'}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel ?? 'Confirm'}
        cancelLabel={confirmState?.cancelLabel ?? 'Cancel'}
        danger={confirmState?.danger}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />
    </UIContext.Provider>
  );
}

export function useToast() {
  return useContext(UIContext).toast;
}

export function useConfirm() {
  return useContext(UIContext).confirm;
}
