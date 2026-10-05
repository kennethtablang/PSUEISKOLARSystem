import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X, ChevronLeft, ChevronRight, Sparkles, LayoutDashboard, FolderOpen, MessageSquare,
  Bell, User, GraduationCap, FileCheck, CalendarClock, Megaphone, BarChart2, Users, Settings,
  UserCheck, Award, Banknote, BanknoteArrowUp, Activity,
  HelpCircle, Search, Sun, CheckCircle2,
} from 'lucide-react';

/**
 * The guided tour.
 *
 * Two things make it a tour rather than a slideshow:
 *
 *  1. It **drives the app**. Each step carries a `route`, so the page behind the overlay is
 *     the page being described. You watch the system work rather than reading about it.
 *  2. The card is **anchored to what it's pointing at** — placed beside the spotlight and
 *     flipped to whichever side has room, instead of parked at the bottom of the screen
 *     while the highlight sits somewhere else entirely.
 *
 * Steps are ordered as the work actually flows: for staff, a scholar arrives → is approved →
 * is placed on a scholarship → submits documents → is reviewed → is paid → is reported on.
 *
 * `target` is a `data-tour` key. Only persistent chrome (sidebar nav, topbar) carries those,
 * because a target that lives on one page would vanish the moment the tour moved on.
 */

const WELCOME = {
  Icon: Sparkles,
  title: null, // filled in with the user's name
  body: null,
};

const SCHOLAR_STEPS = [
  {
    target: '/dashboard', route: '/dashboard', Icon: LayoutDashboard, title: 'Your dashboard',
    body: 'Where you land every time you sign in: your GWA standing, how much of your document checklist is done, what is due soon, and the latest announcements.',
  },
  {
    target: '/my-profile', route: '/my-profile', Icon: User, title: 'Start with your profile',
    body: 'Your student ID, program, and scholarship go here. e-Iskolar works out which documents you owe and which GWA you are held to from these three answers — so nothing else unlocks until they are saved.',
  },
  {
    target: '/my-documents', route: '/my-documents', Icon: FolderOpen, title: 'Your document checklist',
    body: 'Every document your scholarship requires, in the order the office wants them. Each row shows a sample of what a correct submission looks like — check it before you upload.',
  },
  {
    target: '/my-documents', route: '/my-documents', Icon: FileCheck, title: 'Uploading and what happens next',
    body: 'Upload a file and it goes to your coordinator as Pending. They mark it Under Review while checking it, then Verified, or Rejected with a note telling you what to fix. Re-upload as many times as you need until it clears.',
  },
  {
    target: '/my-documents', route: '/my-documents', Icon: CalendarClock, title: 'Deadlines',
    body: 'Requirements with a due date show a countdown, and turn red once they are overdue. You are reminded by email and in-app three days before — but the countdown is always here.',
  },
  {
    target: '/messages', route: '/messages', Icon: MessageSquare, title: 'Ask your coordinator',
    body: 'Start a conversation about a specific requirement or a general question. Replies arrive in real time and by email, so you are not left guessing.',
  },
  {
    target: 'notifications', Icon: Bell, title: 'Your notifications',
    body: 'The bell lights up the moment a document is reviewed, an announcement is posted, a deadline nears, or a scholarship payout is released. Click through to go straight to what changed.',
  },
  {
    target: 'theme', Icon: Sun, title: 'Light, dark, or automatic',
    body: 'Cycle the theme here. “System” follows your device, so e-Iskolar goes dark when the rest of your machine does.',
  },
  {
    target: 'account', route: '/profile', Icon: User, title: 'Account and privacy',
    body: 'Your photo, password, and two-factor sign-in live here — along with which emails you receive, and a button to download every piece of data we hold about you.',
  },
  {
    target: '/help', route: '/help', Icon: HelpCircle, title: 'Help whenever you need it',
    body: 'Answers to the questions scholars ask most. This tour can be replayed any time from here or from your profile.',
  },
];

const COORDINATOR_STEPS = [
  {
    target: '/dashboard', route: '/dashboard', Icon: LayoutDashboard, title: 'Your dashboard',
    body: 'The queues that need you: documents waiting on review, scholars whose GWA has slipped, registrations awaiting approval, and recent activity across the system.',
  },
  {
    target: '/scholar-approvals', route: '/scholar-approvals', Icon: UserCheck, title: 'Step 1 — approve the registration',
    body: 'Scholars who sign up land here first. Until you approve them they cannot submit a single document, so this queue is the front door of the whole system.',
  },
  {
    target: '/scholarship-types', route: '/scholarship-types', Icon: Award, title: 'Step 2 — define the scholarship',
    body: 'A scholarship type carries its GWA ceiling, its slot limit, the documents it demands with their deadlines, and how it pays out — one-time, per semester, or per year. Everything downstream reads these settings.',
  },
  {
    target: '/master-list', route: '/master-list', Icon: GraduationCap, title: 'Step 3 — the roster',
    body: 'Every scholar and grantee once, with all their scholarships and grants. Each scholarship type also lists its own scholars, its cross-matching list of who may sign up, and its documents with their deadline — open the type to work in it.',
  },
  {
    target: '/document-review', route: '/document-review', Icon: FileCheck, title: 'Step 4 — review what comes in',
    body: 'Open a scholar to see every document they sent; verify each, or reject it with feedback the scholar sees and can act on. Tick several and clear them in one pass when the batch is straightforward.',
  },
  {
    target: '/scholarship-releases', route: '/scholarship-releases', Icon: BanknoteArrowUp, title: 'Step 5 — pay the scholars',
    body: 'Pick a scholarship and a period to see every holder and whether they have actually been paid. “Not recorded” means nobody has even scheduled their payout — the state you most need to catch.',
  },
  {
    target: '/one-time-grants', route: '/one-time-grants', Icon: Banknote, title: 'One-off assistance',
    body: 'Allowances and top-ups awarded on top of a scholarship. Each is tracked from award to release with its own reference number, and filed under the scholarship it belongs to.',
  },
  {
    target: '/announcements', route: '/announcements', Icon: Megaphone, title: 'Reaching scholars',
    body: 'Post to everyone, to one scholarship or program, or to named individuals. Attach an image, add a button that drops them on the right page, and schedule it to go out later.',
  },
  {
    target: '/messages', route: '/messages', Icon: MessageSquare, title: 'One-to-one conversations',
    body: 'Threads with individual scholars, optionally tied to a requirement so the context is obvious. They get your reply in-app and by email.',
  },
  {
    target: '/analytics', route: '/analytics', Icon: BarChart2, title: 'Step 6 — see the whole picture',
    body: 'Compliance, submissions, scholar distribution, semester-over-semester comparison, and disbursement coverage — updating live as work happens. Export any of it to Excel or PDF.',
  },
  {
    target: 'search', Icon: Search, title: 'Find anything, fast',
    body: 'One field across scholars, announcements, and requirements. Type a name or a student number and go straight there instead of hunting through filters.',
  },
  {
    target: 'notifications', Icon: Bell, title: 'Stay in the loop',
    body: 'Real-time alerts for new submissions, messages, and approaching deadlines. Mute the categories you do not want without losing the ones you do.',
  },
];

const ADMIN_EXTRA = [
  {
    target: '/users', route: '/users', Icon: Users, title: 'Accounts',
    body: 'Create staff and scholar accounts one at a time, or import a whole cohort from a spreadsheet — the importer validates every row and tells you precisely which ones failed and why.',
  },
  {
    target: '/settings', route: '/settings', Icon: Settings, title: 'System settings',
    body: 'The active semester, session timeout, submission and upload rules, privacy notice, automatic reminders, backups, and sample data. Everything here changes how the system behaves for everyone.',
  },
  {
    target: '/activity-log', route: '/activity-log', Icon: Activity, title: 'The audit trail',
    body: 'Every create, update, approval, review, and release, with who did it and when. Searchable, filterable, and exportable — this is your answer when someone asks what happened.',
  },
];

function stepsFor(role) {
  if (role === 'Scholar') return SCHOLAR_STEPS;
  if (role === 'Administrator') return [...COORDINATOR_STEPS, ...ADMIN_EXTRA];
  return COORDINATOR_STEPS;
}

const PAD = 6;        // spotlight padding around the target
const GAP = 16;       // distance between the spotlight and the card
const MARGIN = 16;    // keep the card this far from the viewport edge
const CARD_W = 400;

export default function Tutorial({ role, userName, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const welcome = {
    ...WELCOME,
    title: `Welcome, ${userName?.split(' ')[0] ?? 'there'}!`,
    body: role === 'Scholar'
      ? 'A quick walk through e-Iskolar. We’ll move through the system as you’ll actually use it — from setting up your profile to getting your documents verified. Replay it any time from Help.'
      : 'A quick walk through e-Iskolar, following the order the work actually happens: a scholar registers, gets approved, submits, is reviewed, is paid, and shows up in the reports. Replay it any time from Help.',
  };
  const finish = {
    Icon: CheckCircle2,
    title: 'That’s the tour',
    body: role === 'Scholar'
      ? 'Start by completing your profile, then work down your document checklist. Your coordinator is a message away if anything is unclear.'
      : 'Nothing here is one-way — every action is audit-logged and most are reversible. Start with whatever queue is largest on your dashboard.',
  };

  const steps = [welcome, ...stepsFor(role), finish];
  const [i, setI] = useState(0);
  const step = steps[i];
  const { Icon } = step;
  const last = i === steps.length - 1;

  // Where the tour started, so finishing doesn't strand the user on the last page it visited.
  const originRef = useRef(location.pathname);

  // Drive the app: the page behind the overlay is the page being described.
  useEffect(() => {
    if (step.route && location.pathname !== step.route) navigate(step.route);
    // location.pathname is deliberately not a dependency — this fires on step change only,
    // so a user navigating mid-tour isn't yanked back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  function finishTour() {
    if (originRef.current && originRef.current !== location.pathname) navigate(originRef.current);
    onClose();
  }

  // Measure the highlighted element (re-measures on resize, scroll, and step change).
  const [rect, setRect] = useState(null);
  const cardRef = useRef(null);
  const [cardH, setCardH] = useState(260);

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
    raf = requestAnimationFrame(measure); // settle after any scroll or route change
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const iv = setInterval(measure, 400);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      clearInterval(iv);
    };
  }, [step.target, i]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [i, rect]);

  const hole = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  const place = placeCard(hole, cardH);
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
          <div style={{
            position: 'fixed', top: hole.top, left: hole.left, width: hole.width, height: hole.height,
            border: '2.5px solid #f5b800', borderRadius: 12, boxShadow: '0 0 0 3px rgba(245,184,0,0.28)',
            pointerEvents: 'none', animation: 'tourPulse 1.6s ease-in-out infinite',
          }} />
        </>
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: DIM }} />
      )}

      {/* Guide card — anchored beside whatever is highlighted */}
      <div
        ref={cardRef}
        className="clay-card-modal p-6 fade-up"
        style={{
          position: 'fixed',
          width: `min(${CARD_W}px, calc(100vw - ${MARGIN * 2}px))`,
          zIndex: 9991,
          transition: 'top 0.22s cubic-bezier(0.4,0,0.2,1), left 0.22s cubic-bezier(0.4,0,0.2,1)',
          ...place.style,
        }}
      >
        {/* A small arrow pointing back at the spotlight, so the link between the card and
            the highlight survives even when they end up far apart on a wide screen. */}
        {place.arrow && <span style={place.arrow} />}

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Step {i + 1} of {steps.length}
          </span>
          <button onClick={finishTour} aria-label="Close tour"
            className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/5">
            <X size={15} style={{ color: 'var(--text-muted)' }} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent-wash)', border: '1.5px solid var(--accent-soft-border)' }}>
            <Icon size={22} style={{ color: 'var(--accent)' }} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 className="text-base font-black mb-1" style={{ color: 'var(--text-strong)' }}>{step.title}</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{step.body}</p>
          </div>
        </div>

        {/* A dot per step is unreadable past a dozen; a progress bar scales. */}
        <div className="clay-progress-track w-full mb-4" style={{ height: 5 }}>
          <div className="clay-progress-fill" style={{
            width: `${((i + 1) / steps.length) * 100}%`,
            background: 'linear-gradient(90deg, var(--accent-bar-from), var(--accent-bar-to))',
          }} />
        </div>

        <div className="flex items-center gap-3">
          {i > 0 ? (
            <button onClick={() => setI(i - 1)} className="clay-btn clay-btn-ghost px-4 py-2.5 text-sm flex items-center gap-1.5">
              <ChevronLeft size={15} strokeWidth={2.5} /> Back
            </button>
          ) : (
            <button onClick={finishTour} className="clay-btn clay-btn-ghost px-4 py-2.5 text-sm">Skip</button>
          )}
          <button
            onClick={() => (last ? finishTour() : setI(i + 1))}
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

/**
 * Places the card beside the spotlight, trying right → left → below → above and taking the
 * first side with room. Falls back to centring when there is no target (the welcome and
 * closing steps) or when nothing fits — a card half off-screen is worse than a centred one.
 */
function placeCard(hole, cardH) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - MARGIN * 2);

  if (!hole) {
    return {
      style: {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      },
      arrow: null,
    };
  }

  const clampTop = t => Math.max(MARGIN, Math.min(t, vh - cardH - MARGIN));
  const clampLeft = l => Math.max(MARGIN, Math.min(l, vw - w - MARGIN));
  const centreY = hole.top + hole.height / 2;
  const centreX = hole.left + hole.width / 2;

  const arrowBase = {
    position: 'absolute',
    width: 12,
    height: 12,
    background: 'var(--surface-modal)',
    transform: 'rotate(45deg)',
  };

  // Right of the target — the usual outcome, since most anchors are sidebar items.
  if (hole.left + hole.width + GAP + w <= vw - MARGIN) {
    const top = clampTop(centreY - cardH / 2);
    return {
      style: { left: hole.left + hole.width + GAP, top },
      arrow: {
        ...arrowBase,
        left: -6,
        top: Math.max(16, Math.min(centreY - top - 6, cardH - 28)),
      },
    };
  }

  // Left of the target.
  if (hole.left - GAP - w >= MARGIN) {
    const top = clampTop(centreY - cardH / 2);
    return {
      style: { left: hole.left - GAP - w, top },
      arrow: {
        ...arrowBase,
        right: -6,
        top: Math.max(16, Math.min(centreY - top - 6, cardH - 28)),
      },
    };
  }

  // Below the target.
  if (hole.top + hole.height + GAP + cardH <= vh - MARGIN) {
    const left = clampLeft(centreX - w / 2);
    return {
      style: { left, top: hole.top + hole.height + GAP },
      arrow: {
        ...arrowBase,
        top: -6,
        left: Math.max(16, Math.min(centreX - left - 6, w - 28)),
      },
    };
  }

  // Above the target.
  if (hole.top - GAP - cardH >= MARGIN) {
    const left = clampLeft(centreX - w / 2);
    return {
      style: { left, top: hole.top - GAP - cardH },
      arrow: {
        ...arrowBase,
        bottom: -6,
        left: Math.max(16, Math.min(centreX - left - 6, w - 28)),
      },
    };
  }

  // Nothing fits — centre it and drop the arrow rather than point at nothing.
  return {
    style: { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
    arrow: null,
  };
}
