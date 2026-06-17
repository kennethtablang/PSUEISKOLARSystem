import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { updateProfile, get2faSetup, enable2fa, disable2fa } from '../api/auth';
import { User, Mail, Shield, Lock, KeyRound, CheckCircle, AlertCircle, ShieldCheck, ShieldOff, Smartphone, X, Copy } from 'lucide-react';
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
  const [nameMsg, setNameMsg]         = useState(null);

  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [savingPw, setSavingPw]     = useState(false);
  const [pwMsg, setPwMsg]           = useState(null);

  const [showSetup2fa, setShowSetup2fa]     = useState(false);
  const [showDisable2fa, setShowDisable2fa] = useState(false);

  const initials   = user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const roleBadge  = ROLE_BADGE[user?.role] ?? { cls: 'badge-inactive', label: user?.role };
  const twoFaEnabled = user?.twoFactorEnabled ?? false;

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

        <div className="mb-8">
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account information and security</p>
          <span className="page-title-bar" />
        </div>

        {/* Identity card */}
        <div className="clay-card p-6 mb-6">
          <div className="flex items-center gap-5 flex-wrap">
            <div style={{
              width: 76, height: 76, borderRadius: 20, flexShrink: 0,
              background: 'linear-gradient(145deg, #ffd030, #e0a000)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 900, color: '#1a0e00',
              boxShadow: '5px 5px 0 rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.32)',
            }}>
              {initials}
            </div>

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
                {twoFaEnabled && (
                  <span className="clay-badge" style={{ background: 'rgba(0,48,135,0.08)', color: '#003087', border: '1px solid rgba(0,48,135,0.15)' }}>
                    <ShieldCheck size={9} strokeWidth={2.5} />
                    2FA On
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <InfoBlock icon={<User size={13} color="#003087" strokeWidth={2} />} label="Role" value={roleBadge.label} />
              <InfoBlock icon={<Mail size={13} color="#003087" strokeWidth={2} />} label="Email" value={user?.email ?? '—'} />
            </div>
          </div>
        </div>

        {/* Edit grid */}
        <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>

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
              <button type="submit" disabled={savingName} className="clay-btn clay-btn-primary w-full">
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
              {[
                { label: 'Current Password', val: currentPw, set: setCurrentPw, ac: 'current-password' },
                { label: 'New Password',     val: newPw,     set: setNewPw,     ac: 'new-password' },
                { label: 'Confirm New Password', val: confirmPw, set: setConfirmPw, ac: 'new-password' },
              ].map(({ label, val, set, ac }) => (
                <div key={label}>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#4a5a7a' }}>{label}</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Lock size={13} color="#7a8aaa" strokeWidth={2} />
                    </span>
                    <input
                      type="password"
                      required
                      value={val}
                      onChange={e => set(e.target.value)}
                      className="clay-input"
                      style={{ paddingLeft: '36px' }}
                      placeholder="••••••••"
                      autoComplete={ac}
                    />
                  </div>
                </div>
              ))}
              <button type="submit" disabled={savingPw} className="clay-btn clay-btn-primary w-full">
                {savingPw ? 'Updating…' : 'Update Password'}
              </button>
            </form>

            {pwMsg && <StatusMsg msg={pwMsg} />}
          </div>
        </div>

        {/* 2FA card */}
        <div className="clay-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: twoFaEnabled ? 'rgba(0,48,135,0.08)' : 'rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {twoFaEnabled
                  ? <ShieldCheck size={20} color="#003087" strokeWidth={2} />
                  : <ShieldOff size={20} color="#7a8aaa" strokeWidth={2} />}
              </div>
              <div>
                <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0d1a33' }}>
                  Two-Factor Authentication
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#4a5a7a', marginTop: 2 }}>
                  {twoFaEnabled
                    ? 'Your account is protected with an authenticator app.'
                    : 'Add an extra layer of security to your account.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {twoFaEnabled ? (
                <>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: '#d4f5e2', color: '#065f46', border: '1px solid #a7f3d0' }}>
                    Enabled
                  </span>
                  <button
                    onClick={() => setShowDisable2fa(true)}
                    className="clay-btn clay-btn-ghost text-sm px-4 py-2"
                    style={{ color: '#c03030' }}>
                    Disable
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.06)', color: '#7a8aaa', border: '1px solid rgba(0,0,0,0.1)' }}>
                    Disabled
                  </span>
                  <button
                    onClick={() => setShowSetup2fa(true)}
                    className="clay-btn clay-btn-primary text-sm px-4 py-2">
                    Set Up 2FA
                  </button>
                </>
              )}
            </div>
          </div>

          {!twoFaEnabled && (
            <div className="mt-4 pt-4 border-t border-black/5 flex items-start gap-2.5">
              <Smartphone size={14} color="#7a8aaa" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '0.75rem', color: '#7a8aaa', lineHeight: 1.5 }}>
                Use Google Authenticator, Microsoft Authenticator, or any TOTP-compatible app.
                After setup, you will be required to enter a code from the app each time you sign in.
              </p>
            </div>
          )}
        </div>

      </div>

      {showSetup2fa && (
        <Setup2faModal
          token={token}
          onClose={() => setShowSetup2fa(false)}
          onEnabled={async () => { setShowSetup2fa(false); await refreshUser(); }}
        />
      )}

      {showDisable2fa && (
        <Disable2faModal
          token={token}
          onClose={() => setShowDisable2fa(false)}
          onDisabled={async () => { setShowDisable2fa(false); await refreshUser(); }}
        />
      )}
    </Layout>
  );
}

function Setup2faModal({ token, onClose, onEnabled }) {
  const [step, setStep] = useState(1); // 1 = qr, 2 = verify
  const [setup, setSetup] = useState(null); // { uri, key }
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    get2faSetup(token)
      .then(setSetup)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleEnable(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await enable2fa(code.replace(/\s/g, ''), token);
      onEnabled();
    } catch (err) {
      setError(err.message);
      setCode('');
    } finally {
      setSaving(false);
    }
  }

  function copyKey() {
    if (!setup?.key) return;
    navigator.clipboard.writeText(setup.key.replace(/\s/g, '')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,20,60,0.52)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="clay-card-modal w-full p-7" style={{ maxWidth: 440 }}>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,48,135,0.08)' }}>
              <ShieldCheck size={15} color="#003087" strokeWidth={2} />
            </div>
            <h2 className="text-base font-black" style={{ color: '#0d1a33' }}>
              {step === 1 ? 'Set Up Authenticator' : 'Verify Code'}
            </h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/5">
            <X size={15} color="#7a8aaa" strokeWidth={2.5} />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-2xl text-sm"
            style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
            <AlertCircle size={14} strokeWidth={2.5} className="shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <>
            <p className="text-sm mb-5" style={{ color: '#4a5a7a' }}>
              Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, etc.).
            </p>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="text-sm" style={{ color: '#7a8aaa' }}>Loading…</div>
              </div>
            ) : setup ? (
              <div className="flex flex-col items-center gap-4">
                <div className="p-3 rounded-2xl" style={{ background: '#fff', border: '1.5px solid rgba(0,0,0,0.08)' }}>
                  <QRCodeSVG value={setup.uri} size={180} />
                </div>

                <div className="w-full">
                  <p className="text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: '#7a8aaa' }}>
                    Or enter this key manually
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 clay-input text-xs font-mono" style={{ letterSpacing: '0.1em', color: '#0d1a33', userSelect: 'all' }}>
                      {setup.key}
                    </div>
                    <button onClick={copyKey}
                      className="clay-btn clay-btn-ghost p-2.5 shrink-0"
                      title="Copy key">
                      {copied
                        ? <CheckCircle size={14} color="#10a060" strokeWidth={2.5} />
                        : <Copy size={14} color="#7a8aaa" strokeWidth={2.5} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
                  <button onClick={() => setStep(2)} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm">
                    Next — Enter Code
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sm mb-5" style={{ color: '#4a5a7a' }}>
              Enter the 6-digit code shown in your authenticator app to confirm setup.
            </p>
            <form onSubmit={handleEnable} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#4a5a7a' }}>
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9 ]*"
                  maxLength={7}
                  required
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="000000"
                  className="clay-input text-center text-lg font-bold tracking-[0.25em]"
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">
                  Back
                </button>
                <button type="submit"
                  disabled={saving || code.replace(/\s/g, '').length < 6}
                  className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm"
                  style={{ opacity: (saving || code.replace(/\s/g, '').length < 6) ? 0.65 : 1 }}>
                  {saving ? 'Enabling…' : 'Enable 2FA'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Disable2faModal({ token, onClose, onDisabled }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await disable2fa(password, token);
      onDisabled();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,20,60,0.52)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="clay-card-modal w-full p-7" style={{ maxWidth: 400 }}>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(200,0,0,0.06)' }}>
              <ShieldOff size={15} color="#c03030" strokeWidth={2} />
            </div>
            <h2 className="text-base font-black" style={{ color: '#0d1a33' }}>Disable 2FA</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/5">
            <X size={15} color="#7a8aaa" strokeWidth={2.5} />
          </button>
        </div>

        <p className="text-sm mb-5" style={{ color: '#4a5a7a' }}>
          Enter your current password to confirm disabling two-factor authentication. Your account will be less secure.
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-2xl text-sm"
            style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
            <AlertCircle size={14} strokeWidth={2.5} className="shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="clay-input"
                style={{ paddingLeft: '36px' }}
                placeholder="••••••••"
                autoComplete="current-password"
                autoFocus
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="clay-btn flex-1 py-2.5 text-sm font-bold"
              style={{ background: '#c03030', color: '#fff', opacity: saving ? 0.65 : 1,
                boxShadow: '4px 4px 0 rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
              {saving ? 'Disabling…' : 'Disable 2FA'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
