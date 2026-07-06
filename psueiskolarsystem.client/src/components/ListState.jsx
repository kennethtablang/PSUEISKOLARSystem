import { Inbox } from 'lucide-react';

/**
 * Shimmering skeleton rows for list/table pages while data loads.
 * Renders `rows` placeholder lines inside the surrounding card.
 */
export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="p-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-1 py-3.5"
          style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,48,135,0.05)' }}>
          <div className="skeleton-bar" style={{ width: '22%', height: 13 }} />
          <div className="skeleton-bar" style={{ width: '30%', height: 13 }} />
          <div className="skeleton-bar" style={{ width: '16%', height: 13 }} />
          <div className="skeleton-bar" style={{ flex: 1, height: 13 }} />
        </div>
      ))}
    </div>
  );
}

/** Standardized empty state for list pages. */
export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message }) {
  return (
    <div className="text-center py-14 px-6">
      <Icon size={34} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: '#b0bdd0' }} />
      <p className="text-sm font-bold" style={{ color: 'var(--text-strong)' }}>{title}</p>
      {message && <p className="text-sm mt-1" style={{ color: '#7a8aaa' }}>{message}</p>}
    </div>
  );
}
