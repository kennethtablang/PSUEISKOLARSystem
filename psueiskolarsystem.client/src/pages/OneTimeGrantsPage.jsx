import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import {
  getOneTimeGrants, createOneTimeGrant, updateOneTimeGrant,
  releaseOneTimeGrant, cancelOneTimeGrant, deleteOneTimeGrant,
} from '../api/oneTimeGrants';
import { getScholars } from '../api/scholars';
import Pagination from '../components/Pagination';
import { TableSkeleton, EmptyState } from '../components/ListState';
import Modal from '../components/Modal';
import { ErrorBox, Field, ModalButtons } from './UsersPage';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';
import { GRANT_RELEASE_STATUSES, GRANT_STATUS_COLORS, peso } from '../constants/grants';
import { Plus, BanknoteArrowUp, Wallet, CircleCheckBig, Clock, Ban } from 'lucide-react';

const STATUS_ICON = { Pending: Clock, Released: CircleCheckBig, Cancelled: Ban };

export function GrantStatusBadge({ status }) {
  const s = GRANT_STATUS_COLORS[status] ?? GRANT_STATUS_COLORS.Pending;
  const Icon = STATUS_ICON[status] ?? Clock;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      <Icon size={11} strokeWidth={2.6} />
      {status}
    </span>
  );
}

export default function OneTimeGrantsPage() {
  useTitle('One-Time Grants');
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [data, setData] = useState(null);
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState(undefined);   // undefined = closed, null = new
  const [releasing, setReleasing] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    // Scholar picker options — capped, searchable inside the modal.
    getScholars(token, { pageSize: 100 })
      .then(r => setScholars(r.items ?? []))
      .catch(() => {});
  }, [token]);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      setData(await getOneTimeGrants(token, {
        status: status || undefined,
        search: debouncedSearch || undefined,
        page,
        pageSize,
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, status, debouncedSearch, pageSize]);

  useEffect(() => { load(1); }, [load]);

  async function handleDelete(grant) {
    if (!(await confirm({
      title: 'Delete grant',
      message: `Delete “${grant.title}” for ${grant.scholarName}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    }))) return;
    try {
      await deleteOneTimeGrant(grant.id, token);
      load(data?.page ?? 1);
    } catch (e) { toast(e.message, 'error'); }
  }

  const items = data?.items ?? [];

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">One-Time Grants</h1>
            <p className="page-subtitle">
              One-off financial awards recorded against a scholar, on top of their scholarship.
              Track each from award to release.
            </p>
            <span className="page-title-bar" />
          </div>
          <button onClick={() => setEditing(null)} className="clay-btn clay-btn-primary px-4 py-2.5 text-sm flex items-center gap-1.5">
            <Plus size={15} strokeWidth={2.6} /> Record Grant
          </button>
        </div>

        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <Tile label="Total awarded" value={peso(data.totalAmount)} sub={`${data.total} grant${data.total !== 1 ? 's' : ''}`} Icon={Wallet} bg="#dce8ff" iconColor="#003087" />
            <Tile label="Released" value={peso(data.releasedAmount)} Icon={CircleCheckBig} bg="#d4f5e2" iconColor="#108050" />
            <Tile label="Awaiting release" value={peso(data.pendingAmount)} Icon={Clock} bg="#fff3cd" iconColor="#c07800" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <input
            type="search"
            placeholder="Search grant, source or scholar…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="clay-input"
            style={{ ...ctlStyle, width: 250 }}
          />
          <select value={status} onChange={e => setStatus(e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All statuses</option>
            {GRANT_RELEASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: '#e03030' }}>{error}</p>}

        <div className="clay-card overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : items.length === 0 ? (
            <EmptyState title="No one-time grants yet" message="Record a grant to start tracking one-off financial assistance." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Scholar', 'Grant', 'Amount', 'Awarded', 'Status', 'Reference', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(g => (
                  <tr key={g.id} className="clay-table-row">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{g.scholarName}</p>
                      <p className="text-xs" style={{ color: '#7a8aaa' }}>{g.scholarEmail}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium" style={{ color: 'var(--text-strong)' }}>{g.title}</p>
                      <p className="text-xs" style={{ color: '#7a8aaa' }}>
                        {[g.source, g.purpose].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold" style={{ color: 'var(--text-strong)' }}>{peso(g.amount)}</td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text)' }}>
                      {new Date(g.awardedOn).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5">
                      <GrantStatusBadge status={g.releaseStatus} />
                      {g.releasedAt && (
                        <p className="text-xs mt-1" style={{ color: '#9aaabb' }}>
                          {new Date(g.releasedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs" style={{ color: 'var(--text)' }}>{g.referenceNo ?? '—'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center gap-3 justify-end">
                        {g.releaseStatus === 'Pending' && (
                          <>
                            <button onClick={() => setReleasing(g)} className="text-xs font-bold hover:underline flex items-center gap-1" style={{ color: '#166534' }}>
                              <BanknoteArrowUp size={12} strokeWidth={2.6} /> Release
                            </button>
                            <button onClick={() => setEditing(g)} className="text-xs font-medium hover:underline" style={{ color: '#003087' }}>
                              Edit
                            </button>
                            <button onClick={() => setCancelling(g)} className="text-xs font-medium hover:underline" style={{ color: '#b45309' }}>
                              Cancel
                            </button>
                          </>
                        )}
                        {g.releaseStatus !== 'Released' && (
                          <button onClick={() => handleDelete(g)} className="text-xs font-medium hover:underline" style={{ color: '#e03030' }}>
                            Delete
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

        {!loading && data && data.total > 0 && (
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={pageSize}
            onPageChange={load}
            onPageSizeChange={setPageSize}
            label="grants"
          />
        )}
      </div>

      {editing !== undefined && (
        <GrantModal
          initial={editing}
          scholars={scholars}
          token={token}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load(data?.page ?? 1); }}
        />
      )}

      {releasing && (
        <ReleaseModal
          grant={releasing}
          token={token}
          onClose={() => setReleasing(null)}
          onSaved={() => { setReleasing(null); toast('Grant released — the scholar has been notified.', 'success'); load(data?.page ?? 1); }}
        />
      )}

      {cancelling && (
        <CancelModal
          grant={cancelling}
          token={token}
          onClose={() => setCancelling(null)}
          onSaved={() => { setCancelling(null); toast('Grant cancelled.', 'success'); load(data?.page ?? 1); }}
        />
      )}
    </Layout>
  );
}

function CancelModal({ grant, token, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = reason.trim().length >= 5;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await cancelOneTimeGrant(grant.id, reason.trim(), token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Cancel grant"
      subtitle={`${grant.title} · ${peso(grant.amount)} · ${grant.scholarName}`}
      onClose={onClose}
      width={440}
      dismissible={!submitting}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Reason for cancelling">
          <textarea
            rows={3}
            required
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="clay-input"
            placeholder="e.g. Scholar withdrew from the programme."
          />
          {reason.length > 0 && !canSubmit && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#dc2626' }}>
              Please give a reason of at least 5 characters — it is kept on the record.
            </p>
          )}
        </Field>
        <p className="text-xs" style={{ color: '#7a8aaa' }}>
          The grant is kept for auditing with your reason appended to its notes.
        </p>
        <ModalButtons onClose={onClose} submitting={submitting} disabled={!canSubmit} label="Cancel grant" />
      </form>
    </Modal>
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

export function GrantModal({ initial, scholars, token, fixedScholar, onClose, onSaved }) {
  const [form, setForm] = useState({
    scholarId: initial?.scholarId ?? fixedScholar?.userId ?? '',
    title:     initial?.title ?? '',
    purpose:   initial?.purpose ?? '',
    amount:    initial?.amount != null ? String(initial.amount) : '',
    source:    initial?.source ?? '',
    awardedOn: (initial?.awardedOn ?? new Date().toISOString()).split('T')[0],
    notes:     initial?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const amountVal = parseFloat(form.amount);
  const amountError = form.amount !== '' && (isNaN(amountVal) || amountVal <= 0)
    ? 'Amount must be greater than zero.'
    : amountVal > 10000000 ? 'Amount looks too large — please check the figure.' : '';

  const canSubmit = form.scholarId && form.title.trim() && form.amount !== '' && !amountError && form.awardedOn;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        scholarId: form.scholarId,
        title:     form.title.trim(),
        purpose:   form.purpose.trim() || null,
        amount:    amountVal,
        source:    form.source.trim() || null,
        awardedOn: new Date(form.awardedOn).toISOString(),
        notes:     form.notes.trim() || null,
      };
      if (initial) await updateOneTimeGrant(initial.id, payload, token);
      else await createOneTimeGrant(payload, token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={initial ? `Edit grant: ${initial.title}` : 'Record a one-time grant'}
      subtitle={fixedScholar
        ? `For ${fixedScholar.fullName}`
        : 'A one-off award on top of the scholar’s ongoing scholarship.'}
      onClose={onClose}
      width={520}
      dismissible={!submitting}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {!fixedScholar && (
          <Field label="Scholar">
            <select
              required
              value={form.scholarId}
              onChange={e => set('scholarId', e.target.value)}
              className="clay-input"
              disabled={!!initial}
            >
              <option value="">— Select a scholar —</option>
              {scholars.map(s => (
                <option key={s.userId} value={s.userId}>
                  {s.fullName} · {s.studentId}
                </option>
              ))}
            </select>
            {initial && (
              <p className="text-xs mt-1" style={{ color: '#7a8aaa' }}>
                The recipient cannot be changed. Delete the grant and record a new one instead.
              </p>
            )}
          </Field>
        )}

        <Field label="Grant title">
          <input
            required
            value={form.title}
            onChange={e => set('title', e.target.value)}
            className="clay-input"
            placeholder="e.g. Tulong Dunong Assistance"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount (PHP)">
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className="clay-input"
              placeholder="5000.00"
            />
            {amountError && <p className="text-xs mt-1 font-medium" style={{ color: '#dc2626' }}>{amountError}</p>}
          </Field>
          <Field label="Date awarded">
            <input
              required
              type="date"
              value={form.awardedOn}
              onChange={e => set('awardedOn', e.target.value)}
              className="clay-input"
            />
          </Field>
        </div>

        <Field label="Funding source (optional)">
          <input
            value={form.source}
            onChange={e => set('source', e.target.value)}
            className="clay-input"
            placeholder="e.g. CHED, PSU Alumni Association, LGU Lingayen"
          />
        </Field>

        <Field label="Purpose (optional)">
          <input
            value={form.purpose}
            onChange={e => set('purpose', e.target.value)}
            className="clay-input"
            placeholder="e.g. Book and supplies allowance"
          />
        </Field>

        <Field label="Internal notes (optional)">
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            className="clay-input"
            placeholder="Not shown to the scholar."
          />
        </Field>

        <ModalButtons
          onClose={onClose}
          submitting={submitting}
          disabled={!canSubmit}
          label={initial ? 'Save changes' : 'Record grant'}
        />
      </form>
    </Modal>
  );
}

function ReleaseModal({ grant, token, onClose, onSaved }) {
  const [referenceNo, setReferenceNo] = useState('');
  const [releasedAt, setReleasedAt] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await releaseOneTimeGrant(grant.id, {
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
      title="Release grant"
      subtitle={`${grant.title} · ${peso(grant.amount)} · ${grant.scholarName}`}
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
        <p className="text-xs" style={{ color: '#7a8aaa' }}>
          Releasing is final — a released grant becomes part of the disbursement record and can no
          longer be edited or deleted. The scholar is notified.
        </p>
        <ModalButtons onClose={onClose} submitting={submitting} label="Mark as released" />
      </form>
    </Modal>
  );
}
