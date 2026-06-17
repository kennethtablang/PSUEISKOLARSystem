import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import { useTitle } from '../hooks/useTitle';
import { Lock, ShieldCheck, KeyRound, CheckCircle, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';

const TIPS = [
  { Icon: Lock,        label: 'Strong Password', desc: 'Use 8+ characters with letters and numbers' },
  { Icon: ShieldCheck, label: 'Stay Secure',     desc: 'Never share or reuse your old password' },
  { Icon: KeyRound,    label: 'Instant Effect',  desc: 'Your new password is active immediately' },
  { Icon: CheckCircle, label: 'One-Time Link',   desc: 'This reset link is single-use only' },
];

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useTitle('Reset Password');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!email || !token) {
      setError('Invalid or expired reset link. Please request a new one.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email, token, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#e8edf5' }}>

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden"
        style={{ background: '#002570' }}>

        {/* Background geometry */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute w-[600px] h-[600px] rounded-full"
            style={{ top: '-200px', right: '-200px', background: 'radial-gradient(circle, rgba(245,184,0,0.18) 0%, transparent 70%)' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full"
            style={{ bottom: '-150px', left: '-100px', background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots3" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots3)" />
          </svg>
        </div>

        {/* Tumbling geometric shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* 1. Hexagon outline — gold, top-left */}
          <div style={{
            position: 'absolute', top: '5%', left: '7%',
            width: 76, height: 76,
            border: '1.5px solid rgba(245,184,0,0.22)',
            clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
            animation: 'shape-tumble-r 10s ease-in-out infinite',
          }} />
          {/* 2. Circle fill — white, upper-right */}
          <div style={{
            position: 'absolute', top: '6%', right: '9%',
            width: 52, height: 52,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '50%',
            animation: 'shape-tumble-l 12s ease-in-out infinite',
            animationDelay: '-4s',
          }} />
          {/* 3. Tiny star — gold, top-center */}
          <div style={{
            position: 'absolute', top: '7%', left: '43%',
            width: 22, height: 22,
            background: 'rgba(245,184,0,0.28)',
            clipPath: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
            animation: 'shape-tumble-spin 5s ease-in-out infinite',
            animationDelay: '-2s',
          }} />
          {/* 4. Pentagon outline — white, upper-center-right */}
          <div style={{
            position: 'absolute', top: '15%', left: '57%',
            width: 50, height: 50,
            border: '1.5px solid rgba(255,255,255,0.10)',
            clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
            animation: 'shape-tumble-up 9s ease-in-out infinite',
            animationDelay: '-3s',
          }} />
          {/* 5. Diamond outline — gold, mid-left */}
          <div style={{
            position: 'absolute', top: '24%', left: '5%',
            width: 56, height: 56,
            border: '1.5px solid rgba(245,184,0,0.20)',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            animation: 'shape-tumble-arc 13s ease-in-out infinite',
            animationDelay: '-6s',
          }} />
          {/* 6. Square fill — white, mid-right */}
          <div style={{
            position: 'absolute', top: '28%', right: '7%',
            width: 54, height: 54,
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 8,
            animation: 'shape-tumble-d 11s ease-in-out infinite',
            animationDelay: '-5s',
          }} />
          {/* 7. Cross — gold, center-left */}
          <div style={{
            position: 'absolute', top: '38%', left: '4%',
            width: 36, height: 36,
            background: 'rgba(245,184,0,0.15)',
            clipPath: 'polygon(33% 0%,67% 0%,67% 33%,100% 33%,100% 67%,67% 67%,67% 100%,33% 100%,33% 67%,0% 67%,0% 33%,33% 33%)',
            animation: 'shape-tumble-r 8s ease-in-out infinite',
            animationDelay: '-7s',
          }} />
          {/* 8. Triangle up — white, center */}
          <div style={{
            position: 'absolute', top: '42%', left: '36%',
            width: 54, height: 46,
            background: 'rgba(255,255,255,0.07)',
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            animation: 'shape-tumble-l 14s ease-in-out infinite',
            animationDelay: '-9s',
          }} />
          {/* 9. Octagon — white, right */}
          <div style={{
            position: 'absolute', top: '46%', right: '8%',
            width: 48, height: 48,
            border: '1.5px solid rgba(255,255,255,0.09)',
            clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
            animation: 'shape-tumble-spin 10s ease-in-out infinite',
            animationDelay: '-4s',
          }} />
          {/* 10. Small diamond fill — gold, center */}
          <div style={{
            position: 'absolute', top: '52%', left: '57%',
            width: 20, height: 20,
            background: 'rgba(245,184,0,0.24)',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            animation: 'shape-tumble-up 4.5s ease-in-out infinite',
            animationDelay: '-1s',
          }} />
          {/* 11. Hexagon fill — gold, lower-left */}
          <div style={{
            position: 'absolute', top: '60%', left: '9%',
            width: 52, height: 52,
            background: 'rgba(245,184,0,0.14)',
            clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
            animation: 'shape-tumble-arc 11s ease-in-out infinite',
            animationDelay: '-5s',
          }} />
          {/* 12. Rectangle outline — white, lower-right */}
          <div style={{
            position: 'absolute', top: '65%', right: '5%',
            width: 84, height: 40,
            border: '1.5px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            animation: 'shape-tumble-r 13s ease-in-out infinite',
            animationDelay: '-2s',
          }} />
          {/* 13. Inverted triangle — white, lower-center */}
          <div style={{
            position: 'absolute', top: '72%', left: '36%',
            width: 46, height: 40,
            background: 'rgba(255,255,255,0.07)',
            clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
            animation: 'shape-tumble-l 10s ease-in-out infinite',
            animationDelay: '-8s',
          }} />
          {/* 14. Large circle outline — white, bottom-left */}
          <div style={{
            position: 'absolute', bottom: '5%', left: '4%',
            width: 94, height: 94,
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '50%',
            animation: 'shape-tumble-d 17s ease-in-out infinite',
            animationDelay: '-10s',
          }} />
          {/* 15. Star fill — gold, bottom-center */}
          <div style={{
            position: 'absolute', bottom: '9%', left: '48%',
            width: 34, height: 34,
            background: 'rgba(245,184,0,0.17)',
            clipPath: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
            animation: 'shape-tumble-spin 6.5s ease-in-out infinite',
            animationDelay: '-3s',
          }} />
          {/* 16. Square — white, bottom-right */}
          <div style={{
            position: 'absolute', bottom: '7%', right: '11%',
            width: 28, height: 28,
            background: 'rgba(255,255,255,0.09)',
            borderRadius: 4,
            animation: 'shape-tumble-up 7s ease-in-out infinite',
            animationDelay: '-6s',
          }} />
          {/* 17. Pentagon fill — gold, bottom-far-right */}
          <div style={{
            position: 'absolute', bottom: '20%', right: '3%',
            width: 42, height: 42,
            background: 'rgba(245,184,0,0.12)',
            clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
            animation: 'shape-tumble-r 9s ease-in-out infinite',
            animationDelay: '-4s',
          }} />
          {/* 18. Small square outline — gold, mid */}
          <div style={{
            position: 'absolute', top: '33%', left: '23%',
            width: 22, height: 22,
            border: '1.5px solid rgba(245,184,0,0.22)',
            borderRadius: 3,
            animation: 'shape-tumble-l 5.5s ease-in-out infinite',
            animationDelay: '-2s',
          }} />
        </div>

        <div className="relative z-10 flex flex-col h-full p-12">

          {/* Top: Wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0"
              style={{ background: '#f5b800', color: '#002570', boxShadow: '0 4px 0px rgba(0,0,0,0.25)' }}>
              PSU
            </div>
            <div>
              <p className="font-black text-xl text-white leading-tight tracking-tight">e-Iskolar</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Lingayen Campus</p>
            </div>
          </div>

          {/* Center: Headline */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-8">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-5"
                style={{ background: 'rgba(245,184,0,0.15)', color: '#f5d060', border: '1px solid rgba(245,184,0,0.25)' }}>
                Password Recovery
              </span>

              <h1 className="text-[2.75rem] font-black text-white leading-[1.1] mb-4"
                style={{ letterSpacing: '-1px' }}>
                Secure Your<br />
                <span style={{ color: '#f5b800' }}>Account</span><br />
                Again.
              </h1>

              <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '340px' }}>
                Create a strong new password to regain full access to your PSU e-Iskolar account.
              </p>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-3">
              {TIPS.map(({ Icon, label, desc }) => (
                <div key={label} className="p-4 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: 'rgba(245,184,0,0.15)', border: '1px solid rgba(245,184,0,0.2)' }}>
                    <Icon size={15} color="#f5b800" strokeWidth={2.5} />
                  </div>
                  <p className="text-xs font-bold text-white leading-tight mb-1">{label}</p>
                  <p className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            PSU e-Iskolar · Scholar Profiling and Records Management System
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12"
        style={{ background: '#e8edf5' }}>

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-8 lg:hidden">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm"
            style={{ background: '#002570', color: '#f5b800', boxShadow: '0 3px 0px #001a4a' }}>
            PSU
          </div>
          <div>
            <p className="font-black text-base leading-tight" style={{ color: '#0d1a33' }}>e-Iskolar</p>
            <p className="text-xs" style={{ color: '#7a8aaa' }}>Lingayen Campus</p>
          </div>
        </div>

        <div className="w-full" style={{ maxWidth: '420px' }}>

          {/* Header */}
          <div className="mb-6 px-1">
            <h2 className="text-2xl font-black" style={{ color: '#0d1a33' }}>Set New Password</h2>
            <p className="text-sm mt-1" style={{ color: '#4a5a7a' }}>
              {email ? `Resetting password for ${email}` : 'Enter your new password below.'}
            </p>
          </div>

          {/* Card */}
          <div className="clay-card-modal p-8">

            {success ? (
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(0,48,135,0.08)', border: '2px solid rgba(0,48,135,0.15)' }}>
                  <ShieldCheck size={26} color="#002570" strokeWidth={2} />
                </div>
                <p className="font-black text-lg mb-1" style={{ color: '#0d1a33' }}>Password Updated!</p>
                <p className="text-sm mb-6" style={{ color: '#4a5a7a' }}>
                  Your password has been reset successfully. You can now sign in with your new credentials.
                </p>
                <button
                  onClick={() => navigate('/login')}
                  className="clay-btn clay-btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2">
                  Sign In Now
                  <ArrowRight size={15} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <>
                {(!email || !token) && (
                  <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-2xl text-sm"
                    style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
                    <AlertTriangle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
                    <span>Invalid or missing reset link. Please request a new one from the login page.</span>
                  </div>
                )}

                {error && (
                  <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-2xl text-sm"
                    style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
                    <AlertTriangle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
                      style={{ color: '#4a5a7a' }}>
                      New Password
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Lock size={15} color="#7a8aaa" strokeWidth={2} />
                      </span>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="clay-input"
                        style={{ paddingLeft: '38px' }}
                        autoComplete="new-password"
                        disabled={!email || !token}
                      />
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
                      style={{ color: '#4a5a7a' }}>
                      Confirm Password
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Lock size={15} color="#7a8aaa" strokeWidth={2} />
                      </span>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="clay-input"
                        style={{ paddingLeft: '38px' }}
                        autoComplete="new-password"
                        disabled={!email || !token}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !email || !token}
                    className="clay-btn clay-btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2 mt-2"
                    style={{ opacity: (submitting || !email || !token) ? 0.55 : 1 }}>
                    {submitting ? 'Resetting…' : (
                      <>
                        Reset Password
                        <ArrowRight size={15} strokeWidth={2.5} />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Back to login */}
          <div className="text-center mt-5">
            <Link to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color: '#4a5a7a' }}>
              <ArrowLeft size={13} strokeWidth={2.5} />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
