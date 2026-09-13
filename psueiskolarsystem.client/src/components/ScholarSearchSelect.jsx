import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Check, ChevronDown } from 'lucide-react';
import { searchScholars } from '../api/lookups';

/**
 * Single-select scholar picker with a type-ahead.
 *
 * A plain `<select>` cannot work here: the option list is the whole scholar roster, it is
 * capped server-side, and staff know the person by name or student number rather than by
 * position in an alphabetical list. This queries `/api/lookups/scholars` as you type
 * (debounced), so the list is never truncated at an arbitrary first-100 and a scholar is
 * found by name, student ID, or email.
 *
 * Controlled by `value` (a scholar id) plus `initialLabel` — the label is passed in rather
 * than looked up so an existing record still shows the right name before any search runs.
 */
export default function ScholarSearchSelect({
  token,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search by name, student ID, or email…',
  initialLabel = '',
  autoFocus = false,
  // Handed down by Field so its <label for> lands on whichever element is focusable at
  // the time — the closed trigger button, or the search box once it opens.
  id,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  // Names of everyone we have seen, so the chosen scholar keeps their label after the
  // search text changes and the result list no longer contains them.
  const [labels, setLabels] = useState(() => (value && initialLabel ? { [value]: initialLabel } : {}));

  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const selectedLabel = value ? (labels[value] ?? initialLabel ?? 'Selected scholar') : '';

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      searchScholars(token, { search: query || undefined, limit: 25 })
        .then(rows => {
          if (cancelled) return;
          setResults(rows);
          setActive(0);
          setLabels(prev => {
            const next = { ...prev };
            for (const r of rows) next[r.id] = r.fullName;
            return next;
          });
        })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, token, open]);

  // Close when the click lands anywhere else on the page.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const hint = useMemo(() => {
    if (loading && results.length === 0) return 'Searching…';
    if (results.length === 0) return query ? 'No scholar matches that search.' : 'No scholars available.';
    return null;
  }, [loading, results.length, query]);

  function pick(scholar) {
    setLabels(prev => ({ ...prev, [scholar.id]: scholar.fullName }));
    onChange(scholar.id, scholar);
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();      // never submits the surrounding form by accident
      if (results[active]) pick(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <div ref={boxRef}>
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-haspopup="listbox"
          aria-expanded="false"
          className="clay-input flex items-center gap-2 text-left"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
        >
          {value ? (
            <>
              <span className="flex-1 min-w-0 truncate text-sm" style={{ color: 'var(--text-strong)' }}>
                {selectedLabel}
              </span>
              {!disabled && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label="Clear selection"
                  onClick={e => { e.stopPropagation(); onChange('', null); }}
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}
                >
                  <X size={11} strokeWidth={3} />
                </span>
              )}
            </>
          ) : (
            <>
              <Search size={14} strokeWidth={2.4} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span className="flex-1 truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                {placeholder}
              </span>
            </>
          )}
          <ChevronDown size={14} strokeWidth={2.4} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        id={id}
        ref={inputRef}
        autoFocus={autoFocus}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        className="clay-input"
        placeholder={placeholder}
        role="combobox"
        aria-expanded="true"
        aria-autocomplete="list"
        aria-controls={`${id ?? 'scholar-search'}-listbox`}
        aria-activedescendant={results[active] ? `${id ?? 'scholar-search'}-opt-${results[active].id}` : undefined}
      />
      <div
        id={`${id ?? 'scholar-search'}-listbox`}
        role="listbox"
        className="rounded-xl overflow-hidden"
        style={{
          position: 'absolute',
          zIndex: 30,
          left: 0,
          right: 0,
          marginTop: 6,
          maxHeight: 236,
          overflowY: 'auto',
          background: 'var(--surface-modal)',
          border: '1px solid var(--accent-soft-border)',
          boxShadow: '0 14px 34px rgba(0, 12, 40, 0.22)',
        }}
      >
        {hint ? (
          <p className="text-xs px-3.5 py-3" style={{ color: 'var(--text-muted)' }}>{hint}</p>
        ) : results.map((s, i) => {
          const on = s.id === value;
          return (
            <button
              key={s.id}
              id={`${id ?? 'scholar-search'}-opt-${s.id}`}
              type="button"
              role="option"
              aria-selected={on}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(s)}
              className="w-full text-left flex items-start gap-2.5 px-3.5 py-2.5"
              style={{
                borderTop: i > 0 ? '1px solid var(--hairline)' : undefined,
                background: i === active ? 'var(--accent-wash)' : 'transparent',
              }}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate" style={{ color: 'var(--text-strong)' }}>
                  {s.fullName}
                </span>
                <span className="block text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {[s.studentId, s.scholarshipType].filter(Boolean).join(' · ') || s.email}
                </span>
              </span>
              {on && <Check size={14} strokeWidth={2.6} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
