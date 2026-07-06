import { createContext, useContext, useState, useCallback, useRef } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

const UIContext = createContext(null);
let idSeq = 0;

const TOAST_STYLE = {
  success: { bg: '#e7f7ee', border: '#9bdcb6', color: '#0a5a3a', Icon: CheckCircle },
  error:   { bg: '#fff0f0', border: '#f5b0b0', color: '#b03030', Icon: AlertTriangle },
  info:    { bg: '#eef6ff', border: '#bcd4f5', color: '#003087', Icon: Info },
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

      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380, pointerEvents: 'none' }}>
        {toasts.map(t => {
          const s = TOAST_STYLE[t.type] ?? TOAST_STYLE.info;
          return (
            <div key={t.id} className="fade-up"
              style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 14, fontSize: 13.5, fontWeight: 500, background: s.bg, color: s.color, border: `1.5px solid ${s.border}`, boxShadow: '0 8px 24px rgba(0,20,60,0.14)' }}>
              <s.Icon size={16} strokeWidth={2.4} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{ flexShrink: 0, opacity: 0.6, cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', padding: 0 }}>
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
