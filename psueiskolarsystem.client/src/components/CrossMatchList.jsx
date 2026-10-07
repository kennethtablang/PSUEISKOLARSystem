import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Field from './Field';
import Pagination from './Pagination';
import { TableSkeleton, EmptyState } from './ListState';
import { NameInput, NumericInput, ChoiceChecks } from './PersonalDetailsFields';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { ctlStyle } from '../constants/ui';
import { SEX_OPTIONS } from '../constants/personal';
import {
  getMasterList, createMasterListLine, updateMasterListLine, deleteMasterListLine,
  downloadMasterListTemplate, importMasterList,
} from '../api/masterList';
import { ListChecks, Plus, Upload, Download, Pencil, Trash2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

/**
 * The cross-matching list of one scholarship type or one grant type: the students the office
 * has listed for it. A sign-up whose student number and name (and campus, when set) match a
 * line here gets an account under this type at once. It lives inside its type, so what the
 * office set for a type is always seen — and changed — in that type.
 *
 * `scope` is `{ kind: 'Scholar', scholarshipTypeId, typeName }` or
 * `{ kind: 'Grantee', grantTypeId, typeName, defaultAmount, isActive }`.
 */
export default function CrossMatchList({ scope, campuses, canEdit = true }) {
  const { token, user } = useAuth();
  // A coordinator works within one campus, so they have no campus to pick.
  const isAdmin = user?.role === 'Administrator';
  const toast = useToast();
  const confirm = useConfirm();
  const isScholar = scope.kind === 'Scholar';
  const typeFilter = isScholar ? { scholarshipTypeId: scope.scholarshipTypeId } : { grantTypeId: scope.grantTypeId };

  const [rows, setRows] = useState([]);
  const [paging, setPaging] = useState({ page: 1, totalPages: 1, total: 0, claimed: 0, unclaimed: 0 });
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', campusId: '', search: '' });
  const [editing, setEditing] = useState(null);
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
      const data = await getMasterList(token, { ...f, ...typeFilter, kind: scope.kind, page, pageSize: size });
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
    load();
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.scholarshipTypeId, scope.grantTypeId]);

  function setFilter(key, value) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    clearTimeout(searchTimer.current);
    if (key === 'search') searchTimer.current = setTimeout(() => load(next, 1), 350);
    else load(next, 1);
  }

  function openNew() {
    setFormError('');
    setEditing({
      studentId: '', lastName: '', firstName: '', middleName: '', sex: '', campusId: '', notes: '',
      grantAmount: !isScholar && scope.defaultAmount != null ? String(scope.defaultAmount) : '',
    });
  }

  function openEdit(r) {
    setFormError('');
    setEditing({
      id: r.id, studentId: r.studentId, lastName: r.lastName, firstName: r.firstName,
      middleName: r.middleName ?? '', sex: r.sex ?? '', campusId: r.campusId ?? '',
      grantAmount: r.grantAmount ?? '', notes: r.notes ?? '',
    });
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    const v = editing;
    const body = {
      kind: scope.kind,
      studentId: v.studentId.trim(),
      lastName: v.lastName.trim(),
      firstName: v.firstName.trim(),
      middleName: v.middleName.trim() || null,
      sex: v.sex || null,
      campusId: v.campusId ? Number(v.campusId) : null,
      scholarshipTypeId: isScholar ? scope.scholarshipTypeId : null,
      grantTypeId: isScholar ? null : scope.grantTypeId,
      grantAmount: !isScholar && v.grantAmount !== '' ? Number(v.grantAmount) : null,
      notes: v.notes.trim() || null,
    };
    setSaving(true);
    try {
      const res = v.id ? await updateMasterListLine(v.id, body, token) : await createMasterListLine(body, token);
      if (res?.conflict)
        toast(`${res.conflict.scholarName} already holds ${res.conflict.currentScholarship} — the office has been notified to review it.`, 'error');
      else
        toast(res?.applied ? `Saved — ${res.applied}.` : v.id ? 'Line updated.' : `Added to the ${scope.typeName} list.`, 'success');
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
      title: 'Remove from the list?',
      message: r.claimedByUserId
        ? `${r.lastName}, ${r.firstName} already has an account. Removing the line keeps the account; it only stops the line from being matched again.`
        : `${r.lastName}, ${r.firstName} will no longer be able to create an account under ${scope.typeName}.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMasterListLine(r.id, token);
      toast('Removed from the list.', 'success');
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
      const res = await importMasterList(file, token, typeFilter);
      setImportResult(res);
      load(filters, 1);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  }

  const closedGrant = !isScholar && scope.isActive === false;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <p className="text-xs leading-relaxed max-w-2xl" style={{ color: 'var(--text-muted)' }}>
          These are the students the office has listed for <strong>{scope.typeName}</strong>. A student signs up with
          their student number and name; when those match a line here (and the campus, if one is set) the account is
          created as a {isScholar ? 'scholar under this scholarship' : 'grantee of this grant'} straight away.
          {isScholar && ' If someone who already holds another scholarship matches this list, the office is notified.'}
        </p>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {/* The file type is in the label so nobody has to ask what the template is. */}
            <button onClick={() => downloadMasterListTemplate(token, typeFilter).catch(err => toast(err.message, 'error'))}
              title="Download an Excel workbook (.xlsx) with the columns to fill in"
              className="clay-btn clay-btn-ghost text-sm px-3 flex items-center gap-2">
              <Download size={14} /> List Template <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>(.xlsx)</span>
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={importing || closedGrant}
              title="Upload the filled-in list — Excel (.xlsx) or CSV (.csv)"
              className="clay-btn clay-btn-ghost text-sm px-3 flex items-center gap-2">
              <Upload size={14} /> {importing ? 'Importing…' : <>Import List <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>(.xlsx / .csv)</span></>}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={onFile} />
            <button onClick={openNew} disabled={closedGrant} title={closedGrant ? 'Reactivate the grant type to add grantees.' : undefined}
              className="clay-btn clay-btn-primary text-sm px-4 flex items-center gap-2" style={{ opacity: closedGrant ? 0.6 : 1 }}>
              <Plus size={14} /> Add Student
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'On the list', value: paging.total, Icon: ListChecks, tone: 'var(--accent-strong)' },
          { label: 'Account created', value: paging.claimed, Icon: CheckCircle2, tone: 'var(--tone-ok-fg)' },
          { label: 'Not yet signed up', value: paging.unclaimed, Icon: Clock, tone: 'var(--tone-warn-fg)' },
        ].map(k => (
          <div key={k.label} className="clay-card-inner p-3 flex items-center gap-3 rounded-2xl" style={{ background: 'var(--surface-inset)' }}>
            <k.Icon size={18} style={{ color: k.tone }} />
            <div>
              <p className="text-lg font-black" style={{ color: 'var(--text-strong)' }}>{k.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input type="search" placeholder="Search name or student no.…" value={filters.search}
          onChange={e => setFilter('search', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 230 }} />
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Status">
          <option value="">Any status</option>
          <option value="claimed">Account created</option>
          <option value="unclaimed">Not yet signed up</option>
        </select>
        {isAdmin && (
          <select value={filters.campusId} onChange={e => setFilter('campusId', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Campus">
            <option value="">All Campuses</option>
            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid var(--hairline)' }}>
        {loading ? <TableSkeleton /> : rows.length === 0 ? (
          <EmptyState icon={ListChecks} title="Nobody listed yet"
            message={`Add the students of ${scope.typeName} one at a time, or import them from the Excel template.`} />
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
            <thead className="clay-table-head">
              <tr>
                {['Student No.', 'Name', 'Sex', ...(isScholar ? [] : ['Amount']), 'Campus (matched)', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="clay-table-row">
                  <td className="px-4 py-3 font-mono" style={{ color: 'var(--text)' }}>{r.studentId}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-strong)' }}>
                    {r.lastName}, {r.firstName}{r.middleName ? ` ${r.middleName}` : ''}
                    {r.notes && <span className="block text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>{r.notes}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>{r.sex ?? '—'}</td>
                  {!isScholar && (
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>
                      {r.grantAmount != null ? `₱${Number(r.grantAmount).toLocaleString('en-PH')}` : 'Type default'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>{r.campusName ?? 'Any campus'}</td>
                  <td className="px-4 py-3">
                    {r.claimedByUserId
                      ? <span className="status-badge tone-ok" title={r.claimedByEmail ?? ''}>Account created</span>
                      : <span className="status-badge tone-neutral">Not yet signed up</span>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canEdit && !r.claimedByUserId && (
                      <button onClick={() => openEdit(r)} className="p-2 rounded-lg" title="Edit" aria-label="Edit line">
                        <Pencil size={14} style={{ color: 'var(--accent)' }} />
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => remove(r)} className="p-2 rounded-lg" title="Remove" aria-label="Remove line">
                        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {!loading && paging.total > 0 && (
        <Pagination page={paging.page} totalPages={paging.totalPages} total={paging.total} pageSize={pageSize}
          onPageChange={p => load(filters, p)} onPageSizeChange={n => { setPageSize(n); load(filters, 1, n); }} label="students" />
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit Listed Student' : `Add to ${scope.typeName}`}
          subtitle="These details are what a sign-up is matched against."
          onClose={() => setEditing(null)} dismissible={!saving} width={560}>
          <form onSubmit={save} className="space-y-4">
            {formError && <p role="alert" className="text-sm p-3 rounded-2xl" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{formError}</p>}
            <Field label="Student No.">
              <input required maxLength={30} value={editing.studentId} className="clay-input"
                onChange={e => setEditing(v => ({ ...v, studentId: e.target.value.toUpperCase() }))} placeholder="23-LN-0001" />
            </Field>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Last Name"><NameInput required maxLength={100} value={editing.lastName} onChange={x => setEditing(v => ({ ...v, lastName: x }))} /></Field>
              <Field label="First Name"><NameInput required maxLength={100} value={editing.firstName} onChange={x => setEditing(v => ({ ...v, firstName: x }))} /></Field>
              <Field label="Middle Name"><NameInput maxLength={100} value={editing.middleName} onChange={x => setEditing(v => ({ ...v, middleName: x }))} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <ChoiceChecks label="Sex" options={SEX_OPTIONS.map(s => ({ value: s, label: s }))}
                value={editing.sex} onChange={x => setEditing(v => ({ ...v, sex: x }))} />
              <Field label="Campus" hint="Leave as Any campus to match whatever campus the student picks.">
                <select value={editing.campusId} onChange={e => setEditing(v => ({ ...v, campusId: e.target.value }))} className="clay-input">
                  <option value="">Any campus</option>
                  {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            {!isScholar && (
              <Field label="Grant Amount" hint={scope.defaultAmount != null ? `Leave as is for the type's default of ₱${Number(scope.defaultAmount).toLocaleString('en-PH')}.` : 'This grant type has no default amount, so one is required.'}>
                <NumericInput prefix="₱" allowDecimal maxLength={10} value={String(editing.grantAmount ?? '')}
                  onChange={x => setEditing(v => ({ ...v, grantAmount: x }))} />
              </Field>
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
              <p key={r.row} className="text-xs flex gap-2" style={{ color: r.success ? (r.message.includes('flagged') ? 'var(--tone-attention-fg)' : 'var(--tone-ok-fg)') : 'var(--danger)' }}>
                <span className="font-mono shrink-0">Row {r.row}</span>
                <span className="font-mono shrink-0">{r.studentId}</span>
                {r.message.includes('flagged') && <AlertTriangle size={12} className="shrink-0 mt-px" />}
                <span>{r.message}</span>
              </p>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
