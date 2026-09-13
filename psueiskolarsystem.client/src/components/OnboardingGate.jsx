import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getScholarProfile } from '../api/scholars';
import { UserCog, ArrowRight, IdCard, GraduationCap, Award, Check } from 'lucide-react';

/**
 * First-run gate for newly registered scholars.
 *
 * A scholar's profile is what tells the system which requirements apply to them, which
 * deadlines they're subject to, and which GWA threshold they're measured against. Until it
 * exists nothing else in the app can give them a correct answer — so this gate is
 * **blocking**, not a reminder. There is no "later": the only ways past it are completing
 * the profile or signing out.
 *
 * The API enforces the same rule independently (`Data/ScholarOnboarding.cs`), because a gate
 * rendered in the browser is a courtesy, not a control.
 */
export default function OnboardingGate() {
  const { user, token, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState({ checked: false, incomplete: false, missing: [] });

  const check = useCallback(async () => {
    if (user?.role !== 'Scholar') {
      setState({ checked: true, incomplete: false, missing: [] });
      return;
    }
    try {
      const p = await getScholarProfile(user.id, token);
      const missing = [
        !p?.studentId && 'studentId',
        !p?.programId && 'programId',
        !p?.scholarshipTypeId && 'scholarshipTypeId',
      ].filter(Boolean);
      setState({ checked: true, incomplete: missing.length > 0, missing });
    } catch {
      // No profile row at all — the usual case for a brand-new scholar.
      setState({ checked: true, incomplete: true, missing: ['studentId', 'programId', 'scholarshipTypeId'] });
    }
  }, [user, token]);

  // Re-checked on every navigation, so the gate lifts as soon as the profile is saved.
  useEffect(() => { check(); }, [check, location.pathname]);

  const onProfilePage = location.pathname === '/my-profile';
  const blocking = state.checked && state.incomplete;

  // Anywhere else in the app, send them to the one page they can act on. Redirecting rather
  // than only covering the screen means the browser back button can't slip behind the gate.
  useEffect(() => {
    if (blocking && !onProfilePage) navigate('/my-profile', { replace: true });
  }, [blocking, onProfilePage, navigate]);

  if (!blocking) return null;

  const steps = [
    { key: 'studentId',         Icon: IdCard,         label: 'Student ID',  hint: 'Your PSU student number' },
    { key: 'programId',         Icon: GraduationCap,  label: 'Program',     hint: 'The degree you are enrolled in' },
    { key: 'scholarshipTypeId', Icon: Award,          label: 'Scholarship', hint: 'The scholarship you hold' },
  ];

  // On the profile page the gate steps aside — it would cover the very form it is asking
  // them to fill in. A pinned bar keeps the reason and the remaining fields on screen without
  // taking part in the page's layout, which matters because this component renders above
  // <Routes>, outside the sidebar shell.
  if (onProfilePage) {
    return (
      <div
        role="status"
        className="clay-card px-4 py-3 flex items-start gap-3"
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 20,
          zIndex: 9300,           // above the page, below modals (9500) and confirms (9600)
          maxWidth: 'min(560px, calc(100vw - 32px))',
          borderLeft: '4px solid #f5b800',
        }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent-wash)' }}>
          <UserCog size={17} style={{ color: 'var(--accent)' }} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--text-strong)' }}>
            Finish your profile to unlock the system
          </p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text)' }}>
            Still needed: {steps.filter(s => state.missing.includes(s.key)).map(s => s.label).join(', ')}.
            Until these are saved you can’t submit documents or use the rest of e-Iskolar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 9997 }}>
      <div className="modal-panel clay-card-modal" style={{ maxWidth: 480, padding: 32 }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--accent-wash)', border: '2px solid var(--accent-soft-border)' }}>
          <UserCog size={26} style={{ color: 'var(--accent-strong)' }} strokeWidth={2} />
        </div>
        <h2 className="font-black text-lg mb-2 text-center" style={{ color: 'var(--text-strong)' }}>
          Welcome, {user?.firstName || 'Scholar'}!
        </h2>
        <p className="text-sm mb-5 leading-relaxed text-center" style={{ color: 'var(--text)' }}>
          One step before you start. e-Iskolar works out your requirements, deadlines, and GWA
          standing from your profile, so it needs these three details before anything else.
        </p>

        <ul className="space-y-2 mb-6">
          {steps.map(({ key, Icon, label, hint }) => {
            const done = !state.missing.includes(key);
            return (
              <li key={key} className="clay-card-inner flex items-center gap-3 px-3.5 py-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: done ? 'rgba(16,160,96,0.14)' : 'var(--accent-wash)',
                    color: done ? '#10a060' : 'var(--accent)',
                  }}>
                  {done ? <Check size={15} strokeWidth={3} /> : <Icon size={15} strokeWidth={2.2} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-strong)' }}>{label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <button onClick={() => navigate('/my-profile')}
          className="clay-btn clay-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
          Set up my profile
          <ArrowRight size={16} strokeWidth={2.5} />
        </button>
        {/* Signing out is the only other way past this — deliberately, so an unfinished
            profile can't be parked and forgotten. */}
        <button onClick={signOut} className="clay-btn clay-btn-ghost w-full py-2.5 text-sm mt-2.5">
          Sign out
        </button>
      </div>
    </div>
  );
}
