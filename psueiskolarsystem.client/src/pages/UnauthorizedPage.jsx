import { useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';

export default function UnauthorizedPage() {
  useTitle('Unauthorized');
  const navigate = useNavigate();

  /* "Go back" alone stranded anyone who arrived here directly — a shared link opened in a new
     tab has no in-app history, so going back left the system altogether. The dashboard is
     always a page every signed-in role may see. */
  const hasHistory = window.history.state?.idx > 0;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="clay-card p-12 text-center max-w-sm w-full mx-4">
        <p className="text-6xl font-black mb-3" style={{ color: 'var(--accent)' }}>403</p>
        <p className="text-sm mb-6" style={{ color: 'var(--text)' }}>You don&apos;t have permission to access this page.</p>
        <div className="flex gap-3 justify-center flex-wrap">
          {hasHistory && (
            <button
              onClick={() => navigate(-1)}
              className="clay-btn clay-btn-ghost px-6 py-2.5 text-sm"
            >
              Go back
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard', { replace: true })}
            className="clay-btn clay-btn-primary px-6 py-2.5 text-sm"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
