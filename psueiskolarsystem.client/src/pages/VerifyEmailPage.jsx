import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../api/auth';
import { useTitle } from '../hooks/useTitle';
import { MailCheck, AlertTriangle, ArrowRight, Loader } from 'lucide-react';

export default function VerifyEmailPage() {
  useTitle('Verify Email');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const email = searchParams.get('email');
    const token = searchParams.get('token');

    if (!email || !token) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email and try again.');
      return;
    }

    verifyEmail(email, token)
      .then(() => setStatus('success'))
      .catch(err => {
        setStatus('error');
        setMessage(err.message);
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full" style={{ maxWidth: '440px' }}>

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm"
            style={{ background: '#002570', color: '#f5b800', boxShadow: '0 3px 0px #001a4a' }}>
            PSU
          </div>
          <div>
            <p className="font-black text-lg leading-tight" style={{ color: 'var(--text-strong)' }}>e-Iskolar</p>
            <p className="text-xs" style={{ color: '#7a8aaa' }}>Lingayen Campus</p>
          </div>
        </div>

        <div className="clay-card-modal p-8 text-center">

          {status === 'verifying' && (
            <>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(0,37,112,0.08)', border: '2px solid rgba(0,37,112,0.15)' }}>
                <Loader size={28} color="#002570" strokeWidth={2} className="animate-spin" />
              </div>
              <p className="font-black text-lg mb-2" style={{ color: 'var(--text-strong)' }}>Verifying your email…</p>
              <p className="text-sm" style={{ color: 'var(--text)' }}>Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(22,163,74,0.10)', border: '2px solid rgba(22,163,74,0.25)' }}>
                <MailCheck size={28} color="#16a34a" strokeWidth={2} />
              </div>
              <p className="font-black text-lg mb-2" style={{ color: 'var(--text-strong)' }}>Email Verified!</p>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text)' }}>
                Your account has been successfully verified. You can now sign in to PSU e-Iskolar.
              </p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="clay-btn clay-btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2">
                Sign In to Your Account
                <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: '#fff0f0', border: '2px solid #f5b0b0' }}>
                <AlertTriangle size={28} color="#b03030" strokeWidth={2} />
              </div>
              <p className="font-black text-lg mb-2" style={{ color: 'var(--text-strong)' }}>Verification Failed</p>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text)' }}>
                {message || 'This verification link is invalid or has expired. Please register again to receive a new link.'}
              </p>
              <button
                onClick={() => navigate('/register', { replace: true })}
                className="clay-btn clay-btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2">
                Back to Registration
                <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </>
          )}

        </div>

        <p className="text-center text-xs mt-5" style={{ color: '#9aaabb' }}>
          PSU e-Iskolar · Scholar Profiling and Records Management System
        </p>
      </div>
    </div>
  );
}
