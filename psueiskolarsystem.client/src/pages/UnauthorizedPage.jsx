import { useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';

export default function UnauthorizedPage() {
  useTitle('Unauthorized');
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#e8edf5' }}>
      <div className="clay-card p-12 text-center max-w-sm w-full mx-4">
        <p className="text-6xl font-black mb-3" style={{ color: '#003087' }}>403</p>
        <p className="text-sm mb-6" style={{ color: '#4a5a7a' }}>You don&apos;t have permission to access this page.</p>
        <button
          onClick={() => navigate(-1)}
          className="clay-btn clay-btn-primary px-6 py-2.5 text-sm"
        >
          Go back
        </button>
      </div>
    </div>
  );
}
