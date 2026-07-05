import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  uploadAnnouncementImage, ANNOUNCEMENT_INTENTS } from '../api/announcements';
import AnnouncementImage from '../components/AnnouncementImage';
import { getCampuses } from '../api/campuses';
import { getPrograms, getScholarshipTypes } from '../api/lookups';
import { useTitle } from '../hooks/useTitle';

const ROLES = ['', 'Scholar', 'ScholarshipCoordinator'];
const ROLE_LABELS = { '': 'All Users', Scholar: 'Scholars', ScholarshipCoordinator: 'Coordinators' };

export default function AnnouncementsPage() {
  useTitle('Announcements');
  const { token } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [lookups, setLookups] = useState({ campuses: [], scholarshipTypes: [], programs: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [a, campuses, scholarshipTypes, programs] = await Promise.all([
        getAnnouncements(token),
        getCampuses(token),
        getScholarshipTypes(token),
        getPrograms(token),
      ]);
      setAnnouncements(a);
      setLookups({ campuses, scholarshipTypes, programs });
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
              <AnnouncementCard key={a.id} a={a} onEdit={() => openEdit(a)} onDelete={() => handleDelete(a.id)} />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AnnouncementModal
          initial={editing}
          lookups={lookups}
          token={token}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </Layout>
  );
}

function AnnouncementCard({ a, onEdit, onDelete }) {
  const date = new Date(a.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const targets = [
    a.targetRole,
    a.targetCampus,
    a.targetScholarshipType,
    a.targetProgram,
  ].filter(Boolean);

  return (
    <div className="clay-card p-5 group relative">
      {a.hasImage && <AnnouncementImage announcementId={a.id} style={{ marginBottom: 12 }} />}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: '#0d1a33' }}>{a.title}</p>
          <p className="text-sm mt-1 leading-relaxed whitespace-pre-line" style={{ color: '#2a3a5a' }}>{a.content}</p>
          {a.intentAction && ANNOUNCEMENT_INTENTS[a.intentAction] && (
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-xl font-medium"
              style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>
              Action: {ANNOUNCEMENT_INTENTS[a.intentAction].label}
            </span>
          )}
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
            {date} · {a.createdBy}
          </span>
          {targets.length > 0 ? (
            targets.map(t => (
              <span key={t} className="clay-badge text-xs" style={{ background: '#dce8ff', color: '#003087', border: '1px solid #80aaee' }}>
                {t}
              </span>
            ))
          ) : (
            <span className="clay-badge text-xs" style={{ background: '#e8edf5', color: '#7a8aaa', border: '1px solid rgba(0,0,0,0.08)' }}>
              All users
            </span>
          )}
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="text-xs font-medium hover:underline" style={{ color: '#003087' }}>Edit</button>
          <button onClick={onDelete} className="text-xs font-medium hover:underline" style={{ color: '#e03030' }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function AnnouncementModal({ initial, lookups, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    title:                  initial?.title ?? '',
    content:                initial?.content ?? '',
    targetRole:             initial?.targetRole ?? '',
    targetCampusId:         initial?.targetCampusId?.toString() ?? '',
    targetScholarshipTypeId: initial?.targetScholarshipTypeId?.toString() ?? '',
    targetProgramId:        initial?.targetProgramId?.toString() ?? '',
    expiresAt:              initial?.expiresAt
      ? new Date(initial.expiresAt).toISOString().slice(0, 16)
      : '',
    intentAction:           initial?.intentAction ?? '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        title:                  form.title,
        content:                form.content,
        targetRole:             form.targetRole || null,
        targetCampusId:         form.targetCampusId ? parseInt(form.targetCampusId) : null,
        targetScholarshipTypeId: form.targetScholarshipTypeId ? parseInt(form.targetScholarshipTypeId) : null,
        targetProgramId:        form.targetProgramId ? parseInt(form.targetProgramId) : null,
        expiresAt:              form.expiresAt || null,
        intentAction:           form.intentAction || null,
      };
      let id = initial?.id;
      if (initial) {
        await updateAnnouncement(initial.id, payload, token);
      } else {
        const res = await createAnnouncement(payload, token);
        id = res.id;
      }
      if (imageFile && id) await uploadAnnouncementImage(id, imageFile, token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,20,60,0.45)' }}>
      <div className="clay-card-modal w-full p-7" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
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
            <input required value={form.title} onChange={e => set('title', e.target.value)}
              className="clay-input" placeholder="e.g. Deadline for COR Submission" />
          </Field>

          <Field label="Content">
            <textarea required rows={4} value={form.content} onChange={e => set('content', e.target.value)}
              className="clay-input" placeholder="Announcement body…" />
          </Field>

          <p className="text-xs font-bold uppercase tracking-wider pt-1" style={{ color: '#4a5a7a' }}>
            Target Audience (leave blank to target all)
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <select value={form.targetRole} onChange={e => set('targetRole', e.target.value)} className="clay-input">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>

            <Field label="Campus">
              <select value={form.targetCampusId} onChange={e => set('targetCampusId', e.target.value)} className="clay-input">
                <option value="">All Campuses</option>
                {lookups.campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label="Scholarship Type">
              <select value={form.targetScholarshipTypeId} onChange={e => set('targetScholarshipTypeId', e.target.value)} className="clay-input">
                <option value="">All Types</option>
                {lookups.scholarshipTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>

            <Field label="Program">
              <select value={form.targetProgramId} onChange={e => set('targetProgramId', e.target.value)} className="clay-input">
                <option value="">All Programs</option>
                {lookups.programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Expires At (optional)">
            <input type="datetime-local" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} className="clay-input" />
          </Field>

          <Field label="Intended Action (optional)">
            <select value={form.intentAction} onChange={e => set('intentAction', e.target.value)} className="clay-input">
              <option value="">— None —</option>
              {Object.entries(ANNOUNCEMENT_INTENTS).map(([key, v]) => (
                <option key={key} value={key}>{v.label}</option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: '#7a8aaa' }}>
              Adds a button to the announcement that takes scholars to the relevant page.
            </p>
          </Field>

          <Field label="Image (optional)">
            <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={e => setImageFile(e.target.files?.[0] ?? null)} className="clay-input" />
            {initial?.hasImage && !imageFile && (
              <p className="text-xs mt-1" style={{ color: '#7a8aaa' }}>An image is already attached. Choosing a new file replaces it.</p>
            )}
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
