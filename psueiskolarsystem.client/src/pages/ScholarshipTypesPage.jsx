import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NumericInput } from '../components/PersonalDetailsFields';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import {
  getScholarshipTypes, createScholarshipType, updateScholarshipType,
  toggleScholarshipTypeActive, deleteScholarshipType,
} from '../api/scholarshipTypes';
import { getSystemSettings } from '../api/systemSettings';
import { useTitle } from '../hooks/useTitle';
import { ErrorBox, ModalButtons } from './UsersPage';
import Field from '../components/Field';
import Modal from '../components/Modal';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { Plus, Trash2, ChevronRight, MapPin, Globe2 } from 'lucide-react';
import { SCHOLARSHIP_FREQUENCIES } from '../constants/grants';
import { CATEGORIES, canManageType } from '../constants/scholarshipTypes';


export default function ScholarshipTypesPage() {
  const navigate = useNavigate();
  useTitle('Scholarship Types');
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'Administrator';
  // Coordinators may add types too — those are exclusive to their campus.
  const canCreate = isAdmin || (user?.role === 'ScholarshipCoordinator' && user?.campusId != null);
  const toast = useToast();
  const confirm = useConfirm();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  // The house standard, so a new type starts at the institution's own figure rather than a
  // number baked into the form. Falls back to 2.50 if settings can't be read.
  const [defaultGwa, setDefaultGwa] = useState('2.50');

  useEffect(() => {
    getSystemSettings(token)
      .then(s => { if (s?.defaultMinimumGwa != null) setDefaultGwa(String(s.defaultMinimumGwa)); })
      .catch(() => {});
  }, [token]);

  const q = search.toLowerCase();
  const displayed = q
    ? types.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.category ?? '').toLowerCase().includes(q) ||
        (t.campusName ?? '').toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q))
    : types;

  async function load() {
    setLoading(true);
    try {
      setTypes(await getScholarshipTypes(token));
    } catch (e) {
      // Uncaught before: a failed load left the page on an empty list with no explanation.
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function handleToggle(st) {
    try {
      const { isActive } = await toggleScholarshipTypeActive(st.id, token);
      setTypes(prev => prev.map(t => t.id === st.id ? { ...t, isActive } : t));
      toast(isActive ? 'Scholarship type activated.' : 'Scholarship type deactivated.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleDelete(st) {
    if (!(await confirm({ title: 'Delete scholarship type', message: `Delete ${st.name}? This cannot be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await deleteScholarshipType(st.id, token);
      setTypes(prev => prev.filter(t => t.id !== st.id));
      toast('Scholarship type deleted.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Scholarship Types</h1>
            <p className="page-subtitle">
              {isAdmin
                ? 'Every scholarship type, for all campuses and campus-only ones. Open a type to see its scholars, its cross-matching list, and the documents it requires with their deadlines.'
                : 'Scholarship types for every campus, plus the ones exclusive to your campus. Open a type to see its scholars, its cross-matching list, and the documents it requires.'}
            </p>
            <span className="page-title-bar" />
          </div>
          {canCreate && (
            <button onClick={() => setShowModal(true)} className="clay-btn clay-btn-primary px-4 py-2.5 text-sm flex items-center gap-1.5">
              <Plus size={15} strokeWidth={2.6} /> New Scholarship Type
            </button>
          )}
        </div>

        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="clay-input"
            style={{ height: 36, minHeight: 36, fontSize: 12.5, padding: '0 10px', width: '100%', maxWidth: 280 }}
            placeholder="Search scholarship types…"
          />
        </div>

        <div className="clay-card overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : displayed.length === 0 ? (
            <EmptyState title="No scholarship types found" message="Create a scholarship type to get started." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Scholarship Type', 'Min GWA', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(st => {
                  const manage = canManageType(user, st);
                  return (
                    <tr key={st.id} className="clay-table-row cursor-pointer" style={{ opacity: st.isActive ? 1 : 0.7 }}
                      onClick={() => navigate(`/scholarship-types/${st.id}`)}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link to={`/scholarship-types/${st.id}`} onClick={e => e.stopPropagation()}
                            className="font-semibold hover:underline inline-flex items-center gap-1" style={{ color: 'var(--text-strong)' }}>
                            {st.name} <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                          </Link>
                          {st.category && <CategoryBadge category={st.category} />}
                          <ScopeBadge type={st} />
                        </div>
                        {st.description && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{st.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-sm" style={{ color: 'var(--text-strong)' }}>
                        {st.minimumGwa.toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                        <StatusToggle active={st.isActive} disabled={!manage} onToggle={() => handleToggle(st)} />
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        {manage && (
                          <button onClick={() => handleDelete(st)} title={`Delete ${st.name}`} aria-label={`Delete ${st.name}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                            style={{ background: 'rgba(224,48,48,0.08)', color: 'var(--danger)', border: '1px solid rgba(224,48,48,0.18)' }}>
                            <Trash2 size={13} strokeWidth={2.4} /> Delete
                          </button>
                        )}
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
          defaultGwa={defaultGwa}
          token={token}
          onClose={() => setShowModal(false)}
          onSaved={created => {
            toast('Scholarship type created. Now choose the documents its scholars submit.', 'success');
            setShowModal(false);
            // Straight into the new type, on its documents — that is the next thing to set up.
            if (created?.id) navigate(`/scholarship-types/${created.id}?tab=documents`);
            else load();
          }}
        />
      )}
    </Layout>
  );
}

/* Active / inactive, and — for whoever manages the type — the switch between them. */
function StatusToggle({ active, disabled, onToggle }) {
  const style = active
    ? { background: '#d4f4e2', color: '#166534', border: '1px solid #86efac' }
    : { background: '#f5e8e8', color: '#991b1b', border: '1px solid #fca5a5' };
  if (disabled) return <span className="clay-badge" style={style}>{active ? 'Active' : 'Inactive'}</span>;
  return (
    <button onClick={onToggle} title={active ? 'Click to deactivate' : 'Click to activate'}
      className="clay-badge inline-flex items-center gap-1.5" style={{ ...style, cursor: 'pointer' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
      {active ? 'Active' : 'Inactive'}
    </button>
  );
}

export function CategoryBadge({ category }) {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-xl font-medium"
      style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>
      {category}
    </span>
  );
}

/* All campuses (made by the administrator) or exclusive to one campus (made by its coordinator). */
export function ScopeBadge({ type }) {
  const local = type.campusId != null;
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-xl font-medium inline-flex items-center gap-1"
      style={local
        ? { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }
        : { background: 'var(--surface-inset)', color: 'var(--text-muted)', border: '1px solid var(--hairline-strong)' }}>
      {local ? <MapPin size={10} /> : <Globe2 size={10} />}
      {local ? (type.campusName ?? 'Campus only') : 'All campuses'}
    </span>
  );
}

/* ── Create / edit ─────────────────────────────────────── */
// Only the type itself — its documents are edited from the type's Documents tab.
export function ScholarshipTypeModal({ initial, defaultGwa = '2.50', token, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:        initial?.name ?? '',
    description: initial?.description ?? '',
    category:    initial?.category ?? '',
    minimumGwa:  initial?.minimumGwa?.toString() ?? defaultGwa,
    slotLimit:   initial?.slotLimit?.toString() ?? '',
    frequency:   initial?.frequency ?? 'PerSemester',
    amount:      initial?.amount != null ? String(initial.amount) : '',
  });
  const filledSlots = initial?.scholarCount ?? 0;
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const gwaVal = parseFloat(form.minimumGwa);
  const gwaError = form.minimumGwa !== '' && (isNaN(gwaVal) || gwaVal < 1 || gwaVal > 5)
    ? 'Minimum GWA must be between 1.00 and 5.00.' : '';

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

  const canSubmit = form.name.trim() && form.minimumGwa !== '' && !gwaError && !slotError && !amountError;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim() || null,
        category:    form.category || null,
        minimumGwa:  parseFloat(form.minimumGwa),
        slotLimit:   slotVal,
        frequency:   form.frequency,
        amount:      amountVal,
      };
      const result = initial
        ? await updateScholarshipType(initial.id, payload, token)
        : await createScholarshipType(payload, token);
      onSaved(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={initial ? `Edit: ${initial.name}` : 'New Scholarship Type'}
      subtitle={initial
        ? 'The scholarship’s details. Its required documents are edited from the Documents & Deadline tab.'
        : 'After creating it you will choose the documents its scholars must submit.'}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Category">
            <select value={form.category} onChange={e => set('category', e.target.value)} className="clay-input">
              <option value="">— Choose —</option>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
