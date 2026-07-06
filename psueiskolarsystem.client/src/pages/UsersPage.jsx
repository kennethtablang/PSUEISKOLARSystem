import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getUsers, updateUser, setUserStatus, deleteUser, sendPasswordReset } from '../api/users';
import { register } from '../api/auth';
import { getCampuses } from '../api/campuses';
import { downloadImportTemplate, importScholars, triggerDownload } from '../api/userImport';
import { Upload, Download, CheckCircle2, XCircle } from 'lucide-react';
import Pagination from '../components/Pagination';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';

const ROLES = ['Administrator', 'ScholarshipCoordinator', 'Scholar'];

const ROLE_BADGE_CLASS = {
  Administrator: 'badge-admin',
  ScholarshipCoordinator: 'badge-coord',
  Scholar: 'badge-scholar',
};

export default function UsersPage() {
  useTitle('User Management');
  const { token } = useAuth();
  const [users, setUsers]           = useState([]);
  const [total, setTotal]           = useState(0);
  const [campuses, setCampuses]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);     // null = create, object = edit
  const [showImport, setShowImport] = useState(false);
  const [filterRole, setFilterRole] = useState('');
  const [filterCampus, setFilterCampus] = useState('');
  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(20);

  useEffect(() => {
    getCampuses(token).then(setCampuses).catch(() => {});
  }, []);

  /* Debounce the search box so we don't hit the server on every keystroke */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const data = await getUsers(token, {
        role:     filterRole   || undefined,
        campusId: filterCampus || undefined,
        search:   debouncedSearch || undefined,
        page:     p,
        pageSize,
      });
      setUsers(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, filterRole, filterCampus, debouncedSearch, pageSize, page]);

  /* Reset to page 1 whenever filters/search change */
  useEffect(() => { setPage(1); }, [debouncedSearch, filterRole, filterCampus, pageSize]);

  /* Load whenever the query inputs change */
  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page, debouncedSearch, filterRole, filterCampus, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleToggleStatus(user) {
    try {
      await setUserStatus(user.id, !user.isActive, token);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
    } catch (e) { alert(e.message); }
  }

  async function handleDelete(user) {
    if (!confirm(`Delete ${user.fullName}? This cannot be undone.`)) return;
    try {
      await deleteUser(user.id, token);
      load(page); // reload the page so totals/paging stay correct
    } catch (e) { alert(e.message); }
  }

  const [resetting, setResetting] = useState(null);
  async function handleSendReset(user) {
    setResetting(user.id);
    try {
      const data = await sendPasswordReset(user.id, token);
      alert(data.message || `A password reset link was sent to ${user.email}.`);
    } catch (e) {
      alert(e.message);
    } finally {
      setResetting(null);
    }
  }

  function openCreate() { setEditing(null); setShowModal(true); }
  function openEdit(u)  { setEditing(u);    setShowModal(true); }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
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
            onChange={e => setSearch(e.target.value)}
            className="clay-input"
            style={{ ...ctlStyle, width: 220 }}
            placeholder="Search name or email…"
          />
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterCampus} onChange={e => setFilterCampus(e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All Campuses</option>
            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: '#003087' }}>{error}</p>}

        <div className="clay-card overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : users.length === 0 ? (
            <EmptyState title="No users found" message="Try adjusting your filters, or add a new user." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Name', 'Email', 'Role', 'Campus', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="clay-table-row">
                    <td className="px-5 py-3.5 font-semibold" style={{ color: 'var(--text-strong)' }}>{u.fullName}</td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`clay-badge ${ROLE_BADGE_CLASS[u.role] ?? ''}`}>{u.role}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--text)' }}>
                      {u.campusName ?? <span style={{ color: '#b0bdd0', fontStyle: 'italic' }}>—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`clay-badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => openEdit(u)} className="text-xs font-medium hover:underline" style={{ color: '#003087' }}>
                          Edit
                        </button>
                        <button onClick={() => handleToggleStatus(u)} className="text-xs font-medium hover:underline" style={{ color: '#1a3a7a' }}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => handleSendReset(u)} disabled={resetting === u.id} className="text-xs font-medium hover:underline" style={{ color: '#8a5a00', opacity: resetting === u.id ? 0.6 : 1 }}>
                          {resetting === u.id ? 'Sending…' : 'Reset Password'}
                        </button>
                        <button onClick={() => handleDelete(u)} className="text-xs font-medium hover:underline" style={{ color: '#e03030' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            label="users"
          />
        )}
      </div>

      {showModal && (
        editing ? (
          <EditUserModal
            user={editing}
            campuses={campuses}
            token={token}
            onClose={() => setShowModal(false)}
            onSaved={() => { setShowModal(false); load(); }}
          />
        ) : (
          <CreateUserModal
            campuses={campuses}
            token={token}
            onClose={() => setShowModal(false)}
            onCreated={() => { setShowModal(false); load(); }}
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
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,20,60,0.45)' }}>
      <div className="clay-card-modal w-full p-7" style={{ maxWidth: 620, maxHeight: '88vh', overflowY: 'auto' }}>
        <h2 className="text-base font-black mb-1.5" style={{ color: 'var(--text-strong)' }}>Import Scholars</h2>
        <p className="text-sm mb-5" style={{ color: '#5a6a85' }}>
          Upload a CSV or Excel file to create many scholar accounts at once. Each created scholar is
          emailed a temporary password and a verification link.
        </p>

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
              <SummaryStat label="Total rows" value={result.total} color="#003087" />
              <SummaryStat label="Created" value={result.created} color="#0a7d43" />
              <SummaryStat label="Failed" value={result.failed} color="#c0342c" />
            </div>

            <div className="clay-card overflow-hidden mb-4" style={{ maxHeight: 300, overflowY: 'auto' }}>
              <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-xs">
                <thead className="clay-table-head">
                  <tr>
                    {['#', 'Email', 'Result'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.results.map(r => (
                    <tr key={r.row} className="clay-table-row">
                      <td className="px-3 py-2" style={{ color: '#7a8aaa' }}>{r.row}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-strong)' }}>{r.email || '—'}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5" style={{ color: r.success ? '#0a7d43' : '#c0342c' }}>
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
      </div>
    </div>
  );
}

function SummaryStat({ label, value, color }) {
  return (
    <div className="clay-card flex-1 px-4 py-3 text-center">
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider mt-0.5" style={{ color: '#7a8aaa' }}>{label}</p>
    </div>
  );
}

/* ── Create User Modal ─────────────────────────────── */
function CreateUserModal({ campuses, token, onClose, onCreated }) {
  const [form, setForm] = useState({ firstName: '', middleName: '', lastName: '', email: '', password: '', role: 'Scholar', campusId: '' });
  const [error, setError]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
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
        campusId:   form.campusId ? parseInt(form.campusId) : null,
      }, token);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ClayModal title="Add New User" onClose={onClose}>
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
        </Field>
        <Field label="Password">
          <input type="password" required minLength={8} value={form.password} onChange={e => set('password', e.target.value)} className="clay-input" placeholder="Min. 8 characters" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <select required value={form.role} onChange={e => set('role', e.target.value)} className="clay-input">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Campus">
            <select value={form.campusId} onChange={e => set('campusId', e.target.value)} className="clay-input">
              <option value="">— Select —</option>
              {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <ModalButtons onClose={onClose} submitting={submitting} label="Create User" />
      </form>
    </ClayModal>
  );
}

/* ── Edit User Modal ───────────────────────────────── */
function EditUserModal({ user, campuses, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    firstName:  user.firstName  ?? '',
    middleName: user.middleName ?? '',
    lastName:   user.lastName   ?? '',
    email:      user.email      ?? '',
    role:       user.role       ?? 'Scholar',
    campusId:   user.campusId   ? String(user.campusId) : '',
  });
  const [error, setError]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await updateUser(user.id, {
        firstName:  form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName:   form.lastName.trim(),
        email:      form.email.trim(),
        role:       form.role,
        campusId:   form.campusId ? parseInt(form.campusId) : null,
      }, token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ClayModal title={`Edit — ${user.fullName}`} onClose={onClose}>
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
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <select required value={form.role} onChange={e => set('role', e.target.value)} className="clay-input">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Campus">
            <select value={form.campusId} onChange={e => set('campusId', e.target.value)} className="clay-input">
              <option value="">— None —</option>
              {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <ModalButtons onClose={onClose} submitting={submitting} label="Save Changes" />
      </form>
    </ClayModal>
  );
}

/* ── Shared UI helpers (exported for reuse in other pages) ── */
export function ClayModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,20,60,0.45)' }}>
      <div className="clay-card-modal w-full max-w-md p-7">
        <h2 className="text-base font-black mb-5" style={{ color: 'var(--text-strong)' }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ErrorBox({ children }) {
  return (
    <div className="mb-4 p-3 rounded-2xl text-sm font-medium"
      style={{ background: '#dce8ff', color: '#003087', border: '1.5px solid #80aaee' }}>
      {children}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text)' }}>{label}</label>
      {children}
    </div>
  );
}

export function ModalButtons({ onClose, submitting, label }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
      <button type="submit" disabled={submitting} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm" style={{ opacity: submitting ? 0.65 : 1 }}>
        {submitting ? 'Saving…' : label}
      </button>
    </div>
  );
}
