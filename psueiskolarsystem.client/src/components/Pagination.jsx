import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZES = [10, 20, 50, 100];

/* Compact, reusable pagination with a customizable page size. */
export default function Pagination({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange, label = 'items' }) {
  return (
    <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
      <div className="flex items-center gap-2 text-xs" style={{ color: '#7a8aaa' }}>
        <span>Show</span>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="rounded-lg px-2 py-1"
          style={{ border: '1px solid rgba(0,48,135,0.14)', background: '#fff', color: '#0d1a33', fontWeight: 600 }}
        >
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span>per page · {total} {label}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ border: '1px solid rgba(0,48,135,0.14)', background: '#fff', opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}
        >
          <ChevronLeft size={15} strokeWidth={2.4} color="#003087" />
        </button>
        <span className="text-xs font-semibold px-2" style={{ color: '#4a5a7a' }}>
          {page} / {Math.max(totalPages, 1)}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ border: '1px solid rgba(0,48,135,0.14)', background: '#fff', opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}
        >
          <ChevronRight size={15} strokeWidth={2.4} color="#003087" />
        </button>
      </div>
    </div>
  );
}
