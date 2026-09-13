import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { getSubmissions, reviewDocument, batchReviewDocuments, downloadFile, getSubmissionHistory, getRequirements, uploadDocument } from '../api/documents';
import { getActiveSemester } from '../api/settings';
import { useTitle } from '../hooks/useTitle';
import { CheckCircle2, XCircle, FilePlus2 } from 'lucide-react';
import Pagination from '../components/Pagination';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { ctlStyle } from '../constants/ui';
import Modal from '../components/Modal';
import ScholarSearchSelect from '../components/ScholarSearchSelect';
import StatusBadge from '../components/StatusBadge';
import { statusDot } from '../constants/statusTones';
import Field from '../components/Field';
import { getUploadPolicy, FALLBACK_UPLOAD_POLICY, acceptAttribute, describeExtensions, validateUpload } from '../api/uploadPolicy';

const STATUSES = ['', 'Pending', 'Verified', 'Incomplete'];

export default function DocumentReviewPage() {
  useTitle('Document Review');
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [filing, setFiling] = useState(false);
  const [filters, setFilters] = useState({ status: 'Pending', academicYear: '', semester: '' });
  const [selected, setSelected] = useState(new Set());
  const [bulkFeedback, setBulkFeedback] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  async function load(f = filters) {
    setLoading(true);
    try {
      const data = await getSubmissions(token, {
        status: f.status || undefined,
        academicYear: f.academicYear || undefined,
        semester: f.semester || undefined,
      });
      setSubmissions(data);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(prev => prev.size === submissions.length ? new Set() : new Set(submissions.map(s => s.id)));
  }

  async function handleBatch(status) {
    if (selected.size === 0) return;
    if (status === 'Incomplete' && !bulkFeedback.trim()) {
      toast('Please add feedback explaining what needs correcting before marking incomplete.', 'error');
      return;
    }
    if (!(await confirm({ title: `Mark as ${status}`, message: `Mark ${selected.size} submission(s) as ${status}?`, confirmLabel: 'Confirm' }))) return;
    setBulkBusy(true);
    try {
      await batchReviewDocuments([...selected], status, bulkFeedback.trim() || null, token);
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
  }, []);

  /* Paging here is client-side over an already-loaded list, so the page reset belongs with
     the thing that invalidates it rather than in an effect watching `filters` — that effect
     re-fired on every render, because `filters` is a fresh object each time. */
  function setFilter(k, v) {
    const next = { ...filters, [k]: v };
    setFilters(next);
    setPage(1);
    load(next);
  }

  function changeSearch(v) { setSearch(v); setPage(1); }
  function changePageSize(v) { setPageSize(v); setPage(1); }

  const pending = submissions.filter(s => s.status === 'Pending').length;

  const filtered = search
    ? submissions.filter(s =>
        (s.scholarName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.requirementName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.scholarEmail ?? '').toLowerCase().includes(search.toLowerCase()))
    : submissions;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Document Review</h1>
            <p className="page-subtitle">{pending} pending review{pending !== 1 ? 's' : ''}</p>
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
            {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
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

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="clay-card p-3 mb-4 flex items-center gap-3 flex-wrap" style={{ background: 'var(--accent-soft-bg)', border: '1.5px solid var(--accent-soft-border)' }}>
            <span className="text-sm font-bold px-2" style={{ color: 'var(--accent)' }}>{selected.size} selected</span>
            <input
              value={bulkFeedback}
              onChange={e => setBulkFeedback(e.target.value)}
              placeholder="Feedback (required to mark incomplete)"
              className="clay-input flex-1"
              style={{ minWidth: 200 }}
            />
            <button onClick={() => handleBatch('Verified')} disabled={bulkBusy}
              className="clay-btn px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
              style={{ background: '#d4f4e2', color: '#166534', opacity: bulkBusy ? 0.6 : 1 }}>
              <CheckCircle2 size={15} strokeWidth={2.4} /> Verify Selected
            </button>
            <button onClick={() => handleBatch('Incomplete')} disabled={bulkBusy}
              className="clay-btn px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
              style={{ background: '#fee2e2', color: '#991b1b', opacity: bulkBusy ? 0.6 : 1 }}>
              <XCircle size={15} strokeWidth={2.4} /> Mark Incomplete
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
            <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={selected.size === submissions.length && submissions.length > 0}
                      onChange={toggleAll} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                  </th>
                  {['Scholar', 'Document', 'File', 'Period', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(s => (
                  <tr key={s.id} className="clay-table-row">
                    <td className="px-4 py-3.5">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)}
                        style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{s.scholarName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.scholarEmail}</p>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{s.requirementName}</td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => downloadFile(s.id, s.fileName, token).catch(e => toast(e.message, 'error'))}
                        className="text-xs hover:underline truncate max-w-[180px] block text-left"
                        style={{ color: 'var(--accent)' }}
                      >
                        {s.fileName}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: 'var(--text)' }}>
                      {s.academicYear} · Sem {s.semester}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setReviewing(s)}
                        className="text-xs font-medium hover:underline"
                        style={{ color: s.status === 'Pending' ? 'var(--accent)' : 'var(--text-muted)' }}
                      >
                        {s.status === 'Pending' ? 'Review' : 'Update'}
                      </button>
                    </td>
                  </tr>
                ))}
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
            label="submissions"
          />
        )}
      </div>

      {reviewing && (
        <ReviewModal
          submission={reviewing}
          token={token}
          onClose={() => setReviewing(null)}
          onSaved={() => { setReviewing(null); load(); }}
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
      {error && (
        <div className="mb-4 p-3 rounded-2xl text-sm font-medium"
          style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1.5px solid var(--accent-soft-border)' }}>
          {error}
        </div>
      )}

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
          <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
          <button type="submit" disabled={submitting} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm" style={{ opacity: submitting ? 0.65 : 1 }}>
            {submitting ? 'Filing…' : 'File Document'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReviewModal({ submission, token, onClose, onSaved }) {
  const toast = useToast();
  const [status, setStatus] = useState('Verified');
  const [feedback, setFeedback] = useState(submission.feedbackNote ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    getSubmissionHistory(submission.id, token).then(setHistory).catch(() => {});
  }, [submission.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await reviewDocument(submission.id, status, feedback || null, token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Review Document"
      subtitle={`${submission.scholarName} · ${submission.requirementName}`}
      onClose={onClose}
      width={480}
      dismissible={!submitting}
    >
        <div className="mb-4">
          <button
            onClick={() => downloadFile(submission.id, submission.fileName, token).catch(e => toast(e.message, 'error'))}
            className="text-sm hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            Download: {submission.fileName}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl text-sm font-medium"
            style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1.5px solid var(--accent-soft-border)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* A radio group is labelled by a <legend>, not a <label> — a label with no control
              to point at is announced as a label for nothing. The options carry their own
              wrapping labels, which associates each with its radio implicitly. */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
              Decision
            </legend>
            <div className="flex gap-3">
              {['Verified', 'Incomplete'].map(s => (
                <label
                  key={s}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl cursor-pointer text-sm font-bold transition-colors${
                    status === s ? ` status-badge tone-${s === 'Verified' ? 'ok' : 'bad'}` : ''}`}
                  style={status === s
                    ? { borderRadius: 16, borderWidth: 2 }
                    : { background: 'var(--surface-inset)', color: 'var(--text-muted)', border: '2px solid var(--hairline-strong)' }}
                >
                  <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label={<>Feedback {status === 'Incomplete' && <span style={{ color: 'var(--danger)' }}>*</span>}</>}>
            <textarea
              rows={3}
              required={status === 'Incomplete'}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder={status === 'Incomplete' ? 'Explain what needs to be corrected…' : 'Optional notes for the scholar'}
              className="clay-input"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm" style={{ opacity: submitting ? 0.65 : 1 }}>
              {submitting ? 'Saving…' : 'Submit Review'}
            </button>
          </div>
        </form>

        {history.length > 0 && (
          <div className="mt-6 pt-5" style={{ borderTop: '1.5px solid rgba(0,0,0,0.07)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Status History</p>
            <ol className="space-y-3">
              {history.map((h, i) => (
                <li key={h.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full mt-0.5" style={{ background: statusDot(h.status) }} />
                    {i < history.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'rgba(0,0,0,0.1)', minHeight: 16 }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-strong)' }}>{h.status}</p>
                    {h.note && <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{h.note}</p>}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      {h.changedBy} · {new Date(h.changedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
    </Modal>
  );
}
