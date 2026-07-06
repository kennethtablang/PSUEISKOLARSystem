import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/UIContext';
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  uploadAnnouncementImage, ANNOUNCEMENT_INTENTS } from '../api/announcements';
import AnnouncementCard from '../components/AnnouncementCard';
import { getCampuses } from '../api/campuses';
import { getPrograms, getScholarshipTypes } from '../api/lookups';
import { useTitle } from '../hooks/useTitle';

const ROLES = ['', 'Scholar', 'ScholarshipCoordinator'];
const ROLE_LABELS = { '': 'All Users', Scholar: 'Scholars', ScholarshipCoordinator: 'Coordinators' };

export default function AnnouncementsPage() {
  useTitle('Announcements');
  const { token } = useAuth();
  const confirm = useConfirm();
  const [announcements, setAnnouncements] = useState([]);
  const [lookups, setLookups] = useState({ campuses: [], scholarshipTypes: [], programs: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const displayed = search
    ? announcements.filter(a =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.content.toLowerCase().includes(search.toLowerCase()))
    : announcements;

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
    if (!(await confirm({ title: 'Delete announcement', message: 'Delete this announcement?', confirmLabel: 'Delete', danger: true }))) return;
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

        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="clay-input"
            style={{ height: 36, minHeight: 36, fontSize: 12.5, padding: '0 10px', width: 240 }}
            placeholder="Search announcements…"
          />
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
        ) : displayed.length === 0 ? (
          <p className="text-sm" style={{ color: '#7a8aaa' }}>No announcements found.</p>
        ) : (
          <div className="space-y-3">
            {displayed.map(a => (
              <AnnouncementCard key={a.id} a={a} variant="manage" onEdit={() => openEdit(a)} onDelete={() => handleDelete(a.id)} />
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
  const [imageError, setImageError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp'];

  /* Validate image type + size on the client before upload */
  function handleImageChange(e) {
    const f = e.target.files?.[0] ?? null;
    setImageError('');
    if (!f) { setImageFile(null); return; }
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!IMAGE_EXTS.includes(ext)) {
      setImageError('Unsupported file type. Use PNG, JPG, or WEBP.');
      setImageFile(null); e.target.value = ''; return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      setImageError(`Image is ${(f.size / 1024 / 1024).toFixed(1)} MB — the maximum is 10 MB.`);
      setImageFile(null); e.target.value = ''; return;
    }
    setImageFile(f);
  }

  /* A past expiry means the announcement is hidden immediately — warn, don't block */
  const expiresInPast = form.expiresAt && new Date(form.expiresAt) < new Date();

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
        <h2 className="text-base font-black mb-5" style={{ color: 'var(--text-strong)' }}>
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

          <p className="text-xs font-bold uppercase tracking-wider pt-1" style={{ color: 'var(--text)' }}>
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
            {expiresInPast && (
              <p className="text-xs mt-1 font-medium" style={{ color: '#c05000' }}>
                ⚠ This date is in the past — the announcement will be hidden immediately after saving.
              </p>
            )}
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
            <input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleImageChange} className="clay-input" />
            <p className="text-xs mt-1" style={{ color: '#7a8aaa' }}>
              PNG, JPG, or WEBP · max 10 MB. Recommended <strong>1200 × 400 px</strong> (3:1 landscape banner) —
              it’s displayed full-width and cropped to a 260 px-tall banner, so keep key content centered.
            </p>
            {imageError && (
              <p className="text-xs mt-1 font-medium" style={{ color: '#e03030' }}>{imageError}</p>
            )}
            {imageFile && !imageError && (
              <p className="text-xs mt-1" style={{ color: '#2a8a3a' }}>
                {imageFile.name} · {(imageFile.size / 1024 / 1024).toFixed(1)} MB ready to upload.
              </p>
            )}
            {initial?.hasImage && !imageFile && (
              <p className="text-xs mt-1" style={{ color: '#7a8aaa' }}>An image is already attached. Choosing a new file replaces it.</p>
            )}
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={submitting || !!imageError} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm" style={{ opacity: (submitting || imageError) ? 0.65 : 1 }}>
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
      <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text)' }}>{label}</label>
      {children}
    </div>
  );
}
