import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Open dialogs, oldest first. Nested modals each add a lock; only the last one to close
// releases the page scroll. The stack also decides who owns the keyboard: every modal listens
// on `document`, so without it one Escape closed a confirm dialog *and* the form beneath it
// (losing whatever was typed), and Tab was trapped by two panels at once.
const stack = [];

// Everything the browser will let Tab reach, minus anything explicitly removed from the
// order. Kept as one selector so the focus trap and the initial-focus search agree.
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * The single modal shell used across the app.
 *
 * It portals to <body> rather than rendering in place, because page content sits inside
 * `.route-fade` — a transformed element, and therefore its own stacking context — so an
 * in-place modal can never paint above the sticky topbar whatever its z-index. The portal
 * also lets one backdrop own the blur + PSU-blue tint behind every dialog.
 *
 * Closes on Escape and on a backdrop click, locks background scroll, and moves focus into
 * the panel so keyboard users land inside the dialog.
 */
export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  width = 520,
  variant = 'default',      // 'default' | 'confirm' — confirm sits above other modals
  dismissible = true,       // false while a request is in flight
  closeOnBackdrop = true,
  bare = false,             // no chrome: image lightboxes and similar
  labelledBy,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    const entry = panelRef;
    stack.push(entry);
    document.body.classList.add('modal-open');
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) document.body.classList.remove('modal-open');
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      // Only the topmost dialog responds; the ones beneath wait their turn.
      if (stack[stack.length - 1] !== panelRef) return;

      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onClose?.();
        return;
      }

      /* Keep Tab inside the dialog. Without this the focus ring walks straight out of the
         panel and onto the page behind it, which a sighted mouse user never notices and a
         keyboard user cannot recover from — the page is inert to the eye (backdrop, scroll
         lock) but still fully tabbable. Wrapping at both ends is what makes `aria-modal`
         true rather than merely asserted. */
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = [...panel.querySelectorAll(FOCUSABLE)]
        .filter(el => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dismissible, onClose]);

  useEffect(() => {
    // Focus the first field, falling back to the panel itself.
    const panel = panelRef.current;
    if (!panel) return;

    // Whatever had focus when the dialog opened — almost always the button that opened it.
    // Returning focus there on close is what keeps a keyboard user's place in the page;
    // without it focus falls back to <body> and the next Tab starts from the top.
    const opener = document.activeElement;

    const target = panel.querySelector(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );
    (target ?? panel).focus({ preventScroll: true });

    return () => {
      if (opener instanceof HTMLElement && document.contains(opener))
        opener.focus({ preventScroll: true });
    };
  }, []);

  function handleBackdropClick(e) {
    if (e.target !== e.currentTarget) return;
    if (closeOnBackdrop && dismissible) onClose?.();
  }

  return createPortal(
    <div
      className={`modal-backdrop${variant === 'confirm' ? ' modal-backdrop-confirm' : ''}`}
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : (typeof title === 'string' ? title : undefined)}
        aria-labelledby={labelledBy}
        className={bare ? 'modal-panel' : 'modal-panel clay-card-modal'}
        style={{ maxWidth: width, outline: 'none' }}
      >
        {bare ? children : (
          <>
            {(title || onClose) && (
              <div className="modal-head">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 className="text-base font-black leading-snug" style={{ color: 'var(--text-strong)' }}>
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {subtitle}
                    </p>
                  )}
                </div>
                {onClose && (
                  <button
                    type="button"
                    onClick={() => dismissible && onClose()}
                    className="modal-close"
                    aria-label="Close"
                    disabled={!dismissible}
                    style={{ opacity: dismissible ? 1 : 0.4, cursor: dismissible ? 'pointer' : 'not-allowed' }}
                  >
                    <X size={16} strokeWidth={2.6} />
                  </button>
                )}
              </div>
            )}
            <div className="modal-body">{children}</div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
