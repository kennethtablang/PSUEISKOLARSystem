import { useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/auth';
import { User, Mail, Shield, Lock, KeyRound, CheckCircle, AlertCircle } from 'lucide-react';
import { useTitle } from '../hooks/useTitle';

const ROLE_BADGE = {
  Administrator:           { cls: 'badge-admin',   label: 'Administrator' },
  ScholarshipCoordinator:  { cls: 'badge-coord',   label: 'Coordinator' },
  Scholar:                 { cls: 'badge-scholar', label: 'Scholar' },
};

export default function ProfilePage() {
  useTitle('Profile');
  const { user, token, refreshUser } = useAuth();

  const [name, setName]           = useState(user?.fullName ?? '');
  const [savingName, setSavingName]   = useState(false);
  const [nameMsg, setNameMsg]         = useState(null); // { ok, text }

  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [savingPw, setSavingPw]     = useState(false);
  const [pwMsg, setPwMsg]           = useState(null);

  const initials   = user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const roleBadge  = ROLE_BADGE[user?.role] ?? { cls: 'badge-inactive', label: user?.role };

  async function handleSaveName(e) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg(null);
    try {
      await updateProfile({ fullName: name.trim() }, token);
      await refreshUser();
      setNameMsg({ ok: true, text: 'Display name updated.' });
    } catch (err) {
      setNameMsg({ ok: false, text: err.message });
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' });
      return;
    }
    setSavingPw(true);
    try {
      await updateProfile({ fullName: user?.fullName ?? '', currentPassword: currentPw, newPassword: newPw }, token);
      setPwMsg({ ok: true, text: 'Password changed successfully.' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwMsg({ ok: false, text: err.message });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <Layout>
      <div className="p-8" style={{ maxWidth: '860px' }}>

        {/* ── Page header ── */}
        <div className="mb-8">
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account information and password</p>
          <span className="page-title-bar" />
        </div>

        {/* ── Identity card ── */}
        <div className="clay-card p-6 mb-6">
          <div className="flex items-center gap-5 flex-wrap">
            {/* Avatar */}
            <div style={{
              width: 76, height: 76, borderRadius: 20, flexShrink: 0,
              background: 'linear-gradient(145deg, #ffd030, #e0a000)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 900, color: '#1a0e00',
              boxShadow: '5px 5px 0 rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.32)',
            }}>
              {initials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0d1a33', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {user?.fullName}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Mail size={12} strokeWidth={2} color="#7a8aaa" />
                <p style={{ fontSize: '0.82rem', color: '#4a5a7a' }}>{user?.email}</p>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={`clay-badge ${roleBadge.cls}`}>
                  <Shield size={9} strokeWidth={2.5} />
                  {roleBadge.label}
                </span>
                <span className="clay-badge badge-active">
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10a060', display: 'inline-block' }} />
                  Active
                </span>
              </div>
            </div>

            {/* Info blocks */}
            <div className="flex gap-3 flex-wrap">
              <InfoBlock icon={<User size={13} color="#003087" strokeWidth={2} />} label="Role" value={roleBadge.label} />
              <InfoBlock icon={<Mail size={13} color="#003087" strokeWidth={2} />} label="Email" value={user?.email ?? '—'} />
            </div>
          </div>
        </div>

        {/* ── Edit grid ── */}
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>

          {/* Display name */}
          <div className="clay-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,48,135,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={15} color="#003087" strokeWidth={2} />
              </div>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0d1a33' }}>Display Name</h2>
            </div>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#4a5a7a' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="clay-input"
                  placeholder="Your full name"
                />
              </div>
              <button
                type="submit"
                disabled={savingName}
                className="clay-btn clay-btn-primary w-full"
              >
                {savingName ? 'Saving…' : 'Save Name'}
              </button>
            </form>

            {nameMsg && <StatusMsg msg={nameMsg} />}
          </div>

          {/* Change password */}
          <div className="clay-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,48,135,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <KeyRound size={15} color="#003087" strokeWidth={2} />
              </div>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0d1a33' }}>Change Password</h2>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#4a5a7a' }}>
                  Current Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock size={13} color="#7a8aaa" strokeWidth={2} />
                  </span>
                  <input
                    type="password"
                    required
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    className="clay-input"
                    style={{ paddingLeft: '36px' }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#4a5a7a' }}>
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock size={13} color="#7a8aaa" strokeWidth={2} />
                  </span>
                  <input
                    type="password"
                    required
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    className="clay-input"
                    style={{ paddingLeft: '36px' }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#4a5a7a' }}>
                  Confirm New Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock size={13} color="#7a8aaa" strokeWidth={2} />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    className="clay-input"
                    style={{ paddingLeft: '36px' }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPw}
                className="clay-btn clay-btn-primary w-full"
              >
                {savingPw ? 'Updating…' : 'Update Password'}
              </button>
            </form>

            {pwMsg && <StatusMsg msg={pwMsg} />}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function InfoBlock({ icon, label, value }) {
  return (
    <div className="clay-card-inner px-4 py-3" style={{ minWidth: '140px' }}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7a8aaa' }}>
          {label}
        </p>
      </div>
      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0d1a33', wordBreak: 'break-all' }}>{value}</p>
    </div>
  );
}

function StatusMsg({ msg }) {
  return (
    <div className="flex items-start gap-2 mt-4 p-3 rounded-2xl text-xs font-semibold"
      style={{
        background: msg.ok ? '#d4f5e2' : '#fee2e2',
        color: msg.ok ? '#065f46' : '#991b1b',
        border: `1px solid ${msg.ok ? '#a7f3d0' : '#fca5a5'}`,
      }}>
      {msg.ok
        ? <CheckCircle size={13} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
        : <AlertCircle size={13} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />}
      {msg.text}
    </div>
  );
}
