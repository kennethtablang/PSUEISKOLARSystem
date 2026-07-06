import { useEffect, useRef, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { useNotifications } from '../context/NotificationContext';
import { getThreads, getThread, sendMessage } from '../api/messages';
import { getRequirements } from '../api/documents';
import { useTitle } from '../hooks/useTitle';
import { MessageSquare, Send, Plus, ArrowLeft, FileText } from 'lucide-react';

const sameReq = (a, b) => (a ?? null) === (b ?? null);
const sameThread = (t, s) => t && s && t.scholarId === s.scholarId && sameReq(t.requirementId, s.requirementId);

export default function MessagesPage() {
  useTitle('Messages');
  const { token, user } = useAuth();
  const toast = useToast();
  const { subscribeToMessages, refreshMessageUnread } = useNotifications();
  const isStaff = user.role !== 'Scholar';

  const [threads, setThreads]         = useState([]);
  const [selected, setSelected]       = useState(null);
  const [messages, setMessages]       = useState([]);
  const [body, setBody]               = useState('');
  const [sending, setSending]         = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [requirements, setRequirements] = useState([]);
  const bottomRef = useRef(null);
  const selectedRef = useRef(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const loadThreads = useCallback(async () => {
    try { setThreads(await getThreads(token)); }
    catch { /* leave as-is */ }
  }, [token]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Load a thread's messages when selection changes.
  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    let cancelled = false;
    setLoadingThread(true);
    getThread(token, { scholarId: selected.scholarId, requirementId: selected.requirementId })
      .then(msgs => { if (!cancelled) setMessages(msgs); })
      .catch(() => { if (!cancelled) setMessages([]); })
      .finally(() => { if (!cancelled) setLoadingThread(false); loadThreads(); refreshMessageUnread(); });
    return () => { cancelled = true; };
  }, [selected, token, loadThreads, refreshMessageUnread]);

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

  async function handleSend(e) {
    e.preventDefault();
    if (!body.trim() || !selected) return;
    setSending(true);
    try {
      const sent = await sendMessage({
        scholarId: selected.scholarId,
        requirementId: selected.requirementId ?? null,
        body: body.trim(),
      }, token);
      setMessages(prev => [...prev, sent]);
      setBody('');
      loadThreads();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSending(false); }
  }

  async function openNew() {
    setShowNew(true);
    if (requirements.length === 0) {
      try { setRequirements(await getRequirements(token)); } catch { /* optional */ }
    }
  }

  function startThread(requirementId, requirementName) {
    setShowNew(false);
    setSelected({ scholarId: user.id, scholarName: user.fullName, requirementId: requirementId ?? null, requirementName: requirementName ?? null });
  }

  return (
    <Layout>
      <div className="flex h-full" style={{ minHeight: 0 }}>

        {/* ── Thread list (single-pane on mobile: hidden once a thread is open) ── */}
        <div className={`flex-col shrink-0 w-full lg:w-80 ${selected ? 'hidden lg:flex' : 'flex'}`}
          style={{ borderRight: '1.5px solid var(--surface-inset)' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1.5px solid var(--surface-inset)' }}>
            <div>
              <h1 className="text-lg font-black" style={{ color: 'var(--text-strong)' }}>Messages</h1>
              <p className="text-xs" style={{ color: '#7a8aaa' }}>{isStaff ? 'Scholar conversations' : 'Chat with your coordinator'}</p>
            </div>
            {!isStaff && (
              <button onClick={openNew} className="clay-btn clay-btn-primary px-3 py-2 text-xs flex items-center gap-1.5">
                <Plus size={14} strokeWidth={2.5} /> New
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare size={26} strokeWidth={1.6} color="rgba(0,48,135,0.25)" />
                <p className="mt-2 text-xs" style={{ color: '#7a8aaa' }}>No conversations yet.</p>
              </div>
            ) : threads.map(t => (
              <button
                key={`${t.scholarId}-${t.requirementId ?? 'none'}`}
                onClick={() => setSelected({ scholarId: t.scholarId, scholarName: t.scholarName, requirementId: t.requirementId, requirementName: t.requirementName })}
                className="w-full text-left px-5 py-3.5 flex flex-col gap-1"
                style={{
                  borderBottom: '1px solid #f0f4fa',
                  background: sameThread(t, selected) ? 'rgba(0,48,135,0.06)' : 'transparent',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold truncate" style={{ color: 'var(--text-strong)' }}>
                    {isStaff ? t.scholarName : (t.requirementName ?? 'General')}
                  </span>
                  {t.unread > 0 && (
                    <span className="shrink-0 text-xs font-bold text-white px-1.5 rounded-full" style={{ background: '#d92020', minWidth: 18, textAlign: 'center' }}>
                      {t.unread}
                    </span>
                  )}
                </div>
                {isStaff && t.requirementName && (
                  <span className="text-xs flex items-center gap-1" style={{ color: '#7a8aaa' }}>
                    <FileText size={11} /> {t.requirementName}
                  </span>
                )}
                <span className="text-xs truncate" style={{ color: '#8a94a6' }}>{t.lastBody}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Conversation (single-pane on mobile: shown only when a thread is open) ── */}
        <div className={`flex-1 flex-col ${selected ? 'flex' : 'hidden lg:flex'}`} style={{ minWidth: 0, background: 'var(--bg)' }}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare size={34} strokeWidth={1.4} color="rgba(0,48,135,0.25)" />
                <p className="mt-3 text-sm" style={{ color: '#7a8aaa' }}>Select a conversation to start messaging.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-5 py-3.5 flex items-center gap-3" style={{ background: 'var(--surface-2)', borderBottom: '1.5px solid var(--surface-inset)' }}>
                <button onClick={() => setSelected(null)} className="lg:hidden w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-inset)' }}>
                  <ArrowLeft size={16} color="#003087" />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-black truncate" style={{ color: 'var(--text-strong)' }}>
                    {isStaff ? selected.scholarName : (selected.requirementName ?? 'General')}
                  </p>
                  <p className="text-xs" style={{ color: '#7a8aaa' }}>
                    {isStaff ? (selected.requirementName ?? 'General') : selected.scholarName}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loadingThread ? (
                  <p className="text-xs" style={{ color: '#7a8aaa' }}>Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-center mt-6" style={{ color: '#9aaabb' }}>No messages yet. Say hello 👋</p>
                ) : messages.map(m => (
                  <div key={m.id} className="flex" style={{ justifyContent: m.mine ? 'flex-end' : 'flex-start' }}>
                    <div className="max-w-md px-3.5 py-2.5 rounded-2xl" style={{
                      background: m.mine ? '#003087' : 'var(--surface-2)',
                      color: m.mine ? '#fff' : 'var(--text-strong)',
                      boxShadow: '0 1px 4px rgba(0,20,60,0.08)',
                      borderBottomRightRadius: m.mine ? 4 : 16,
                      borderBottomLeftRadius: m.mine ? 16 : 4,
                    }}>
                      {!m.mine && <p className="text-xs font-bold mb-0.5" style={{ color: '#003087' }}>{m.senderName}</p>}
                      <p className="text-sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</p>
                      <p className="text-xs mt-1" style={{ color: m.mine ? 'rgba(255,255,255,0.6)' : '#9aaabb', textAlign: 'right' }}>
                        {new Date(m.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <form onSubmit={handleSend} className="p-4 flex items-end gap-2" style={{ background: 'var(--surface-2)', borderTop: '1.5px solid var(--surface-inset)' }}>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                  rows={1}
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

      {/* New conversation picker (scholar) */}
      {showNew && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,20,60,0.45)' }}>
          <div className="clay-card-modal w-full max-w-md p-7">
            <h2 className="text-base font-black mb-1.5" style={{ color: 'var(--text-strong)' }}>New Conversation</h2>
            <p className="text-sm mb-4" style={{ color: '#5a6a85' }}>What is this about? Pick a document or start a general chat.</p>
            <div className="space-y-2 max-h-72 overflow-y-auto mb-4">
              <button onClick={() => startThread(null, null)} className="clay-card w-full text-left px-4 py-3 text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>
                General question
              </button>
              {requirements.map(r => (
                <button key={r.id} onClick={() => startThread(r.id, r.name)} className="clay-card w-full text-left px-4 py-3 text-sm" style={{ color: 'var(--text-strong)' }}>
                  {r.name}
                </button>
              ))}
            </div>
            <button onClick={() => setShowNew(false)} className="clay-btn clay-btn-ghost w-full py-2.5 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </Layout>
  );
}
