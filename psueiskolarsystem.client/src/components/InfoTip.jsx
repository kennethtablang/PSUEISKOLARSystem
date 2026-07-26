import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

/**
 * Explains what a figure or chart actually measures.
 *
 * Opens on hover and on keyboard focus, closes on blur, Escape, or pointer-leave, and is
 * reachable by tab — a tooltip that only appears on hover is invisible to keyboard and
 * touch users. The bubble is portalled to <body> and positioned from the trigger's own
 * rect so it is never clipped by a card's `overflow: hidden`.
 */
export default function InfoTip({ text, label = 'More information', size = 13, align = 'center' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const id = useId();

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 240;
    let left = align === 'end'
      ? r.right - width
      : r.left + r.width / 2 - width / 2;
    // Keep the bubble inside the viewport on narrow screens.
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

    // Prefer above; flip below when there isn't room.
    const above = r.top > 120;
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, width, above });
  }

  function show() { place(); setOpen(true); }
  function hide() { setOpen(false); }

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') hide(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={e => { e.preventDefault(); open ? hide() : show(); }}
        className="info-tip-trigger"
      >
        <Info size={size} strokeWidth={2.3} />
      </button>

      {open && pos && createPortal(
        <div
          id={id}
          role="tooltip"
          className="info-tip-bubble"
          style={{
            left: pos.left,
            top: pos.top,
            width: pos.width,
            transform: pos.above ? 'translateY(-100%)' : undefined,
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
}
