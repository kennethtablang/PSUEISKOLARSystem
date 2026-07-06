import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { getSubmissions, reviewDocument, batchReviewDocuments, downloadFile, getSubmissionHistory } from '../api/documents';
import { getActiveSemester } from '../api/settings';
import { useTitle } from '../hooks/useTitle';
import { CheckCircle2, XCircle } from 'lucide-react';
import Pagination from '../components/Pagination';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { ctlStyle } from '../constants/ui';

const STATUSES = ['', 'Pending', 'Verified', 'Incomplete'];
const STATUS_STYLE = {
  Pending:    'bg-amber-100 text-amber-700',
  Verified:   'bg-emerald-100 text-emerald-700',
  Incomplete: 'bg-red-100 text-red-700',
};

export default function DocumentReviewPage() {
  useTitle('Document Review');
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
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

  function setFilter(k, v) {
    const next = { ...filters, [k]: v };
    setFilters(next);
    load(next);
  }

  const pending = submissions.filter(s => s.status === 'Pending').length;

  const filtered = search
    ? submissions.filter(s =>
        (s.scholarName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.requirementName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.scholarEmail ?? '').toLowerCase().includes(search.toLowerCase()))
    : submissions;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search, pageSize, filters]);

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Document Review</h1>
            <p className="page-subtitle">{pending} pending review{pending !== 1 ? 's' : ''}</p>
            <span className="page-title-bar" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
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
          <div className="clay-card p-3 mb-4 flex items-center gap-3 flex-wrap" style={{ background: '#f0f5ff', border: '1.5px solid #80aaee' }}>
            <span className="text-sm font-bold px-2" style={{ color: '#003087' }}>{selected.size} selected</span>
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
            <button onClick={() => setSelected(new Set())} className="text-xs hover:underline" style={{ color: '#7a8aaa' }}>Clear</button>
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
                      onChange={toggleAll} style={{ width: 16, height: 16, accentColor: '#003087' }} />
                  </th>
                  {['Scholar', 'Document', 'File', 'Period', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((s, i) => (
                  <tr key={s.id} className="clay-table-row">
                    <td className="px-4 py-3.5">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)}
                        style={{ width: 16, height: 16, accentColor: '#003087' }} />
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{s.scholarName}</p>
                      <p className="text-xs" style={{ color: '#7a8aaa' }}>{s.campusName ?? s.scholarEmail}</p>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{s.requirementName}</td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => downloadFile(s.id, s.fileName, token).catch(e => toast(e.message, 'error'))}
                        className="text-xs hover:underline truncate max-w-[180px] block text-left"
                        style={{ color: '#003087' }}
                      >
                        {s.fileName}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: 'var(--text)' }}>
                      {s.academicYear} · Sem {s.semester}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[s.status]}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setReviewing(s)}
                        className="text-xs font-medium hover:underline"
                        style={{ color: s.status === 'Pending' ? '#003087' : '#7a8aaa' }}
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
            onPageSizeChange={setPageSize}
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
    </Layout>
  );
}

const STATUS_DOT = { Pending: '#c07800', Verified: '#0a7a50', Incomplete: '#c03010' };

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
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,20,60,0.45)' }}>
      <div className="clay-card-modal w-full max-w-md p-7" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 className="text-base font-black mb-1" style={{ color: 'var(--text-strong)' }}>Review Document</h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text)' }}>
          {submission.scholarName} · {submission.requirementName}
        </p>

        <div className="mb-4">
          <button
            onClick={() => downloadFile(submission.id, submission.fileName, token).catch(e => toast(e.message, 'error'))}
            className="text-sm hover:underline"
            style={{ color: '#003087' }}
          >
            Download: {submission.fileName}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl text-sm font-medium"
            style={{ background: '#dce8ff', color: '#003087', border: '1.5px solid #80aaee' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>Decision</label>
            <div className="flex gap-3">
              {['Verified', 'Incomplete'].map(s => (
                <label key={s} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl border-2 cursor-pointer text-sm font-bold transition-colors ${
                  status === s
                    ? s === 'Verified' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-red-400 bg-red-50 text-red-700'
                    : 'border-transparent text-gray-500'
                }`} style={status !== s ? { background: 'rgba(0,0,0,0.04)', border: '2px solid rgba(0,0,0,0.08)' } : {}}>
                  <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
              Feedback {status === 'Incomplete' && <span style={{ color: '#e03030' }}>*</span>}
            </label>
            <textarea
              rows={3}
              required={status === 'Incomplete'}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder={status === 'Incomplete' ? 'Explain what needs to be corrected…' : 'Optional notes for the scholar'}
              className="clay-input"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm" style={{ opacity: submitting ? 0.65 : 1 }}>
              {submitting ? 'Saving…' : 'Submit Review'}
            </button>
          </div>
        </form>

        {history.length > 0 && (
          <div className="mt-6 pt-5" style={{ borderTop: '1.5px solid rgba(0,0,0,0.07)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#7a8aaa' }}>Status History</p>
            <ol className="space-y-3">
              {history.map((h, i) => (
                <li key={h.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full mt-0.5" style={{ background: STATUS_DOT[h.status] ?? '#7a8aaa' }} />
                    {i < history.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'rgba(0,0,0,0.1)', minHeight: 16 }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-strong)' }}>{h.status}</p>
                    {h.note && <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{h.note}</p>}
                    <p className="text-xs mt-0.5" style={{ color: '#9aaabb' }}>
                      {h.changedBy} · {new Date(h.changedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
