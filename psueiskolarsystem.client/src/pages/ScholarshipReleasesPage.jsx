import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NumericInput } from '../components/PersonalDetailsFields';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { getScholarshipTypes } from '../api/lookups';
import { getCampuses } from '../api/campuses';
import {
  getReleaseMonitor, getReleasePeriods, recordScholarshipRelease,
  scheduleScholarshipReleases, releaseScholarshipBatch, cancelScholarshipRelease,
} from '../api/scholarshipReleases';
import Modal from '../components/Modal';
import { ErrorBox, ModalButtons } from './UsersPage';
import Field from '../components/Field';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle, localDateInput } from '../constants/ui';
import {
  peso, isRecurring, periodChoicesFor, semesterLabel, periodLabel,
  currentAcademicYear, BOTH_SEMESTERS, FREQUENCY_LABELS,
} from '../constants/grants';
import {
  BanknoteArrowUp, CircleCheckBig, Clock, CircleAlert,
  Users, CalendarPlus, Search, Check, HandCoins,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const fmtDay = d => (d
  ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—');

const STATUS_LABEL = {
  Released: 'Received',
  Pending: 'Not yet received',
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
  const { token, user } = useAuth();
  // A coordinator works within one campus, so they have no campus to pick.
  const isAdmin = user?.role === 'Administrator';
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

  const [campuses, setCampuses] = useState([]);
  const [campusId, setCampusId] = useState('');
  const [yearLevel, setYearLevel] = useState('');

  const [recording, setRecording] = useState(null);   // scholar row being scheduled
  const [releasing, setReleasing] = useState(null);   // row being marked released
  const [scheduling, setScheduling] = useState(false);
  const [selected, setSelected] = useState(new Set()); // scholarIds ticked for bulk release
  const [batchReleasing, setBatchReleasing] = useState(false);
  const [releasingAll, setReleasingAll] = useState(false);

  const recurringTypes = useMemo(() => types.filter(t => isRecurring(t.frequency)), [types]);
  const selectedType = recurringTypes.find(t => String(t.id) === String(typeId));

  // Load the scholarship list and the periods the system already knows about.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getScholarshipTypes(token), getReleasePeriods(token).catch(() => null), getCampuses(token).catch(() => [])])
      .then(([allTypes, periodData, campusList]) => {
        if (cancelled) return;
        setTypes(allTypes);
        setCampuses(campusList);
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
    const allowed = periodChoicesFor(selectedType.frequency);
    if (!allowed.includes(semester)) setSemester(allowed[0]);
  }, [selectedType, semester]);

  // Only the latest request may fill the table, and only a complete YYYY-YYYY is worth
  // requesting: the year box used to fire per keystroke, flashing "invalid academic year"
  // errors while typing and letting a slow earlier response overwrite the current one.
  const requestSeq = useRef(0);
  const yearComplete = /^\d{4}-\d{4}$/.test(academicYear.trim());

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (!typeId || !yearComplete) { setMonitor(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const data = await getReleaseMonitor(token, {
        scholarshipTypeId: typeId, academicYear: academicYear.trim(), semester,
        campusId: campusId || undefined, yearLevel: yearLevel || undefined,
      });
      if (seq === requestSeq.current) { setMonitor(data); setSelected(new Set()); }
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(e.message);
      setMonitor(null);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [token, typeId, academicYear, semester, yearComplete, campusId, yearLevel]);

  useEffect(() => { load(); }, [load]);

  const [cancellingId, setCancellingId] = useState(null);

  async function handleCancel(row) {
    if (cancellingId) return;
    const ok = await confirm({
      title: 'Cancel this release',
      message: `Cancel the ${selectedType?.name} payout for ${row.scholarName} this period? `
        + 'The row is kept on the record so the period still shows what happened.',
      confirmLabel: 'Cancel release',
      danger: true,
    });
    if (!ok) return;
    setCancellingId(row.releaseId);
    try {
      // With both semesters in view a row can hold two pending releases; cancel each.
      for (const id of row.pendingReleaseIds?.length ? row.pendingReleaseIds : [row.releaseId])
        await cancelScholarshipRelease(id, 'Cancelled by staff from the release monitor.', token);
      toast('Release cancelled.', 'success');
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setCancellingId(null);
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

  const allowedSemesters = selectedType ? periodChoicesFor(selectedType.frequency) : [1, 2];

  // A row can be released only when it has a scheduled payout still waiting.
  const releasable = r => r.status === 'Pending' && (r.pendingReleaseIds?.length ?? 0) > 0;
  const pendingRows = rows.filter(releasable);
  const allPendingSelected = pendingRows.length > 0 && pendingRows.every(r => selected.has(r.scholarId));
  const selectedReleaseIds = (monitor?.scholars ?? [])
    .filter(r => selected.has(r.scholarId) && releasable(r))
    .flatMap(r => r.pendingReleaseIds);
  const awaitingAll = (monitor?.scholars ?? []).filter(releasable);

  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllPending() {
    setSelected(allPendingSelected ? new Set() : new Set(pendingRows.map(r => r.scholarId)));
  }

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Scholarship Releases</h1>
            <p className="page-subtitle">
              Schedule each scholarship&apos;s release once per period, campus by campus, then mark who
              has received it. Every release is saved to the scholar&apos;s profile with its date and amount.
            </p>
            <span className="page-title-bar" />
          </div>
          {selectedType && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setScheduling(true)}
                disabled={!yearComplete}
                className="clay-btn clay-btn-ghost px-4 py-2.5 text-sm flex items-center gap-1.5"
              >
                <CalendarPlus size={15} strokeWidth={2.6} />
                Schedule Release
              </button>
              {/* Released: every scheduled scholar is marked as having received the money in one
                  step; anyone who did not collect is left out as an exemption. */}
              <button
                onClick={() => setReleasingAll(true)}
                disabled={awaitingAll.length === 0}
                title={awaitingAll.length === 0 ? 'Nobody is waiting on a scheduled release for this period.' : undefined}
                className="clay-btn clay-btn-primary px-4 py-2.5 text-sm flex items-center gap-1.5"
                style={{ opacity: awaitingAll.length === 0 ? 0.6 : 1 }}
              >
                <HandCoins size={15} strokeWidth={2.6} />
                Released
              </button>
            </div>
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

              {isAdmin && (
                <select
                  value={campusId}
                  onChange={e => setCampusId(e.target.value)}
                  className="clay-input"
                  style={{ ...ctlStyle, width: 'auto' }}
                  aria-label="Campus"
                >
                  <option value="">All campuses</option>
                  {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}

              <select
                value={yearLevel}
                onChange={e => setYearLevel(e.target.value)}
                className="clay-input"
                style={{ ...ctlStyle, width: 'auto' }}
                aria-label="Year level"
              >
                <option value="">All year levels</option>
                {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>Year {y}</option>)}
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
                <option value="Pending">Not yet received</option>
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
                <Tile label="Not yet received" value={monitor.pending} Icon={Clock} bg="#fff3cd" iconColor="#c07800" />
                <Tile label="Not recorded" value={monitor.notRecorded} sub="No payout scheduled" Icon={CircleAlert} bg="#ffe0e0" iconColor="#b02020" />
              </div>
            )}

            {selected.size > 0 && (
              <div className="clay-card px-4 py-3 mb-3 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>
                  {selected.size} release{selected.size === 1 ? '' : 's'} selected
                </span>
                <button onClick={() => setBatchReleasing(true)}
                  className="clay-btn clay-btn-primary text-xs px-4 flex items-center gap-1.5">
                  <BanknoteArrowUp size={13} strokeWidth={2.6} /> Mark as released
                </button>
                <button onClick={() => setSelected(new Set())} className="text-xs font-medium hover:underline" style={{ color: 'var(--text-muted)' }}>
                  Clear
                </button>
              </div>
            )}

            <div className="clay-card overflow-hidden">
              {loading ? (
                <TableSkeleton />
              ) : !monitor ? (
                <EmptyState
                title={typeId && !yearComplete ? 'Enter the academic year' : 'Pick a scholarship'}
                message={typeId && !yearComplete
                  ? 'Type the academic year as YYYY-YYYY (e.g. 2025-2026) to see who has been paid.'
                  : 'Choose a scholarship and period above to see who has been paid.'} />
              ) : rows.length === 0 ? (
                <EmptyState
                  title={monitor.totalScholars === 0 ? 'Nobody holds this scholarship' : 'No scholars match'}
                  message={monitor.totalScholars === 0
                    ? 'Assign the scholarship to a scholar first — releases follow the roster.'
                    : 'Clear the search or status filter to see the full roster.'}
                />
              ) : (
                <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
                  <thead className="clay-table-head">
                    <tr>
                      <th className="pl-5 py-3 w-8">
                        <input type="checkbox" aria-label="Select all awaiting release" disabled={pendingRows.length === 0}
                          checked={allPendingSelected} onChange={toggleAllPending} />
                      </th>
                      {['Scholar', 'Campus', 'Year', 'Amount', 'Status', 'Scheduled', 'Received', 'Reference', ''].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider"
                          style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(s => (
                      <tr key={s.scholarId} className="clay-table-row">
                        <td className="pl-5 py-3.5">
                          {releasable(s) && (
                            <input type="checkbox" aria-label={`Select ${s.scholarName}`}
                              checked={selected.has(s.scholarId)} onChange={() => toggleRow(s.scholarId)} />
                          )}
                        </td>
                        <td className="px-5 py-3.5 min-w-[220px]">
                          <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{s.scholarName}</p>
                          <p className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{s.studentId || s.scholarEmail}</p>
                        </td>
                        <td className="px-5 py-3.5 text-xs min-w-[120px]" style={{ color: 'var(--text)' }}>{s.campusName ?? '—'}</td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text)' }}>
                          {s.releaseYearLevel ?? s.profileYearLevel ? `Year ${s.releaseYearLevel ?? s.profileYearLevel}` : '—'}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold" style={{ color: 'var(--text-strong)' }}>
                          {s.amount != null ? peso(s.amount) : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          {/* The monitor renames the states for its own question — "has this
                              grantee received it?" — so it passes a label but keeps the tone. */}
                          <StatusBadge status={s.status} label={STATUS_LABEL[s.status]} />
                          {semester === BOTH_SEMESTERS && s.semesters?.length > 0 && (
                            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                              {s.semesters.map(x => `Sem ${x.semester}: ${STATUS_LABEL[x.status] ?? x.status}`).join(' · ')}
                              {s.partlyRecorded ? ' · other semester not scheduled' : ''}
                            </p>
                          )}
                          {s.status === 'Pending' && s.notes && (
                            <p className="text-[11px] mt-1 max-w-[220px]" style={{ color: 'var(--tone-attention-fg)' }}>{s.notes}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text)' }}>{fmtDay(s.scheduledDate)}</td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text)' }}>
                          {s.releasedAt
                            ? new Date(s.releasedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs" style={{ color: 'var(--text)' }}>
                          {s.referenceNo ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
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
                                {releasable(s) && <button
                                  onClick={() => setReleasing(s)}
                                  className="text-xs font-bold hover:underline flex items-center gap-1"
                                  style={{ color: 'var(--tone-ok-fg)' }}
                                >
                                  <BanknoteArrowUp size={12} strokeWidth={2.6} /> Release
                                </button>}
                                <button
                                  onClick={() => setRecording(s)}
                                  className="text-xs font-medium hover:underline"
                                  style={{ color: 'var(--accent)' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleCancel(s)}
                                  disabled={cancellingId === s.releaseId}
                                  className="text-xs font-medium hover:underline"
                                  style={{ color: 'var(--tone-attention-fg)', opacity: cancellingId === s.releaseId ? 0.6 : 1 }}
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
                scheduled for {monitor.periodLabel}. Use “Schedule Release” to set the date for a campus
                (or several) in a single step.
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

      {scheduling && selectedType && (
        <ScheduleReleaseModal
          type={selectedType}
          academicYear={academicYear.trim()}
          semester={semester}
          campuses={campuses}
          pickCampus={isAdmin}
          initialCampusId={isAdmin ? campusId : campuses[0]?.id}
          token={token}
          onClose={() => setScheduling(false)}
          onSaved={res => {
            setScheduling(false);
            toast(`Scheduled ${res.created + res.rescheduled} release${res.created + res.rescheduled === 1 ? '' : 's'}` +
              (res.rescheduled ? ` (${res.rescheduled} rescheduled)` : '') + ' — scholars have been notified.', 'success');
            load();
          }}
        />
      )}

      {releasingAll && (
        <ReleaseAllModal
          rows={awaitingAll}
          typeName={selectedType?.name ?? 'Scholarship'}
          period={monitor?.periodLabel ?? ''}
          token={token}
          onClose={() => setReleasingAll(false)}
          onSaved={res => {
            setReleasingAll(false);
            toast(`${res.released} release${res.released === 1 ? '' : 's'} marked as received` +
              (res.exempted ? `; ${res.exempted} left as not yet received.` : '.'), 'success');
            load();
          }}
        />
      )}

      {batchReleasing && (
        <BatchReleaseModal
          count={selected.size}
          typeName={selectedType?.name ?? 'Scholarship'}
          ids={selectedReleaseIds}
          token={token}
          onClose={() => setBatchReleasing(false)}
          onSaved={res => {
            setBatchReleasing(false);
            toast(`${res.released} release${res.released === 1 ? '' : 's'} marked as received.`, 'success');
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
      // "Semesters 1 & 2" records each semester's release; one already released is left alone.
      const semesters = semester === BOTH_SEMESTERS
        ? [1, 2].filter(n => !(scholar.semesters ?? []).some(x => x.semester === n && x.status !== 'Pending'))
        : [semester];
      for (const sem of semesters)
        await recordScholarshipRelease({
          scholarId: scholar.scholarId,
          scholarshipTypeId: type.id,
          academicYear,
          semester: sem,
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
      subtitle={`${type.name} · ${scholar.scholarName} · ${periodLabel(academicYear, semester)}`}
      onClose={onClose}
      width={460}
      dismissible={!submitting}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Amount (PHP)">
          <NumericInput required prefix="₱" allowDecimal maxLength={11}
            value={amount} onChange={setAmount} placeholder="10,000.00" />
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
  const [releasedAt, setReleasedAt] = useState(localDateInput);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await releaseScholarshipBatch({
        releaseIds: row.pendingReleaseIds?.length ? row.pendingReleaseIds : [row.releaseId],
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

/**
 * Schedules one scholarship type's release for the period in a single step. The campuses do
 * not all receive on the same day, so the office picks the campuses receiving on this date;
 * every holder there is included unless the office narrows the list by hand.
 */
function ScheduleReleaseModal({ type, academicYear, semester, campuses, pickCampus, initialCampusId, token, onClose, onSaved }) {
  const [campusIds, setCampusIds] = useState(() => new Set(initialCampusId ? [Number(initialCampusId)] : []));
  const [scheduledDate, setScheduledDate] = useState(localDateInput);
  const [amount, setAmount] = useState(type.amount != null ? String(type.amount) : '');
  const [filterYear, setFilterYear] = useState('');
  const [recordYear, setRecordYear] = useState('');
  const [notes, setNotes] = useState('');
  const [roster, setRoster] = useState(null);
  const [picked, setPicked] = useState(null); // null = everyone listed
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Everyone holding the scholarship this period; narrowed below by campus and year level.
  useEffect(() => {
    let cancelled = false;
    getReleaseMonitor(token, { scholarshipTypeId: type.id, academicYear, semester })
      .then(d => { if (!cancelled) setRoster(d.scholars); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [token, type.id, academicYear, semester]);

  const eligible = (roster ?? []).filter(s =>
    s.status !== 'Released' && s.status !== 'Cancelled' &&
    ['Active', 'Renewed', null, undefined, ''].includes(s.lifecycleStatus) &&
    s.campusId != null && campusIds.has(s.campusId) &&
    (!filterYear || String(s.profileYearLevel) === filterYear));

  const chosen = picked ? eligible.filter(s => picked.has(s.scholarId)) : eligible;

  function toggleCampus(id) {
    setCampusIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setPicked(null);
  }

  function togglePick(id) {
    setPicked(prev => {
      const next = new Set(prev ?? eligible.map(s => s.scholarId));
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const amountVal = parseFloat(amount);
  const canSubmit = campusIds.size > 0 && scheduledDate && amountVal > 0 && chosen.length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await scheduleScholarshipReleases({
        scholarshipTypeId: type.id,
        academicYear,
        semester,
        scheduledDate,
        amount: amountVal,
        campusIds: [...campusIds],
        filterYearLevel: filterYear ? Number(filterYear) : null,
        yearLevel: recordYear ? Number(recordYear) : null,
        scholarIds: picked ? chosen.map(s => s.scholarId) : null,
        notes: notes.trim() || null,
      }, token);
      onSaved(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Schedule release"
      subtitle={`${type.name} · ${periodLabel(academicYear, semester)}`}
      onClose={onClose}
      width={720}
      dismissible={!submitting}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* A coordinator schedules for their own campus only, which is chosen for them. */}
        {pickCampus && (
          <div>
            <p className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
              Campuses receiving on this date
            </p>
            <div className="flex flex-wrap gap-1.5">
              {campuses.map(c => {
                const on = campusIds.has(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleCampus(c.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                    style={on ? { background: '#002570', color: '#fff' } : { background: 'var(--surface-inset)', color: 'var(--text)' }}
                    aria-pressed={on}>
                    {on && <Check size={11} strokeWidth={3} />}{c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {semester === BOTH_SEMESTERS && (
          <p className="text-xs rounded-xl px-3 py-2" style={{ background: 'var(--surface-inset)', color: 'var(--text)' }}>
            Semesters 1 and 2 are released together on this date. Each semester is still recorded as
            its own release of the amount below.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Release date">
            <input required type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="clay-input" />
          </Field>
          <Field label={semester === BOTH_SEMESTERS ? 'Amount per scholar, per semester (PHP)' : 'Amount per scholar (PHP)'}>
            <NumericInput required prefix="₱" allowDecimal maxLength={11}
              value={amount} onChange={setAmount} placeholder="10,000.00" />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Include year level">
            <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setPicked(null); }} className="clay-input">
              <option value="">All year levels</option>
              {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>Year {y} only</option>)}
            </select>
          </Field>
          <Field label="Year level paid for">
            <select value={recordYear} onChange={e => setRecordYear(e.target.value)} className="clay-input">
              <option value="">Each scholar&apos;s current year level</option>
              {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
              Scholars ({chosen.length} of {eligible.length})
            </p>
            {eligible.length > 0 && (
              <div className="flex gap-3">
                <button type="button" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }} onClick={() => setPicked(null)}>Select all</button>
                <button type="button" className="text-xs font-semibold hover:underline" style={{ color: 'var(--text-muted)' }} onClick={() => setPicked(new Set())}>Select none</button>
              </div>
            )}
          </div>
          <div className="rounded-2xl p-2 max-h-56 overflow-y-auto" style={{ background: 'var(--surface-inset)' }}>
            {!roster ? (
              <p className="text-xs p-2" style={{ color: 'var(--text-muted)' }}>Loading scholars…</p>
            ) : campusIds.size === 0 ? (
              <p className="text-xs p-2" style={{ color: 'var(--text-muted)' }}>Choose at least one campus.</p>
            ) : eligible.length === 0 ? (
              <p className="text-xs p-2" style={{ color: 'var(--text-muted)' }}>No scholars awaiting this release at the selected campuses.</p>
            ) : eligible.map(s => {
              const on = !picked || picked.has(s.scholarId);
              return (
                <label key={s.scholarId} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm">
                  <input type="checkbox" checked={on} onChange={() => togglePick(s.scholarId)} />
                  <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--text-strong)' }}>{s.scholarName}</span>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {s.campusName} · Year {s.profileYearLevel}{s.status === 'Pending' ? ' · rescheduling' : ''}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <Field label="Notes (optional)">
          <input value={notes} onChange={e => setNotes(e.target.value)} className="clay-input" placeholder="e.g. Payout at the Cashier's Office, 9 AM" />
        </Field>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Each scholar is notified of the date. Mark them released once they have received it — the date
          and amount are then saved to their profile.
        </p>

        <ModalButtons onClose={onClose} submitting={submitting} disabled={!canSubmit}
          label={`Schedule ${chosen.length} release${chosen.length === 1 ? '' : 's'}`} />
      </form>
    </Modal>
  );
}

/* Marks every ticked release as received in one go. */
function BatchReleaseModal({ count, typeName, ids, token, onClose, onSaved }) {
  const [referenceNo, setReferenceNo] = useState('');
  const [releasedAt, setReleasedAt] = useState(localDateInput);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await releaseScholarshipBatch({
        releaseIds: ids,
        referenceNo: referenceNo.trim() || null,
        releasedAt: releasedAt ? new Date(releasedAt).toISOString() : null,
      }, token);
      onSaved(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Mark as released" subtitle={`${typeName} · ${count} scholar${count === 1 ? '' : 's'}`}
      onClose={onClose} width={440} dismissible={!submitting}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Date received">
          <input required type="date" value={releasedAt} onChange={e => setReleasedAt(e.target.value)} className="clay-input" />
        </Field>
        <Field label="Reference number (optional)">
          <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)} className="clay-input" placeholder="Payroll / disbursement no." />
        </Field>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Releasing is final. Each scholar is notified, and the date and amount are saved to their profile.
        </p>
        <ModalButtons onClose={onClose} submitting={submitting} label={`Release ${count}`} />
      </form>
    </Modal>
  );
}

/**
 * "Released" for the whole scholarship: everyone scheduled for this period is marked as having
 * received the money in one step. A scholar who did not collect on the day is unticked — an
 * exemption — and stays "not yet received" with a note, to be released once they claim it.
 */
function ReleaseAllModal({ rows, typeName, period, token, onClose, onSaved }) {
  const [exempt, setExempt] = useState(() => new Set());
  const [referenceNo, setReferenceNo] = useState('');
  const [releasedAt, setReleasedAt] = useState(localDateInput);
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const shown = query.trim()
    ? rows.filter(r => `${r.scholarName} ${r.studentId ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    : rows;
  const receiving = rows.filter(r => !exempt.has(r.scholarId));

  function toggle(id) {
    setExempt(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await releaseScholarshipBatch({
        releaseIds: receiving.flatMap(r => r.pendingReleaseIds),
        exemptReleaseIds: rows.filter(r => exempt.has(r.scholarId)).flatMap(r => r.pendingReleaseIds),
        exemptReason: reason.trim() || null,
        referenceNo: referenceNo.trim() || null,
        releasedAt: releasedAt ? new Date(releasedAt).toISOString() : null,
      }, token);
      onSaved(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Release ${typeName}`} subtitle={`${period} · ${rows.length} scholar${rows.length === 1 ? '' : 's'} scheduled`}
      onClose={onClose} width={640} dismissible={!submitting}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
          Everyone ticked is marked as having <strong>received</strong> the scholarship, and it shows on their
          profile at once. Untick anyone who did not get their money — they are exempted and stay
          <strong> not yet received</strong> until you release them individually.
        </p>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
              Received ({receiving.length}) · Exempted ({exempt.size})
            </p>
            <div className="flex gap-3">
              <button type="button" className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }} onClick={() => setExempt(new Set())}>Tick all</button>
              <button type="button" className="text-xs font-semibold hover:underline" style={{ color: 'var(--text-muted)' }} onClick={() => setExempt(new Set(rows.map(r => r.scholarId)))}>Untick all</button>
            </div>
          </div>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} className="clay-input mb-2"
            placeholder="Find a scholar…" aria-label="Find a scholar" />
          <div className="rounded-2xl p-2 max-h-64 overflow-y-auto" style={{ background: 'var(--surface-inset)' }}>
            {shown.map(r => {
              const on = !exempt.has(r.scholarId);
              return (
                <label key={r.scholarId} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm">
                  <input type="checkbox" checked={on} onChange={() => toggle(r.scholarId)} />
                  <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--text-strong)' }}>{r.scholarName}</span>
                  <span className="text-xs shrink-0" style={{ color: on ? 'var(--tone-ok-fg)' : 'var(--tone-attention-fg)' }}>
                    {on ? 'Received' : 'Not yet received'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {exempt.size > 0 && (
          <Field label="Why the exempted scholars did not receive it (optional)">
            <input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} className="clay-input"
              placeholder="e.g. Did not claim at the cashier on the release day" />
          </Field>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Date received">
            <input required type="date" value={releasedAt} onChange={e => setReleasedAt(e.target.value)} className="clay-input" />
          </Field>
          <Field label="Reference number (optional)">
            <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)} className="clay-input" placeholder="Payroll / disbursement no." />
          </Field>
        </div>

        <ModalButtons onClose={onClose} submitting={submitting} disabled={rows.length === 0}
          label={receiving.length > 0 ? `Mark ${receiving.length} as received` : 'Save exemptions'} />
      </form>
    </Modal>
  );
}
