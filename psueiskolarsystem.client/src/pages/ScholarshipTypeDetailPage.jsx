import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import CrossMatchList from '../components/CrossMatchList';
import StatusBadge from '../components/StatusBadge';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';
import { SEX_OPTIONS } from '../constants/personal';
import { FREQUENCY_LABELS, peso } from '../constants/grants';
import { getScholarshipType, getScholarshipTypes, updateScholarshipTypeDocuments } from '../api/scholarshipTypes';
import { getScholars } from '../api/scholars';
import { getCampuses } from '../api/campuses';
import { getPrograms } from '../api/lookups';
import { getRequirements, uploadRequirementSample, deleteRequirementSample } from '../api/documents';
import { getActiveSemester } from '../api/settings';
import { getDeadlines, upsertDeadline } from '../api/deadlines';
import { getSystemSettings } from '../api/systemSettings';
import { ScholarshipTypeModal, ScopeBadge } from './ScholarshipTypesPage';
import { canManageType } from '../constants/scholarshipTypes';
import Modal from '../components/Modal';
import { ErrorBox, ModalButtons } from './UsersPage';
import { ArrowLeft, GraduationCap, ListChecks, FileText, CalendarClock, Pencil, Users, Lock, Plus, Trash2, Save, Sparkles, CheckCircle2 } from 'lucide-react';

const TABS = [
  { key: 'scholars', label: 'Scholars', Icon: Users },
  { key: 'crossmatch', label: 'Cross-Matching', Icon: ListChecks },
  { key: 'documents', label: 'Documents & Deadline', Icon: FileText },
];

const toDateInput = d => (d ? String(new Date(d).toLocaleDateString('en-CA')) : '');

/**
 * One scholarship type, everything about it in one place: the scholars under it, the
 * cross-matching list of who may sign up under it, and the documents its scholars must submit
 * with their deadline. This replaces separate Scholars / Deadlines / Requirements tabs — open
 * the scholarship and it is all here.
 */
export default function ScholarshipTypeDetailPage() {
  const { id } = useParams();
  const typeId = Number(id);
  const { token, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'Administrator';

  const [type, setType] = useState(null);
  const [listItem, setListItem] = useState(null);   // the list-shape row the edit modal expects
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'scholars');
  const [campuses, setCampuses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editingDocs, setEditingDocs] = useState(false);
  const [docsVersion, setDocsVersion] = useState(0);
  const [sharedRequirements, setSharedRequirements] = useState([]);
  const [defaultGwa, setDefaultGwa] = useState('2.50');
  useTitle(type?.name ?? 'Scholarship Type');

  const loadType = useCallback(async () => {
    try {
      const [detail, list] = await Promise.all([getScholarshipType(typeId, token), getScholarshipTypes(token)]);
      setType(detail);
      setListItem(list.find(t => t.id === typeId) ?? null);
    } catch (e) {
      setError(e.message);
    }
  }, [typeId, token]);

  useEffect(() => {
    loadType();
    Promise.all([getCampuses(token), getPrograms(token)])
      .then(([c, p]) => { setCampuses(c); setPrograms(p); })
      .catch(() => {});
    getRequirements(token, { sharedOnly: true }).then(setSharedRequirements).catch(() => {});
    if (isAdmin)
      getSystemSettings(token).then(s => { if (s?.defaultMinimumGwa != null) setDefaultGwa(String(s.defaultMinimumGwa)); }).catch(() => {});
  }, [loadType, token, isAdmin]);

  // The administrator manages every type; a coordinator only their own campus's types.
  const manage = canManageType(user, listItem);

  function changeTab(key) {
    setTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', key);
    window.history.replaceState(null, '', url);
  }

  if (error) {
    return (
      <Layout>
        <div className="page-shell">
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
          <Link to="/scholarship-types" className="text-sm font-bold" style={{ color: 'var(--accent)' }}>← Back to Scholarship Types</Link>
        </div>
      </Layout>
    );
  }


  return (
    <Layout>
      <div className="page-shell">
        <button onClick={() => navigate('/scholarship-types')} className="text-xs font-bold flex items-center gap-1 mb-3 hover:underline" style={{ color: 'var(--accent)' }}>
          <ArrowLeft size={13} /> All scholarship types
        </button>

        <div className="page-head">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <GraduationCap size={26} style={{ color: 'var(--accent)' }} /> {type?.name ?? 'Loading…'}
            </h1>
            {type && (
              <p className="page-subtitle">
                {[type.category, FREQUENCY_LABELS[type.frequency], type.amount != null ? `${peso(type.amount)} per release` : 'Amount varies',
                  `Min GWA ${Number(type.minimumGwa).toFixed(2)}`,
                  type.slotLimit != null ? `${type.scholarCount} of ${type.slotLimit} slots` : `${type.scholarCount} scholar${type.scholarCount === 1 ? '' : 's'}`,
                ].filter(Boolean).join(' · ')}
                {!type.isActive && <span className="status-badge tone-neutral ml-2">Inactive</span>}
                {listItem && <span className="ml-2 align-middle"><ScopeBadge type={listItem} /></span>}
              </p>
            )}
            <span className="page-title-bar" />
          </div>
          {manage && (
            <button onClick={() => setEditing(true)} className="clay-btn clay-btn-ghost text-sm px-4 flex items-center gap-2">
              <Pencil size={14} /> Edit Scholarship Type
            </button>
          )}
        </div>

        <div className="flex gap-1.5 mb-5 flex-wrap" role="tablist">
          {TABS.map(t => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => changeTab(t.key)}
              className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5"
              style={tab === t.key ? { background: '#002570', color: '#fff' } : { background: 'var(--surface-inset)', color: 'var(--text)' }}>
              <t.Icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {type && (
          <div className="clay-card p-5">
            {tab === 'scholars' && <ScholarsTab typeId={typeId} campuses={campuses} programs={programs} />}
            {tab === 'crossmatch' && (
              <CrossMatchList scope={{ kind: 'Scholar', scholarshipTypeId: typeId, typeName: type.name }} campuses={campuses} />
            )}
            {tab === 'documents' && (
              <DocumentsTab type={type} canEdit={manage} version={docsVersion} onEditDocuments={() => setEditingDocs(true)} />
            )}
          </div>
        )}
      </div>

      {editing && listItem && (
        <ScholarshipTypeModal
          initial={listItem}
          defaultGwa={defaultGwa}
          token={token}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); toast('Scholarship type saved.', 'success'); loadType(); }}
        />
      )}

      {editingDocs && listItem && (
        <TypeDocumentsModal
          type={listItem}
          sharedRequirements={sharedRequirements}
          token={token}
          onClose={() => setEditingDocs(false)}
          onSaved={() => {
            setEditingDocs(false);
            toast('Required documents saved.', 'success');
            setDocsVersion(v => v + 1);
            loadType();
          }}
        />
      )}
    </Layout>
  );
}

/* ── Scholars under the type ─────────────────────────────────────── */

function ScholarsTab({ typeId, campuses, programs }) {
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ search: '', campusId: '', programId: '', yearLevel: '', sex: '', lifecycleStatus: '' });
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    const t = setTimeout(() => {
      getScholars(token, { ...filters, scholarshipTypeId: typeId, page, pageSize })
        .then(d => { if (mine === seq.current) setData(d); })
        .catch(e => { if (mine === seq.current) toast(e.message, 'error'); });
    }, filters.search ? 300 : 0);
    return () => clearTimeout(t);
  }, [filters, page, pageSize, typeId, token, toast]);

  function set(k, v) { setFilters(f => ({ ...f, [k]: v })); setPage(1); }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input type="search" placeholder="Search name or student no.…" value={filters.search}
          onChange={e => set('search', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 220 }} />
        <select value={filters.sex} onChange={e => set('sex', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Sex">
          <option value="">Male &amp; Female</option>
          {SEX_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.campusId} onChange={e => set('campusId', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Campus">
          <option value="">All Campuses</option>
          {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filters.programId} onChange={e => set('programId', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto', maxWidth: 260 }} aria-label="Program">
          <option value="">All Programs</option>
          {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.yearLevel} onChange={e => set('yearLevel', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Year level">
          <option value="">All Years</option>
          {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <select value={filters.lifecycleStatus} onChange={e => set('lifecycleStatus', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Status">
          <option value="">Any status</option>
          {['Active', 'Renewed', 'Lapsed', 'Suspended', 'Graduated'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="flex-1" />
        <ExportButtons dataset="scholars" filters={{ ...filters, scholarshipTypeId: typeId }} compact />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid var(--hairline)' }}>
        {!data ? <TableSkeleton /> : data.items.length === 0 ? (
          <EmptyState title="No scholars" message="No scholars under this scholarship match the filters." />
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm">
            <thead className="clay-table-head">
              <tr>
                {['Scholar', 'Sex', 'Campus', 'Program', 'Year', 'GWA', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map(s => (
                <tr key={s.userId} className="clay-table-row cursor-pointer" onClick={() => navigate(`/scholars/${s.userId}`)}>
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{s.fullName}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{s.studentId}</p>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>{s.personal?.sex ?? '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>{s.campusName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>{s.programName ?? '—'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>Year {s.yearLevel}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: s.meetsRequirement === false ? 'var(--danger)' : 'var(--text)' }}>
                    {s.latestGwa != null ? Number(s.latestGwa).toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.lifecycleStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      {data && data.total > 0 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} label="scholars" />
      )}
    </div>
  );
}

/* ── Required documents and their deadline ───────────────────────── */

function DocumentsTab({ type, canEdit, version, onEditDocuments }) {
  const { token, user } = useAuth();
  const toast = useToast();
  // The documents this scholarship's scholars actually see — a type with no documents chosen
  // falls back to the whole shared list, exactly as the scholar checklist does.
  const [documents, setDocuments] = useState([]);
  const loadDocuments = useCallback(() => {
    getRequirements(token, { scholarshipTypeId: type.id }).then(setDocuments).catch(() => setDocuments([]));
  }, [token, type.id]);
  useEffect(() => { loadDocuments(); }, [loadDocuments, version]);
  const linked = type.sharedRequirements.length + type.otherDocuments.length > 0;
  const isAdmin = user?.role === 'Administrator';
  // A shared document's deadline reaches every campus, so it is the administrator's to set;
  // a coordinator sets deadlines on their own type's documents.
  const canSetDeadline = d => canEdit && (isAdmin || d.scholarshipTypeId === type.id);
  const settable = documents.filter(canSetDeadline);
  const [period, setPeriod] = useState(null);
  const [deadlines, setDeadlines] = useState({});
  const [allDate, setAllDate] = useState('');
  const [saving, setSaving] = useState(false);

  const loadDeadlines = useCallback(async p => {
    const list = await getDeadlines(token, { academicYear: p.academicYear, semester: p.semester }).catch(() => []);
    setDeadlines(Object.fromEntries(list.map(d => [d.requirementId, d])));
  }, [token]);

  useEffect(() => {
    getActiveSemester(token)
      .then(p => { setPeriod(p); return loadDeadlines(p); })
      .catch(() => {});
  }, [token, loadDeadlines]);

  async function save(requirementIds, dateStr) {
    if (!period || !dateStr) return;
    setSaving(true);
    try {
      for (const requirementId of requirementIds)
        await upsertDeadline({
          requirementId,
          academicYear: period.academicYear,
          semester: Number(period.semester),
          dueDate: new Date(`${dateStr}T23:59:59`).toISOString(),
        }, token);
      toast(requirementIds.length > 1 ? `Deadline set for ${requirementIds.length} documents.` : 'Deadline saved.', 'success');
      setAllDate('');
      await loadDeadlines(period);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function changeSample(doc, file) {
    try {
      if (file) await uploadRequirementSample(doc.id, file, token);
      else await deleteRequirementSample(doc.id, token);
      toast(file ? 'Sample added.' : 'Sample removed.', 'success');
      loadDocuments();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs leading-relaxed max-w-2xl" style={{ color: 'var(--text-muted)' }}>
          The documents every {type.name} scholar must submit each period, and when they are due
          {period ? <> for <strong>{period.academicYear} · Semester {period.semester}</strong></> : ''}. Once a deadline passes, a scholar who
          submitted nothing is locked out of that document for the period, and it shows on their profile.
        </p>
        {canEdit && (
          <button onClick={onEditDocuments} className="clay-btn clay-btn-ghost text-sm px-4 flex items-center gap-2">
            <Pencil size={14} /> Edit required documents
          </button>
        )}
      </div>

      {!linked && documents.length > 0 && (
        <p className="text-xs px-3 py-2 rounded-xl" style={{ background: 'var(--surface-inset)', color: 'var(--text)' }}>
          No documents have been chosen for {type.name}, so its scholars see every shared document below.
          {canEdit && ' Use “Edit required documents” to choose the ones they must submit.'}
        </p>
      )}

      {settable.length > 0 && (
        <div className="rounded-2xl p-4 flex flex-wrap items-end gap-3" style={{ background: 'var(--surface-inset)' }}>
          <div>
            <label htmlFor="all-deadline" className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
              Deadline for all documents
            </label>
            <input id="all-deadline" type="date" value={allDate} onChange={e => setAllDate(e.target.value)} className="clay-input" style={{ width: 200, maxWidth: '100%' }} />
          </div>
          <button disabled={!allDate || saving} onClick={() => save(settable.map(d => d.id), allDate)}
            className="clay-btn clay-btn-primary text-sm px-4 flex items-center gap-2" style={{ opacity: !allDate || saving ? 0.6 : 1 }}>
            <CalendarClock size={14} /> {saving ? 'Saving…' : 'Set deadline'}
          </button>
          <p className="text-[11px] w-full" style={{ color: 'var(--text-muted)' }}>
            {isAdmin
              ? 'Shared documents are used by other scholarships too — their deadline is the same for every scholarship that requires them.'
              : `Applies to the documents only ${type.name} asks for. Shared documents’ deadlines are set by the administrator for every campus.`}
          </p>
        </div>
      )}

      {documents.length === 0 ? (
        <EmptyState title="No documents required yet" message={canEdit ? 'Use “Edit required documents” to choose the documents its scholars submit.' : 'No documents have been set for this scholarship yet.'} />
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={{ border: '1.5px solid var(--hairline)' }}>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="clay-table-head">
              <tr>
                {['Document', 'Kind', 'Deadline', settable.length > 0 ? 'Set deadline' : ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map(d => {
                const dl = deadlines[d.id];
                const past = dl && new Date(dl.dueDate) < new Date();
                return (
                  <tr key={d.id} className="clay-table-row">
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{d.name}</p>
                      {d.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.description}</p>}
                      {isAdmin && <SampleControl doc={d} onChange={file => changeSample(d, file)} />}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>
                      {d.scholarshipTypeId === type.id ? `Only ${type.name}` : 'Shared'}{d.isRequired ? ' · required' : ' · optional'}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: past ? 'var(--danger)' : 'var(--text)' }}>
                      {dl ? (
                        <span className="inline-flex items-center gap-1">
                          {past && <Lock size={11} />}
                          {new Date(dl.dueDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {past && ' · closed'}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>No deadline</span>}
                    </td>
                    <td className="px-4 py-3">
                      {canSetDeadline(d) && (
                        <DeadlineEditor key={dl?.dueDate ?? 'none'} name={d.name} current={toDateInput(dl?.dueDate)}
                          disabled={saving} onSave={date => save([d.id], date)} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* One document's deadline: pick a date, then press Save — nothing is stored until then. */
function DeadlineEditor({ name, current, disabled, onSave }) {
  const [value, setValue] = useState(current);
  const dirty = Boolean(value) && value !== current;
  return (
    <div className="flex items-center gap-2 justify-end">
      <input type="date" aria-label={`Deadline for ${name}`} value={value} disabled={disabled}
        onChange={e => setValue(e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 160 }} />
      <button type="button" disabled={!dirty || disabled} onClick={() => onSave(value)}
        title={dirty ? `Save the deadline for ${name}` : 'Pick a new date first'}
        className="clay-btn clay-btn-primary text-xs px-3 flex items-center gap-1.5"
        style={{ height: 34, minHeight: 34, opacity: !dirty || disabled ? 0.5 : 1 }}>
        <Save size={13} /> Save
      </button>
    </div>
  );
}

/* An example image scholars can look at before uploading the real document. */
function SampleControl({ doc, onChange }) {
  const inputId = `sample-${doc.id}`;
  return (
    <div className="flex items-center gap-3 mt-1">
      <label htmlFor={inputId} className="text-[11px] font-bold cursor-pointer hover:underline" style={{ color: 'var(--accent)' }}>
        {doc.hasSample ? 'Replace sample' : '+ Add sample'}
      </label>
      <input id={inputId} type="file" accept="image/*" className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onChange(f); }} />
      {doc.hasSample && (
        <button type="button" onClick={() => onChange(null)} className="text-[11px] font-bold hover:underline" style={{ color: 'var(--danger)' }}>
          Remove sample
        </button>
      )}
    </div>
  );
}

/* ── Edit required documents ─────────────────────────────────────── */

/**
 * What a type's scholars must submit: documents ticked from the shared list (used by other
 * scholarships too) plus documents that exist only for this type, which are added, renamed
 * and removed right here.
 */
function TypeDocumentsModal({ type, sharedRequirements, token, onClose, onSaved }) {
  const [requirementIds, setRequirementIds] = useState(type.requirementIds ?? []);
  const [ownDocs, setOwnDocs] = useState(
    () => (type.requirements ?? [])
      .filter(r => r.isTypeSpecific)
      .map(r => ({ id: r.requirementId, name: r.name, description: r.description ?? '', isRequired: r.isRequired }))
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function toggle(id) {
    setRequirementIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  }
  const addDoc = () => setOwnDocs(d => [...d, { id: null, name: '', description: '', isRequired: true }]);
  const setDoc = (i, patch) => setOwnDocs(d => d.map((doc, j) => j === i ? { ...doc, ...patch } : doc));
  const removeDoc = i => setOwnDocs(d => d.filter((_, j) => j !== i));

  const names = ownDocs.filter(d => d.name.trim()).map(d => d.name.trim().toLowerCase());
  const docsError = names.length !== new Set(names).size
    ? 'Each document needs a distinct name.'
    : ownDocs.some(d => !d.name.trim())
      ? 'Give every new document a name, or remove the empty row.'
      : '';

  async function handleSubmit(e) {
    e.preventDefault();
    if (docsError) return;
    setError('');
    setSubmitting(true);
    try {
      await updateScholarshipTypeDocuments(type.id, {
        requirementIds,
        otherDocuments: ownDocs.map(d => ({
          id: d.id,
          name: d.name.trim(),
          description: d.description.trim() || null,
          isRequired: d.isRequired,
        })),
      }, token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Required documents: ${type.name}`}
      subtitle="Tick the shared documents its scholars must submit, and add any document only this scholarship asks for."
      onClose={onClose} width={640} dismissible={!submitting}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-strong)' }}>Shared documents</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Documents other scholarships use too. Leave them all unticked and the scholars see every shared document.
          </p>
          {sharedRequirements.length === 0 ? (
            <p className="text-xs italic" style={{ color: 'var(--text-faint)' }}>There are no shared documents — add this scholarship’s own documents below.</p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
              {sharedRequirements.map((r, i) => {
                const checked = requirementIds.includes(r.id);
                return (
                  <label key={r.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
                    style={{ borderTop: i > 0 ? '1px solid var(--hairline)' : undefined, background: checked ? 'rgba(0,37,112,0.04)' : 'transparent' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(r.id)} className="mt-0.5 w-4 h-4 rounded"
                      style={{ accentColor: 'var(--accent)', flexShrink: 0 }} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium" style={{ color: 'var(--text-strong)' }}>{r.name}</span>
                      {r.description && <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.description}</span>}
                    </span>
                    <span className="text-xs font-bold shrink-0" style={{ color: r.isRequired ? '#b45309' : 'var(--text-muted)' }}>
                      {r.isRequired ? 'Required' : 'Optional'}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-strong)' }}>
              <Sparkles size={14} style={{ color: '#6b21a8' }} /> Documents only for {type.name}
            </p>
            <button type="button" onClick={addDoc} className="text-xs font-bold hover:underline flex items-center gap-1" style={{ color: '#6030b0' }}>
              <Plus size={12} strokeWidth={2.8} /> Add document
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            New requirements for this scholarship. Other scholarships don’t see them.
          </p>
          {ownDocs.length === 0 ? (
            <button type="button" onClick={addDoc} className="w-full rounded-xl py-4 text-xs font-semibold"
              style={{ border: '1.5px dashed rgba(107,33,168,0.35)', color: '#6030b0', background: 'rgba(107,33,168,0.04)' }}>
              + Add a new requirement
            </button>
          ) : (
            <div className="space-y-2.5">
              {ownDocs.map((doc, i) => (
                <div key={doc.id ?? `new-${i}`} className="clay-card-inner p-3 flex items-start gap-2">
                  <div className="flex-1 min-w-0 space-y-2">
                    <input value={doc.name} onChange={e => setDoc(i, { name: e.target.value })} className="clay-input"
                      style={{ height: 36, minHeight: 36, fontSize: 13 }} placeholder="Document name — e.g. Barangay Certificate of Indigency"
                      aria-label="Document name" />
                    <input value={doc.description} onChange={e => setDoc(i, { description: e.target.value })} className="clay-input"
                      style={{ height: 34, minHeight: 34, fontSize: 12 }} placeholder="What should the scholar submit? (optional)"
                      aria-label="Document description" />
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={doc.isRequired} onChange={e => setDoc(i, { isRequired: e.target.checked })}
                        className="w-3.5 h-3.5 rounded" style={{ accentColor: '#6030b0' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>Required for compliance</span>
                    </label>
                  </div>
                  <button type="button" onClick={() => removeDoc(i)} aria-label={`Remove ${doc.name || 'document'}`}
                    title={doc.id ? 'Remove — documents already submitted are kept' : 'Remove'}
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(224,48,48,0.08)', color: 'var(--danger)' }}>
                    <Trash2 size={14} strokeWidth={2.4} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {docsError && <p className="text-xs mt-2 font-medium" style={{ color: 'var(--danger)' }}>{docsError}</p>}
          {ownDocs.some(d => d.id) && (
            <p className="text-xs mt-2 flex items-start gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
              Removing a document retires it — documents scholars already submitted are never deleted.
            </p>
          )}
        </div>

        <ModalButtons onClose={onClose} submitting={submitting} disabled={!!docsError} label="Save documents" />
      </form>
    </Modal>
  );
}
