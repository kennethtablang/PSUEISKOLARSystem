import { useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useTutorial } from '../context/TutorialContext';
import { useTitle } from '../hooks/useTitle';
import { HelpCircle, ChevronDown, ChevronUp, PlayCircle, Mail } from 'lucide-react';

// Role-tagged FAQ entries. Entries with no `roles` show for everyone.
const FAQS = [
  {
    q: 'How do I submit my scholarship documents?',
    a: 'Go to My Documents from the sidebar. Each required document has an Upload button — choose a PDF, JPG, PNG, DOC, or DOCX file (max 10 MB). You can re-submit until a coordinator verifies it.',
    roles: ['Scholar'],
  },
  {
    q: 'What do the document statuses mean?',
    a: 'Pending means a coordinator hasn’t reviewed it yet. Verified means it was accepted. Incomplete means it needs to be resubmitted — open the document to see the reviewer’s note.',
    roles: ['Scholar'],
  },
  {
    q: 'How is my GWA compliance determined?',
    a: 'Your latest recorded GWA is compared against your scholarship type’s minimum requirement. If it meets or beats the threshold you are compliant; otherwise your status is flagged for review.',
    roles: ['Scholar'],
  },
  {
    q: 'I didn’t receive my verification or reset email. What now?',
    a: 'Check your spam folder first. On the sign-in screen you can request a new verification link, and Forgot Password resends a reset link. If it still doesn’t arrive, contact your coordinator.',
  },
  {
    q: 'How do I record a scholar’s grade?',
    a: 'Open the scholar from Scholars, then use Record GWA. Grades can only be recorded for the active academic period or earlier — future periods are rejected.',
    roles: ['Administrator', 'ScholarshipCoordinator'],
  },
  {
    q: 'How do I post an announcement with an image?',
    a: 'From Announcements, create a new announcement. Images should be PNG/JPG/WEBP up to 10 MB; a 1200×400 (3:1) banner looks best since it is cropped to a wide banner.',
    roles: ['Administrator', 'ScholarshipCoordinator'],
  },
  {
    q: 'How do I export reports or the activity log?',
    a: 'Reports and the Activity Log each have an Export button that downloads an Excel (.xlsx) file reflecting your current filters.',
    roles: ['Administrator', 'ScholarshipCoordinator'],
  },
  {
    q: 'How long before I’m signed out for inactivity?',
    a: 'Sessions end after a period of inactivity (30 minutes by default). Administrators can change this under System Settings → Preferences; it applies to that browser.',
  },
  {
    q: 'Is my personal data protected?',
    a: 'Yes. In line with the Data Privacy Act (RA 10173) your data is used only for scholarship management and is accessible only to authorized staff. You can view and download your data from your profile.',
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="clay-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="text-sm font-bold" style={{ color: 'var(--text-strong)' }}>{q}</span>
        {open
          ? <ChevronUp size={16} strokeWidth={2.5} style={{ color: '#7a8aaa', flexShrink: 0 }} />
          : <ChevronDown size={16} strokeWidth={2.5} style={{ color: '#7a8aaa', flexShrink: 0 }} />}
      </button>
      {open && (
        <p className="px-5 pb-4 -mt-1 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{a}</p>
      )}
    </div>
  );
}

export default function HelpPage() {
  useTitle('Help & FAQ');
  const { user } = useAuth();
  const { openTutorial } = useTutorial();

  const faqs = FAQS.filter(f => !f.roles || f.roles.includes(user?.role));

  return (
    <Layout>
      <div className="p-8" style={{ maxWidth: 760 }}>
        <div className="mb-7">
          <h1 className="page-title flex items-center gap-2">
            <HelpCircle size={22} strokeWidth={2.2} style={{ color: '#003087' }} /> Help &amp; FAQ
          </h1>
          <p className="page-subtitle">Answers to common questions about using PSU e-Iskolar.</p>
          <span className="page-title-bar" />
        </div>

        {openTutorial && (
          <button onClick={openTutorial} className="clay-btn clay-btn-ghost px-4 py-2.5 text-sm flex items-center gap-2 mb-6">
            <PlayCircle size={15} strokeWidth={2.3} /> Replay the guided tour
          </button>
        )}

        <div className="space-y-3">
          {faqs.map(f => <FaqItem key={f.q} {...f} />)}
        </div>

        <div className="clay-card p-5 mt-6 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,48,135,0.08)' }}>
            <Mail size={16} strokeWidth={2.2} color="#003087" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-strong)' }}>Still need help?</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>
              Use the Messages page to reach a scholarship coordinator, or contact the PSU Lingayen scholarship office directly.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
