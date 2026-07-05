import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { acceptConsent } from '../api/auth';
import { ShieldCheck } from 'lucide-react';

// Data Privacy Act (RA 10173) consent gate (FR-19). Blocks the app until the
// signed-in user acknowledges the privacy notice.
export default function ConsentGate() {
  const { user, token, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!user || user.consentAcceptedAt) return null;

  async function accept() {
    setBusy(true);
    try {
      await acceptConsent(token);
      await refreshUser();
    } catch { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9998] p-4" style={{ background: 'rgba(0,20,60,0.6)' }}>
      <div className="clay-card-modal w-full p-8" style={{ maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(0,37,112,0.08)', border: '2px solid rgba(0,37,112,0.15)' }}>
          <ShieldCheck size={26} color="#002570" strokeWidth={2} />
        </div>
        <h2 className="font-black text-lg mb-2 text-center" style={{ color: 'var(--text-strong)' }}>Data Privacy Notice</h2>
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
        <button onClick={accept} disabled={busy}
          className="clay-btn clay-btn-primary w-full py-3 text-sm"
          style={{ opacity: busy ? 0.65 : 1 }}>
          {busy ? 'Saving…' : 'I Understand and Consent'}
        </button>
      </div>
    </div>
  );
}
