import { Children, cloneElement, isValidElement, useId } from 'react';

/* Elements the browser will accept as a <label for> target. A helper <p> under the input
   must not be picked, or the label would point at text instead of at the control. */
const LABELLABLE = new Set(['input', 'select', 'textarea']);

/**
 * Whether this child should receive the generated id. A host element has to be one the
 * browser can focus from a label; a component gets it and decides for itself. Fragments
 * (whose type is a symbol) are excluded — passing them props does nothing but warn.
 */
function canTakeLabel(child) {
  if (!isValidElement(child) || child.props.id) return false;
  if (typeof child.type === 'string') return LABELLABLE.has(child.type);
  return typeof child.type === 'function' || typeof child.type === 'object';
}

/**
 * A labelled form field.
 *
 * This existed three times, byte-identical, in UsersPage, AnnouncementsPage and
 * ScholarDetailPage, and none of the copies associated the label with anything: the app had
 * 99 `<input>` elements and exactly one `htmlFor`, so a screen reader announced almost every
 * field as an unlabelled edit box. Because it wraps the control, one component can generate
 * the id and wire both ends — which fixes every form that already uses it, rather than
 * needing 99 hand-written id/htmlFor pairs.
 *
 * The id goes to the first native control among the children. A child that already carries
 * an `id` is left alone. Custom controls are handed the id as a prop so they can place it on
 * whatever element they actually focus (see ScholarSearchSelect).
 */
export default function Field({ label, children, hint }) {
  const id = useId();

  // Found first, then applied — a running "have I wired it yet?" flag would be a mutation
  // that outlives the render, which the React Compiler rules reject outright.
  const items = Children.toArray(children);
  const target = items.findIndex(canTakeLabel);
  const controls = items.map((child, i) => (i === target ? cloneElement(child, { id }) : child));

  return (
    <div>
      <label
        htmlFor={target >= 0 ? id : undefined}
        className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
        style={{ color: 'var(--text)' }}
      >
        {label}
      </label>
      {controls}
      {hint && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      )}
    </div>
  );
}
