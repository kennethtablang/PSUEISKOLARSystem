import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { getScholarApprovals, approveScholar, rejectScholar } from '../api/scholarApprovals';
import Pagination from '../components/Pagination';
import { TableSkeleton, EmptyState } from '../components/ListState';
import Modal from '../components/Modal';
import { ErrorBox, Field } from './UsersPage';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';
import { ShieldCheck, ShieldX, AlertTriangle, MailCheck, MailWarning, Clock, UserCheck } from 'lucide-react';

const STATUS_STYLE = {
  Pending:  { bg: '#fff3cd', color: '#7d5a00', border: '#f5d060' },
  Approved: { bg: '#d4f4e2', color: '#166534', border: '#86efac' },
  Rejected: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

export default function ScholarApprovalsPage() {
  useTitle('Scholar Approvals');
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [paging, setPaging] = useState({ page: 1, totalPages: 1, total: 0 });
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState('Pending');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState(null);   // { scholar, approved }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await getScholarApprovals(token, {
        status: status || undefined,
        search: debouncedSearch || undefined,
        page,
        pageSize,
      });
      setItems(data.items);
      setPaging({ page: data.page, totalPages: data.totalPages, total: data.total });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, status, debouncedSearch, pageSize]);

  useEffect(() => { load(1); }, [load]);

  async function handleApproveDirect(scholar) {
    // Approving needs no reason, so skip the modal unless something looks off.
    if (scholar.warnings.length > 0) { setDeciding({ scholar, approved: true }); return; }
    try {
      await approveScholar(scholar.id, null, token);
      toast(`${scholar.fullName}'s registration is approved.`, 'success');
      load(paging.page);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const pendingOnly = status === 'Pending';

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Scholar Approvals</h1>
            <p className="page-subtitle">
              Verify scholars who registered themselves. Until approved they can sign in and
              complete their profile, but cannot submit documents.
            </p>
            <span className="page-title-bar" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <input
            type="search"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="clay-input"
            style={{ ...ctlStyle, width: 220 }}
          />
          <div className="flex gap-1.5">
            {['Pending', 'Approved', 'Rejected', ''].map(s => (
              <button
                key={s || 'all'}
                onClick={() => setStatus(s)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                style={status === s
                  ? { background: '#002570', color: '#fff' }
                  : { background: 'var(--surface-inset)', color: 'var(--text)' }}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: '#e03030' }}>{error}</p>}

        <div className="clay-card overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              title={pendingOnly ? 'No registrations waiting' : 'Nothing to show'}
              message={pendingOnly
                ? 'Every self-registered scholar has been verified.'
                : 'Try a different status filter or search term.'}
            />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Scholar', 'Student ID', 'Program', 'Scholarship', 'Registered', 'Checks', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(s => (
                  <tr key={s.id} className="clay-table-row">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{s.fullName}</p>
                      <p className="text-xs flex items-center gap-1" style={{ color: '#7a8aaa' }}>
                        {s.emailConfirmed
                          ? <MailCheck size={11} strokeWidth={2.4} style={{ color: '#166534' }} />
                          : <MailWarning size={11} strokeWidth={2.4} style={{ color: '#b45309' }} />}
                        {s.email}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-mono" style={{ color: 'var(--text)' }}>{s.studentId ?? '—'}</td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{s.programCode ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      {s.scholarshipTypeName ? (
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-strong)' }}>{s.scholarshipTypeName}</p>
                          {s.scholarshipTypeCategory && (
                            <p className="text-xs" style={{ color: '#7a8aaa' }}>{s.scholarshipTypeCategory}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs italic" style={{ color: '#b45309' }}>Not selected</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text)' }}>
                      {new Date(s.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5" style={{ maxWidth: 240 }}>
                      {s.warnings.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#166534' }}>
                          <ShieldCheck size={12} strokeWidth={2.4} /> All checks passed
                        </span>
                      ) : (
                        <ul className="space-y-0.5">
                          {s.warnings.map(w => (
                            <li key={w} className="flex items-start gap-1 text-xs" style={{ color: '#b45309' }}>
                              <AlertTriangle size={11} strokeWidth={2.4} className="mt-0.5 shrink-0" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={s.approvalStatus} />
                      {s.approvalDecidedAt && (
                        <p className="text-xs mt-1" style={{ color: '#9aaabb' }}>
                          {s.decidedBy ? `by ${s.decidedBy}` : ''}
                        </p>
                      )}
                      {s.approvalNote && (
                        <p className="text-xs mt-0.5 italic" style={{ color: '#7a8aaa' }}>“{s.approvalNote}”</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => navigate(`/scholars/${s.id}`)}
                          className="text-xs font-medium hover:underline"
                          style={{ color: '#003087' }}
                        >
                          View profile
                        </button>
                        {s.approvalStatus !== 'Approved' && (
                          <button
                            onClick={() => handleApproveDirect(s)}
                            className="text-xs font-bold hover:underline flex items-center gap-1"
                            style={{ color: '#166534' }}
                          >
                            <ShieldCheck size={12} strokeWidth={2.6} /> Approve
                          </button>
                        )}
                        {s.approvalStatus !== 'Rejected' && (
                          <button
                            onClick={() => setDeciding({ scholar: s, approved: false })}
                            className="text-xs font-bold hover:underline flex items-center gap-1"
                            style={{ color: '#e03030' }}
                          >
                            <ShieldX size={12} strokeWidth={2.6} /> Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        {!loading && paging.total > 0 && (
          <Pagination
            page={paging.page}
            totalPages={paging.totalPages}
            total={paging.total}
            pageSize={pageSize}
            onPageChange={load}
            onPageSizeChange={setPageSize}
            label="registrations"
          />
        )}
      </div>

      {deciding && (
        <DecisionModal
          scholar={deciding.scholar}
          approved={deciding.approved}
          token={token}
          onClose={() => setDeciding(null)}
          onDone={msg => { setDeciding(null); toast(msg, 'success'); load(paging.page); }}
        />
      )}
    </Layout>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.Pending;
  const Icon = status === 'Approved' ? ShieldCheck : status === 'Rejected' ? ShieldX : Clock;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      <Icon size={11} strokeWidth={2.6} />
      {status === 'Pending' ? 'Pending' : status}
    </span>
  );
}

function DecisionModal({ scholar, approved, token, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const noteRequired = !approved;
  const canSubmit = !noteRequired || note.trim().length >= 5;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (approved) {
        await approveScholar(scholar.id, note.trim() || null, token);
        onDone(`${scholar.fullName}'s registration is approved.`);
      } else {
        await rejectScholar(scholar.id, note.trim(), token);
        onDone(`${scholar.fullName}'s registration was rejected.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: approved ? 'rgba(22,101,52,0.10)' : 'rgba(224,48,48,0.10)' }}>
            {approved
              ? <UserCheck size={15} strokeWidth={2.4} style={{ color: '#166534' }} />
              : <ShieldX size={15} strokeWidth={2.4} style={{ color: '#e03030' }} />}
          </span>
          {approved ? 'Approve registration' : 'Reject registration'}
        </span>
      }
      subtitle={`${scholar.fullName} · ${scholar.email}`}
      onClose={onClose}
      width={460}
      dismissible={!submitting}
    >
      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="clay-card-inner p-3.5 mb-4 space-y-1.5">
        <Row label="Student ID" value={scholar.studentId ?? '—'} />
        <Row label="Program" value={scholar.programName ?? '—'} />
        <Row label="Scholarship" value={scholar.scholarshipTypeName ?? 'Not selected'} />
        <Row label="Email verified" value={scholar.emailConfirmed ? 'Yes' : 'No'} />
      </div>

      {scholar.warnings.length > 0 && (
        <div className="rounded-2xl p-3.5 mb-4"
          style={{ background: 'rgba(245,200,60,0.13)', border: '1.5px solid rgba(245,200,60,0.45)' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#b58600' }}>
            Please check first
          </p>
          <ul className="space-y-1">
            {scholar.warnings.map(w => (
              <li key={w} className="flex items-start gap-1.5 text-xs" style={{ color: '#8a6500' }}>
                <AlertTriangle size={11} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={noteRequired ? 'Reason (sent to the scholar)' : 'Note (optional)'}>
          <textarea
            rows={3}
            required={noteRequired}
            value={note}
            onChange={e => setNote(e.target.value)}
            className="clay-input"
            placeholder={noteRequired
              ? 'e.g. Student ID does not match our enrolment list — please visit the scholarship office.'
              : 'Anything the scholar should know…'}
          />
          {noteRequired && !canSubmit && note.length > 0 && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#dc2626' }}>
              Please give the scholar a usable reason (at least 5 characters).
            </p>
          )}
        </Field>

        <p className="text-xs" style={{ color: '#7a8aaa' }}>
          {approved
            ? 'The scholar is notified by email and in-app, and can start submitting documents right away.'
            : 'The scholar is notified with your reason. Their account stays active but document submission stays locked.'}
        </p>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className={`clay-btn flex-1 py-2.5 text-sm font-bold ${approved ? 'clay-btn-primary' : ''}`}
            style={approved
              ? { opacity: (submitting || !canSubmit) ? 0.6 : 1 }
              : { background: '#c02020', color: '#fff', opacity: (submitting || !canSubmit) ? 0.6 : 1,
                  boxShadow: '4px 4px 0 rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)' }}
          >
            {submitting ? 'Saving…' : approved ? 'Approve' : 'Reject'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span style={{ color: '#7a8aaa' }}>{label}</span>
      <span className="font-semibold text-right" style={{ color: 'var(--text-strong)' }}>{value}</span>
    </div>
  );
}
