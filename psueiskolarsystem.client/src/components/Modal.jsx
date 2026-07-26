import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Nested modals each add a lock; only the last one to close releases the page scroll.
let openCount = 0;

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
    openCount += 1;
    document.body.classList.add('modal-open');
    return () => {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.classList.remove('modal-open');
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onClose?.();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dismissible, onClose]);

  useEffect(() => {
    // Focus the first field, falling back to the panel itself.
    const panel = panelRef.current;
    if (!panel) return;
    const target = panel.querySelector(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );
    (target ?? panel).focus({ preventScroll: true });
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
