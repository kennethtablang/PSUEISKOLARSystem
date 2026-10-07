import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { useNotifications } from '../context/NotificationContext';
import { getThreads, getThread, sendMessage } from '../api/messages';
import { getRequirements } from '../api/documents';
import { searchScholars } from '../api/lookups';
import { getCampuses } from '../api/campuses';
import { useTitle } from '../hooks/useTitle';
import { MessageSquare, Send, Plus, ArrowLeft, FileText, Search, Bot, Inbox, Building2 } from 'lucide-react';
import Modal from '../components/Modal';

const sameReq = (a, b) => (a ?? null) === (b ?? null);
const sameThread = (t, s) => t && s && t.scholarId === s.scholarId && sameReq(t.requirementId, s.requirementId);
const threadKey = t => `${t.scholarId}-${t.requirementId ?? 'none'}`;

export default function MessagesPage() {
  useTitle('Messages');
  const { token, user } = useAuth();
  const toast = useToast();
  const { subscribeToMessages, refreshMessageUnread } = useNotifications();
  const isStaff = user.role !== 'Scholar';
  // The administrator reads the inbox campus by campus: each campus's scholars and their coordinator.
  const isAdmin = user.role === 'Administrator';

  const [threads, setThreads]         = useState([]);
  const [selected, setSelected]       = useState(null);
  const [messages, setMessages]       = useState([]);
  const [body, setBody]               = useState('');
  const [sending, setSending]         = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [requirements, setRequirements] = useState([]);
  const [search, setSearch]           = useState('');
  const [onlyUnread, setOnlyUnread]   = useState(false);
  const [campuses, setCampuses]       = useState([]);
  const [campusId, setCampusId]       = useState('');   // '' = every campus
  const bottomRef = useRef(null);
  const selectedRef = useRef(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const loadThreads = useCallback(async () => {
    try { setThreads(await getThreads(token)); }
    catch { /* leave as-is */ }
  }, [token]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  useEffect(() => {
    if (!isAdmin) return;
    getCampuses(token).then(setCampuses).catch(() => { /* the list still works unfiltered */ });
  }, [isAdmin, token]);

  // Conversations and unread messages per campus, for the campus list.
  const campusStats = useMemo(() => {
    const stats = {};
    for (const t of threads) {
      const key = t.campusId ?? 'none';
      stats[key] ??= { count: 0, unread: 0 };
      stats[key].count++;
      stats[key].unread += t.unread || 0;
    }
    return stats;
  }, [threads]);
  const selectedCampus = campuses.find(c => String(c.id) === String(campusId));
  const selectedCampusCount = selectedCampus ? (campusStats[selectedCampus.id]?.count ?? 0) : 0;

  function pickCampus(id) {
    setCampusId(id);
    // The open conversation belongs to another campus: close it rather than leave it orphaned.
    if (id && selected && threads.some(t => sameThread(t, selected) && String(t.campusId) !== String(id))) setSelected(null);
  }

  // Load a thread's messages when selection changes.
  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    let cancelled = false;
    setLoadingThread(true);
    getThread(token, { scholarId: selected.scholarId, requirementId: selected.requirementId })
      .then(msgs => { if (!cancelled) setMessages(msgs); })
      .catch(e => {
        if (cancelled) return;
        setMessages([]);
        // An empty pane on its own reads as "no messages yet", not as a failed load.
        toast(e.message, 'error');
      })
      .finally(() => { if (!cancelled) setLoadingThread(false); loadThreads(); refreshMessageUnread(); });
    return () => { cancelled = true; };
  }, [selected, token, loadThreads, refreshMessageUnread, toast]);

  // Real-time: append incoming messages to the open thread; always refresh the list.
  useEffect(() => {
    return subscribeToMessages((m) => {
      const s = selectedRef.current;
      if (sameThread({ scholarId: m.scholarId, requirementId: m.requirementId ?? null }, s)) {
        setMessages(prev => prev.some(x => x.id === m.id)
          ? prev
          : [...prev, { id: m.id, senderId: m.senderId, senderName: m.senderName, mine: false, body: m.body, createdAt: m.createdAt }]);
      }
      loadThreads();
    });
  }, [subscribeToMessages, loadThreads]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Staff inboxes grow quickly, so the list is filterable.
  const displayedThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter(t => {
      if (campusId && String(t.campusId) !== String(campusId)) return false;
      if (onlyUnread && !(t.unread > 0)) return false;
      if (!q) return true;
      return (t.scholarName ?? '').toLowerCase().includes(q)
        || (t.requirementName ?? '').toLowerCase().includes(q)
        || (t.lastBody ?? '').toLowerCase().includes(q);
    });
  }, [threads, search, onlyUnread, campusId]);

  const totalUnread = threads.reduce((n, t) => n + (t.unread || 0), 0);

  async function handleSend(e) {
    e.preventDefault();
    // Enter submits from the textarea directly, bypassing the disabled Send button, so a
    // second Enter while the first request was in flight posted the message twice.
    if (sending || !body.trim() || !selected) return;
    setSending(true);
    try {
      const sent = await sendMessage({
        scholarId: selected.scholarId,
        requirementId: selected.requirementId ?? null,
        body: body.trim(),
      }, token);
      // The server may return an automatic acknowledgement alongside a scholar's first
      // message in a thread — append it so the scholar sees the reply immediately.
      const { autoReply, ...mine } = sent;
      setMessages(prev => autoReply ? [...prev, mine, autoReply] : [...prev, mine]);
      setBody('');
      loadThreads();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSending(false); }
  }

  async function openNew() {
    setShowNew(true);
    if (!isStaff && requirements.length === 0) {
      try { setRequirements(await getRequirements(token)); } catch { /* optional */ }
    }
  }

  function startThread(requirementId, requirementName) {
    setShowNew(false);
    setSelected({ scholarId: user.id, scholarName: user.fullName, requirementId: requirementId ?? null, requirementName: requirementName ?? null });
  }

  function startStaffThread(scholar) {
    setShowNew(false);
    setSelected({ scholarId: scholar.id, scholarName: scholar.fullName, requirementId: null, requirementName: null });
  }

  return (
    <Layout>
      {/* The shell is given an explicit height: it sits inside `.route-fade`, whose height is
          content-driven, so `h-full` collapsed and the inner `overflow-y-auto` panes never
          scrolled — the whole page did, pushing the composer off-screen. 58px is the topbar. */}
      <div className="p-0 sm:p-6" style={{ height: 'calc(100dvh - 58px)' }}>
        <div className="clay-card flex overflow-hidden h-full">

          {/* ── Campus list (administrator, wide screens): one campus's conversations at a time ── */}
          {isAdmin && (
            <div className="hidden xl:flex flex-col shrink-0 w-60 min-h-0"
              style={{ borderRight: '1.5px solid var(--surface-inset)' }}>
              <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: '1.5px solid var(--surface-inset)' }}>
                <h2 className="text-sm font-black flex items-center gap-1.5" style={{ color: 'var(--text-strong)' }}>
                  <Building2 size={14} strokeWidth={2.4} /> Campuses
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Scholars and their coordinator</p>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 py-1">
                <CampusItem label="All campuses" active={!campusId} count={threads.length} unread={totalUnread} onClick={() => pickCampus('')} />
                {campuses.map(c => (
                  <CampusItem key={c.id} label={c.name} active={String(c.id) === String(campusId)}
                    count={campusStats[c.id]?.count ?? 0} unread={campusStats[c.id]?.unread ?? 0}
                    onClick={() => pickCampus(String(c.id))} />
                ))}
              </div>
            </div>
          )}

          {/* ── Thread list (single-pane on mobile: hidden once a thread is open) ── */}
          <div className={`flex-col shrink-0 w-full lg:w-80 xl:w-96 min-h-0 ${selected ? 'hidden lg:flex' : 'flex'}`}
            style={{ borderRight: '1.5px solid var(--surface-inset)' }}>

            <div className="px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: '1.5px solid var(--surface-inset)' }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h1 className="text-lg font-black" style={{ color: 'var(--text-strong)' }}>Messages</h1>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {isAdmin && selectedCampus
                      ? `${selectedCampus.name} · ${selectedCampusCount} conversation${selectedCampusCount !== 1 ? 's' : ''}`
                      : isStaff
                        ? `${threads.length} conversation${threads.length !== 1 ? 's' : ''}${totalUnread > 0 ? ` · ${totalUnread} unread` : ''}`
                        : 'Chat with your coordinator'}
                  </p>
                </div>
                <button onClick={openNew} className="clay-btn clay-btn-primary px-3 py-2 text-xs flex items-center gap-1.5 shrink-0">
                  <Plus size={14} strokeWidth={2.5} /> New
                </button>
              </div>

              {/* Campus picker where the campus list does not fit. */}
              {isAdmin && (
                <select value={campusId} onChange={e => pickCampus(e.target.value)} aria-label="Campus"
                  className="clay-input xl:hidden mb-2" style={{ height: 34, minHeight: 34, fontSize: 12.5 }}>
                  <option value="">All campuses ({threads.length})</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({campusStats[c.id]?.count ?? 0})</option>
                  ))}
                </select>
              )}

              {/* Search + unread filter — a staff inbox is unusable without them. */}
              <div className="relative mb-2">
                <Search size={13} strokeWidth={2.4} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-faint)' }} />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={isStaff ? 'Search scholar, document, message…' : 'Search messages…'}
                  className="clay-input"
                  style={{ height: 34, minHeight: 34, fontSize: 12.5, paddingLeft: 30 }}
                />
              </div>
              <button
                onClick={() => setOnlyUnread(v => !v)}
                aria-pressed={onlyUnread}
                className="text-xs font-bold px-2.5 py-1 rounded-lg transition-colors"
                style={onlyUnread
                  ? { background: '#002570', color: '#fff' }
                  : { background: 'var(--surface-inset)', color: 'var(--text)' }}
              >
                Unread only{totalUnread > 0 ? ` (${totalUnread})` : ''}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {displayedThreads.length === 0 ? (
                <div className="p-8 text-center">
                  <Inbox size={26} strokeWidth={1.6} className="mx-auto" style={{ color: 'rgba(0,48,135,0.25)' }} />
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {threads.length === 0
                      ? 'No conversations yet.'
                      : selectedCampus && selectedCampusCount === 0
                        ? `No conversations from ${selectedCampus.name} yet.`
                        : 'No conversations match this filter.'}
                  </p>
                </div>
              ) : displayedThreads.map(t => (
                <button
                  key={threadKey(t)}
                  onClick={() => setSelected({ scholarId: t.scholarId, scholarName: t.scholarName, requirementId: t.requirementId, requirementName: t.requirementName })}
                  className="w-full text-left px-5 py-3.5 flex flex-col gap-1"
                  style={{
                    borderBottom: '1px solid var(--surface-inset)',
                    background: sameThread(t, selected) ? 'rgba(0,48,135,0.08)' : 'transparent',
                    borderLeft: sameThread(t, selected) ? '3px solid var(--accent)' : '3px solid transparent',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold truncate" style={{ color: 'var(--text-strong)' }}>
                      {isStaff ? t.scholarName : (t.requirementName ?? 'General')}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{relativeTime(t.lastAt)}</span>
                      {t.unread > 0 && (
                        <span className="text-xs font-bold text-white px-1.5 rounded-full"
                          style={{ background: '#d92020', minWidth: 18, textAlign: 'center' }}>
                          {t.unread}
                        </span>
                      )}
                    </div>
                  </div>
                  {isStaff && t.requirementName && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <FileText size={11} /> {t.requirementName}
                    </span>
                  )}
                  {isAdmin && !campusId && t.campusName && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
                      <Building2 size={11} /> {t.campusName}
                    </span>
                  )}
                  <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{t.lastBody}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Conversation (single-pane on mobile: shown only when a thread is open) ── */}
          <div className={`flex-1 flex-col min-h-0 ${selected ? 'flex' : 'hidden lg:flex'}`}
            style={{ minWidth: 0, background: 'var(--bg)' }}>
            {!selected ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <MessageSquare size={34} strokeWidth={1.4} style={{ color: 'rgba(0,48,135,0.25)' }} className="mx-auto" />
                  <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Select a conversation to start messaging.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-5 py-3.5 flex items-center gap-3 shrink-0"
                  style={{ background: 'var(--surface-2)', borderBottom: '1.5px solid var(--surface-inset)' }}>
                  <button onClick={() => setSelected(null)} className="lg:hidden w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--surface-inset)' }}>
                    <ArrowLeft size={16} style={{ color: 'var(--accent)' }} />
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-black truncate" style={{ color: 'var(--text-strong)' }}>
                      {isStaff ? selected.scholarName : (selected.requirementName ?? 'General')}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {isStaff ? (selected.requirementName ?? 'General enquiry') : selected.scholarName}
                    </p>
                  </div>
                </div>

                {/* Messages — this is the only pane that scrolls */}
                <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-3">
                  {loadingThread ? (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>
                  ) : messages.length === 0 ? (
                    <p className="text-xs text-center mt-6" style={{ color: 'var(--text-faint)' }}>
                      No messages yet. Say hello 👋
                    </p>
                  ) : messages.map(m => <Bubble key={m.id} m={m} />)}
                  <div ref={bottomRef} />
                </div>

                {/* Composer — pinned, because the shell now has a real height */}
                <form onSubmit={handleSend} className="p-4 flex items-end gap-2 shrink-0"
                  style={{ background: 'var(--surface-2)', borderTop: '1.5px solid var(--surface-inset)' }}>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                    rows={1}
                    maxLength={2000}
                    aria-label="Message"
                    placeholder="Type a message…"
                    className="clay-input flex-1 resize-none"
                    style={{ maxHeight: 120 }}
                  />
                  <button type="submit" disabled={!body.trim() || sending}
                    className="clay-btn clay-btn-primary flex items-center justify-center"
                    style={{ width: 44, height: 44, padding: 0, flexShrink: 0, opacity: (!body.trim() || sending) ? 0.6 : 1 }}>
                    <Send size={17} strokeWidth={2.4} />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {showNew && (isStaff
        ? <NewStaffThreadModal token={token} onClose={() => setShowNew(false)} onPick={startStaffThread} />
        : <NewScholarThreadModal requirements={requirements} onClose={() => setShowNew(false)} onPick={startThread} />
      )}
    </Layout>
  );
}

function CampusItem({ label, active, count, unread, onClick }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-2"
      style={{
        background: active ? 'rgba(0,48,135,0.08)' : 'transparent',
        borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
      }}>
      <span className="text-sm truncate" style={{ color: 'var(--text-strong)', fontWeight: active ? 800 : 600 }}>{label}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{count}</span>
        {unread > 0 && (
          <span className="text-xs font-bold text-white px-1.5 rounded-full"
            style={{ background: '#d92020', minWidth: 18, textAlign: 'center' }}>
            {unread}
          </span>
        )}
      </span>
    </button>
  );
}

function Bubble({ m }) {
  // An automatic acknowledgement is neither "mine" nor a coordinator typing — it gets its
  // own quiet treatment so nobody waits for a human who already replied.
  if (m.isAutoReply) {
    return (
      <div className="flex justify-start">
        <div className="max-w-md px-3.5 py-2.5 rounded-2xl"
          style={{
            background: 'var(--surface-inset)',
            border: '1px dashed rgba(0,48,135,0.28)',
            borderBottomLeftRadius: 4,
          }}>
          <p className="text-xs font-bold mb-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <Bot size={12} strokeWidth={2.4} />
            Scholarship Office · automatic
          </p>
          <p className="text-sm" style={{ color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</p>
          <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-faint)' }}>{shortTime(m.createdAt)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex" style={{ justifyContent: m.mine ? 'flex-end' : 'flex-start' }}>
      <div className="max-w-md px-3.5 py-2.5 rounded-2xl" style={{
        background: m.mine ? '#003087' : 'var(--surface-2)',
        color: m.mine ? '#fff' : 'var(--text-strong)',
        boxShadow: '0 1px 4px rgba(0,20,60,0.08)',
        borderBottomRightRadius: m.mine ? 4 : 16,
        borderBottomLeftRadius: m.mine ? 16 : 4,
      }}>
        {!m.mine && <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--accent)' }}>{m.senderName}</p>}
        <p className="text-sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</p>
        <p className="text-xs mt-1 text-right" style={{ color: m.mine ? 'rgba(255,255,255,0.6)' : 'var(--text-faint)' }}>
          {shortTime(m.createdAt)}
        </p>
      </div>
    </div>
  );
}

/* Scholars pick what the conversation is about. */
function NewScholarThreadModal({ requirements, onClose, onPick }) {
  return (
    <Modal
      title="New Conversation"
      subtitle="What is this about? Pick a document or start a general chat."
      onClose={onClose}
      width={440}
    >
      <div className="space-y-2 max-h-72 overflow-y-auto mb-4">
        <button onClick={() => onPick(null, null)} className="clay-card w-full text-left px-4 py-3 text-sm font-semibold"
          style={{ color: 'var(--text-strong)' }}>
          General question
        </button>
        {requirements.map(r => (
          <button key={r.id} onClick={() => onPick(r.id, r.name)} className="clay-card w-full text-left px-4 py-3 text-sm"
            style={{ color: 'var(--text-strong)' }}>
            {r.name}
          </button>
        ))}
      </div>
      <button onClick={onClose} className="clay-btn clay-btn-ghost w-full py-2.5 text-sm">Cancel</button>
    </Modal>
  );
}

/* Staff pick a scholar. Previously staff could only reply to threads scholars had opened. */
function NewStaffThreadModal({ token, onClose, onPick }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      searchScholars(token, { search: query || undefined, limit: 40 })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, token]);

  return (
    <Modal
      title="Message a Scholar"
      subtitle="Start a conversation with any scholar. They are notified by email and in-app."
      onClose={onClose}
      width={460}
    >
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="clay-input mb-3"
        placeholder="Search by name, student ID, or email…"
      />
      <div className="space-y-1.5 max-h-72 overflow-y-auto mb-4">
        {loading ? (
          <p className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>Searching…</p>
        ) : results.length === 0 ? (
          <p className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>No scholars match that search.</p>
        ) : results.map(s => (
          <button key={s.id} onClick={() => onPick(s)}
            className="clay-card-inner w-full text-left px-3.5 py-2.5 rounded-xl">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>{s.fullName}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {[s.studentId, s.scholarshipType].filter(Boolean).join(' · ') || s.email}
            </p>
          </button>
        ))}
      </div>
      <button onClick={onClose} className="clay-btn clay-btn-ghost w-full py-2.5 text-sm">Cancel</button>
    </Modal>
  );
}

function shortTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function relativeTime(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
