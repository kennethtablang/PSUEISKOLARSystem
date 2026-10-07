import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * A password <input> with an eye button that shows or hides what was typed.
 * Takes every prop a plain input would (except `type`), so it drops in wherever a
 * bare input was. The button is overlaid with a one-cell grid rather than absolute
 * positioning: a positioned wrapper would paint over the lock icons the pages
 * place on the left of the field.
 */
export default function PasswordInput({ style, disabled, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="grid">
      <input
        {...props}
        className={`${props.className ?? ''} [grid-area:1/1]`}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        style={{ ...style, paddingRight: '40px' }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        className="[grid-area:1/1] justify-self-end self-center mr-2 p-1.5 rounded-md"
        style={{ color: 'var(--text-muted)', opacity: disabled ? 0.5 : 1 }}>
        {visible ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
      </button>
    </div>
  );
}
