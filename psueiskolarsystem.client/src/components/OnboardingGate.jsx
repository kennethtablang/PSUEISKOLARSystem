import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getScholarProfile } from '../api/scholars';
import { UserCog, ArrowRight } from 'lucide-react';

const DISMISS_KEY = 'onboarding-dismissed';

/**
 * First-run gate for newly registered scholars: if their profile is missing key
 * details (student ID, program, or scholarship type), prompt them to set it up
 * before using the system. Dismissible for the session, re-prompts next login
 * until the profile is complete.
 */
export default function OnboardingGate() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [incomplete, setIncomplete] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === 'true');

  useEffect(() => {
    if (user?.role !== 'Scholar') { setIncomplete(false); return; }
    let cancelled = false;
    getScholarProfile(user.id, token)
      .then(p => {
        if (cancelled) return;
        const missing = !p || !p.studentId || !p.programId || !p.scholarshipTypeId;
        setIncomplete(Boolean(missing));
      })
      .catch(() => { if (!cancelled) setIncomplete(true); }); // no profile yet → needs setup
    return () => { cancelled = true; };
  }, [user, token, location.pathname]);

  // Don't show while already on the profile page (they're setting it up there).
  if (!incomplete || dismissed || location.pathname === '/my-profile') return null;

  function setUpNow() { navigate('/my-profile'); }
  function later() { sessionStorage.setItem(DISMISS_KEY, 'true'); setDismissed(true); }

  return (
    <div className="modal-backdrop" style={{ zIndex: 9997 }}>
      <div className="modal-panel clay-card-modal" style={{ maxWidth: 460, padding: 32 }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(0,37,112,0.08)', border: '2px solid rgba(0,37,112,0.15)' }}>
          <UserCog size={26} color="#002570" strokeWidth={2} />
        </div>
        <h2 className="font-black text-lg mb-2 text-center" style={{ color: 'var(--text-strong)' }}>
          Welcome, {user?.firstName || 'Scholar'}!
        </h2>
        <p className="text-sm mb-6 leading-relaxed text-center" style={{ color: 'var(--text)' }}>
          Before you start, let’s set up your scholar profile — your student ID, program, and
          scholarship type. We use these to show the right requirements and track your compliance.
        </p>
        <button onClick={setUpNow}
          className="clay-btn clay-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
          Set up my profile
          <ArrowRight size={16} strokeWidth={2.5} />
        </button>
        <button onClick={later}
          className="clay-btn clay-btn-ghost w-full py-2.5 text-sm mt-2.5">
          I’ll do it later
        </button>
      </div>
    </div>
  );
}
