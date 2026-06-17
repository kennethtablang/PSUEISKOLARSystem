import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getUsers, setUserStatus, deleteUser } from '../api/users';
import { register } from '../api/auth';
import { useTitle } from '../hooks/useTitle';

const ROLES = ['Administrator', 'ScholarshipCoordinator', 'Scholar'];

const ROLE_BADGE_CLASS = {
  Administrator: 'badge-admin',
  ScholarshipCoordinator: 'badge-coord',
  Scholar: 'badge-scholar',
};

export default function UsersPage() {
  useTitle('User Management');
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [filterRole, setFilterRole] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const u = await getUsers(token, { role: filterRole || undefined });
      setUsers(u);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterRole]);

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
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (e) { alert(e.message); }
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">User Management</h1>
            <p className="page-subtitle">{users.length} user{users.length !== 1 ? 's' : ''}</p>
            <span className="page-title-bar" />
          </div>
          <button onClick={() => setShowModal(true)} className="clay-btn clay-btn-primary px-4 py-2.5 text-sm">
            + Add User
          </button>
        </div>

        <div className="flex gap-3 mb-5">
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="clay-input" style={{ width: 'auto' }}>
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: '#003087' }}>{error}</p>}

        <div className="clay-card overflow-hidden">
          {loading ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>No users found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Name', 'Email', 'Role', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className="clay-table-row">
                    <td className="px-5 py-3.5 font-semibold" style={{ color: '#0d1a33' }}>{u.fullName}</td>
                    <td className="px-5 py-3.5" style={{ color: '#4a5a7a' }}>{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`clay-badge ${ROLE_BADGE_CLASS[u.role] ?? ''}`}>{u.role}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`clay-badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => handleToggleStatus(u)} className="text-xs font-medium hover:underline" style={{ color: '#1a3a7a' }}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => handleDelete(u)} className="text-xs font-medium hover:underline" style={{ color: '#003087' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <CreateUserModal
          token={token}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </Layout>
  );
}

function CreateUserModal({ token, onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'Scholar' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({ ...form, campusId: null }, token);
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
        <Field label="Full Name"><input required value={form.fullName} onChange={e => set('fullName', e.target.value)} className="clay-input" placeholder="Juan Dela Cruz" /></Field>
        <Field label="Email Address"><input type="email" required value={form.email} onChange={e => set('email', e.target.value)} className="clay-input" placeholder="juan@psu.edu.ph" /></Field>
        <Field label="Password"><input type="password" required minLength={8} value={form.password} onChange={e => set('password', e.target.value)} className="clay-input" placeholder="Min. 8 characters" /></Field>
        <Field label="Role">
          <select required value={form.role} onChange={e => set('role', e.target.value)} className="clay-input">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <ModalButtons onClose={onClose} submitting={submitting} label="Create User" />
      </form>
    </ClayModal>
  );
}

export function ClayModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,20,60,0.45)' }}>
      <div className="clay-card-modal w-full max-w-md p-7">
        <h2 className="text-base font-black mb-5" style={{ color: '#0d1a33' }}>{title}</h2>
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
      <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: '#4a5a7a' }}>{label}</label>
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
