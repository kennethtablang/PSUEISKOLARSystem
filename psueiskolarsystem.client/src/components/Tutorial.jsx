import { useState, useLayoutEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight, Sparkles, LayoutDashboard, FolderOpen, MessageSquare,
  Bell, User, GraduationCap, FileCheck, CalendarClock, Megaphone, BarChart2, Users, Settings,
} from 'lucide-react';

// Each step optionally points at a real UI element via its data-tour key.
const SCHOLAR_STEPS = [
  { target: '/dashboard', Icon: LayoutDashboard, title: 'Your Dashboard', body: 'See your GWA status, document compliance progress, and the latest announcements the moment you sign in.' },
  { target: '/my-documents', Icon: FolderOpen, title: 'My Documents', body: 'Upload each required document, view a sample of what to submit, watch your deadlines, and track whether each is Verified, Pending, or Incomplete.' },
  { target: '/messages', Icon: MessageSquare, title: 'Messages', body: 'Have a question? Message your coordinator directly and get replies in real time (and by email).' },
  { target: 'notifications', Icon: Bell, title: 'Notifications', body: 'This bell lights up in real time for document reviews, new announcements, and approaching deadlines.' },
  { target: '/my-profile', Icon: User, title: 'Your Profile & Privacy', body: 'Update your info, choose which emails you receive, and download a copy of your personal data anytime.' },
];

const COORDINATOR_STEPS = [
  { target: '/scholars', Icon: GraduationCap, title: 'Scholars', body: 'Search and filter scholars by program, scholarship type, compliance, or status — and open any profile with grades and a GWA trend chart.' },
  { target: '/document-review', Icon: FileCheck, title: 'Document Review', body: 'Verify or flag submissions with feedback. Select several at once to review them in bulk.' },
  { target: '/deadlines', Icon: CalendarClock, title: 'Deadlines', body: 'Set submission deadlines per requirement and watch a live compliance report of who is on-time, late, or missing.' },
  { target: '/announcements', Icon: Megaphone, title: 'Announcements', body: 'Post notices with images and an action button that sends scholars straight to the right page.' },
  { target: '/analytics', Icon: BarChart2, title: 'Data Visualization', body: 'Explore charts of scholar distribution and compliance, and export reports to Excel.' },
];

const ADMIN_EXTRA = [
  { target: '/users', Icon: Users, title: 'User Management', body: 'Create accounts one by one or import many scholars at once from a CSV/Excel file.' },
  { target: '/settings', Icon: Settings, title: 'System Settings', body: 'Set the active semester, archive inactive scholars, and seed sample data. Every change is recorded in the Activity Log.' },
];

function stepsFor(role) {
  if (role === 'Scholar') return SCHOLAR_STEPS;
  if (role === 'Administrator') return [...COORDINATOR_STEPS, ...ADMIN_EXTRA];
  return COORDINATOR_STEPS;
}

const PAD = 6; // spotlight padding around the target

export default function Tutorial({ role, userName, onClose }) {
  const first = { Icon: Sparkles, title: `Welcome, ${userName?.split(' ')[0] ?? 'there'}!`, body: "Here's a quick guided tour of PSU e-Iskolar — we'll point out where everything is. You can replay it anytime from your Profile or the Help page." };
  const steps = [first, ...stepsFor(role)];
  const [i, setI] = useState(0);
  const step = steps[i];
  const { Icon } = step;
  const last = i === steps.length - 1;

  // Measure the highlighted element (re-measures on resize/step change).
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    if (!step.target) { setRect(null); return; }
    let raf;
    function measure() {
      const el = document.querySelector(`[data-tour="${CSS.escape(step.target)}"]`);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) { setRect(null); return; } // hidden (e.g. mobile drawer)
      el.scrollIntoView({ block: 'nearest' });
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    measure();
    raf = requestAnimationFrame(measure); // settle after any scroll
    window.addEventListener('resize', measure);
    const iv = setInterval(measure, 400);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); clearInterval(iv); };
  }, [step.target, i]);

  const hole = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  const DIM = 'rgba(0,20,60,0.62)';

  return (
    <div className="fixed inset-0" style={{ zIndex: 9990 }}>
      {/* Dim overlay — full when no target, else a 4-piece mask leaving a hole */}
      {hole ? (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: Math.max(0, hole.top), background: DIM }} />
          <div style={{ position: 'fixed', top: hole.top + hole.height, left: 0, right: 0, bottom: 0, background: DIM }} />
          <div style={{ position: 'fixed', top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height, background: DIM }} />
          <div style={{ position: 'fixed', top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height, background: DIM }} />
          {/* Highlight ring */}
          <div style={{
            position: 'fixed', top: hole.top, left: hole.left, width: hole.width, height: hole.height,
            border: '2.5px solid #f5b800', borderRadius: 12, boxShadow: '0 0 0 3px rgba(245,184,0,0.28)',
            pointerEvents: 'none', animation: 'tourPulse 1.6s ease-in-out infinite',
          }} />
        </>
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: DIM }} />
      )}

      {/* Guide card — fixed at the bottom so it never covers the left sidebar */}
      <div className="clay-card-modal p-6 fade-up" style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 24, width: 'calc(100% - 32px)', maxWidth: 420, zIndex: 9991,
      }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#9aa6bc' }}>
            Step {i + 1} of {steps.length}
          </span>
          <button onClick={onClose} className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/5">
            <X size={15} color="#7a8aaa" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,48,135,0.08)', border: '1.5px solid rgba(0,48,135,0.14)' }}>
            <Icon size={22} color="#003087" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 className="text-base font-black mb-1" style={{ color: 'var(--text-strong)' }}>{step.title}</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{step.body}</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-4">
          {steps.map((_, idx) => (
            <span key={idx} style={{
              width: idx === i ? 20 : 7, height: 7, borderRadius: 999,
              background: idx === i ? '#003087' : 'rgba(0,48,135,0.2)', transition: 'all 0.2s',
            }} />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {i > 0 ? (
            <button onClick={() => setI(i - 1)} className="clay-btn clay-btn-ghost px-4 py-2.5 text-sm flex items-center gap-1.5">
              <ChevronLeft size={15} strokeWidth={2.5} /> Back
            </button>
          ) : (
            <button onClick={onClose} className="clay-btn clay-btn-ghost px-4 py-2.5 text-sm">Skip</button>
          )}
          <button
            onClick={() => (last ? onClose() : setI(i + 1))}
            className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-1.5"
          >
            {last ? 'Get Started' : 'Next'}
            {!last && <ChevronRight size={15} strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    </div>
  );
}
