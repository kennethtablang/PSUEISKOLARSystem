import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getUsers, updateUser, setUserStatus, deleteUser, sendPasswordReset } from '../api/users';
import { register } from '../api/auth';
import { downloadImportTemplate, importScholars, triggerDownload } from '../api/userImport';
import { Upload, Download, CheckCircle2, XCircle } from 'lucide-react';
import Pagination from '../components/Pagination';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';
import Modal from '../components/Modal';
import Avatar from '../components/Avatar';
import { useToast, useConfirm } from '../context/UIContext';
import PasswordStrengthMeter, { getPasswordStrength } from '../components/PasswordStrengthMeter';
import Field from '../components/Field';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function FieldError({ children }) {
  return children ? <p className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>{children}</p> : null;
}

const ROLES = ['Administrator', 'ScholarshipCoordinator', 'Scholar'];

const ROLE_LABEL = {
  Administrator: 'Administrator',
  ScholarshipCoordinator: 'Coordinator',
  Scholar: 'Scholar',
};

const ROLE_BADGE_CLASS = {
  Administrator: 'badge-admin',
  ScholarshipCoordinator: 'badge-coord',
  Scholar: 'badge-scholar',
};

export default function UsersPage() {
  useTitle('User Management');
  const { token, user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers]           = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);     // null = create, object = edit
  const [showImport, setShowImport] = useState(false);
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // '' | 'true' (active) | 'false' (archived)
  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(20);

  /* Debounce the search box so we don't hit the server on every keystroke */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getUsers(token, {
        role:     filterRole   || undefined,
        search:   debouncedSearch || undefined,
        isActive: filterStatus || undefined,
        page,
        pageSize,
      });
      setUsers(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, filterRole, filterStatus, debouncedSearch, page, pageSize]);

  /* Every filter resets the page as part of the same update.

     This used to be an effect that watched the filters and set the page back to 1, next to
     a second effect that loaded. Changing a filter while on page 3 then fired the loader
     twice — once against the stale page, then again once the reset landed — so the list
     flickered through the wrong page's results and the server took two queries per keystroke
     group. One state update, one fetch. */
  const changePage = p => setPage(p);
  const changeSearch = v => { setSearch(v); setPage(1); };
  const changeRole = v => { setFilterRole(v); setPage(1); };
  const changeStatus = v => { setFilterStatus(v); setPage(1); };
  const changePageSize = v => { setPageSize(v); setPage(1); };

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Id of the row with a status change or delete in flight, so a double click cannot send
  // the request twice (archive then immediately restore, or a second delete that 404s).
  const [busyId, setBusyId] = useState(null);

  async function handleToggleStatus(user) {
    const archiving = user.isActive;
    if (archiving && !(await confirm({
      title: 'Archive user',
      message: `Archive ${user.fullName}? They will be signed out and unable to sign in until the account is restored.`,
      confirmLabel: 'Archive',
      danger: true,
    }))) return;

    setBusyId(user.id);
    try {
      await setUserStatus(user.id, !archiving, token);
      toast(archiving ? `${user.fullName} was archived.` : `${user.fullName} was restored.`, 'success');
      // Reload rather than patch the row: with a status filter applied the row no longer
      // belongs on this page, and the total has changed.
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(user) {
    if (!(await confirm({ title: 'Delete user', message: `Delete ${user.fullName}? This cannot be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    setBusyId(user.id);
    try {
      await deleteUser(user.id, token);
      toast(`${user.fullName} was deleted.`, 'success');
      load(); // reload so totals/paging stay correct
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const [resetting, setResetting] = useState(null);
  async function handleSendReset(user) {
    setResetting(user.id);
    try {
      const data = await sendPasswordReset(user.id, token);
      toast(data.message || `A password reset link was sent to ${user.email}.`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setResetting(null);
    }
  }

  function openCreate() { setEditing(null); setShowModal(true); }
  function openEdit(u)  { setEditing(u);    setShowModal(true); }

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">User Management</h1>
            <p className="page-subtitle">{total} user{total !== 1 ? 's' : ''}</p>
            <span className="page-title-bar" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowImport(true)} className="clay-btn clay-btn-ghost px-4 py-2.5 text-sm flex items-center gap-2">
              <Upload size={15} strokeWidth={2.4} /> Import Scholars
            </button>
            <button onClick={openCreate} className="clay-btn clay-btn-primary px-4 py-2.5 text-sm">
              + Add User
            </button>
          </div>
        </div>

        {/* Filters — compact */}
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <input
            value={search}
            onChange={e => changeSearch(e.target.value)}
            className="clay-input"
            style={{ ...ctlStyle, width: 220 }}
            placeholder="Search name or email…"
          />
          <select value={filterRole} onChange={e => changeRole(e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <select value={filterStatus} onChange={e => changeStatus(e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All Statuses</option>
            <option value="true">Active</option>
            <option value="false">Archived</option>
          </select>
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="clay-card overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : users.length === 0 ? (
            <EmptyState title="No users found" message="Try adjusting your filters, or add a new user." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Name', 'Email', 'Role', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isSelf = u.id === me?.id;
                  const rowBusy = busyId === u.id;
                  return (
                  <tr key={u.id} className="clay-table-row">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar userId={u.id} name={u.fullName} hasAvatar={u.hasAvatar} size={32} />
                        <span className="font-semibold" style={{ color: 'var(--text-strong)' }}>{u.fullName}</span>
                        {isSelf && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(you)</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`clay-badge ${ROLE_BADGE_CLASS[u.role] ?? ''}`}>{ROLE_LABEL[u.role] ?? u.role}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`clay-badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => openEdit(u)} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                          Edit
                        </button>
                        {/* Archiving or deleting yourself is refused by the server (it would end
                            this session, or leave the system without an administrator), so the
                            controls are not offered on your own row. */}
                        {!isSelf && (
                          <button onClick={() => handleToggleStatus(u)} disabled={rowBusy} className="text-xs font-medium hover:underline" style={{ color: u.isActive ? 'var(--text)' : 'var(--tone-ok-fg)', opacity: rowBusy ? 0.6 : 1 }}>
                            {u.isActive ? 'Archive' : 'Restore'}
                          </button>
                        )}
                        <button onClick={() => handleSendReset(u)} disabled={resetting === u.id} className="text-xs font-medium hover:underline" style={{ color: 'var(--tone-warn-fg)', opacity: resetting === u.id ? 0.6 : 1 }}>
                          {resetting === u.id ? 'Sending…' : 'Reset Password'}
                        </button>
                        {!isSelf && (
                          <button onClick={() => handleDelete(u)} disabled={rowBusy} className="text-xs font-medium hover:underline" style={{ color: 'var(--danger)', opacity: rowBusy ? 0.6 : 1 }}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>

        {!loading && total > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={changePage}
            onPageSizeChange={changePageSize}
            label="users"
          />
        )}
      </div>

      {showModal && (
        editing ? (
          <EditUserModal
            user={editing}
            token={token}
            onClose={() => setShowModal(false)}
            isSelf={editing.id === me?.id}
            onSaved={() => { setShowModal(false); toast('User updated.', 'success'); load(); }}
          />
        ) : (
          <CreateUserModal
            token={token}
            onClose={() => setShowModal(false)}
            onCreated={() => { setShowModal(false); toast('User created.', 'success'); load(); }}
          />
        )
      )}

      {showImport && (
        <ImportScholarsModal
          token={token}
          onClose={() => setShowImport(false)}
          onDone={() => load()}
        />
      )}
    </Layout>
  );
}

/* ── Bulk Import Modal (FR-15) ──────────────────────── */
function ImportScholarsModal({ token, onClose, onDone }) {
  const [file, setFile]           = useState(null);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');
  const [result, setResult]       = useState(null);   // ImportSummary

  async function handleTemplate() {
    try { await downloadImportTemplate(token); }
    catch (e) { setError(e.message); }
  }

  async function handleImport() {
    if (!file) return;
    setError(''); setBusy(true); setResult(null);
    try {
      const summary = await importScholars(file, token);
      setResult(summary);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadErrorReport() {
    if (!result) return;
    const failed = result.results.filter(r => !r.success);
    const rows = [['Row', 'Email', 'Error'], ...failed.map(r => [r.row, r.email, r.message])];
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    triggerDownload(new Blob([csv], { type: 'text/csv' }), 'import_errors.csv');
  }

  return (
    <Modal
      title="Import Scholars"
      subtitle="Upload a CSV or Excel file to create many scholar accounts at once. Each created scholar is emailed a temporary password and a verification link, and is verified on creation."
      onClose={onClose}
      width={620}
      dismissible={!busy}
    >
        {error && <ErrorBox>{error}</ErrorBox>}

        {!result && (
          <>
            <button onClick={handleTemplate} className="clay-btn clay-btn-ghost px-4 py-2.5 text-sm flex items-center gap-2 mb-4">
              <Download size={15} strokeWidth={2.4} /> Download template
            </button>

            <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
              Import file (.xlsx or .csv)
            </label>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="clay-input mb-5"
            />

            <div className="flex gap-3">
              <button onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
              <button
                onClick={handleImport}
                disabled={!file || busy}
                className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm"
                style={{ opacity: (!file || busy) ? 0.6 : 1 }}
              >
                {busy ? 'Importing…' : 'Import'}
              </button>
            </div>
          </>
        )}

        {result && (
          <>
            <div className="flex gap-3 mb-4">
              <SummaryStat label="Total rows" value={result.total} color="var(--accent)" />
              <SummaryStat label="Created" value={result.created} color="var(--tone-ok-fg)" />
              <SummaryStat label="Failed" value={result.failed} color="var(--danger)" />
            </div>

            <div className="clay-card overflow-hidden mb-4" style={{ maxHeight: 300, overflowY: 'auto' }}>
              <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-xs">
                <thead className="clay-table-head">
                  <tr>
                    {['#', 'Email', 'Result'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.results.map(r => (
                    <tr key={r.row} className="clay-table-row">
                      <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.row}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-strong)' }}>{r.email || '—'}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5" style={{ color: r.success ? 'var(--tone-ok-fg)' : 'var(--danger)' }}>
                          {r.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {r.message}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>

            <div className="flex gap-3">
              {result.failed > 0 && (
                <button onClick={downloadErrorReport} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                  <Download size={14} strokeWidth={2.4} /> Error report
                </button>
              )}
              <button onClick={onClose} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm">Done</button>
            </div>
          </>
        )}
    </Modal>
  );
}

function SummaryStat({ label, value, color }) {
  return (
    <div className="clay-card flex-1 px-4 py-3 text-center">
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

/* ── Create User Modal ─────────────────────────────── */
function CreateUserModal({ token, onClose, onCreated }) {
  const [form, setForm] = useState({ firstName: '', middleName: '', lastName: '', email: '', password: '', role: 'Scholar' });
  const [error, setError]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  const emailError = form.email && !EMAIL_RE.test(form.email.trim()) ? 'Enter a valid email address.' : '';
  const passwordOk = getPasswordStrength(form.password).passed === 5;
  const canSubmit = form.firstName.trim() && form.lastName.trim() && !emailError && form.email && passwordOk;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      await register({
        firstName:  form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName:   form.lastName.trim(),
        email:      form.email,
        password:   form.password,
        role:       form.role,
      }, token);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ClayModal title="Add New User" onClose={onClose} dismissible={!submitting}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name">
            <input required value={form.firstName} onChange={e => set('firstName', e.target.value)} className="clay-input" placeholder="Juan" />
          </Field>
          <Field label="Last Name">
            <input required value={form.lastName} onChange={e => set('lastName', e.target.value)} className="clay-input" placeholder="Dela Cruz" />
          </Field>
        </div>
        <Field label="Middle Name (optional)">
          <input value={form.middleName} onChange={e => set('middleName', e.target.value)} className="clay-input" placeholder="Santos" />
        </Field>
        <Field label="Email Address">
          <input type="email" required value={form.email} onChange={e => set('email', e.target.value)} className="clay-input" placeholder="juan@psu.edu.ph" />
          <FieldError>{emailError}</FieldError>
        </Field>
        <Field label="Password">
          <input type="password" required minLength={8} value={form.password} onChange={e => set('password', e.target.value)} className="clay-input" placeholder="Min. 8 characters" />
          <PasswordStrengthMeter password={form.password} />
        </Field>
        <Field label="Role">
          <select required value={form.role} onChange={e => set('role', e.target.value)} className="clay-input">
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        <ModalButtons onClose={onClose} submitting={submitting} disabled={!canSubmit} label="Create User" />
      </form>
    </ClayModal>
  );
}

/* ── Edit User Modal ───────────────────────────────── */
function EditUserModal({ user, token, isSelf, onClose, onSaved }) {
  const [form, setForm] = useState({
    firstName:  user.firstName  ?? '',
    middleName: user.middleName ?? '',
    lastName:   user.lastName   ?? '',
    email:      user.email      ?? '',
    role:       user.role       ?? 'Scholar',
  });
  const [error, setError]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  const emailError = form.email && !EMAIL_RE.test(form.email.trim()) ? 'Enter a valid email address.' : '';
  const canSubmit = form.firstName.trim() && form.lastName.trim() && form.email && !emailError;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      await updateUser(user.id, {
        firstName:  form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName:   form.lastName.trim(),
        email:      form.email.trim(),
        role:       form.role,
      }, token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ClayModal title={`Edit — ${user.fullName}`} onClose={onClose} dismissible={!submitting}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name">
            <input required value={form.firstName} onChange={e => set('firstName', e.target.value)} className="clay-input" />
          </Field>
          <Field label="Last Name">
            <input required value={form.lastName} onChange={e => set('lastName', e.target.value)} className="clay-input" />
          </Field>
        </div>
        <Field label="Middle Name (optional)">
          <input value={form.middleName} onChange={e => set('middleName', e.target.value)} className="clay-input" />
        </Field>
        <Field label="Email / Login">
          <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className="clay-input" />
          <FieldError>{emailError}</FieldError>
        </Field>
        <Field label="Role">
          <select required value={form.role} onChange={e => set('role', e.target.value)} className="clay-input" disabled={isSelf}>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        {isSelf && (
          <p className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>
            You cannot change your own role. Another administrator has to do it.
          </p>
        )}
        <ModalButtons onClose={onClose} submitting={submitting} disabled={!canSubmit} label="Save Changes" />
      </form>
    </ClayModal>
  );
}

/* ── Shared UI helpers (exported for reuse in other pages) ── */
/* Thin wrapper kept for the pages that already import it; all chrome, layering and
   backdrop behaviour live in components/Modal.jsx. */
export function ClayModal({ title, subtitle, onClose, children, width = 460, dismissible = true }) {
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} width={width} dismissible={dismissible}>
      {children}
    </Modal>
  );
}

export function ErrorBox({ children }) {
  return (
    <div role="alert" className="mb-4 p-3 rounded-2xl text-sm font-medium"
      style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1.5px solid var(--danger-border)' }}>
      {children}
    </div>
  );
}

export function ModalButtons({ onClose, submitting, label, disabled = false }) {
  const off = submitting || disabled;
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onClose} disabled={submitting} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
      <button type="submit" disabled={off} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm" style={{ opacity: off ? 0.65 : 1 }}>
        {submitting ? 'Saving…' : label}
      </button>
    </div>
  );
}
