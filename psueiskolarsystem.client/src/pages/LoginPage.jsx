import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, forgotPassword, verifyTwoFactorLogin, resendVerification } from '../api/auth';
import { useTitle } from '../hooks/useTitle';
import { Mail, Lock, UserCheck, FolderUp, TrendingUp, Bell, ArrowRight, KeyRound, UserPlus, AlertTriangle, ShieldCheck, MailCheck } from 'lucide-react';
import Modal from '../components/Modal';

const HIGHLIGHTS = [
  { Icon: UserCheck,  label: 'Scholar Profiling',      desc: 'Academic records & personal information' },
  { Icon: FolderUp,   label: 'Document Submission',    desc: 'Upload and track compliance per semester' },
  { Icon: TrendingUp, label: 'Grade Monitoring',       desc: 'GWA tracking and requirement alerts' },
  { Icon: Bell,       label: 'Announcements',          desc: 'Deadlines and notices in one place' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [twoFa, setTwoFa] = useState(null); // { userId } when 2FA required
  const [resend, setResend] = useState({ busy: false, msg: '' });

  const needsVerification = /verified/i.test(error);

  async function handleResendVerification() {
    setResend({ busy: true, msg: '' });
    try {
      const data = await resendVerification(email);
      setResend({ busy: false, msg: data.message });
    } catch (err) {
      setResend({ busy: false, msg: err.message });
    }
  }

  useTitle('Sign In');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await login(email, password);
      if (data.requires2fa) {
        setTwoFa({ ticket: data.twoFaTicket });
      } else {
        signIn(data);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden"
        style={{ background: '#002570' }}>

        {/* Background geometry */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Large gold arc top-right */}
          <div className="absolute w-[600px] h-[600px] rounded-full"
            style={{
              top: '-200px', right: '-200px',
              background: 'radial-gradient(circle, rgba(245,184,0,0.18) 0%, transparent 70%)',
            }} />
          {/* Subtle bottom-left fill */}
          <div className="absolute w-[400px] h-[400px] rounded-full"
            style={{
              bottom: '-150px', left: '-100px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
            }} />
          {/* Grid dot pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* Tumbling geometric shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* 1. Large square outline — gold, top-left */}
          <div style={{
            position: 'absolute', top: '5%', left: '5%',
            width: 80, height: 80,
            border: '1.5px solid rgba(245,184,0,0.22)',
            borderRadius: 8,
            animation: 'shape-tumble-r 9s ease-in-out infinite',
          }} />
          {/* 2. Triangle up — white, upper-right */}
          <div style={{
            position: 'absolute', top: '8%', right: '10%',
            width: 58, height: 50,
            background: 'rgba(255,255,255,0.09)',
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            animation: 'shape-tumble-l 11s ease-in-out infinite',
            animationDelay: '-3s',
          }} />
          {/* 3. Tiny circle fill — gold, top-center */}
          <div style={{
            position: 'absolute', top: '6%', left: '40%',
            width: 18, height: 18,
            background: 'rgba(245,184,0,0.30)',
            borderRadius: '50%',
            animation: 'shape-tumble-spin 5s ease-in-out infinite',
            animationDelay: '-1s',
          }} />
          {/* 4. Pentagon outline — white, upper-center-right */}
          <div style={{
            position: 'absolute', top: '14%', left: '58%',
            width: 52, height: 52,
            border: '1.5px solid rgba(255,255,255,0.11)',
            clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
            animation: 'shape-tumble-r 10s ease-in-out infinite',
            animationDelay: '-4s',
          }} />
          {/* 5. Circle outline — white, mid-right */}
          <div style={{
            position: 'absolute', top: '22%', right: '5%',
            width: 65, height: 65,
            border: '1.5px solid rgba(255,255,255,0.10)',
            borderRadius: '50%',
            animation: 'shape-tumble-d 14s ease-in-out infinite',
            animationDelay: '-5s',
          }} />
          {/* 6. Diamond fill — gold, left */}
          <div style={{
            position: 'absolute', top: '28%', left: '7%',
            width: 44, height: 44,
            background: 'rgba(245,184,0,0.17)',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            animation: 'shape-tumble-r 7s ease-in-out infinite',
            animationDelay: '-2s',
          }} />
          {/* 7. Octagon outline — white, center */}
          <div style={{
            position: 'absolute', top: '34%', left: '34%',
            width: 56, height: 56,
            border: '1.5px solid rgba(255,255,255,0.08)',
            clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
            animation: 'shape-tumble-arc 13s ease-in-out infinite',
            animationDelay: '-7s',
          }} />
          {/* 8. Small triangle — gold, far-left */}
          <div style={{
            position: 'absolute', top: '38%', left: '2%',
            width: 32, height: 28,
            background: 'rgba(245,184,0,0.16)',
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            animation: 'shape-tumble-up 8s ease-in-out infinite',
            animationDelay: '-7s',
          }} />
          {/* 9. Cross / plus — white, right */}
          <div style={{
            position: 'absolute', top: '42%', right: '11%',
            width: 42, height: 42,
            background: 'rgba(255,255,255,0.08)',
            clipPath: 'polygon(33% 0%,67% 0%,67% 33%,100% 33%,100% 67%,67% 67%,67% 100%,33% 100%,33% 67%,0% 67%,0% 33%,33% 33%)',
            animation: 'shape-tumble-spin 9s ease-in-out infinite',
            animationDelay: '-3s',
          }} />
          {/* 10. Small square fill — white, center-right */}
          <div style={{
            position: 'absolute', top: '48%', left: '54%',
            width: 22, height: 22,
            background: 'rgba(255,255,255,0.11)',
            borderRadius: 3,
            animation: 'shape-tumble-l 5.5s ease-in-out infinite',
            animationDelay: '-6s',
          }} />
          {/* 11. Large hexagon — gold, lower-left */}
          <div style={{
            position: 'absolute', top: '55%', left: '10%',
            width: 56, height: 56,
            background: 'rgba(245,184,0,0.13)',
            clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
            animation: 'shape-tumble-arc 12s ease-in-out infinite',
            animationDelay: '-6s',
          }} />
          {/* 12. Star — gold, right */}
          <div style={{
            position: 'absolute', top: '58%', right: '8%',
            width: 42, height: 42,
            background: 'rgba(245,184,0,0.15)',
            clipPath: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
            animation: 'shape-tumble-r 10s ease-in-out infinite',
            animationDelay: '-4s',
          }} />
          {/* 13. Rectangle outline — white, lower-left */}
          <div style={{
            position: 'absolute', top: '65%', left: '2%',
            width: 92, height: 44,
            border: '1.5px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            animation: 'shape-tumble-l 13s ease-in-out infinite',
            animationDelay: '-1s',
          }} />
          {/* 14. Diamond outline — gold, lower-center */}
          <div style={{
            position: 'absolute', top: '68%', left: '40%',
            width: 50, height: 50,
            border: '1.5px solid rgba(245,184,0,0.20)',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            animation: 'shape-tumble-d 11s ease-in-out infinite',
            animationDelay: '-8s',
          }} />
          {/* 15. Large circle outline — white, bottom-right */}
          <div style={{
            position: 'absolute', bottom: '6%', right: '6%',
            width: 98, height: 98,
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '50%',
            animation: 'shape-tumble-d 18s ease-in-out infinite',
            animationDelay: '-9s',
          }} />
          {/* 16. Inverted triangle — white, bottom-center-left */}
          <div style={{
            position: 'absolute', bottom: '15%', left: '22%',
            width: 46, height: 40,
            background: 'rgba(255,255,255,0.08)',
            clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
            animation: 'shape-tumble-arc 9s ease-in-out infinite',
            animationDelay: '-5s',
          }} />
          {/* 17. Small pentagon fill — gold, bottom-center */}
          <div style={{
            position: 'absolute', bottom: '10%', left: '54%',
            width: 28, height: 28,
            background: 'rgba(245,184,0,0.18)',
            clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
            animation: 'shape-tumble-spin 7s ease-in-out infinite',
            animationDelay: '-2s',
          }} />
          {/* 18. Small square outline — white, bottom-left */}
          <div style={{
            position: 'absolute', bottom: '5%', left: '8%',
            width: 30, height: 30,
            border: '1.5px solid rgba(255,255,255,0.11)',
            borderRadius: 4,
            animation: 'shape-tumble-r 6s ease-in-out infinite',
            animationDelay: '-3s',
          }} />
        </div>

        <div className="relative z-10 flex flex-col h-full p-12">

          {/* Top: Wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0"
              style={{
                background: '#f5b800',
                color: '#002570',
                boxShadow: '0 4px 0px rgba(0,0,0,0.25)',
              }}>
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
                Pangasinan State University
              </span>

              <h1 className="text-[2.75rem] font-black text-white leading-[1.1] mb-4"
                style={{ letterSpacing: '-1px' }}>
                Scholarship<br />
                <span style={{ color: '#f5b800' }}>Management</span><br />
                Made Simple.
              </h1>

              <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '340px' }}>
                One platform for scholars, coordinators, and administrators — from enrollment to graduation.
              </p>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-3">
              {HIGHLIGHTS.map(({ Icon, label, desc }) => (
                <div key={label}
                  className="p-4 rounded-2xl"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(4px)',
                  }}>
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

          {/* Bottom: Tagline */}
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            PSU e-Iskolar · Scholar Profiling and Records Management System
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12"
        style={{ background: 'var(--bg)' }}>

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-8 lg:hidden">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm"
            style={{ background: '#002570', color: '#f5b800', boxShadow: '0 3px 0px #001a4a' }}>
            PSU
          </div>
          <div>
            <p className="font-black text-base leading-tight" style={{ color: 'var(--text-strong)' }}>e-Iskolar</p>
            <p className="text-xs" style={{ color: '#7a8aaa' }}>Lingayen Campus</p>
          </div>
        </div>

        {/* Form card */}
        <div className="w-full" style={{ maxWidth: '420px' }}>

          {/* Header above card */}
          <div className="mb-6 px-1">
            <h2 className="text-2xl font-black" style={{ color: 'var(--text-strong)' }}>Welcome back</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
              Sign in to your PSU e-Iskolar account
            </p>
          </div>

          {/* Card */}
          <div className="clay-card-modal p-8">

            {error && (
              <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-2xl text-sm"
                style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
                <AlertTriangle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {needsVerification && (
              <div className="mb-5 -mt-2">
                {resend.msg ? (
                  <p className="flex items-start gap-2 text-xs p-3 rounded-2xl"
                    style={{ background: '#eef6ff', color: '#003087', border: '1px solid #bcd4f5' }}>
                    <MailCheck size={14} strokeWidth={2.5} className="mt-px shrink-0" />
                    <span>{resend.msg}</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resend.busy || !email}
                    className="clay-btn clay-btn-ghost w-full py-2.5 text-sm flex items-center justify-center gap-2"
                    style={{ opacity: (resend.busy || !email) ? 0.6 : 1 }}>
                    <MailCheck size={14} strokeWidth={2.5} />
                    {resend.busy ? 'Sending…' : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email field */}
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
                  style={{ color: 'var(--text)' }}>
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Mail size={15} color="#7a8aaa" strokeWidth={2} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@psu.edu.ph"
                    className="clay-input"
                    style={{ paddingLeft: '38px' }}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
                  style={{ color: 'var(--text)' }}>
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Lock size={15} color="#7a8aaa" strokeWidth={2} />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="clay-input"
                    style={{ paddingLeft: '38px' }}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Forgot password */}
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs font-medium hover:underline"
                  style={{ color: '#002570' }}>
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="clay-btn clay-btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2 mt-1"
                style={{ opacity: submitting ? 0.65 : 1 }}
              >
                {submitting ? 'Signing in…' : (
                  <>
                    Sign in
                    <ArrowRight size={15} strokeWidth={2.5} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Register button */}
          <div className="mt-4">
            <Link
              to="/register"
              className="clay-btn clay-btn-ghost w-full py-3 text-sm flex items-center justify-center gap-2"
              style={{ color: 'var(--text-strong)', textDecoration: 'none' }}>
              <UserPlus size={15} strokeWidth={2.5} />
              Create New Account
            </Link>
          </div>

          {/* Below-card note */}
          <p className="text-center text-xs mt-4" style={{ color: '#9aaabb' }}>
            Access is restricted to authorized PSU personnel only.
          </p>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      {twoFa && (
        <TwoFaModal
          ticket={twoFa.ticket}
          onBack={() => setTwoFa(null)}
          onSuccess={data => { signIn(data); navigate('/dashboard', { replace: true }); }}
        />
      )}
    </div>
  );
}

function TwoFaModal({ ticket, onBack, onSuccess }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await verifyTwoFactorLogin(ticket, code.replace(/\s/g, ''));
      onSuccess(data);
    } catch (err) {
      setError(err.message);
      setCode('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onBack} width={400} dismissible={!submitting} closeOnBackdrop={false} bare>
      <div className="clay-card-modal p-7">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'rgba(0,37,112,0.08)', border: '2px solid rgba(0,37,112,0.15)' }}>
            <ShieldCheck size={24} color="#002570" strokeWidth={2} />
          </div>
          <h2 className="text-base font-black" style={{ color: 'var(--text-strong)' }}>Two-Factor Verification</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
            Enter the 6-digit code sent to your email
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-2xl text-sm"
            style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
            <AlertTriangle size={14} strokeWidth={2.5} className="shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
              style={{ color: 'var(--text)' }}>
              Authentication Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9 ]*"
              maxLength={7}
              required
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="000000"
              className="clay-input text-center text-lg font-bold tracking-[0.25em]"
              autoFocus
              autoComplete="one-time-code"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onBack}
              className="clay-btn clay-btn-ghost flex-1 py-3 text-sm">
              Back
            </button>
            <button type="submit" disabled={submitting || code.replace(/\s/g, '').length < 6}
              className="clay-btn clay-btn-primary flex-1 py-3 text-sm"
              style={{ opacity: (submitting || code.replace(/\s/g, '').length < 6) ? 0.65 : 1 }}>
              {submitting ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1); // 1 = form, 2 = result
  const [found, setFound] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await forgotPassword(email);
      setFound(data.found);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,37,112,0.08)', border: '1px solid rgba(0,37,112,0.12)' }}>
            <KeyRound size={15} color="#002570" strokeWidth={2} />
          </span>
          Reset Password
        </span>
      }
      onClose={onClose}
      width={400}
      dismissible={!submitting}
    >
        {step === 1 ? (
          <>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text)' }}>
              Enter your registered email address and we will send you a password reset link.
            </p>

            {error && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-2xl text-sm"
                style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
                <AlertTriangle size={14} strokeWidth={2.5} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
                  style={{ color: 'var(--text)' }}>
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Mail size={15} color="#7a8aaa" strokeWidth={2} />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@psu.edu.ph"
                    className="clay-input"
                    style={{ paddingLeft: '38px' }}
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="clay-btn clay-btn-ghost flex-1 py-3 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="clay-btn clay-btn-primary flex-1 py-3 text-sm"
                  style={{ opacity: submitting ? 0.65 : 1 }}>
                  {submitting ? 'Sending…' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </>
        ) : found ? (
          <>
            <div className="flex flex-col items-center text-center py-2 mb-5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: 'rgba(0,37,112,0.08)', border: '2px solid rgba(0,37,112,0.15)' }}>
                <Mail size={22} color="#002570" strokeWidth={2} />
              </div>
              <p className="font-black text-base mb-1" style={{ color: 'var(--text-strong)' }}>Check Your Inbox</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                A password reset link has been sent to <strong>{email}</strong>.
                Please check your email and follow the instructions.
              </p>
            </div>
            <p className="text-xs text-center mb-4" style={{ color: '#9aaabb' }}>
              The link expires in 24 hours. Check your spam folder if you don't see it.
            </p>
            <button onClick={onClose}
              className="clay-btn clay-btn-ghost w-full py-3 text-sm">
              Close
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center py-2 mb-5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: 'rgba(0,37,112,0.06)', border: '2px solid rgba(0,37,112,0.10)' }}>
                <Mail size={22} color="#7a8aaa" strokeWidth={2} />
              </div>
              <p className="font-black text-base mb-1" style={{ color: 'var(--text-strong)' }}>Email Not Found</p>
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                That email is not registered. Please contact your system administrator for assistance.
              </p>
            </div>
            <button onClick={onClose}
              className="clay-btn clay-btn-ghost w-full py-3 text-sm">
              Close
            </button>
          </>
        )}
    </Modal>
  );
}
