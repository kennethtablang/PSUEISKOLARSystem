import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/UIContext';
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  uploadAnnouncementImage, publishAnnouncementNow, ANNOUNCEMENT_INTENTS } from '../api/announcements';
import AnnouncementCard from '../components/AnnouncementCard';
import Modal from '../components/Modal';
import { Users, UserSearch, X, Clock } from 'lucide-react';
import { getPrograms, getScholarshipTypes, searchScholars } from '../api/lookups';
import { useTitle } from '../hooks/useTitle';

const ROLES = ['', 'Scholar', 'ScholarshipCoordinator'];
const ROLE_LABELS = { '': 'All Users', Scholar: 'Scholars', ScholarshipCoordinator: 'Coordinators' };

/* <input type="datetime-local"> works in naive local time while the API speaks UTC, so both
   directions need the offset applied — otherwise "publish at 8 AM" fires at 4 PM in Manila. */
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null;
}

export default function AnnouncementsPage() {
  useTitle('Announcements');
  const { token } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [lookups, setLookups] = useState({ scholarshipTypes: [], programs: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const displayed = search
    ? announcements.filter(a =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.content.toLowerCase().includes(search.toLowerCase()))
    : announcements;

  // Queued posts, soonest first — the rail's release schedule.
  const scheduled = announcements
    .filter(a => a.isScheduled)
    .sort((a, b) => new Date(a.publishAt) - new Date(b.publishAt));

  async function load() {
    setLoading(true);
    try {
      const [a, scholarshipTypes, programs] = await Promise.all([
        getAnnouncements(token),
        getScholarshipTypes(token),
        getPrograms(token),
      ]);
      setAnnouncements(a);
      setLookups({ scholarshipTypes, programs });
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

  async function handlePublishNow(a) {
    const ok = await confirm({
      title: 'Publish now?',
      message: `"${a.title}" will be sent to its audience immediately instead of waiting until `
        + `${new Date(a.publishAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}. `
        + 'Notifications and emails go out right away and cannot be recalled.',
      confirmLabel: 'Publish now',
    });
    if (!ok) return;

    try {
      const { reached } = await publishAnnouncementNow(a.id, token);
      toast(`Published to ${reached} scholar${reached === 1 ? '' : 's'}.`, 'success');
      await load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function openEdit(a) { setEditing(a); setShowModal(true); }
  function openCreate() { setEditing(null); setShowModal(true); }

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Announcements</h1>
            <p className="page-subtitle">
              {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
              {scheduled.length > 0 && ` · ${scheduled.length} scheduled`}
            </p>
            <span className="page-title-bar" />
          </div>
          <div className="page-head-actions">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="clay-input"
              style={{ height: 40, minHeight: 40, fontSize: 13, padding: '0 12px', width: 240 }}
              placeholder="Search announcements…"
            />
            <button onClick={openCreate} className="clay-btn clay-btn-primary px-4 py-2.5 text-sm">
              + New Announcement
            </button>
          </div>
        </div>

        <div className="page-split">
          <div>
            {loading ? (
              <p className="text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
            ) : displayed.length === 0 ? (
              <p className="text-sm" style={{ color: '#7a8aaa' }}>No announcements found.</p>
            ) : (
              <div className="space-y-3">
                {displayed.map(a => (
                  <AnnouncementCard
                    key={a.id}
                    a={a}
                    variant="manage"
                    onEdit={() => openEdit(a)}
                    onDelete={() => handleDelete(a.id)}
                    onPublishNow={() => handlePublishNow(a)}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="page-rail space-y-5">
            {/* What's queued to go out — the one thing you can't see by scrolling the
                feed, since a scheduled post looks like any other card until it lands. */}
            <div className="clay-card p-5">
              <p className="rail-heading">Scheduled to publish</p>
              {scheduled.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  Nothing queued. Set a publish time when creating an announcement to hold it
                  back until then.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {scheduled.map(a => (
                    <button
                      key={a.id}
                      onClick={() => openEdit(a)}
                      className="w-full text-left clay-card-inner px-3.5 py-2.5"
                    >
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--text-strong)' }}>{a.title}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Clock size={11} strokeWidth={2.5} style={{ color: '#003087' }} />
                        <span className="text-xs font-semibold" style={{ color: '#003087' }}>
                          {new Date(a.publishAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="clay-card p-5">
              <p className="rail-heading">Audience</p>
              <p className="text-sm" style={{ color: 'var(--text)', lineHeight: 1.6 }}>
                An announcement reaches everyone matching its role, scholarship type, and
                program filters — unless you name specific scholars, who then become the whole
                audience. Scholars are notified in-app and by email when it publishes.
              </p>
            </div>
          </aside>
        </div>
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
    targetScholarshipTypeId: initial?.targetScholarshipTypeId?.toString() ?? '',
    targetProgramId:        initial?.targetProgramId?.toString() ?? '',
    expiresAt:              toLocalInput(initial?.expiresAt),
    publishAt:              toLocalInput(initial?.publishAt),
    intentAction:           initial?.intentAction ?? '',
  });
  // Once it has gone out, the publish time is history — editing it would be a lie.
  const alreadyPublished = Boolean(initial) && !initial.isScheduled && !initial.publishAt;
  // Audience mode: broadcast to everyone matching the filters, or address named scholars.
  const [audience, setAudience] = useState(() => (initial?.recipientIds?.length ? 'specific' : 'filters'));
  const [recipients, setRecipients] = useState(
    () => (initial?.recipientIds ?? []).map((id, i) => ({ id, fullName: initial.recipientNames?.[i] ?? 'Scholar' }))
  );
  const [imageFile, setImageFile] = useState(null);
  const [imageError, setImageError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const specific = audience === 'specific';
  const audienceError = specific && recipients.length === 0
    ? 'Pick at least one scholar, or switch back to targeting by filters.'
    : '';

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

  /* Scheduling. A publish time in the past is treated as "send now" by the server, so it's
     a note rather than an error; an expiry before the release would be a no-op announcement. */
  const publishInPast = form.publishAt && new Date(form.publishAt) <= new Date();
  const scheduleError = form.publishAt && form.expiresAt && new Date(form.expiresAt) <= new Date(form.publishAt)
    ? 'The expiry must come after the scheduled publish time — otherwise nobody would see it.'
    : '';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (audienceError) { setError(audienceError); return; }
    if (scheduleError) { setError(scheduleError); return; }
    setSubmitting(true);
    try {
      const payload = {
        title:                  form.title,
        content:                form.content,
        // Named scholars replace the filters entirely, so don't send both.
        targetRole:             specific ? null : (form.targetRole || null),
        targetScholarshipTypeId: specific || !form.targetScholarshipTypeId ? null : parseInt(form.targetScholarshipTypeId),
        targetProgramId:        specific || !form.targetProgramId ? null : parseInt(form.targetProgramId),
        expiresAt:              fromLocalInput(form.expiresAt),
        publishAt:              alreadyPublished ? null : fromLocalInput(form.publishAt),
        intentAction:           form.intentAction || null,
        recipientIds:           specific ? recipients.map(r => r.id) : [],
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
    <Modal
      title={initial ? 'Edit Announcement' : 'New Announcement'}
      onClose={onClose}
      width={520}
      dismissible={!submitting}
    >
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

          {/* ── Audience ── */}
          <div className="pt-1">
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text)' }}>
              Who receives this
            </p>
            <div className="flex gap-2 mb-3">
              <AudienceTab active={!specific} onClick={() => setAudience('filters')}
                Icon={Users} label="By group" hint="Role, scholarship type, program" />
              <AudienceTab active={specific} onClick={() => setAudience('specific')}
                Icon={UserSearch} label="Specific scholars" hint="Pick individuals by name" />
            </div>

            {specific ? (
              <RecipientPicker token={token} selected={recipients} onChange={setRecipients} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Role">
                    <select value={form.targetRole} onChange={e => set('targetRole', e.target.value)} className="clay-input">
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
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
                <p className="text-xs mt-2" style={{ color: '#7a8aaa' }}>
                  Leave a filter blank to include everyone. Filters combine — a scholarship type
                  <em> and</em> a program means scholars in both.
                </p>
              </>
            )}
            {audienceError && (
              <p className="text-xs mt-2 font-medium" style={{ color: '#dc2626' }}>{audienceError}</p>
            )}
          </div>

          {/* ── Scheduling ── */}
          {!alreadyPublished && (
            <Field label="Publish At (optional)">
              <input type="datetime-local" value={form.publishAt}
                onChange={e => set('publishAt', e.target.value)} className="clay-input" />
              {publishInPast ? (
                <p className="text-xs mt-1 font-medium" style={{ color: '#c05000' }}>
                  ⚠ That time has passed — this will be published straight away.
                </p>
              ) : form.publishAt ? (
                <p className="text-xs mt-1 font-medium" style={{ color: '#1a6b3c' }}>
                  Held back until {new Date(form.publishAt).toLocaleString('en-PH', {
                    dateStyle: 'medium', timeStyle: 'short',
                  })}. Notifications and emails go out then, not now.
                </p>
              ) : (
                <p className="text-xs mt-1" style={{ color: '#7a8aaa' }}>
                  Leave blank to publish immediately. A future time hides it from its audience
                  until then.
                </p>
              )}
            </Field>
          )}

          <Field label="Expires At (optional)">
            <input type="datetime-local" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} className="clay-input" />
            {scheduleError ? (
              <p className="text-xs mt-1 font-medium" style={{ color: '#dc2626' }}>{scheduleError}</p>
            ) : expiresInPast && (
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
    </Modal>
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

function AudienceTab({ active, onClick, Icon, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex-1 text-left px-3.5 py-2.5 rounded-xl transition-colors"
      style={active
        ? { background: 'rgba(0,48,135,0.10)', border: '1.5px solid rgba(0,48,135,0.35)' }
        : { background: 'var(--surface-inset)', border: '1.5px solid transparent' }}
    >
      <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: active ? '#003087' : 'var(--text)' }}>
        <Icon size={13} strokeWidth={2.4} /> {label}
      </span>
      <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{hint}</span>
    </button>
  );
}

/**
 * Searchable multi-select of scholars. Selected scholars are kept as {id, fullName} so the
 * chips stay meaningful after the search text changes and when reopening a saved announcement.
 */
function RecipientPicker({ token, selected, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      searchScholars(token, { search: query || undefined, limit: 30 })
        .then(r => { if (!cancelled) setResults(r); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, token]);

  const selectedIds = new Set(selected.map(s => s.id));

  function toggle(scholar) {
    onChange(selectedIds.has(scholar.id)
      ? selected.filter(s => s.id !== scholar.id)
      : [...selected, { id: scholar.id, fullName: scholar.fullName }]);
  }

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {selected.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-xl text-xs font-semibold"
              style={{ background: '#dce8ff', color: '#003087', border: '1px solid #80aaee' }}>
              {s.fullName}
              <button type="button" onClick={() => onChange(selected.filter(x => x.id !== s.id))}
                aria-label={`Remove ${s.fullName}`}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10">
                <X size={10} strokeWidth={3} />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => onChange([])}
            className="text-xs font-medium hover:underline px-1" style={{ color: '#7a8aaa' }}>
            Clear all
          </button>
        </div>
      )}

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="clay-input mb-2"
        style={{ height: 36, minHeight: 36, fontSize: 13 }}
        placeholder="Search by name, student ID, or email…"
      />

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,37,112,0.12)', maxHeight: 200, overflowY: 'auto' }}>
        {loading && results.length === 0 ? (
          <p className="text-xs px-3.5 py-3" style={{ color: '#7a8aaa' }}>Searching…</p>
        ) : results.length === 0 ? (
          <p className="text-xs px-3.5 py-3" style={{ color: '#7a8aaa' }}>No scholars match that search.</p>
        ) : results.map((s, i) => {
          const on = selectedIds.has(s.id);
          return (
            <label key={s.id} className="flex items-start gap-2.5 px-3.5 py-2.5 cursor-pointer select-none"
              style={{
                borderTop: i > 0 ? '1px solid rgba(0,37,112,0.07)' : undefined,
                background: on ? 'rgba(0,48,135,0.05)' : 'transparent',
              }}>
              <input type="checkbox" checked={on} onChange={() => toggle(s)}
                className="mt-0.5 w-4 h-4 rounded" style={{ accentColor: '#003087', flexShrink: 0 }} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate" style={{ color: 'var(--text-strong)' }}>{s.fullName}</span>
                <span className="block text-xs truncate" style={{ color: '#7a8aaa' }}>
                  {[s.studentId, s.scholarshipType].filter(Boolean).join(' · ') || s.email}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <p className="text-xs mt-2" style={{ color: '#7a8aaa' }}>
        {selected.length === 0
          ? 'Only the scholars you pick will see this announcement.'
          : `${selected.length} scholar${selected.length !== 1 ? 's' : ''} will receive this — and nobody else.`}
      </p>
    </div>
  );
}
