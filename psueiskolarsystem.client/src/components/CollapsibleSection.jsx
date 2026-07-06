import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * A dashboard section with a collapsible header. Collapsed state is remembered
 * per-section in localStorage so a user's layout preference persists.
 */
export default function CollapsibleSection({ id, title, children, right = null }) {
  const key = `dash-collapsed:${id}`;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(key) === 'true');

  function toggle() {
    setCollapsed(c => {
      const next = !c;
      localStorage.setItem(key, String(next));
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={toggle} className="flex items-center gap-1.5 group" aria-expanded={!collapsed}>
          {collapsed
            ? <ChevronRight size={17} strokeWidth={2.5} style={{ color: '#7a8aaa' }} />
            : <ChevronDown size={17} strokeWidth={2.5} style={{ color: '#7a8aaa' }} />}
          <h2 className="text-base font-black group-hover:opacity-80" style={{ color: 'var(--text-strong)' }}>{title}</h2>
        </button>
        {right}
      </div>
      {!collapsed && <div className="fade-up">{children}</div>}
    </div>
  );
}
