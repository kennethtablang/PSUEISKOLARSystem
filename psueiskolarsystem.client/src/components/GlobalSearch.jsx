import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, GraduationCap, Megaphone, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { globalSearch } from '../api/search';

const EMPTY = { scholars: [], announcements: [], requirements: [] };

/**
 * Navbar global search with a live dropdown across scholars, announcements,
 * and document requirements. Enter (or "See all scholars") falls back to the
 * scholars list filtered by the query.
 */
export default function GlobalSearch({ isDesktop }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

  /* Debounced live search */
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(EMPTY); setLoading(false); return; }
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const data = await globalSearch(token, term, controller.signal);
        setResults(data); setOpen(true);
      } catch { /* aborted or failed */ }
      finally { setLoading(false); }
    }, 300);
    return () => { clearTimeout(t); controller.abort(); };
  }, [q, token]);

  /* Close on outside click */
  useEffect(() => {
    function onClick(e) { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(url) { setOpen(false); setQ(''); navigate(url); }

  function submit(e) {
    e.preventDefault();
    const term = q.trim();
    if (term) go(`/scholars?search=${encodeURIComponent(term)}`);
  }

  const total = results.scholars.length + results.announcements.length + results.requirements.length;

  return (
    // Grows into the space the topbar has going spare, up to a width where a longer
    // field would stop helping — rather than sitting at a fixed 340px with a void beside it.
    <div ref={rootRef} style={{ position: 'relative', flex: isDesktop ? '1 1 340px' : 1, maxWidth: 460 }}>
      <form onSubmit={submit}>
        <Search size={15} strokeWidth={2.2} color="#7a8aaa"
          style={{ position: 'absolute', left: 12, top: 19, transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => { if (total > 0) setOpen(true); }}
          placeholder="Search scholars, announcements…"
          style={{
            width: '100%', height: 38, paddingLeft: 34, paddingRight: 12,
            borderRadius: 11, border: '1px solid rgba(0,48,135,0.1)',
            background: 'var(--input-bg)', fontSize: 13, color: 'var(--text-strong)', outline: 'none',
          }}
        />
      </form>

      {open && q.trim().length >= 2 && (
        <div className="clay-card-modal fade-up" style={{
          position: 'absolute', top: 46, left: 0, right: 0, zIndex: 50,
          maxHeight: 420, overflowY: 'auto', padding: 6,
        }}>
          {loading && total === 0 ? (
            <p className="text-xs px-3 py-3" style={{ color: '#7a8aaa' }}>Searching…</p>
          ) : total === 0 ? (
            <p className="text-xs px-3 py-3" style={{ color: '#7a8aaa' }}>No matches for “{q.trim()}”.</p>
          ) : (
            <>
              <Group label="Scholars" icon={GraduationCap} items={results.scholars}
                render={s => ({ key: `s${s.id}`, title: s.name, subtitle: s.email, url: `/scholars/${s.id}` })} onGo={go} />
              <Group label="Announcements" icon={Megaphone} items={results.announcements}
                render={a => ({ key: `a${a.id}`, title: a.title, url: '/announcements' })} onGo={go} />
              <Group label="Requirements" icon={ClipboardList} items={results.requirements}
                render={r => ({ key: `r${r.id}`, title: r.name, url: '/requirements' })} onGo={go} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, icon: Icon, items, render, onGo }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-1">
      <p className="text-[10px] font-bold uppercase tracking-wider px-3 pt-2 pb-1" style={{ color: '#9aaabb' }}>{label}</p>
      {items.map(item => {
        const { key, title, subtitle, url } = render(item);
        return (
          <button key={key} onClick={() => onGo(url)}
            className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/5">
            <Icon size={14} strokeWidth={2.2} style={{ color: '#003087', flexShrink: 0 }} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm truncate" style={{ color: 'var(--text-strong)' }}>{title}</span>
              {subtitle && <span className="block text-xs truncate" style={{ color: '#7a8aaa' }}>{subtitle}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
