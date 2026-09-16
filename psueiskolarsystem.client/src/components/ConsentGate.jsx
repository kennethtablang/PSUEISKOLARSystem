import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { acceptConsent } from '../api/auth';
import { PRIVACY_NOTICE_VERSION } from '../constants/privacy';
import { ShieldCheck } from 'lucide-react';

// Data Privacy Act (RA 10173) consent gate (FR-19). Blocks the app until the
// signed-in user acknowledges the current version of the privacy notice.
export default function ConsentGate() {
  const { user, token, refreshUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;
  // Re-prompt when the user has never consented OR accepted an older notice version.
  const consentCurrent = user.consentAcceptedAt && user.consentVersion === PRIVACY_NOTICE_VERSION;
  if (consentCurrent) return null;

  const isUpdate = Boolean(user.consentAcceptedAt) && user.consentVersion !== PRIVACY_NOTICE_VERSION;

  /* A failure used to be swallowed: the button simply re-enabled, so pressing it again and
     again did nothing visible. */
  async function accept() {
    setBusy(true);
    setError('');
    try {
      await acceptConsent(token);
      await refreshUser();
    } catch (e) {
      setError(e.message || 'Your consent could not be recorded. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Consent has to be something a person can decline. Without this the only way out of the
  // notice was to agree to it.
  function decline() {
    signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 9998 }}>
      <div className="modal-panel clay-card-modal" style={{ maxWidth: 480, padding: 32, overflowY: 'auto' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(0,37,112,0.08)', border: '2px solid rgba(0,37,112,0.15)' }}>
          <ShieldCheck size={26} style={{ color: 'var(--accent-strong)' }} strokeWidth={2} />
        </div>
        <h2 className="font-black text-lg mb-2 text-center" style={{ color: 'var(--text-strong)' }}>Data Privacy Notice</h2>
        {isUpdate && (
          <p className="text-xs mb-3 text-center font-semibold" style={{ color: 'var(--tone-warn-fg)' }}>
            Our privacy notice has been updated. Please review and re-confirm your consent to continue.
          </p>
        )}
        <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text)' }}>
          In compliance with the <strong>Data Privacy Act of 2012 (RA 10173)</strong>, PSU e-Iskolar
          collects and processes your personal and academic information solely for scholarship
          profiling, records management, and compliance monitoring.
        </p>
        <ul className="text-sm mb-3 leading-relaxed pl-5 list-disc" style={{ color: 'var(--text)' }}>
          <li>Your data is accessible only to authorized administrators and coordinators.</li>
          <li>It will not be shared with third parties without your consent.</li>
          <li>You may view and download the personal data we hold about you at any time.</li>
        </ul>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text)' }}>
          By continuing, you acknowledge that you have read and understood this notice and consent to
          the processing of your data for the purposes described.
        </p>
        {error && (
          <p role="alert" className="text-sm mb-3 p-3 rounded-2xl"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1.5px solid var(--danger-border)' }}>
            {error}
          </p>
        )}
        <button onClick={accept} disabled={busy}
          className="clay-btn clay-btn-primary w-full py-3 text-sm"
          style={{ opacity: busy ? 0.65 : 1 }}>
          {busy ? 'Saving…' : 'I Understand and Consent'}
        </button>
        <button onClick={decline} disabled={busy}
          className="w-full mt-3 py-2 text-xs font-semibold hover:underline"
          style={{ color: 'var(--text-muted)' }}>
          I do not consent — sign me out
        </button>
      </div>
    </div>
  );
}
