import { useEffect, useState } from 'react';
import { NumericInput } from '../components/PersonalDetailsFields';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import {
  getScholarshipTypes, getScholarshipType, createScholarshipType, updateScholarshipType,
  toggleScholarshipTypeActive, deleteScholarshipType,
} from '../api/scholarshipTypes';
import { getRequirements } from '../api/documents';
import { getSystemSettings } from '../api/systemSettings';
import { useTitle } from '../hooks/useTitle';
import { ErrorBox, ModalButtons } from './UsersPage';
import Field from '../components/Field';
import Modal from '../components/Modal';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { Plus, Trash2, FileText, GraduationCap, Eye, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';
import { SCHOLARSHIP_FREQUENCIES, FREQUENCY_LABELS, peso } from '../constants/grants';

const CATEGORIES = ['Government', 'Private', 'Institutional', 'Local (LGU)', 'International', 'Other'];

export default function ScholarshipTypesPage() {
  useTitle('Scholarship Types');
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [types, setTypes] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [search, setSearch] = useState('');
  // The house standard, so a new type starts at the institution's own figure rather than a
  // number baked into the form. Falls back to 2.50 if settings can't be read.
  const [defaultGwa, setDefaultGwa] = useState('2.50');

  useEffect(() => {
    getSystemSettings(token)
      .then(s => { if (s?.defaultMinimumGwa != null) setDefaultGwa(String(s.defaultMinimumGwa)); })
      .catch(() => {});
  }, [token]);

  const displayed = search
    ? types.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.description ?? '').toLowerCase().includes(search.toLowerCase()))
    : types;

  async function load() {
    setLoading(true);
    try {
      const [t, r] = await Promise.all([
        getScholarshipTypes(token),
        // Only the shared catalog is offered as checkboxes; per-type documents are
        // created inside the editor below.
        getRequirements(token, { sharedOnly: true }),
      ]);
      setTypes(t);
      setRequirements(r);
    } catch (e) {
      // Uncaught before: a failed load left the page on an empty list with no explanation.
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(id) {
    try {
      const { isActive } = await toggleScholarshipTypeActive(id, token);
      setTypes(prev => prev.map(t => t.id === id ? { ...t, isActive } : t));
      toast(isActive ? 'Scholarship type activated.' : 'Scholarship type deactivated.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleDelete(id) {
    if (!(await confirm({ title: 'Delete scholarship type', message: 'Delete this scholarship type? This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await deleteScholarshipType(id, token);
      setTypes(prev => prev.filter(t => t.id !== id));
      toast('Scholarship type deleted.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function openCreate() { setEditing(null); setShowModal(true); }
  function openEdit(st) { setEditing(st); setShowModal(true); }

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Scholarship Types</h1>
            <p className="page-subtitle">
              Define scholarship types, the shared documents they require, and any documents unique to them.
            </p>
            <span className="page-title-bar" />
          </div>
          <button onClick={openCreate} className="clay-btn clay-btn-primary px-4 py-2.5 text-sm flex items-center gap-1.5">
            <Plus size={15} strokeWidth={2.6} /> New Scholarship Type
          </button>
        </div>

        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="clay-input"
            style={{ height: 36, minHeight: 36, fontSize: 12.5, padding: '0 10px', width: 240 }}
            placeholder="Search scholarship types…"
          />
        </div>

        <div className="clay-card overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : displayed.length === 0 ? (
            <EmptyState title="No scholarship types found" message="Create a scholarship type to get started." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Scholarship Type', 'Payout', 'Min GWA', 'Slots', 'Required Documents', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(st => {
                  const otherCount = st.requirements.filter(r => r.isTypeSpecific).length;
                  return (
                    <tr key={st.id} className="clay-table-row">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setViewingId(st.id)}
                            className="font-semibold text-left hover:underline"
                            style={{ color: 'var(--text-strong)' }}
                          >
                            {st.name}
                          </button>
                          {st.category && <CategoryBadge category={st.category} />}
                        </div>
                        {st.description && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{st.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <FrequencyBadge frequency={st.frequency} />
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {st.amount != null ? peso(st.amount) : 'Amount varies'}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-sm" style={{ color: 'var(--text-strong)' }}>
                        {st.minimumGwa.toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5">
                        <SlotMeter filled={st.scholarCount ?? 0} limit={st.slotLimit} isFull={st.isFull} />
                      </td>
                      <td className="px-5 py-3.5">
                        {st.requirements.length === 0 ? (
                          <span className="text-xs italic" style={{ color: 'var(--text-faint)' }}>All requirements (none configured)</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {st.requirements.slice(0, 2).map(r => (
                              <span key={r.requirementId} className="clay-badge text-xs"
                                style={r.isTypeSpecific
                                  ? { background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe' }
                                  : { background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1px solid var(--accent-soft-border)' }}>
                                {r.name}
                              </span>
                            ))}
                            {st.requirements.length > 2 && (
                              <span className="clay-badge text-xs"
                                style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid rgba(0,0,0,0.08)' }}>
                                +{st.requirements.length - 2} more
                              </span>
                            )}
                            {otherCount > 0 && (
                              <span className="text-xs font-semibold" style={{ color: '#6b21a8' }}>
                                · {otherCount} own
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {st.isActive ? (
                          <span className="clay-badge" style={{ background: '#d4f4e2', color: '#166534', border: '1px solid #86efac' }}>
                            Active
                          </span>
                        ) : (
                          <span className="clay-badge" style={{ background: '#f5e8e8', color: '#991b1b', border: '1px solid #fca5a5' }}>
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center gap-3 justify-end">
                          <button
                            onClick={() => setViewingId(st.id)}
                            className="text-xs font-medium hover:underline flex items-center gap-1"
                            style={{ color: '#6030b0' }}
                          >
                            <Eye size={12} strokeWidth={2.4} /> View
                          </button>
                          <button
                            onClick={() => openEdit(st)}
                            className="text-xs font-medium hover:underline"
                            style={{ color: 'var(--accent)' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggle(st.id)}
                            className="text-xs font-medium hover:underline"
                            style={{ color: st.isActive ? '#b45309' : '#166534' }}
                          >
                            {st.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(st.id)}
                            className="text-xs font-medium hover:underline"
                            style={{ color: 'var(--danger)' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      {showModal && (
        <ScholarshipTypeModal
          initial={editing}
          defaultGwa={defaultGwa}
          allRequirements={requirements}
          token={token}
          onClose={() => setShowModal(false)}
          onSaved={() => { toast(editing ? 'Scholarship type updated.' : 'Scholarship type created.', 'success'); setShowModal(false); load(); }}
        />
      )}

      {viewingId != null && (
        <ScholarshipTypeViewModal
          id={viewingId}
          token={token}
          onClose={() => setViewingId(null)}
          onEdit={st => { setViewingId(null); openEdit(types.find(t => t.id === st.id) ?? st); }}
        />
      )}
    </Layout>
  );
}

/**
 * How often the scholarship pays. Recurring types are the ones that show up on the
 * Scholarship Releases monitor, so the badge earns its place: it tells you at a glance
 * whether a type is tracked period-by-period or paid once and done.
 */
function FrequencyBadge({ frequency }) {
  const recurring = frequency === 'PerSemester' || frequency === 'PerYear';
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-xl font-semibold"
      style={recurring
        ? { background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1px solid var(--accent-soft-border)' }
        : { background: 'var(--surface-inset)', color: 'var(--text-muted)', border: '1px solid var(--hairline-strong)' }}>
      {recurring && <RefreshCw size={10} strokeWidth={2.8} />}
      {FREQUENCY_LABELS[frequency] ?? 'Per semester'}
    </span>
  );
}

function CategoryBadge({ category }) {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-xl font-medium"
      style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>
      {category}
    </span>
  );
}

/* ── Read-only detail view ─────────────────────────────── */
function ScholarshipTypeViewModal({ id, token, onClose, onEdit }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getScholarshipType(id, token)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id, token]);

  return (
    <Modal
      title={data?.name ?? 'Scholarship Type'}
      subtitle={data?.description ?? undefined}
      onClose={onClose}
      width={620}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      {!data && !error && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>}

      {data && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {data.category && <CategoryBadge category={data.category} />}
            <FrequencyBadge frequency={data.frequency} />
            <span className="clay-badge text-xs"
              style={data.isActive
                ? { background: '#d4f4e2', color: '#166534', border: '1px solid #86efac' }
                : { background: '#f5e8e8', color: '#991b1b', border: '1px solid #fca5a5' }}>
              {data.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Amount per payout" value={data.amount != null ? peso(data.amount) : 'Varies'} />
            <Stat label="Minimum GWA" value={data.minimumGwa.toFixed(2)} mono />
            <Stat
              label="Slots filled"
              value={data.slotLimit != null ? `${data.scholarCount}/${data.slotLimit}` : data.scholarCount}
            />
            <Stat
              label="GWA compliant"
              value={data.scholarCount > 0 ? `${data.compliantCount}/${data.scholarCount}` : '—'}
            />
          </div>

          <div>
            <SectionLabel>Slot availability</SectionLabel>
            <SlotMeter filled={data.scholarCount} limit={data.slotLimit} isFull={data.isFull} wide />
          </div>

          {data.lifecycleBreakdown?.length > 0 && (
            <div>
              <SectionLabel>Scholar status</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {data.lifecycleBreakdown.map(b => (
                  <span key={b.status} className="clay-badge text-xs"
                    style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid rgba(0,0,0,0.08)' }}>
                    {b.status}: <strong style={{ color: 'var(--text-strong)' }}>{b.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <SectionLabel>
              Shared requirements ({data.sharedRequirements.length})
            </SectionLabel>
            <DocList docs={data.sharedRequirements} emptyNote="No shared requirements are linked — scholars see the full catalog." />
          </div>

          <div>
            <SectionLabel>
              Other documents for this scholarship ({data.otherDocuments.length})
            </SectionLabel>
            <DocList docs={data.otherDocuments} emptyNote="No documents unique to this scholarship type." accent />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Close</button>
            <button onClick={() => onEdit(data)} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm">
              Edit this type
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* Filled-vs-available slots. A null limit means the scholarship is uncapped, in which
   case there is no bar to draw — only the headcount. */
function SlotMeter({ filled, limit, isFull, wide = false }) {
  if (limit == null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text)' }}>
        <GraduationCap size={13} strokeWidth={2.2} style={{ color: 'var(--text-muted)' }} />
        {filled}
        <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>· no cap</span>
      </span>
    );
  }

  const pct = limit > 0 ? Math.min(100, Math.round((filled / limit) * 100)) : 100;
  const left = Math.max(0, limit - filled);
  const tone = isFull ? '#c02626' : pct >= 80 ? '#b45309' : '#166534';

  return (
    <div style={{ minWidth: wide ? undefined : 108 }}>
      <div className="flex items-center gap-1.5">
        <GraduationCap size={13} strokeWidth={2.2} style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>
          {filled}<span style={{ color: 'var(--text-muted)', fontWeight: 600 }}> / {limit}</span>
        </span>
      </div>
      <div style={{
        height: 5, borderRadius: 999, marginTop: 5, overflow: 'hidden',
        background: 'rgba(0,37,112,0.10)',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: tone, transition: 'width 0.3s ease' }} />
      </div>
      <p className="text-xs mt-1" style={{ color: tone, fontWeight: 700 }}>
        {isFull ? 'Full' : `${left} slot${left === 1 ? '' : 's'} left`}
      </p>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{children}</p>
  );
}

function Stat({ label, value, mono }) {
  return (
    <div className="clay-card-inner px-3.5 py-3">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className={`text-lg font-black mt-0.5${mono ? ' font-mono' : ''}`} style={{ color: 'var(--text-strong)' }}>
        {value}
      </p>
    </div>
  );
}

function DocList({ docs, emptyNote, accent }) {
  if (docs.length === 0) {
    return <p className="text-xs italic" style={{ color: 'var(--text-faint)' }}>{emptyNote}</p>;
  }
  return (
    <ul className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,37,112,0.12)' }}>
      {docs.map((d, i) => (
        <li key={d.id} className="flex items-start gap-2.5 px-3.5 py-2.5"
          style={{ borderTop: i > 0 ? '1px solid rgba(0,37,112,0.07)' : undefined }}>
          <FileText size={13} strokeWidth={2.2} className="mt-0.5 shrink-0" style={{ color: accent ? '#6b21a8' : 'var(--accent)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text-strong)' }}>{d.name}</p>
            {d.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.description}</p>}
          </div>
          <span className="text-xs font-bold shrink-0" style={{ color: d.isRequired ? '#b45309' : 'var(--text-muted)' }}>
            {d.isRequired ? 'Required' : 'Optional'}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ── Create / edit ─────────────────────────────────────── */
function ScholarshipTypeModal({ initial, allRequirements, defaultGwa = '2.50', token, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:           initial?.name ?? '',
    description:    initial?.description ?? '',
    category:       initial?.category ?? '',
    minimumGwa:     initial?.minimumGwa?.toString() ?? defaultGwa,
    slotLimit:      initial?.slotLimit?.toString() ?? '',
    frequency:      initial?.frequency ?? 'PerSemester',
    amount:         initial?.amount != null ? String(initial.amount) : '',
    requirementIds: initial?.requirementIds ?? [],
  });
  const filledSlots = initial?.scholarCount ?? 0;
  // Documents that exist only for this scholarship type. Rows with an id already exist.
  const [otherDocs, setOtherDocs] = useState(
    () => (initial?.requirements ?? [])
      .filter(r => r.isTypeSpecific)
      .map(r => ({ id: r.requirementId, name: r.name, description: r.description ?? '', isRequired: r.isRequired }))
  );
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleReq(id) {
    setForm(f => ({
      ...f,
      requirementIds: f.requirementIds.includes(id)
        ? f.requirementIds.filter(r => r !== id)
        : [...f.requirementIds, id],
    }));
  }

  function addOtherDoc() {
    setOtherDocs(d => [...d, { id: null, name: '', description: '', isRequired: true }]);
  }
  function setOtherDoc(index, patch) {
    setOtherDocs(d => d.map((doc, i) => i === index ? { ...doc, ...patch } : doc));
  }
  function removeOtherDoc(index) {
    setOtherDocs(d => d.filter((_, i) => i !== index));
  }

  const gwaVal = parseFloat(form.minimumGwa);
  const gwaError = form.minimumGwa !== '' && (isNaN(gwaVal) || gwaVal < 1 || gwaVal > 5)
    ? 'Minimum GWA must be between 1.00 and 5.00.' : '';

  const namedDocs = otherDocs.filter(d => d.name.trim());
  const docNames = namedDocs.map(d => d.name.trim().toLowerCase());
  const duplicateDocName = docNames.length !== new Set(docNames).size;
  const blankDocRow = otherDocs.some(d => !d.name.trim());

  const docsError = duplicateDocName
    ? 'Each additional document needs a distinct name.'
    : blankDocRow
      ? 'Give every additional document a name, or remove the empty row.'
      : '';

  // A cap below the current headcount can't be honoured, so catch it before the round trip.
  const slotVal = form.slotLimit.trim() === '' ? null : parseInt(form.slotLimit, 10);
  const slotError = slotVal === null
    ? ''
    : !Number.isInteger(slotVal) || slotVal < 1
      ? 'The slot limit must be a whole number of at least 1, or blank for unlimited.'
      : slotVal < filledSlots
        ? `${filledSlots} scholar${filledSlots === 1 ? ' already holds' : 's already hold'} this scholarship, so the limit can't be below ${filledSlots}.`
        : '';

  const amountVal = form.amount.trim() === '' ? null : parseFloat(form.amount);
  const amountError = amountVal === null
    ? ''
    : isNaN(amountVal) || amountVal <= 0
      ? 'The standard amount must be greater than zero, or blank if it varies per scholar.'
      : amountVal > 10000000
        ? 'That amount looks too large — please check the figure.'
        : '';

  const frequencyHint = SCHOLARSHIP_FREQUENCIES.find(f => f.value === form.frequency)?.hint ?? '';

  const canSubmit = form.name.trim() && form.minimumGwa !== '' && !gwaError && !slotError && !docsError && !amountError;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        name:           form.name.trim(),
        description:    form.description.trim() || null,
        category:       form.category || null,
        minimumGwa:     parseFloat(form.minimumGwa),
        slotLimit:      slotVal,
        frequency:      form.frequency,
        amount:         amountVal,
        requirementIds: form.requirementIds,
        otherDocuments: namedDocs.map(d => ({
          id:          d.id,
          name:        d.name.trim(),
          description: d.description.trim() || null,
          isRequired:  d.isRequired,
        })),
      };
      if (initial) {
        await updateScholarshipType(initial.id, payload, token);
      } else {
        await createScholarshipType(payload, token);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const required = allRequirements.filter(r => r.isRequired);
  const optional = allRequirements.filter(r => !r.isRequired);

  return (
    <Modal
      title={initial ? `Edit: ${initial.name}` : 'New Scholarship Type'}
      subtitle="Scholars under this type must submit the shared requirements you tick, plus every document you add below."
      onClose={onClose}
      width={620}
      dismissible={!submitting}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <input
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="clay-input"
            placeholder="e.g. DOST-SEI Scholarship"
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            rows={2}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            className="clay-input"
            placeholder="Brief description of this scholarship program…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select value={form.category} onChange={e => set('category', e.target.value)} className="clay-input">
              <option value="">— Uncategorized —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Minimum GWA">
            <input
              required
              type="number"
              step="0.01"
              min="1.00"
              max="5.00"
              value={form.minimumGwa}
              onChange={e => set('minimumGwa', e.target.value)}
              className="clay-input"
            />
          </Field>
        </div>
        {gwaError
          ? <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{gwaError}</p>
          : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Scholars above this GWA are flagged. (1.00 = highest, 5.00 = lowest)
            </p>}

        {/* ── How the money arrives ── */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payout frequency">
            <select value={form.frequency} onChange={e => set('frequency', e.target.value)} className="clay-input">
              {SCHOLARSHIP_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Field>

          <Field label="Standard amount (optional)">
            <NumericInput prefix="₱" allowDecimal maxLength={11}
              value={form.amount} onChange={v => set('amount', v)} placeholder="Leave blank if it varies" />
          </Field>
        </div>
        {amountError
          ? <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{amountError}</p>
          : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {frequencyHint}
              {form.frequency !== 'OneTime' &&
                ' Each period’s payout is tracked per scholar on the Scholarship Releases page.'}
            </p>}

        <Field label="Slot limit (optional)">
          <input
            type="number"
            min={filledSlots || 1}
            step="1"
            value={form.slotLimit}
            onChange={e => set('slotLimit', e.target.value)}
            className="clay-input"
            placeholder="Leave blank for unlimited"
          />
        </Field>
        {slotError
          ? <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{slotError}</p>
          : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              The maximum number of scholars who may hold this scholarship at once. Assignments
              are refused once the slots are full.
              {initial && ` Currently filled: ${filledSlots}.`}
            </p>}

        {/* ── Shared requirement checklist ── */}
        <div>
          {/* Heads a checklist, not a single control — a <label> here would be announced as
              labelling whatever came next, which is a paragraph. */}
          <p className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-strong)' }}>
            Shared requirements
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Documents from the shared catalog. Tick the ones scholars under this type must submit;
            leave all unticked to show them the full catalog.
          </p>

          {allRequirements.length === 0 ? (
            <p className="text-xs italic" style={{ color: 'var(--text-faint)' }}>
              No shared requirements yet. Add some on the Requirements page first.
            </p>
          ) : (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(0,37,112,0.12)' }}>
              {required.length > 0 && (
                <div>
                  <GroupHeader>Mandatory documents</GroupHeader>
                  {required.map(r => (
                    <RequirementCheckRow
                      key={r.id}
                      req={r}
                      checked={form.requirementIds.includes(r.id)}
                      onChange={() => toggleReq(r.id)}
                    />
                  ))}
                </div>
              )}
              {optional.length > 0 && (
                <div>
                  <GroupHeader bordered={required.length > 0}>Optional documents</GroupHeader>
                  {optional.map(r => (
                    <RequirementCheckRow
                      key={r.id}
                      req={r}
                      checked={form.requirementIds.includes(r.id)}
                      onChange={() => toggleReq(r.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Type-specific documents ── */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-1.5">
            {/* Heading for a repeatable list, not a label for one field. */}
            <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-strong)' }}>
              <Sparkles size={14} strokeWidth={2.4} style={{ color: '#6b21a8' }} />
              Other documents for this scholarship
            </p>
            <button
              type="button"
              onClick={addOtherDoc}
              className="text-xs font-bold hover:underline flex items-center gap-1"
              style={{ color: '#6030b0' }}
            >
              <Plus size={12} strokeWidth={2.8} /> Add document
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Documents only this scholarship asks for. They stay out of the shared catalog and are
            always required of its scholars.
          </p>

          {otherDocs.length === 0 ? (
            <button
              type="button"
              onClick={addOtherDoc}
              className="w-full rounded-xl py-4 text-xs font-semibold"
              style={{ border: '1.5px dashed rgba(107,33,168,0.35)', color: '#6030b0', background: 'rgba(107,33,168,0.04)' }}
            >
              + Add a document unique to this scholarship
            </button>
          ) : (
            <div className="space-y-2.5">
              {otherDocs.map((doc, i) => (
                <div key={doc.id ?? `new-${i}`} className="clay-card-inner p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 space-y-2">
                      <input
                        value={doc.name}
                        onChange={e => setOtherDoc(i, { name: e.target.value })}
                        className="clay-input"
                        style={{ height: 36, minHeight: 36, fontSize: 13 }}
                        placeholder="Document name — e.g. Barangay Certificate of Indigency"
                      />
                      <input
                        value={doc.description}
                        onChange={e => setOtherDoc(i, { description: e.target.value })}
                        className="clay-input"
                        style={{ height: 34, minHeight: 34, fontSize: 12 }}
                        placeholder="What should the scholar submit? (optional)"
                      />
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={doc.isRequired}
                          onChange={e => setOtherDoc(i, { isRequired: e.target.checked })}
                          className="w-3.5 h-3.5 rounded"
                          style={{ accentColor: '#6030b0' }}
                        />
                        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                          Required for compliance
                        </span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOtherDoc(i)}
                      title={doc.id ? 'Remove — existing submissions are kept' : 'Remove'}
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(224,48,48,0.08)', color: 'var(--danger)' }}
                    >
                      <Trash2 size={14} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {docsError && (
            <p className="text-xs mt-2 font-medium" style={{ color: 'var(--danger)' }}>{docsError}</p>
          )}
          {otherDocs.some(d => d.id) && (
            <p className="text-xs mt-2 flex items-start gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle2 size={12} strokeWidth={2.4} className="mt-0.5 shrink-0" />
              Removing a document retires it — documents scholars already submitted are never deleted.
            </p>
          )}
        </div>

        <ModalButtons
          onClose={onClose}
          submitting={submitting}
          disabled={!canSubmit}
          label={initial ? 'Save Changes' : 'Create Scholarship Type'}
        />
      </form>
    </Modal>
  );
}

function GroupHeader({ children, bordered }) {
  return (
    <p className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
      style={{
        background: 'var(--surface-inset)',
        color: 'var(--text-muted)',
        borderTop: bordered ? '1px solid rgba(0,37,112,0.08)' : undefined,
      }}>
      {children}
    </p>
  );
}

function RequirementCheckRow({ req, checked, onChange }) {
  return (
    <label
      className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
      style={{
        borderTop: '1px solid rgba(0,37,112,0.06)',
        background: checked ? 'rgba(0,37,112,0.04)' : 'transparent',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 w-4 h-4 rounded"
        style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-strong)' }}>{req.name}</p>
        {req.description && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{req.description}</p>
        )}
      </div>
      <span className="text-xs font-bold shrink-0" style={{ color: req.isRequired ? '#b45309' : 'var(--text-muted)' }}>
        {req.isRequired ? 'Required' : 'Optional'}
      </span>
    </label>
  );
}
