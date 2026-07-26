import { useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { updateProfile, enable2fa, disable2fa, updateNotificationPreferences } from '../api/auth';
import { uploadMyAvatar, deleteMyAvatar, clearAvatarCache } from '../api/avatars';
import { exportScholarData } from '../api/scholars';
import { useTutorial } from '../context/TutorialContext';
import { User, Mail, Shield, Lock, KeyRound, CheckCircle, AlertCircle, ShieldCheck, ShieldOff, Bell, Download, Sparkles, Camera, Trash2 } from 'lucide-react';
import { useTitle } from '../hooks/useTitle';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import Modal from '../components/Modal';
import Avatar from '../components/Avatar';
import { MUTABLE_IN_APP_CATEGORIES } from '../constants/notifications';

const ROLE_BADGE = {
  Administrator:           { cls: 'badge-admin',   label: 'Administrator' },
  ScholarshipCoordinator:  { cls: 'badge-coord',   label: 'Coordinator' },
  Scholar:                 { cls: 'badge-scholar', label: 'Scholar' },
};

export default function ProfilePage() {
  useTitle('Profile');
  const { user, token, refreshUser } = useAuth();
  const { openTutorial } = useTutorial();
  const toast = useToast();

  const [firstName,  setFirstName]  = useState(user?.firstName  ?? '');
  const [middleName, setMiddleName] = useState(user?.middleName ?? '');
  const [lastName,   setLastName]   = useState(user?.lastName   ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg]       = useState(null);

  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [savingPw, setSavingPw]     = useState(false);
  const [pwMsg, setPwMsg]           = useState(null);

  const [enabling2fa, setEnabling2fa]       = useState(false);
  const [twoFaMsg, setTwoFaMsg]             = useState(null);
  const [showDisable2fa, setShowDisable2fa] = useState(false);

  const [prefs, setPrefs] = useState({
    emailAnnouncements:  user?.emailAnnouncements  ?? true,
    emailDocumentStatus: user?.emailDocumentStatus ?? true,
    emailDeadlines:      user?.emailDeadlines      ?? true,
    mutedInAppCategories: user?.mutedInAppCategories ?? [],
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMsg, setPrefsMsg]       = useState(null);

  // The UI asks "show this in the bell?", the server stores the inverse (what's muted).
  const isInAppOn = key => !prefs.mutedInAppCategories.includes(key);
  function toggleInApp(key, on) {
    setPrefs(p => ({
      ...p,
      mutedInAppCategories: on
        ? p.mutedInAppCategories.filter(c => c !== key)
        : [...p.mutedInAppCategories, key],
    }));
  }

  async function handleSavePrefs() {
    setSavingPrefs(true); setPrefsMsg(null);
    try {
      await updateNotificationPreferences(prefs, token);
      await refreshUser();
      setPrefsMsg({ ok: true, text: 'Preferences saved.' });
    } catch (err) {
      setPrefsMsg({ ok: false, text: err.message });
    } finally { setSavingPrefs(false); }
  }

  /* ── Profile photo ── */
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoVersion, setPhotoVersion]     = useState(0);
  const photoInput = useRef(null);

  async function handlePhotoPicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';               // let the same file be re-picked after an error
    if (!file) return;

    // Checked here as well as on the server so the feedback is instant.
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) {
      toast('Profile photo must be a PNG, JPG, or WEBP image.', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast('Profile photo must be 4 MB or smaller.', 'error');
      return;
    }

    setUploadingPhoto(true);
    try {
      await uploadMyAvatar(file, token);
      clearAvatarCache(user.id);
      setPhotoVersion(v => v + 1);
      await refreshUser();
      toast('Profile photo updated.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally { setUploadingPhoto(false); }
  }

  async function handleRemovePhoto() {
    setUploadingPhoto(true);
    try {
      await deleteMyAvatar(token);
      clearAvatarCache(user.id);
      setPhotoVersion(v => v + 1);
      await refreshUser();
      toast('Profile photo removed.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally { setUploadingPhoto(false); }
  }

  async function handleDownloadData() {
    try {
      const data = await exportScholarData(user.id, token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'my-eiskolar-data.json';
      a.click(); URL.revokeObjectURL(url);
    } catch (err) { toast(err.message, 'error'); }
  }

  const roleBadge = ROLE_BADGE[user?.role] ?? { cls: 'badge-inactive', label: user?.role };
  const twoFaEnabled = user?.twoFactorEnabled ?? false;

  async function handleSaveName(e) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg(null);
    try {
      await updateProfile({ firstName: firstName.trim(), middleName: middleName.trim() || null, lastName: lastName.trim() }, token);
      await refreshUser();
      setNameMsg({ ok: true, text: 'Name updated.' });
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
      await updateProfile({ firstName: user?.firstName ?? '', middleName: user?.middleName ?? null, lastName: user?.lastName ?? '', currentPassword: currentPw, newPassword: newPw }, token);
      setPwMsg({ ok: true, text: 'Password changed successfully.' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwMsg({ ok: false, text: err.message });
    } finally {
      setSavingPw(false);
    }
  }

  async function handleEnable2fa() {
    setEnabling2fa(true);
    setTwoFaMsg(null);
    try {
      await enable2fa(token);
      await refreshUser();
      setTwoFaMsg({ ok: true, text: 'Two-factor authentication enabled. A code will be sent to your email each time you sign in.' });
    } catch (err) {
      setTwoFaMsg({ ok: false, text: err.message });
    } finally {
      setEnabling2fa(false);
    }
  }

  return (
    <Layout>
      <div className="page-shell">

        <div className="page-head">
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="page-subtitle">Manage your account information and security</p>
            <span className="page-title-bar" />
          </div>
        </div>

        {/* Identity card — spans the full shell above the split, so the person you are
            editing is established once before the columns begin. */}
        <div className="clay-card p-6 mb-6">
          <div className="flex items-center gap-5 flex-wrap">
            {/* Photo + its controls. The camera button overlaps the corner so the whole
                thing still reads as one avatar rather than a form field. */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar
                userId={user?.id}
                name={user?.fullName}
                hasAvatar={user?.hasAvatar}
                version={photoVersion}
                size={76}
                radius={20}
                style={{
                  boxShadow: '5px 5px 0 rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.32)',
                  opacity: uploadingPhoto ? 0.55 : 1,
                  transition: 'opacity 0.15s',
                }}
              />
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                disabled={uploadingPhoto}
                title={user?.hasAvatar ? 'Change profile photo' : 'Upload a profile photo'}
                style={{
                  position: 'absolute', right: -6, bottom: -6,
                  width: 30, height: 30, borderRadius: 10, border: 'none',
                  cursor: uploadingPhoto ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#003087', color: '#fff',
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.15)',
                }}
              >
                <Camera size={14} strokeWidth={2.4} />
              </button>
              <input
                ref={photoInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePhotoPicked}
                style={{ display: 'none' }}
              />
              {user?.hasAvatar && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-1 mx-auto mt-2.5"
                  style={{
                    fontSize: 10.5, fontWeight: 700, color: '#c03030',
                    background: 'none', border: 'none',
                    cursor: uploadingPhoto ? 'wait' : 'pointer',
                  }}
                >
                  <Trash2 size={11} strokeWidth={2.4} /> Remove
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-strong)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {user?.fullName}
              </p>

              <div className="flex items-center gap-1.5 mt-1.5">
                <Mail size={12} strokeWidth={2} color="#7a8aaa" />
                <p style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{user?.email}</p>
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

            {/* Account facts. Role and email already read in the block to the left, so
                these carry things you can't see anywhere else on the page. */}
            <div className="flex gap-3 flex-wrap">
              <InfoBlock
                icon={<User size={13} color="#003087" strokeWidth={2} />}
                label="Role"
                value={roleBadge.label}
              />
              <InfoBlock
                icon={<ShieldCheck size={13} color="#003087" strokeWidth={2} />}
                label="Two-factor"
                value={twoFaEnabled ? 'Enabled' : 'Off'}
              />
              <InfoBlock
                icon={<Shield size={13} color="#003087" strokeWidth={2} />}
                label="Privacy notice"
                value={user?.consentAcceptedAt
                  ? `v${user.consentVersion} · ${new Date(user.consentAcceptedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : 'Not accepted'}
              />
            </div>
          </div>
        </div>

        {/* Working columns: the forms you came here to fill in on the left, account
            posture and one-off actions in the rail. */}
        <div className="page-split">
          <div>

        {/* Edit grid */}
        <div className="card-grid-wide mb-5">

          {/* Display name */}
          <div className="clay-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,48,135,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={15} color="#003087" strokeWidth={2} />
              </div>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-strong)' }}>Personal Information</h2>
            </div>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>First Name</label>
                  <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="clay-input" placeholder="First name" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>Last Name</label>
                  <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="clay-input" placeholder="Last name" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                  Middle Name <span style={{ color: '#9aaabb', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <input type="text" value={middleName} onChange={e => setMiddleName(e.target.value)} className="clay-input" placeholder="Middle name" />
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
              <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-strong)' }}>Change Password</h2>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                { label: 'Current Password',     val: currentPw, set: setCurrentPw, ac: 'current-password' },
                { label: 'New Password',         val: newPw,     set: setNewPw,     ac: 'new-password' },
                { label: 'Confirm New Password', val: confirmPw, set: setConfirmPw, ac: 'new-password' },
              ].map(({ label, val, set, ac }) => (
                <div key={label}>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>{label}</label>
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
                  {label === 'New Password' && <PasswordStrengthMeter password={val} />}
                </div>
              ))}
              <button type="submit" disabled={savingPw} className="clay-btn clay-btn-primary w-full">
                {savingPw ? 'Updating…' : 'Update Password'}
              </button>
            </form>

            {pwMsg && <StatusMsg msg={pwMsg} />}
          </div>
        </div>

        {/* Notifications & Privacy (FR-19 / FR-20) */}
        <div className="clay-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,48,135,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={15} color="#003087" strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-strong)' }}>Notification Preferences</h2>
          </div>

          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#7a8aaa' }}>Email</p>
          <p className="text-sm mb-3" style={{ color: 'var(--text)' }}>
            Choose which emails you receive. Account and security emails are always sent.
          </p>

          <div className="space-y-2 mb-5">
            {[
              { key: 'emailAnnouncements',  label: 'Announcements' },
              { key: 'emailDocumentStatus', label: 'Document status updates' },
              { key: 'emailDeadlines',      label: 'Submission deadline reminders' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between clay-card-inner px-4 py-3 cursor-pointer">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>{label}</span>
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: '#003087' }}
                />
              </label>
            ))}
          </div>

          {/* In-app muting — finer than the three email toggles: each category can be
              silenced in the bell independently of whether its email still arrives. */}
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#7a8aaa' }}>In-app (notification bell)</p>
          <p className="text-sm mb-3" style={{ color: 'var(--text)' }}>
            Turn a category off to stop it appearing in your bell. Account and security
            notices always show, and muting here doesn't change your email choices above.
          </p>

          <div className="space-y-2 mb-4">
            {MUTABLE_IN_APP_CATEGORIES.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between clay-card-inner px-4 py-3 cursor-pointer">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>{label}</span>
                <input
                  type="checkbox"
                  checked={isInAppOn(key)}
                  onChange={e => toggleInApp(key, e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#003087' }}
                />
              </label>
            ))}
          </div>

          <button onClick={handleSavePrefs} disabled={savingPrefs} className="clay-btn clay-btn-primary px-5 py-2.5 text-sm">
            {savingPrefs ? 'Saving…' : 'Save Preferences'}
          </button>
          {prefsMsg && <StatusMsg msg={prefsMsg} />}
        </div>

          </div>

          {/* ── Rail: account posture and one-off actions ── */}
          <aside className="page-rail space-y-5">

            {/* 2FA — laid out vertically for the rail's width, status leading. */}
            <div className="clay-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div style={{
                  width: 40, height: 40, borderRadius: 13, flexShrink: 0,
                  background: twoFaEnabled ? 'rgba(0,48,135,0.08)' : 'rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {twoFaEnabled
                    ? <ShieldCheck size={18} color="#003087" strokeWidth={2} />
                    : <ShieldOff size={18} color="#7a8aaa" strokeWidth={2} />}
                </div>
                <div className="min-w-0">
                  <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-strong)' }}>
                    Two-Factor Authentication
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-1"
                    style={twoFaEnabled
                      ? { background: '#d4f5e2', color: '#065f46', border: '1px solid #a7f3d0' }
                      : { background: 'rgba(0,0,0,0.06)', color: '#7a8aaa', border: '1px solid rgba(0,0,0,0.1)' }}>
                    {twoFaEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.5 }} className="mb-3">
                {twoFaEnabled
                  ? 'A verification code is sent to your email each time you sign in.'
                  : 'Turn on to receive an email code at every sign-in for extra security.'}
              </p>

              {twoFaEnabled ? (
                <button
                  onClick={() => { setTwoFaMsg(null); setShowDisable2fa(true); }}
                  className="clay-btn clay-btn-ghost text-sm px-4 py-2 w-full"
                  style={{ color: '#c03030' }}>
                  Disable 2FA
                </button>
              ) : (
                <button
                  onClick={handleEnable2fa}
                  disabled={enabling2fa}
                  className="clay-btn clay-btn-primary text-sm px-4 py-2 w-full"
                  style={{ opacity: enabling2fa ? 0.65 : 1 }}>
                  {enabling2fa ? 'Enabling…' : 'Enable 2FA'}
                </button>
              )}

              {twoFaMsg && <StatusMsg msg={twoFaMsg} />}
            </div>

            {/* Guided tour */}
            <div className="clay-card p-5">
              <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-strong)' }} className="mb-1.5">
                Guided Tour
              </h2>
              <p className="text-sm mb-3" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
                New here or need a refresher? Replay the walkthrough of the system's main features.
              </p>
              <button onClick={openTutorial} className="clay-btn clay-btn-ghost px-4 py-2 text-sm w-full flex items-center justify-center gap-2">
                <Sparkles size={15} strokeWidth={2.4} /> Replay Tutorial
              </button>
            </div>

            {user?.role === 'Scholar' && (
              <div className="clay-card p-5">
                <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-strong)' }} className="mb-1.5">
                  Your Data (RA 10173)
                </h2>
                <p className="text-sm mb-3" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
                  Download a copy of the personal data PSU e-Iskolar holds about you.
                </p>
                <button onClick={handleDownloadData} className="clay-btn clay-btn-ghost px-4 py-2 text-sm w-full flex items-center justify-center gap-2">
                  <Download size={15} strokeWidth={2.4} /> Download my data
                </button>
              </div>
            )}
          </aside>
        </div>

      </div>

      {showDisable2fa && (
        <Disable2faModal
          token={token}
          onClose={() => setShowDisable2fa(false)}
          onDisabled={async () => {
            setShowDisable2fa(false);
            await refreshUser();
            setTwoFaMsg({ ok: true, text: 'Two-factor authentication has been disabled.' });
          }}
        />
      )}
    </Layout>
  );
}

function Disable2faModal({ token, onClose, onDisabled }) {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

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
    <Modal
      title={
        <span className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(200,0,0,0.08)' }}>
            <ShieldOff size={15} color="#c03030" strokeWidth={2} />
          </span>
          Disable 2FA
        </span>
      }
      subtitle="Enter your current password to confirm disabling two-factor authentication. Your account will be less secure."
      onClose={onClose}
      width={400}
      dismissible={!saving}
      labelledBy={undefined}
    >
        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-2xl text-sm"
            style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
            <AlertCircle size={14} strokeWidth={2.5} className="shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
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
    </Modal>
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
      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-strong)', wordBreak: 'break-all' }}>{value}</p>
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
