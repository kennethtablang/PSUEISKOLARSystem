import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { getScholarshipTypes } from '../api/lookups';
import {
  getReleaseMonitor, getReleasePeriods, recordScholarshipRelease,
  generateScholarshipReleases, releaseScholarship, cancelScholarshipRelease,
} from '../api/scholarshipReleases';
import Modal from '../components/Modal';
import { ErrorBox, ModalButtons } from './UsersPage';
import Field from '../components/Field';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';
import {
  peso, isRecurring, semestersFor, semesterLabel,
  currentAcademicYear, WHOLE_YEAR_SEMESTER, FREQUENCY_LABELS,
} from '../constants/grants';
import {
  BanknoteArrowUp, CircleCheckBig, Clock, CircleAlert,
  Users, ListPlus, Search,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const STATUS_LABEL = {
  Released: 'Received',
  Pending: 'Awaiting release',
  Cancelled: 'Cancelled',
  NotRecorded: 'Not recorded',
};

/**
 * Scholarship Releases — the answer to "has this grantee received their scholarship?".
 *
 * A recurring scholarship (per semester or per year) owes each of its holders one payout
 * per period. This page picks a scholarship and a period, then lists every holder with
 * the state of their payout. A scholar with no row at all reads "Not recorded" rather
 * than being left out: an unbilled scholar is the whole point of the report.
 */
export default function ScholarshipReleasesPage() {
  useTitle('Scholarship Releases');
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [types, setTypes] = useState([]);
  const [typeId, setTypeId] = useState('');
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [semester, setSemester] = useState(1);
  const [monitor, setMonitor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [recording, setRecording] = useState(null);   // scholar row being scheduled
  const [releasing, setReleasing] = useState(null);   // row being marked released
  const [generating, setGenerating] = useState(false);

  const recurringTypes = useMemo(() => types.filter(t => isRecurring(t.frequency)), [types]);
  const selectedType = recurringTypes.find(t => String(t.id) === String(typeId));

  // Load the scholarship list and the periods the system already knows about.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getScholarshipTypes(token), getReleasePeriods(token).catch(() => null)])
      .then(([allTypes, periodData]) => {
        if (cancelled) return;
        setTypes(allTypes);
        const recurring = allTypes.filter(t => isRecurring(t.frequency));
        if (recurring.length > 0) setTypeId(String(recurring[0].id));
        if (periodData?.activeAcademicYear) {
          setAcademicYear(periodData.activeAcademicYear);
          setSemester(periodData.activeSemester ?? 1);
        }
      })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token]);

  // A per-year scholarship has no semester 1 or 2, so the picker has to follow the type.
  useEffect(() => {
    if (!selectedType) return;
    const allowed = semestersFor(selectedType.frequency);
    if (!allowed.includes(semester)) setSemester(allowed[0]);
  }, [selectedType, semester]);

  const load = useCallback(async () => {
    if (!typeId) { setMonitor(null); return; }
    setLoading(true);
    setError('');
    try {
      setMonitor(await getReleaseMonitor(token, { scholarshipTypeId: typeId, academicYear, semester }));
    } catch (e) {
      setError(e.message);
      setMonitor(null);
    } finally {
      setLoading(false);
    }
  }, [token, typeId, academicYear, semester]);

  useEffect(() => { load(); }, [load]);

  async function handleGenerate() {
    if (!selectedType) return;
    const ok = await confirm({
      title: 'Open this period’s releases',
      message: `Every scholar under ${selectedType.name} who has no release recorded for `
        + `${academicYear} will get one, marked awaiting release`
        + `${selectedType.amount != null ? ` at ${peso(selectedType.amount)} each` : ''}. `
        + 'Scholars already recorded are left untouched.',
      confirmLabel: 'Open releases',
    });
    if (!ok) return;

    setGenerating(true);
    try {
      const res = await generateScholarshipReleases({
        scholarshipTypeId: parseInt(typeId, 10),
        academicYear,
        semester,
        amount: selectedType.amount ?? null,
      }, token);
      toast(res.created === 0
        ? 'Every scholar already has a release for this period.'
        : `Opened ${res.created} release${res.created === 1 ? '' : 's'} at ${peso(res.amount)} each.`,
        res.created === 0 ? 'info' : 'success');
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCancel(row) {
    const ok = await confirm({
      title: 'Cancel this release',
      message: `Cancel the ${selectedType?.name} payout for ${row.scholarName} this period? `
        + 'The row is kept on the record so the period still shows what happened.',
      confirmLabel: 'Cancel release',
      danger: true,
    });
    if (!ok) return;
    try {
      await cancelScholarshipRelease(row.releaseId, 'Cancelled by staff from the release monitor.', token);
      toast('Release cancelled.', 'success');
      await load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const rows = useMemo(() => {
    let list = monitor?.scholars ?? [];
    if (statusFilter) list = list.filter(s => s.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        s.scholarName.toLowerCase().includes(q) ||
        (s.studentId ?? '').toLowerCase().includes(q) ||
        (s.scholarEmail ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [monitor, statusFilter, search]);

  const allowedSemesters = selectedType ? semestersFor(selectedType.frequency) : [1, 2];

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Scholarship Releases</h1>
            <p className="page-subtitle">
              Track, per academic period, which scholars have actually received the scholarship
              they hold — and which are still waiting.
            </p>
            <span className="page-title-bar" />
          </div>
          {selectedType && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="clay-btn clay-btn-primary px-4 py-2.5 text-sm flex items-center gap-1.5"
            >
              <ListPlus size={15} strokeWidth={2.6} />
              {generating ? 'Opening…' : 'Open this period'}
            </button>
          )}
        </div>

        {recurringTypes.length === 0 && !loading ? (
          <div className="clay-card p-6">
            <EmptyState
              title="No recurring scholarships yet"
              message="Only scholarships paid per semester or per year have releases to track. Set a payout frequency on the Scholarship Types page to start monitoring one."
            />
          </div>
        ) : (
          <>
            {/* ── Period selector ── */}
            <div className="flex flex-wrap gap-2 mb-5 items-center">
              <select
                value={typeId}
                onChange={e => setTypeId(e.target.value)}
                className="clay-input"
                style={{ ...ctlStyle, width: 'auto', minWidth: 210 }}
                aria-label="Scholarship"
              >
                {recurringTypes.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {FREQUENCY_LABELS[t.frequency]}
                  </option>
                ))}
              </select>

              <input
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                className="clay-input"
                style={{ ...ctlStyle, width: 130 }}
                placeholder="2025-2026"
                aria-label="Academic year"
              />

              <select
                value={semester}
                onChange={e => setSemester(parseInt(e.target.value, 10))}
                className="clay-input"
                style={{ ...ctlStyle, width: 'auto' }}
                aria-label="Semester"
                disabled={allowedSemesters.length < 2}
              >
                {allowedSemesters.map(s => (
                  <option key={s} value={s}>{semesterLabel(s)}</option>
                ))}
              </select>

              <span style={{ flex: 1 }} />

              <div style={{ position: 'relative' }}>
                <Search
                  size={13}
                  strokeWidth={2.4}
                  style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }}
                />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="clay-input"
                  style={{ ...ctlStyle, width: 220, paddingLeft: 28 }}
                  placeholder="Find a scholar…"
                />
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="clay-input"
                style={{ ...ctlStyle, width: 'auto' }}
                aria-label="Release status"
              >
                <option value="">All scholars</option>
                <option value="Released">Received</option>
                <option value="Pending">Awaiting release</option>
                <option value="NotRecorded">Not recorded</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {error && <p className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{error}</p>}

            {/* ── Period summary ── */}
            {monitor && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Tile label="Scholars on this scholarship" value={monitor.totalScholars} Icon={Users} bg="#dce8ff" iconColor="#003087" />
                <Tile label="Received" value={monitor.received} sub={peso(monitor.releasedAmount)} Icon={CircleCheckBig} bg="#d4f5e2" iconColor="#108050" />
                <Tile label="Awaiting release" value={monitor.pending} Icon={Clock} bg="#fff3cd" iconColor="#c07800" />
                <Tile label="Not recorded" value={monitor.notRecorded} sub="No payout scheduled" Icon={CircleAlert} bg="#ffe0e0" iconColor="#b02020" />
              </div>
            )}

            <div className="clay-card overflow-hidden">
              {loading ? (
                <TableSkeleton />
              ) : !monitor ? (
                <EmptyState title="Pick a scholarship" message="Choose a scholarship and period above to see who has been paid." />
              ) : rows.length === 0 ? (
                <EmptyState
                  title={monitor.totalScholars === 0 ? 'Nobody holds this scholarship' : 'No scholars match'}
                  message={monitor.totalScholars === 0
                    ? 'Assign the scholarship to a scholar first — releases follow the roster.'
                    : 'Clear the search or status filter to see the full roster.'}
                />
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
                  <thead className="clay-table-head">
                    <tr>
                      {['Scholar', 'Student ID', 'Amount', 'Status', 'Released', 'Reference', ''].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider"
                          style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(s => (
                      <tr key={s.scholarId} className="clay-table-row">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{s.scholarName}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.scholarEmail}</p>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs" style={{ color: 'var(--text)' }}>
                          {s.studentId || '—'}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold" style={{ color: 'var(--text-strong)' }}>
                          {s.amount != null ? peso(s.amount) : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          {/* The monitor renames the states for its own question — "has this
                              grantee received it?" — so it passes a label but keeps the tone. */}
                          <StatusBadge status={s.status} label={STATUS_LABEL[s.status]} />
                        </td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text)' }}>
                          {s.releasedAt
                            ? new Date(s.releasedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs" style={{ color: 'var(--text)' }}>
                          {s.referenceNo ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center gap-3 justify-end">
                            {s.status === 'NotRecorded' && (
                              <button
                                onClick={() => setRecording(s)}
                                className="text-xs font-bold hover:underline"
                                style={{ color: 'var(--accent)' }}
                              >
                                Schedule
                              </button>
                            )}
                            {s.status === 'Pending' && (
                              <>
                                <button
                                  onClick={() => setReleasing(s)}
                                  className="text-xs font-bold hover:underline flex items-center gap-1"
                                  style={{ color: '#166534' }}
                                >
                                  <BanknoteArrowUp size={12} strokeWidth={2.6} /> Release
                                </button>
                                <button
                                  onClick={() => setRecording(s)}
                                  className="text-xs font-medium hover:underline"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleCancel(s)}
                                  className="text-xs font-medium hover:underline"
                                  style={{ color: '#b45309' }}
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>

            {monitor && monitor.notRecorded > 0 && (
              <p className="text-xs mt-3 flex items-start gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <CircleAlert size={12} strokeWidth={2.4} className="mt-0.5 shrink-0" />
                {monitor.notRecorded} scholar{monitor.notRecorded === 1 ? ' has' : 's have'} no payout
                scheduled for {monitor.periodLabel}. “Open this period” creates one for each of them
                in a single step.
              </p>
            )}
          </>
        )}
      </div>

      {recording && selectedType && (
        <RecordReleaseModal
          scholar={recording}
          type={selectedType}
          academicYear={academicYear}
          semester={semester}
          token={token}
          onClose={() => setRecording(null)}
          onSaved={() => {
            setRecording(null);
            toast('Release saved.', 'success');
            load();
          }}
        />
      )}

      {releasing && (
        <ReleasePayoutModal
          row={releasing}
          typeName={selectedType?.name ?? 'Scholarship'}
          token={token}
          onClose={() => setReleasing(null)}
          onSaved={() => {
            setReleasing(null);
            toast('Released — the scholar has been notified.', 'success');
            load();
          }}
        />
      )}
    </Layout>
  );
}

function Tile({ label, value, sub, Icon, bg, iconColor }) {
  return (
    <div className="rounded-3xl p-5 stat-tile" style={{ '--tile-bg': bg }}>
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3 stat-tile-icon">
        <Icon size={18} strokeWidth={2} style={{ color: iconColor }} />
      </div>
      <p className="text-xs font-bold uppercase tracking-wider mb-1 stat-tile-label">{label}</p>
      <p className="text-2xl font-black stat-tile-value">{value}</p>
      {sub && <p className="text-xs mt-0.5 stat-tile-label">{sub}</p>}
    </div>
  );
}

/* Schedule (or re-price) one scholar's payout for the selected period. */
function RecordReleaseModal({ scholar, type, academicYear, semester, token, onClose, onSaved }) {
  const [amount, setAmount] = useState(
    scholar.amount != null ? String(scholar.amount) : (type.amount != null ? String(type.amount) : '')
  );
  const [notes, setNotes] = useState(scholar.notes ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const amountVal = parseFloat(amount);
  const amountError = amount !== '' && (isNaN(amountVal) || amountVal <= 0)
    ? 'Amount must be greater than zero.'
    : amountVal > 10000000 ? 'That amount looks too large — please check the figure.' : '';

  const canSubmit = amount !== '' && !amountError;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await recordScholarshipRelease({
        scholarId: scholar.scholarId,
        scholarshipTypeId: type.id,
        academicYear,
        semester,
        amount: amountVal,
        notes: notes.trim() || null,
      }, token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={scholar.status === 'NotRecorded' ? 'Schedule release' : 'Edit release'}
      subtitle={`${type.name} · ${scholar.scholarName} · ${academicYear} ${
        semester === WHOLE_YEAR_SEMESTER ? '(whole year)' : `Sem ${semester}`}`}
      onClose={onClose}
      width={460}
      dismissible={!submitting}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Amount (PHP)">
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="clay-input"
            placeholder="10000.00"
          />
          {amountError
            ? <p className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>{amountError}</p>
            : type.amount != null && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {type.name}’s standard payout is {peso(type.amount)}.
                </p>
              )}
        </Field>

        <Field label="Notes (optional)">
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="clay-input"
            placeholder="Not shown to the scholar."
          />
        </Field>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          This records what the scholar is <em>owed</em> for the period. They are notified only
          once you mark it released.
        </p>

        <ModalButtons onClose={onClose} submitting={submitting} disabled={!canSubmit} label="Save release" />
      </form>
    </Modal>
  );
}

/* Mark a scheduled payout as actually handed over. */
function ReleasePayoutModal({ row, typeName, token, onClose, onSaved }) {
  const [referenceNo, setReferenceNo] = useState('');
  const [releasedAt, setReleasedAt] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await releaseScholarship(row.releaseId, {
        referenceNo: referenceNo.trim() || null,
        releasedAt: releasedAt ? new Date(releasedAt).toISOString() : null,
      }, token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Mark as released"
      subtitle={`${typeName} · ${peso(row.amount)} · ${row.scholarName}`}
      onClose={onClose}
      width={440}
      dismissible={!submitting}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Release date">
          <input required type="date" value={releasedAt} onChange={e => setReleasedAt(e.target.value)} className="clay-input" />
        </Field>
        <Field label="Reference number (optional)">
          <input
            value={referenceNo}
            onChange={e => setReferenceNo(e.target.value)}
            className="clay-input"
            placeholder="Cheque / voucher / disbursement no."
          />
        </Field>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Releasing is final — the payout becomes part of the disbursement record and can no
          longer be edited or cancelled. The scholar is notified.
        </p>
        <ModalButtons onClose={onClose} submitting={submitting} label="Mark as released" />
      </form>
    </Modal>
  );
}
