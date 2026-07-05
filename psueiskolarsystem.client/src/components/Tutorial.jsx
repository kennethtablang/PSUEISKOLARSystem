import { useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Sparkles, LayoutDashboard, FolderOpen, MessageSquare,
  Bell, User, GraduationCap, FileCheck, CalendarClock, Megaphone, BarChart2, Users, Settings,
} from 'lucide-react';

const SCHOLAR_STEPS = [
  { Icon: LayoutDashboard, title: 'Your Dashboard', body: 'See your GWA status, document compliance progress, and the latest announcements the moment you sign in.' },
  { Icon: FolderOpen, title: 'My Documents', body: 'Upload each required document, view a sample of what to submit, watch your deadlines, and track whether each is Verified, Pending, or Incomplete.' },
  { Icon: MessageSquare, title: 'Messages', body: 'Have a question? Message your coordinator directly and get replies in real time (and by email).' },
  { Icon: Bell, title: 'Notifications', body: 'The bell in the top bar lights up in real time for document reviews, new announcements, and approaching deadlines.' },
  { Icon: User, title: 'Your Profile & Privacy', body: 'Update your info, choose which emails you receive, and download a copy of your personal data anytime.' },
];

const COORDINATOR_STEPS = [
  { Icon: GraduationCap, title: 'Scholars', body: 'Search and filter scholars by campus, program, scholarship type, compliance, or status — and open any profile with grades and a GWA trend chart.' },
  { Icon: FileCheck, title: 'Document Review', body: 'Verify or flag submissions with feedback. Select several at once to review them in bulk.' },
  { Icon: CalendarClock, title: 'Deadlines', body: 'Set submission deadlines per requirement and watch a live compliance report of who is on-time, late, or missing.' },
  { Icon: Megaphone, title: 'Announcements', body: 'Post notices with images and an action button that sends scholars straight to the right page.' },
  { Icon: BarChart2, title: 'Data Visualization', body: 'Explore charts of scholar distribution and compliance, and export reports to Excel.' },
];

const ADMIN_EXTRA = [
  { Icon: Users, title: 'User Management', body: 'Create accounts one by one or import many scholars at once from a CSV/Excel file.' },
  { Icon: Settings, title: 'System Settings', body: 'Set the active semester, archive inactive scholars, and seed sample data. Every change is recorded in the Activity Log.' },
];

function stepsFor(role) {
  if (role === 'Scholar') return SCHOLAR_STEPS;
  if (role === 'Administrator') return [...COORDINATOR_STEPS, ...ADMIN_EXTRA];
  return COORDINATOR_STEPS;
}

export default function Tutorial({ role, userName, onClose }) {
  const first = { Icon: Sparkles, title: `Welcome, ${userName?.split(' ')[0] ?? 'there'}!`, body: "Here's a quick tour of PSU e-Iskolar. It only takes a few taps — you can replay it anytime from your Profile." };
  const steps = [first, ...stepsFor(role)];
  const [i, setI] = useState(0);
  const step = steps[i];
  const { Icon } = step;
  const last = i === steps.length - 1;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,20,60,0.6)', zIndex: 9990 }}>
      <div className="clay-card-modal w-full p-7" style={{ maxWidth: 440 }}>
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#9aa6bc' }}>
            Step {i + 1} of {steps.length}
          </span>
          <button onClick={onClose} className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/5">
            <X size={15} color="#7a8aaa" strokeWidth={2.5} />
          </button>
        </div>

        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(0,48,135,0.08)', border: '1.5px solid rgba(0,48,135,0.14)' }}>
          <Icon size={28} color="#003087" strokeWidth={2} />
        </div>

        <h2 className="text-lg font-black text-center mb-2" style={{ color: 'var(--text-strong)' }}>{step.title}</h2>
        <p className="text-sm text-center leading-relaxed mb-6" style={{ color: 'var(--text)' }}>{step.body}</p>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
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
