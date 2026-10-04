import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import {
  getSubmissions, reviewDocument, batchReviewDocuments, downloadFile, previewFile, getSubmissionHistory,
  getRequirements, uploadDocument, startDocumentReview,
} from '../api/documents';
import { getActiveSemester } from '../api/settings';
import { useTitle } from '../hooks/useTitle';
import { CheckCircle2, XCircle, FilePlus2, Download, Loader, ChevronDown, ChevronRight } from 'lucide-react';
import DocumentPreview from '../components/DocumentPreview';
import Pagination from '../components/Pagination';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { ctlStyle } from '../constants/ui';
import Modal from '../components/Modal';
import ScholarSearchSelect from '../components/ScholarSearchSelect';
import StatusBadge from '../components/StatusBadge';
import { statusDot } from '../constants/statusTones';
import Field from '../components/Field';
import { ErrorBox } from './UsersPage';
import { getUploadPolicy, FALLBACK_UPLOAD_POLICY, acceptAttribute, describeExtensions, validateUpload } from '../api/uploadPolicy';

// "Pending" is every document still waiting on a decision — submitted or under review.
const STATUSES = [
  ['Pending', 'Awaiting decision'],
  ['UnderReview', 'Under Review'],
  ['Verified', 'Verified'],
  ['Rejected', 'Rejected'],
];
const awaiting = s => s.status === 'Pending' || s.status === 'UnderReview';

/**
 * Document Review, one row per scholar. A scholar who handed in five documents used to appear
 * five times; now their name is listed once, and opening it shows every document they sent in
 * a single scrollable review — each with its own Verified / Rejected decision.
 */
export default function DocumentReviewPage() {
  useTitle('Document Review');
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);   // scholarId being reviewed
  const [filing, setFiling] = useState(false);
  const [filters, setFilters] = useState({ status: 'Pending', academicYear: '', semester: '' });
  const [selected, setSelected] = useState(new Set()); // scholarIds
  const [bulkFeedback, setBulkFeedback] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [error, setError] = useState('');
  // Each filter change starts a request; only the latest may write the table. The year box
  // fires per keystroke, and a slow early response used to land last and overwrite the
  // results for what was actually typed.
  const requestSeq = useRef(0);

  async function load(f = filters) {
    // Every reload follows something that can change the queue; keep the sidebar badge in step.
    window.dispatchEvent(new Event('document-review-changed'));
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const data = await getSubmissions(token, {
        status: f.status || undefined,
        academicYear: f.academicYear || undefined,
        semester: f.semester || undefined,
      });
      if (seq !== requestSeq.current) return;
      setSubmissions(data);
      setSelected(new Set());
    } catch (e) {
      // Previously uncaught: the table fell through to "No submissions found", which reads
      // as an empty queue rather than a failure.
      if (seq === requestSeq.current) setError(e.message);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  // One group per scholar, newest activity first.
  const groups = useMemo(() => {
    const map = new Map();
    for (const s of submissions) {
      let g = map.get(s.scholarId);
      if (!g) {
        g = {
          scholarId: s.scholarId, scholarName: s.scholarName, scholarEmail: s.scholarEmail,
          studentId: s.studentId, scholarshipTypeName: s.scholarshipTypeName, docs: [], latest: s.submittedAt,
        };
        map.set(s.scholarId, g);
      }
      g.docs.push(s);
      if (s.submittedAt > g.latest) g.latest = s.submittedAt;
    }
    return [...map.values()].sort((a, b) => String(b.latest).localeCompare(String(a.latest)));
  }, [submissions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g =>
      (g.scholarName ?? '').toLowerCase().includes(q) ||
      (g.scholarEmail ?? '').toLowerCase().includes(q) ||
      (g.studentId ?? '').toLowerCase().includes(q) ||
      g.docs.some(d => (d.requirementName ?? '').toLowerCase().includes(q)));
  }, [groups, search]);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  /* "Select all" means the scholars the reviewer can see — never rows the search has hidden. */
  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(filtered.map(g => g.scholarId)));
  }

  // Bulk decisions apply to the documents still awaiting a decision of each ticked scholar.
  const selectedDocIds = filtered
    .filter(g => selected.has(g.scholarId))
    .flatMap(g => g.docs.filter(awaiting).map(d => d.id));

  async function handleBatch(status) {
    if (selectedDocIds.length === 0) { toast('The selected scholars have no documents awaiting a decision.', 'error'); return; }
    if (status === 'Rejected' && !bulkFeedback.trim()) {
      toast('Please add feedback explaining what needs correcting before rejecting.', 'error');
      return;
    }
    if (!(await confirm({
      title: status === 'Rejected' ? 'Reject documents' : 'Verify documents',
      message: `Mark ${selectedDocIds.length} document(s) from ${selected.size} scholar(s) as ${status}?`,
      confirmLabel: 'Confirm',
    }))) return;
    setBulkBusy(true);
    try {
      const result = await batchReviewDocuments(selectedDocIds, status, bulkFeedback.trim() || null, token);
      const count = result?.reviewed ?? selectedDocIds.length;
      toast(`${count} document${count !== 1 ? 's' : ''} marked ${status}.`, 'success');
      setBulkFeedback('');
      await load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBulkBusy(false); }
  }

  useEffect(() => {
    getActiveSemester(token)
      .then(data => {
        const initialFilters = { status: 'Pending', academicYear: data.academicYear, semester: String(data.semester) };
        setFilters(initialFilters);
        load(initialFilters);
      })
      .catch(() => load());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Paging here is client-side over an already-loaded list, so the page reset belongs with
     the thing that invalidates it rather than in an effect watching `filters`. */
  function setFilter(k, v) {
    const next = { ...filters, [k]: v };
    setFilters(next);
    setPage(1);
    load(next);
  }

  // A selection made under one search must not silently carry rows the next search hides.
  function changeSearch(v) { setSearch(v); setPage(1); setSelected(new Set()); }
  function changePageSize(v) { setPageSize(v); setPage(1); }

  const waitingScholars = groups.filter(g => g.docs.some(awaiting)).length;
  const allVisibleSelected = filtered.length > 0 && filtered.every(g => selected.has(g.scholarId));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const reviewingGroup = reviewing ? groups.find(g => g.scholarId === reviewing) : null;

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Document Review</h1>
            <p className="page-subtitle">
              {waitingScholars} scholar{waitingScholars !== 1 ? 's' : ''} with documents awaiting a decision
            </p>
            <span className="page-title-bar" />
          </div>
          <button
            onClick={() => setFiling(true)}
            className="clay-btn clay-btn-primary px-4 py-2.5 text-sm flex items-center gap-2"
          >
            <FilePlus2 size={15} strokeWidth={2.4} /> File for a Scholar
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <input
            type="search"
            value={search}
            onChange={e => changeSearch(e.target.value)}
            className="clay-input"
            style={{ ...ctlStyle, width: 220 }}
            placeholder="Search scholar, document…"
          />
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All Statuses</option>
            {STATUSES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <input
            type="text"
            value={filters.academicYear}
            onChange={e => setFilter('academicYear', e.target.value)}
            className="clay-input"
            style={{ ...ctlStyle, width: 110 }}
            placeholder="2025-2026"
          />
          <select value={filters.semester} onChange={e => setFilter('semester', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All Semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </select>
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="clay-card p-3 mb-4 flex items-center gap-3 flex-wrap" style={{ background: 'var(--accent-soft-bg)', border: '1.5px solid var(--accent-soft-border)' }}>
            <span className="text-sm font-bold px-2" style={{ color: 'var(--accent)' }}>
              {selected.size} scholar{selected.size === 1 ? '' : 's'} · {selectedDocIds.length} document{selectedDocIds.length === 1 ? '' : 's'} awaiting
            </span>
            <input
              value={bulkFeedback}
              onChange={e => setBulkFeedback(e.target.value)}
              placeholder="Feedback (required to reject)"
              className="clay-input flex-1"
              style={{ minWidth: 200 }}
            />
            <button onClick={() => handleBatch('Verified')} disabled={bulkBusy}
              className="clay-btn px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
              style={{ background: 'var(--tone-ok-bg)', color: 'var(--tone-ok-fg)', opacity: bulkBusy ? 0.6 : 1 }}>
              <CheckCircle2 size={15} strokeWidth={2.4} /> Verify All
            </button>
            <button onClick={() => handleBatch('Rejected')} disabled={bulkBusy}
              className="clay-btn px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
              style={{ background: 'var(--tone-bad-bg)', color: 'var(--tone-bad-fg)', opacity: bulkBusy ? 0.6 : 1 }}>
              <XCircle size={15} strokeWidth={2.4} /> Reject All
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs hover:underline" style={{ color: 'var(--text-muted)' }}>Clear</button>
          </div>
        )}

        <div className="clay-card overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState title="No submissions found" message="No submissions match the current filters." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={allVisibleSelected}
                      onChange={toggleAll} aria-label="Select all shown scholars"
                      style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                  </th>
                  {['Scholar', 'Scholarship', 'Documents', 'Status', 'Last Submitted', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(g => {
                  const waiting = g.docs.filter(awaiting).length;
                  const counts = g.docs.reduce((acc, d) => ({ ...acc, [d.status]: (acc[d.status] ?? 0) + 1 }), {});
                  return (
                    <tr key={g.scholarId} className="clay-table-row">
                      <td className="px-4 py-3.5">
                        <input type="checkbox" checked={selected.has(g.scholarId)} onChange={() => toggle(g.scholarId)}
                          aria-label={`Select ${g.scholarName}`}
                          style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => setReviewing(g.scholarId)} className="font-semibold hover:underline text-left" style={{ color: 'var(--text-strong)' }}>
                          {g.scholarName}
                        </button>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.studentId ? `${g.studentId} · ` : ''}{g.scholarEmail}</p>
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text)' }}>{g.scholarshipTypeName ?? '—'}</td>
                      <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>
                        <p className="font-semibold">{g.docs.length} document{g.docs.length === 1 ? '' : 's'}</p>
                        <p className="text-xs truncate max-w-[260px]" style={{ color: 'var(--text-muted)' }} title={g.docs.map(d => d.requirementName).join(', ')}>
                          {g.docs.map(d => d.requirementName).join(', ')}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {['Pending', 'UnderReview', 'Verified', 'Rejected'].filter(st => counts[st]).map(st => (
                            <StatusBadge key={st} status={st} label={`${counts[st]} ${st === 'Pending' ? 'Submitted' : st === 'UnderReview' ? 'Under Review' : st}`} icon={false} />
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: 'var(--text)' }}>
                        {new Date(g.latest).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setReviewing(g.scholarId)}
                          className="text-xs font-bold hover:underline"
                          style={{ color: waiting ? 'var(--accent)' : 'var(--text-muted)' }}
                        >
                          {waiting ? `Review ${waiting}` : 'View'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            label="scholars"
          />
        )}
      </div>

      {reviewingGroup && (
        <ScholarReviewModal
          group={reviewingGroup}
          token={token}
          onClose={() => { setReviewing(null); load(); }}
          onSaved={count => { setReviewing(null); toast(`${count} decision${count === 1 ? '' : 's'} saved — the scholar has been notified.`, 'success'); load(); }}
        />
      )}

      {filing && (
        <FileForScholarModal
          token={token}
          defaultPeriod={{ academicYear: filters.academicYear, semester: filters.semester || '1' }}
          onClose={() => setFiling(false)}
          onSaved={() => { setFiling(false); load(); }}
        />
      )}
    </Layout>
  );
}

/**
 * Staff filing a document a scholar handed in at the counter, posted, or emailed.
 *
 * The server has always had the exemptions this needs — bypassing the profile gate,
 * backfilling a period that has closed, replacing a file already verified, submitting past
 * a deadline — but no way to say *whose* checklist the document belonged on, so a staff
 * upload landed under the staff member's own account. This supplies the scholar.
 */
function FileForScholarModal({ token, defaultPeriod, onClose, onSaved }) {
  const toast = useToast();
  const [scholarId, setScholarId] = useState('');
  const [requirements, setRequirements] = useState([]);
  const [requirementId, setRequirementId] = useState('');
  const [academicYear, setAcademicYear] = useState(defaultPeriod.academicYear || '');
  const [semester, setSemester] = useState(defaultPeriod.semester || '1');
  const [file, setFile] = useState(null);
  const [policy, setPolicy] = useState(FALLBACK_UPLOAD_POLICY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getUploadPolicy().then(setPolicy);
    // The full catalogue, not one scholarship's subset: staff may be filing a shared
    // requirement for a scholar whose scholarship is not yet set.
    getRequirements(token).then(setRequirements).catch(() => setRequirements([]));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!scholarId) { setError('Choose the scholar this document belongs to.'); return; }
    if (!requirementId) { setError('Choose which requirement this document satisfies.'); return; }
    if (!file) { setError('Choose a file to upload.'); return; }

    const problem = validateUpload(file, policy);
    if (problem) { setError(problem); return; }

    setSubmitting(true);
    try {
      await uploadDocument(file, requirementId, academicYear.trim(), Number(semester), token, scholarId);
      toast('Document filed. The scholar has been notified.', 'success');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="File a Document for a Scholar"
      subtitle="Use this for documents handed in at the counter or received by mail."
      onClose={onClose}
      width={480}
      dismissible={!submitting}
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Scholar">
          <ScholarSearchSelect token={token} value={scholarId} onChange={setScholarId} />
        </Field>

        <Field label="Requirement">
          <select value={requirementId} onChange={e => setRequirementId(e.target.value)} className="clay-input">
            <option value="">— Select Requirement —</option>
            {requirements.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Academic Year">
            <input
              required
              value={academicYear}
              onChange={e => setAcademicYear(e.target.value)}
              className="clay-input"
              placeholder="2025-2026"
            />
          </Field>
          <Field label="Semester">
            <select value={semester} onChange={e => setSemester(e.target.value)} className="clay-input">
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </Field>
        </div>

        <Field label="File" hint={`${describeExtensions(policy)} · up to ${policy.maxUploadMb} MB`}>
          <input
            type="file"
            accept={acceptAttribute(policy)}
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="clay-input"
          />
        </Field>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          The submission is filed under the scholar's name and starts as Pending, so it still
          goes through review. A past period is allowed; a future one is not.
        </p>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={submitting} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
          <button type="submit" disabled={submitting} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm" style={{ opacity: submitting ? 0.65 : 1 }}>
            {submitting ? 'Filing…' : 'File Document'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Every document one scholar handed in, reviewed in one place. The list scrolls; each document
 * shows its file beside its own Verified / Rejected decision, so the reviewer can verify some
 * and reject others in a single pass. Opening it moves the scholar's submitted documents to
 * Under Review, which is what their tracker shows.
 */
function ScholarReviewModal({ group, token, onClose, onSaved }) {
  // { [submissionId]: { status, feedback } } — only documents the reviewer has decided on.
  const [decisions, setDecisions] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const docs = useMemo(() => [...group.docs].sort((a, b) =>
    Number(awaiting(b)) - Number(awaiting(a)) || String(a.requirementName).localeCompare(String(b.requirementName))),
  [group.docs]);

  // Opening the review is the office "looking at" the documents.
  useEffect(() => {
    const ids = group.docs.filter(d => d.status === 'Pending').map(d => d.id);
    if (ids.length) startDocumentReview(ids, token).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decided = Object.entries(decisions).filter(([, d]) => d?.status);

  function setDecision(id, patch) {
    setDecisions(prev => ({ ...prev, [id]: { ...(prev[id] ?? { feedback: '' }), ...patch } }));
  }

  async function handleSave() {
    setError('');
    const missing = decided.find(([, d]) => d.status === 'Rejected' && !d.feedback?.trim());
    if (missing) {
      const doc = docs.find(d => String(d.id) === missing[0]);
      setError(`Add feedback for "${doc?.requirementName}" explaining what needs to be corrected.`);
      return;
    }
    setSubmitting(true);
    try {
      for (const [id, d] of decided)
        await reviewDocument(Number(id), d.status, d.feedback?.trim() || null, token);
      onSaved(decided.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Review Documents"
      subtitle={`${group.scholarName}${group.studentId ? ` · ${group.studentId}` : ''}${group.scholarshipTypeName ? ` · ${group.scholarshipTypeName}` : ''} · ${docs.length} document${docs.length === 1 ? '' : 's'}`}
      onClose={onClose}
      width={1080}
      dismissible={!submitting}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="space-y-4 overflow-y-auto pr-1" style={{ maxHeight: 'min(70vh, 820px)' }}>
        {docs.map((d, i) => (
          <DocReviewCard
            key={d.id}
            index={i + 1}
            submission={d}
            token={token}
            decision={decisions[d.id]}
            onDecision={patch => setDecision(d.id, patch)}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 pt-4 mt-4 flex-wrap" style={{ borderTop: '1.5px solid var(--hairline)' }}>
        <p className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>
          {decided.length === 0
            ? 'Choose Verified or Rejected on each document you have checked.'
            : `${decided.length} decision${decided.length === 1 ? '' : 's'} ready to save.`}
        </p>
        <button type="button" onClick={onClose} disabled={submitting} className="clay-btn clay-btn-ghost px-5 py-2.5 text-sm">Close</button>
        <button type="button" onClick={handleSave} disabled={submitting || decided.length === 0}
          className="clay-btn clay-btn-primary px-5 py-2.5 text-sm" style={{ opacity: submitting || decided.length === 0 ? 0.6 : 1 }}>
          {submitting ? 'Saving…' : `Save ${decided.length || ''} Decision${decided.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </Modal>
  );
}

function DocReviewCard({ index, submission, token, decision, onDecision }) {
  const toast = useToast();
  const [preview, setPreview] = useState(null);   // { url, contentType, fileName }
  const [previewError, setPreviewError] = useState('');
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const status = decision?.status ?? '';
  const isRejected = status === 'Rejected';

  useEffect(() => {
    let url;
    let cancelled = false;
    previewFile(submission.id, token)
      .then(p => {
        url = p.url;
        if (cancelled) URL.revokeObjectURL(url);
        else setPreview({ ...p, fileName: submission.fileName });
      })
      .catch(e => { if (!cancelled) setPreviewError(e.message); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [submission.id, submission.fileName, token]);

  function toggleHistory() {
    setShowHistory(v => !v);
    if (!history) getSubmissionHistory(submission.id, token).then(setHistory).catch(() => setHistory([]));
  }

  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--surface-inset)', border: '1.5px solid var(--hairline)' }}
      aria-label={`${index}. ${submission.requirementName}`}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-black text-sm" style={{ color: 'var(--text-strong)' }}>
            {index}. {submission.requirementName}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {submission.fileName} · {submission.academicYear} Sem {submission.semester} · submitted{' '}
            {new Date(submission.submittedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            {submission.isLate && <span style={{ color: 'var(--tone-attention-fg)' }}> · late</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={submission.status === 'Pending' ? 'UnderReview' : submission.status} />
          <button
            type="button"
            onClick={() => downloadFile(submission.id, submission.fileName, token).catch(e => toast(e.message, 'error'))}
            className="text-xs font-medium hover:underline flex items-center gap-1"
            style={{ color: 'var(--accent)' }}
          >
            <Download size={13} strokeWidth={2.4} /> Download
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1.5px solid var(--hairline)', height: 'min(48vh, 460px)' }}>
          {preview ? (
            <DocumentPreview preview={preview} />
          ) : previewError ? (
            <div className="w-full h-full flex items-center justify-center p-6 text-center text-xs" style={{ color: 'var(--danger)' }}>
              {previewError}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Loader size={14} className="animate-spin" /> Loading document…
            </div>
          )}
        </div>

        <div className="space-y-3 min-w-0">
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
              Decision
            </legend>
            <div className="flex gap-2">
              {['Verified', 'Rejected'].map(s => (
                <label
                  key={s}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-2xl cursor-pointer text-sm font-bold transition-colors${
                    status === s ? ` status-badge tone-${s === 'Verified' ? 'ok' : 'bad'}` : ''}`}
                  style={status === s
                    ? { borderRadius: 16, borderWidth: 2 }
                    : { background: 'var(--surface)', color: 'var(--text-muted)', border: '2px solid var(--hairline-strong)' }}
                >
                  <input type="radio" name={`status-${submission.id}`} value={s} checked={status === s}
                    onChange={() => onDecision({ status: s, feedback: decision?.feedback ?? submission.feedbackNote ?? '' })} className="sr-only" />
                  {s === 'Verified' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {s === 'Verified' ? 'Verify' : 'Reject'}
                </label>
              ))}
            </div>
            {submission.status !== 'Pending' && submission.status !== 'UnderReview' && !status && (
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Already {submission.status === 'Rejected' || submission.status === 'Incomplete' ? 'rejected' : 'verified'}
                {submission.reviewedBy ? ` by ${submission.reviewedBy}` : ''}. Choose a decision only to change it.
              </p>
            )}
          </fieldset>

          <Field label={<>Feedback {isRejected && <span style={{ color: 'var(--danger)' }}>*</span>}</>}>
            <textarea
              rows={3}
              value={decision?.feedback ?? (status ? '' : submission.feedbackNote ?? '')}
              maxLength={1000}
              onChange={e => onDecision({ feedback: e.target.value, status: status || undefined })}
              placeholder={isRejected ? 'Explain what needs to be corrected…' : 'Optional notes for the scholar'}
              className="clay-input"
            />
          </Field>

          <button type="button" onClick={toggleHistory} className="text-xs font-semibold flex items-center gap-1 hover:underline"
            style={{ color: 'var(--text-muted)' }}>
            {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Status history
          </button>
          {showHistory && (
            history === null ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : (
              <ol className="space-y-2.5">
                {history.map((h, i) => (
                  <li key={h.id} className="flex items-start gap-2.5">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-2 h-2 rounded-full mt-1" style={{ background: statusDot(h.status) }} />
                      {i < history.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'var(--hairline-strong)', minHeight: 12 }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: 'var(--text-strong)' }}>
                        {h.status === 'UnderReview' ? 'Under Review' : h.status === 'Incomplete' ? 'Rejected' : h.status === 'Pending' ? 'Submitted' : h.status}
                      </p>
                      {h.note && <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{h.note}</p>}
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {h.changedBy} · {new Date(h.changedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )
          )}
        </div>
      </div>
    </section>
  );
}
