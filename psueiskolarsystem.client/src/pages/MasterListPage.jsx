import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Field from '../components/Field';
import Pagination from '../components/Pagination';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { UpperInput, NumericInput } from '../components/PersonalDetailsFields';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';
import {
  getMasterList, createMasterListLine, updateMasterListLine, deleteMasterListLine,
  downloadMasterListTemplate, importMasterList,
} from '../api/masterList';
import { getCampuses } from '../api/campuses';
import { getScholarshipTypes } from '../api/lookups';
import { getGrantTypes } from '../api/grantTypes';
import { ListChecks, Plus, Upload, Download, Pencil, Trash2, CheckCircle2, Clock } from 'lucide-react';

const EMPTY_LINE = {
  kind: 'Scholar', studentId: '', lastName: '', firstName: '', middleName: '',
  campusId: '', scholarshipTypeId: '', grantTypeId: '', grantAmount: '', notes: '',
};

/**
 * The office's list of who may create an account. Sign-up is cross-matched against it, so a
 * student on this list gets an account instantly and one who is not cannot get one at all.
 * The line's kind decides whether the account is a scholar or a grantee.
 */
export default function MasterListPage() {
  useTitle('Master List');
  const { token, user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = useState([]);
  const [paging, setPaging] = useState({ page: 1, totalPages: 1, total: 0, claimed: 0, unclaimed: 0 });
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ kind: '', status: '', campusId: '', search: '' });

  const [campuses, setCampuses] = useState([]);
  const [types, setTypes] = useState([]);
  const [grantTypes, setGrantTypes] = useState([]);

  const [editing, setEditing] = useState(null); // { id?, ...line }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const seq = useRef(0);
  const searchTimer = useRef(null);

  async function load(f = filters, page = 1, size = pageSize) {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const data = await getMasterList(token, { ...f, page, pageSize: size });
      if (mine !== seq.current) return;
      setRows(data.items);
      setPaging({ page: data.page, totalPages: data.totalPages, total: data.total, claimed: data.claimed, unclaimed: data.unclaimed });
    } catch (e) {
      if (mine === seq.current) toast(e.message, 'error');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([getCampuses(token), getScholarshipTypes(token), getGrantTypes(token)])
      .then(([c, t, g]) => { setCampuses(c); setTypes(t); setGrantTypes(g); })
      .catch(e => toast(e.message, 'error'));
    load();
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setFilter(key, value) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    clearTimeout(searchTimer.current);
    if (key === 'search') searchTimer.current = setTimeout(() => load(next, 1), 350);
    else load(next, 1);
  }

  function openNew() {
    setFormError('');
    setEditing({ ...EMPTY_LINE, kind: filters.kind || 'Scholar' });
  }

  function openEdit(r) {
    setFormError('');
    setEditing({
      id: r.id, kind: r.kind, studentId: r.studentId, lastName: r.lastName, firstName: r.firstName,
      middleName: r.middleName ?? '', campusId: r.campusId ?? '', scholarshipTypeId: r.scholarshipTypeId ?? '',
      grantTypeId: r.grantTypeId ?? '', grantAmount: r.grantAmount ?? '', notes: r.notes ?? '',
    });
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    const e2 = editing;
    const body = {
      kind: e2.kind,
      studentId: e2.studentId.trim(),
      lastName: e2.lastName.trim(),
      firstName: e2.firstName.trim(),
      middleName: e2.middleName.trim() || null,
      campusId: e2.campusId ? Number(e2.campusId) : null,
      scholarshipTypeId: e2.kind === 'Scholar' && e2.scholarshipTypeId ? Number(e2.scholarshipTypeId) : null,
      grantTypeId: e2.kind === 'Grantee' && e2.grantTypeId ? Number(e2.grantTypeId) : null,
      grantAmount: e2.kind === 'Grantee' && e2.grantAmount !== '' ? Number(e2.grantAmount) : null,
      notes: e2.notes.trim() || null,
    };
    setSaving(true);
    try {
      if (e2.id) {
        const res = await updateMasterListLine(e2.id, body, token);
        toast(res?.applied ? `Line updated — ${res.applied}.` : 'Line updated.', 'success');
      } else {
        const res = await createMasterListLine(body, token);
        toast(res?.applied ? `Added — ${res.applied}.` : 'Added to the master list.', 'success');
      }
      setEditing(null);
      load(filters, paging.page);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(r) {
    const ok = await confirm({
      title: 'Remove from master list?',
      message: r.claimedByUserId
        ? `${r.lastName}, ${r.firstName} already has an account. Removing the line keeps the account; it only stops the line from being matched again.`
        : `${r.lastName}, ${r.firstName} will no longer be able to create an account.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMasterListLine(r.id, token);
      toast('Removed from the master list.', 'success');
      load(filters, paging.page);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const res = await importMasterList(file, token);
      setImportResult(res);
      load(filters, 1);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  }

  const activeGrantTypes = grantTypes.filter(g => g.isActive);
  const isAdminOrCoord = user?.role === 'Administrator' || user?.role === 'ScholarshipCoordinator';

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Master List</h1>
            <p className="page-subtitle">
              Scholars and grantees allowed to create an account. Sign-ups are cross-matched against this list —
              a match is accepted automatically, anyone else is turned away.
            </p>
            <span className="page-title-bar" />
          </div>
          {isAdminOrCoord && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => downloadMasterListTemplate(token).catch(err => toast(err.message, 'error'))}
                className="clay-btn clay-btn-ghost text-sm px-4 flex items-center gap-2">
                <Download size={15} /> Template
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={importing}
                className="clay-btn clay-btn-ghost text-sm px-4 flex items-center gap-2">
                <Upload size={15} /> {importing ? 'Importing…' : 'Import'}
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={onFile} />
              <button onClick={openNew} className="clay-btn clay-btn-primary text-sm px-4 flex items-center gap-2">
                <Plus size={15} /> Add Line
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'On the list', value: paging.total, Icon: ListChecks, tone: 'var(--accent-strong)' },
            { label: 'Account created', value: paging.claimed, Icon: CheckCircle2, tone: 'var(--tone-ok-fg)' },
            { label: 'Not yet signed up', value: paging.unclaimed, Icon: Clock, tone: 'var(--tone-warn-fg)' },
          ].map(k => (
            <div key={k.label} className="clay-card p-4 flex items-center gap-3">
              <k.Icon size={20} style={{ color: k.tone }} />
              <div>
                <p className="text-xl font-black" style={{ color: 'var(--text-strong)' }}>{k.value}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <input type="search" placeholder="Search name or student no.…" value={filters.search}
            onChange={e => setFilter('search', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 230 }} />
          <select value={filters.kind} onChange={e => setFilter('kind', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Kind">
            <option value="">Scholars &amp; Grantees</option>
            <option value="Scholar">Scholars</option>
            <option value="Grantee">Grantees</option>
          </select>
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Status">
            <option value="">Any status</option>
            <option value="claimed">Account created</option>
            <option value="unclaimed">Not yet signed up</option>
          </select>
          <select value={filters.campusId} onChange={e => setFilter('campusId', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Campus">
            <option value="">All Campuses</option>
            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="clay-card overflow-hidden">
          {loading ? <TableSkeleton /> : rows.length === 0 ? (
            <EmptyState icon={ListChecks} title="No lines yet"
              message="Add scholars and grantees one at a time, or import them from the Excel template." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Student No.', 'Name', 'Kind', 'Scholarship / Grant', 'Campus', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="clay-table-row">
                    <td className="px-5 py-3 font-mono" style={{ color: 'var(--text)' }}>{r.studentId}</td>
                    <td className="px-5 py-3 font-semibold" style={{ color: 'var(--text-strong)' }}>
                      {r.lastName}, {r.firstName}{r.middleName ? ` ${r.middleName}` : ''}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`status-badge tone-${r.kind === 'Scholar' ? 'info' : 'warn'}`}>{r.kind}</span>
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text)' }}>
                      {r.kind === 'Scholar' ? r.scholarshipTypeName : (
                        <>
                          {r.grantTypeName}
                          {r.grantAmount != null && <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>· ₱{Number(r.grantAmount).toLocaleString()}</span>}
                        </>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text)' }}>{r.campusName ?? 'Any campus'}</td>
                    <td className="px-5 py-3">
                      {r.claimedByUserId ? (
                        <span className="status-badge tone-ok" title={r.claimedByEmail ?? ''}>Account created</span>
                      ) : (
                        <span className="status-badge tone-neutral">Not yet signed up</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {!r.claimedByUserId && (
                        <button onClick={() => openEdit(r)} className="p-2 rounded-lg" title="Edit" aria-label="Edit line">
                          <Pencil size={14} style={{ color: 'var(--accent)' }} />
                        </button>
                      )}
                      <button onClick={() => remove(r)} className="p-2 rounded-lg" title="Remove" aria-label="Remove line">
                        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        {!loading && paging.total > 0 && (
          <Pagination page={paging.page} totalPages={paging.totalPages} total={paging.total} pageSize={pageSize}
            onPageChange={p => load(filters, p)} onPageSizeChange={n => { setPageSize(n); load(filters, 1, n); }} label="lines" />
        )}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit Master List Line' : 'Add to Master List'} onClose={() => setEditing(null)} dismissible={!saving} width={560}>
          <form onSubmit={save} className="space-y-4">
            {formError && <p role="alert" className="text-sm p-3 rounded-2xl" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{formError}</p>}
            <div className="flex gap-2">
              {['Scholar', 'Grantee'].map(k => (
                <button key={k} type="button" onClick={() => setEditing(v => ({ ...v, kind: k }))}
                  className={`clay-btn text-sm flex-1 ${editing.kind === k ? 'clay-btn-primary' : 'clay-btn-ghost'}`}>
                  {k}
                </button>
              ))}
            </div>
            <Field label="Student No.">
              <input required maxLength={30} value={editing.studentId} className="clay-input"
                onChange={e => setEditing(v => ({ ...v, studentId: e.target.value.toUpperCase() }))} placeholder="23-LN-0001" />
            </Field>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Last Name"><UpperInput required maxLength={100} value={editing.lastName} onChange={x => setEditing(v => ({ ...v, lastName: x }))} /></Field>
              <Field label="First Name"><UpperInput required maxLength={100} value={editing.firstName} onChange={x => setEditing(v => ({ ...v, firstName: x }))} /></Field>
              <Field label="Middle Name"><UpperInput maxLength={100} value={editing.middleName} onChange={x => setEditing(v => ({ ...v, middleName: x }))} /></Field>
            </div>
            <Field label="Campus" hint="Leave as Any campus to match regardless of the campus the student picks.">
              <select value={editing.campusId} onChange={e => setEditing(v => ({ ...v, campusId: e.target.value }))} className="clay-input">
                <option value="">Any campus</option>
                {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            {editing.kind === 'Scholar' ? (
              <Field label="Scholarship Type">
                <select required value={editing.scholarshipTypeId} onChange={e => setEditing(v => ({ ...v, scholarshipTypeId: e.target.value }))} className="clay-input">
                  <option value="">— Select —</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Grant Type">
                  <select required value={editing.grantTypeId} onChange={e => {
                    const g = grantTypes.find(x => String(x.id) === e.target.value);
                    setEditing(v => ({ ...v, grantTypeId: e.target.value, grantAmount: v.grantAmount || (g?.defaultAmount ?? '') }));
                  }} className="clay-input">
                    <option value="">— Select —</option>
                    {activeGrantTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
                <Field label="Grant Amount">
                  <NumericInput prefix="₱" allowDecimal maxLength={10} value={String(editing.grantAmount ?? '')}
                    onChange={x => setEditing(v => ({ ...v, grantAmount: x }))} placeholder="Type default" />
                </Field>
              </div>
            )}
            <Field label="Notes">
              <input maxLength={300} value={editing.notes} onChange={e => setEditing(v => ({ ...v, notes: e.target.value }))} className="clay-input" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} disabled={saving} className="clay-btn clay-btn-ghost text-sm px-4">Cancel</button>
              <button type="submit" disabled={saving} className="clay-btn clay-btn-primary text-sm px-5">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {importResult && (
        <Modal title="Import finished" subtitle={`${importResult.created} added · ${importResult.failed} skipped`}
          onClose={() => setImportResult(null)} width={620}>
          <div className="max-h-[50vh] overflow-y-auto space-y-1">
            {importResult.results.map(r => (
              <p key={r.row} className="text-xs flex gap-2" style={{ color: r.success ? 'var(--tone-ok-fg)' : 'var(--danger)' }}>
                <span className="font-mono shrink-0">Row {r.row}</span>
                <span className="font-mono shrink-0">{r.studentId}</span>
                <span>{r.message}</span>
              </p>
            ))}
          </div>
        </Modal>
      )}
    </Layout>
  );
}
