import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../api/announcements';
import { useTitle } from '../hooks/useTitle';

const ROLES = ['', 'Scholar', 'ScholarshipCoordinator'];
const ROLE_LABELS = { '': 'All Users', Scholar: 'Scholars', ScholarshipCoordinator: 'Coordinators' };

export default function AnnouncementsPage() {
  useTitle('Announcements');
  const { token } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const a = await getAnnouncements(token);
      setAnnouncements(a);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Delete this announcement?')) return;
    await deleteAnnouncement(id, token);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  }

  function openEdit(a) { setEditing(a); setShowModal(true); }
  function openCreate() { setEditing(null); setShowModal(true); }

  return (
    <Layout>
      <div className="p-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Announcements</h1>
            <p className="page-subtitle">{announcements.length} announcement{announcements.length !== 1 ? 's' : ''}</p>
            <span className="page-title-bar" />
          </div>
          <button onClick={openCreate} className="clay-btn clay-btn-primary px-4 py-2.5 text-sm">
            + New Announcement
          </button>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
        ) : announcements.length === 0 ? (
          <p className="text-sm" style={{ color: '#7a8aaa' }}>No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="clay-card p-5 group relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-bold text-sm" style={{ color: '#0d1a33' }}>{a.title}</p>
                    <p className="text-sm mt-1 leading-relaxed whitespace-pre-line" style={{ color: '#2a3a5a' }}>{a.content}</p>
                  </div>
                  {a.expiresAt && (
                    <span className="clay-badge shrink-0 text-xs" style={{ background: '#fff3cd', color: '#7d5a00', border: '1.5px solid #f0d060' }}>
                      Expires {new Date(a.expiresAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs" style={{ color: '#7a8aaa' }}>
                      {new Date(a.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {a.createdBy}
                    </span>
                    {a.targetRole && <span className="clay-badge text-xs badge-coord">{a.targetRole}</span>}
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(a)} className="text-xs font-medium hover:underline" style={{ color: '#003087' }}>Edit</button>
                    <button onClick={() => handleDelete(a.id)} className="text-xs font-medium hover:underline" style={{ color: '#e03030' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AnnouncementModal
          initial={editing}
          token={token}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </Layout>
  );
}

function AnnouncementModal({ initial, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    content: initial?.content ?? '',
    targetRole: initial?.targetRole ?? '',
    expiresAt: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        targetRole: form.targetRole || null,
        targetCampusId: null,
        expiresAt: form.expiresAt || null,
      };
      if (initial) {
        await updateAnnouncement(initial.id, payload, token);
      } else {
        await createAnnouncement(payload, token);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,20,60,0.45)' }}>
      <div className="clay-card-modal w-full max-w-md p-7">
        <h2 className="text-base font-black mb-5" style={{ color: '#0d1a33' }}>
          {initial ? 'Edit Announcement' : 'New Announcement'}
        </h2>

        {error && (
          <div className="mb-4 p-3 rounded-2xl text-sm font-medium"
            style={{ background: '#dce8ff', color: '#003087', border: '1.5px solid #80aaee' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title">
            <input required value={form.title} onChange={e => set('title', e.target.value)} className="clay-input" placeholder="e.g. Deadline for COR Submission" />
          </Field>
          <Field label="Content">
            <textarea required rows={4} value={form.content} onChange={e => set('content', e.target.value)} className="clay-input" placeholder="Announcement body…" />
          </Field>
          <Field label="Audience">
            <select value={form.targetRole} onChange={e => set('targetRole', e.target.value)} className="clay-input">
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
          <Field label="Expires At (optional)">
            <input type="datetime-local" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} className="clay-input" />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm" style={{ opacity: submitting ? 0.65 : 1 }}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: '#4a5a7a' }}>{label}</label>
      {children}
    </div>
  );
}
