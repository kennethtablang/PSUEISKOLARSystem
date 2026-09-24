import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import {
  getOneTimeGrants, createOneTimeGrant, updateOneTimeGrant,
  releaseOneTimeGrant, cancelOneTimeGrant, deleteOneTimeGrant,
} from '../api/oneTimeGrants';
import { getScholarshipTypes } from '../api/lookups';
import { getGrantTypes } from '../api/grantTypes';
import ScholarSearchSelect from '../components/ScholarSearchSelect';
import Pagination from '../components/Pagination';
import { TableSkeleton, EmptyState } from '../components/ListState';
import Modal from '../components/Modal';
import { ErrorBox, ModalButtons } from './UsersPage';
import Field from '../components/Field';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle, localDateInput } from '../constants/ui';
import { GRANT_RELEASE_STATUSES, peso } from '../constants/grants';
import { Plus, BanknoteArrowUp, Wallet, CircleCheckBig, Clock } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function OneTimeGrantsPage() {
  useTitle('One-Time Grants');
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [data, setData] = useState(null);
  const [scholarshipTypes, setScholarshipTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [grantTypes, setGrantTypes] = useState([]);
  const [grantTypeFilter, setGrantTypeFilter] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('');
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
    // The scholarship a grant is filed under — the scholar itself is searched on demand.
    getScholarshipTypes(token).then(setScholarshipTypes).catch(() => {});
    getGrantTypes(token).then(setGrantTypes).catch(() => {});
  }, [token]);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      setData(await getOneTimeGrants(token, {
        status: status || undefined,
        scholarshipTypeId: typeFilter || undefined,
        grantTypeId: grantTypeFilter || undefined,
        recipient: recipientFilter || undefined,
        search: debouncedSearch || undefined,
        page,
        pageSize,
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, status, typeFilter, grantTypeFilter, recipientFilter, debouncedSearch, pageSize]);

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
      toast('Grant deleted.', 'success');
      // Deleting the only row on a later page used to reload that page, which no longer
      // exists, and showed an empty list while grants remained on earlier pages.
      const page = data?.page ?? 1;
      load(items.length === 1 && page > 1 ? page - 1 : page);
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
          <select value={grantTypeFilter} onChange={e => setGrantTypeFilter(e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Grant type">
            <option value="">All grant types</option>
            {grantTypes.map(t => <option key={t.id} value={t.id}>{t.name}{t.isActive ? '' : ' (closed)'}</option>)}
          </select>
          <select value={recipientFilter} onChange={e => setRecipientFilter(e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Recipient">
            <option value="">Scholars &amp; grantees</option>
            <option value="scholar">Scholars</option>
            <option value="grantee">Grantees</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All scholarships</option>
            {scholarshipTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="clay-card overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : items.length === 0 ? (
            <EmptyState title="No one-time grants yet" message="Record a grant to start tracking one-off financial assistance." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Recipient', 'Grant', 'Scholarship', 'Amount', 'Awarded', 'Status', 'Reference', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(g => (
                  <tr key={g.id} className="clay-table-row">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{g.scholarName}</p>
                      <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                        <span className={`status-badge tone-${g.isGrantee ? 'warn' : 'info'}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                          {g.isGrantee ? 'Grantee' : 'Scholar'}
                        </span>
                        {!g.recipientActive && <span>· account closed</span>}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium" style={{ color: 'var(--text-strong)' }}>{g.grantTypeName ?? g.title}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {[g.source, g.purpose].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      {g.scholarshipTypeName ? (
                        <span className="clay-badge text-xs"
                          style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1px solid var(--accent-soft-border)' }}>
                          {g.scholarshipTypeName}
                        </span>
                      ) : (
                        <span className="text-xs italic" style={{ color: 'var(--text-faint)' }}>Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold" style={{ color: 'var(--text-strong)' }}>{peso(g.amount)}</td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text)' }}>
                      {new Date(g.awardedOn).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={g.releaseStatus} />
                      {g.releasedAt && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
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
                            <button onClick={() => setEditing(g)} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                              Edit
                            </button>
                            <button onClick={() => setCancelling(g)} className="text-xs font-medium hover:underline" style={{ color: '#b45309' }}>
                              Cancel
                            </button>
                          </>
                        )}
                        {g.releaseStatus !== 'Released' && (
                          <button onClick={() => handleDelete(g)} className="text-xs font-medium hover:underline" style={{ color: 'var(--danger)' }}>
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
          scholarshipTypes={scholarshipTypes}
          token={token}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            toast(editing ? 'Grant updated.' : 'Grant recorded.', 'success');
            setEditing(undefined);
            load(data?.page ?? 1);
          }}
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
            <p className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>
              Please give a reason of at least 5 characters — it is kept on the record.
            </p>
          )}
        </Field>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
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

export function GrantModal({ initial, scholarshipTypes = [], token, fixedScholar, onClose, onSaved }) {
  const [grantTypes, setGrantTypes] = useState([]);
  useEffect(() => {
    getGrantTypes(token).then(setGrantTypes).catch(() => {});
  }, [token]);

  const [form, setForm] = useState({
    grantTypeId: initial?.grantTypeId != null ? String(initial.grantTypeId) : '',
    scholarId: initial?.scholarId ?? fixedScholar?.userId ?? '',
    scholarshipTypeId: initial?.scholarshipTypeId != null
      ? String(initial.scholarshipTypeId)
      : (fixedScholar?.scholarshipTypeId != null ? String(fixedScholar.scholarshipTypeId) : ''),
    title:     initial?.title ?? '',
    purpose:   initial?.purpose ?? '',
    amount:    initial?.amount != null ? String(initial.amount) : '',
    source:    initial?.source ?? '',
    awardedOn: initial?.awardedOn ? initial.awardedOn.split('T')[0] : localDateInput(),
    notes:     initial?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const chosenType = scholarshipTypes.find(t => String(t.id) === form.scholarshipTypeId);

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
        grantTypeId: form.grantTypeId ? parseInt(form.grantTypeId, 10) : null,
        scholarshipTypeId: form.scholarshipTypeId ? parseInt(form.scholarshipTypeId, 10) : null,
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
          <Field label="Scholar or grantee">
            <ScholarSearchSelect
              token={token}
              includeGrantees
              value={form.scholarId}
              initialLabel={initial?.scholarName ?? ''}
              disabled={!!initial}
              onChange={(id, scholar) => {
                set('scholarId', id);
                // Default the grant to the scholarship the scholar already holds — the right
                // answer nearly every time, and still editable below.
                if (scholar && !form.scholarshipTypeId) {
                  const match = scholarshipTypes.find(t => t.name === scholar.scholarshipType);
                  if (match) set('scholarshipTypeId', String(match.id));
                }
              }}
            />
            {initial && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                The recipient cannot be changed. Delete the grant and record a new one instead.
              </p>
            )}
          </Field>
        )}

        <Field label="Grant type">
          <select
            value={form.grantTypeId}
            onChange={e => {
              const t = grantTypes.find(x => String(x.id) === e.target.value);
              setForm(f => ({
                ...f,
                grantTypeId: e.target.value,
                // Pre-fill from the type; the office can still adjust each field.
                title: t ? t.name : f.title,
                source: t?.sponsor ?? f.source,
                amount: t?.defaultAmount != null && !f.amount ? String(t.defaultAmount) : f.amount,
              }));
            }}
            className="clay-input"
          >
            <option value="">— Other / not a listed grant type —</option>
            {grantTypes.filter(t => t.isActive || String(t.id) === form.grantTypeId).map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.sponsor ? ` · ${t.sponsor}` : ''}</option>
            ))}
          </select>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage grant types on the Grant Types page. Deactivating a type after its release closes the grantee accounts under it.
          </p>
        </Field>

        <Field label="Kind of scholarship">
          <select
            value={form.scholarshipTypeId}
            onChange={e => set('scholarshipTypeId', e.target.value)}
            className="clay-input"
          >
            <option value="">— Not tied to a scholarship —</option>
            {scholarshipTypes.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}{t.category ? ` · ${t.category}` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {chosenType
              ? `Filed under ${chosenType.name} — it counts toward that scholarship's totals.`
              : 'A grant is still scholarship money, so file it under the scholarship it belongs to. Leave blank only for a one-off award from an outside sponsor.'}
          </p>
        </Field>

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
            {amountError && <p className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>{amountError}</p>}
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

export function ReleaseModal({ grant, token, onClose, onSaved }) {
  const [referenceNo, setReferenceNo] = useState('');
  const [releasedAt, setReleasedAt] = useState(localDateInput);
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
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Releasing is final — a released grant becomes part of the disbursement record and can no
          longer be edited or deleted. The scholar is notified.
        </p>
        <ModalButtons onClose={onClose} submitting={submitting} label="Mark as released" />
      </form>
    </Modal>
  );
}
