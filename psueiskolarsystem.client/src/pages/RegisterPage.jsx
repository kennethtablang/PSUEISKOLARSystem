import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerScholar } from '../api/auth';
import { useTitle } from '../hooks/useTitle';
import { Mail, Lock, User, UserCheck, FolderUp, TrendingUp, Bell, ArrowRight, ArrowLeft, AlertTriangle, GraduationCap, CheckCircle, XCircle, MailCheck } from 'lucide-react';

const HIGHLIGHTS = [
  { Icon: UserCheck,  label: 'Scholar Profiling',   desc: 'Academic records and personal information' },
  { Icon: FolderUp,   label: 'Document Submission', desc: 'Upload and track compliance per semester' },
  { Icon: TrendingUp, label: 'Grade Monitoring',    desc: 'GWA tracking and requirement alerts' },
  { Icon: Bell,       label: 'Announcements',       desc: 'Deadlines and notices in one place' },
];

function getPasswordStrength(pw) {
  const checks = {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    digit:     /[0-9]/.test(pw),
    special:   /[^A-Za-z0-9]/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, passed, total: 5 };
}

function PasswordRequirements({ password }) {
  const { checks } = getPasswordStrength(password);
  if (!password) return null;

  const rules = [
    { key: 'length',    label: 'At least 8 characters' },
    { key: 'uppercase', label: 'One uppercase letter (A–Z)' },
    { key: 'lowercase', label: 'One lowercase letter (a–z)' },
    { key: 'digit',     label: 'One number (0–9)' },
    { key: 'special',   label: 'One special character (!@#$…)' },
  ];

  return (
    <div className="mt-2 space-y-1">
      {rules.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1.5 text-xs">
          {checks[key]
            ? <CheckCircle size={12} color="#16a34a" strokeWidth={2.5} />
            : <XCircle    size={12} color="#dc2626" strokeWidth={2.5} />}
          <span style={{ color: checks[key] ? '#16a34a' : '#9aaabb' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '',
    email: '', password: '', confirmPassword: '',
  });
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useTitle('Create Scholar Account');
  const navigate = useNavigate();

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function isPasswordValid() {
    const { passed } = getPasswordStrength(form.password);
    return passed === 5;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!isPasswordValid()) {
      setError('Password does not meet the requirements below.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await registerScholar({
        firstName:  form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName:   form.lastName.trim(),
        email:      form.email,
        password:   form.password,
      });
      setSuccess(true);
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
          <div className="absolute w-[600px] h-[600px] rounded-full"
            style={{ top: '-200px', right: '-200px', background: 'radial-gradient(circle, rgba(245,184,0,0.18) 0%, transparent 70%)' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full"
            style={{ bottom: '-150px', left: '-100px', background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots2" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots2)" />
          </svg>
        </div>

        {/* Tumbling geometric shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{ position: 'absolute', top: '4%', left: '8%', width: 72, height: 72, border: '1.5px solid rgba(245,184,0,0.22)', borderRadius: '50%', animation: 'shape-tumble-r 10s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '7%', right: '8%', width: 54, height: 54, background: 'rgba(255,255,255,0.09)', clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)', animation: 'shape-tumble-l 12s ease-in-out infinite', animationDelay: '-4s' }} />
          <div style={{ position: 'absolute', top: '5%', left: '44%', width: 20, height: 20, background: 'rgba(245,184,0,0.30)', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', animation: 'shape-tumble-spin 4.5s ease-in-out infinite', animationDelay: '-2s' }} />
          <div style={{ position: 'absolute', top: '13%', left: '55%', width: 48, height: 48, border: '1.5px solid rgba(255,255,255,0.10)', borderRadius: 6, animation: 'shape-tumble-up 9s ease-in-out infinite', animationDelay: '-3s' }} />
          <div style={{ position: 'absolute', top: '24%', left: '6%', width: 58, height: 58, border: '1.5px solid rgba(245,184,0,0.19)', clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', animation: 'shape-tumble-arc 13s ease-in-out infinite', animationDelay: '-6s' }} />
          <div style={{ position: 'absolute', top: '26%', right: '6%', width: 60, height: 52, background: 'rgba(255,255,255,0.08)', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', animation: 'shape-tumble-d 11s ease-in-out infinite', animationDelay: '-5s' }} />
          <div style={{ position: 'absolute', top: '36%', left: '3%', width: 38, height: 38, background: 'rgba(245,184,0,0.16)', clipPath: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)', animation: 'shape-tumble-r 9s ease-in-out infinite', animationDelay: '-7s' }} />
          <div style={{ position: 'absolute', top: '40%', left: '38%', width: 52, height: 52, border: '1.5px solid rgba(255,255,255,0.08)', clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)', animation: 'shape-tumble-l 14s ease-in-out infinite', animationDelay: '-9s' }} />
          <div style={{ position: 'absolute', top: '44%', right: '10%', width: 40, height: 40, background: 'rgba(255,255,255,0.08)', clipPath: 'polygon(33% 0%,67% 0%,67% 33%,100% 33%,100% 67%,67% 67%,67% 100%,33% 100%,33% 67%,0% 67%,0% 33%,33% 33%)', animation: 'shape-tumble-spin 8s ease-in-out infinite', animationDelay: '-4s' }} />
          <div style={{ position: 'absolute', top: '50%', left: '56%', width: 20, height: 20, background: 'rgba(255,255,255,0.11)', borderRadius: '50%', animation: 'shape-tumble-up 5s ease-in-out infinite', animationDelay: '-1s' }} />
          <div style={{ position: 'absolute', top: '58%', left: '8%', width: 48, height: 48, background: 'rgba(245,184,0,0.15)', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', animation: 'shape-tumble-arc 11s ease-in-out infinite', animationDelay: '-5s' }} />
          <div style={{ position: 'absolute', top: '62%', right: '5%', width: 86, height: 42, border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 6, animation: 'shape-tumble-r 13s ease-in-out infinite', animationDelay: '-2s' }} />
          <div style={{ position: 'absolute', top: '70%', left: '38%', width: 44, height: 38, background: 'rgba(255,255,255,0.08)', clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)', animation: 'shape-tumble-l 10s ease-in-out infinite', animationDelay: '-8s' }} />
          <div style={{ position: 'absolute', bottom: '6%', left: '5%', width: 96, height: 96, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '50%', animation: 'shape-tumble-d 17s ease-in-out infinite', animationDelay: '-10s' }} />
          <div style={{ position: 'absolute', bottom: '10%', left: '50%', width: 32, height: 32, background: 'rgba(245,184,0,0.18)', clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)', animation: 'shape-tumble-spin 6s ease-in-out infinite', animationDelay: '-3s' }} />
          <div style={{ position: 'absolute', bottom: '8%', right: '10%', width: 26, height: 26, background: 'rgba(255,255,255,0.10)', borderRadius: 4, animation: 'shape-tumble-up 7s ease-in-out infinite', animationDelay: '-6s' }} />
          <div style={{ position: 'absolute', bottom: '18%', right: '3%', width: 44, height: 44, background: 'rgba(245,184,0,0.12)', clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', animation: 'shape-tumble-r 8s ease-in-out infinite', animationDelay: '-4s' }} />
          <div style={{ position: 'absolute', top: '32%', left: '22%', width: 24, height: 24, border: '1.5px solid rgba(245,184,0,0.22)', borderRadius: 3, animation: 'shape-tumble-l 6s ease-in-out infinite', animationDelay: '-2s' }} />
        </div>

        <div className="relative z-10 flex flex-col h-full p-12">
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

          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-8">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-5"
                style={{ background: 'rgba(245,184,0,0.15)', color: '#f5d060', border: '1px solid rgba(245,184,0,0.25)' }}>
                Scholar Registration
              </span>
              <h1 className="text-[2.75rem] font-black text-white leading-[1.1] mb-4"
                style={{ letterSpacing: '-1px' }}>
                Your Scholar<br />
                <span style={{ color: '#f5b800' }}>Journey</span><br />
                Starts Here.
              </h1>
              <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '340px' }}>
                Create your scholar account to access all PSU e-Iskolar features — from document submission to grade tracking.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {HIGHLIGHTS.map(({ Icon, label, desc }) => (
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

          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            PSU e-Iskolar · Scholar Profiling and Records Management System
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12"
        style={{ background: 'var(--bg)', overflowY: 'auto' }}>

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

        <div className="w-full" style={{ maxWidth: '440px' }}>

          <div className="mb-6 px-1">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(0,37,112,0.08)', border: '1px solid rgba(0,37,112,0.12)' }}>
                <GraduationCap size={14} color="#002570" strokeWidth={2} />
              </div>
              <h2 className="text-2xl font-black" style={{ color: 'var(--text-strong)' }}>Scholar Sign Up</h2>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
              Create your PSU e-Iskolar scholar account.
            </p>
          </div>

          <div className="clay-card-modal p-8">

            {success ? (
              /* ── Email Verification Sent State ── */
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(0,48,135,0.08)', border: '2px solid rgba(0,48,135,0.15)' }}>
                  <MailCheck size={30} color="#002570" strokeWidth={1.8} />
                </div>
                <p className="font-black text-lg mb-2" style={{ color: 'var(--text-strong)' }}>Check Your Email!</p>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text)' }}>
                  A verification link has been sent to <strong>{form.email}</strong>.
                  Please click the link in that email to activate your account before signing in.
                </p>

                <div className="rounded-2xl p-4 mb-5 text-left"
                  style={{ background: '#fffbea', border: '1px solid rgba(245,184,0,0.35)' }}>
                  <p className="text-xs leading-relaxed" style={{ color: '#7a5c00' }}>
                    <strong>Can&apos;t find the email?</strong> Check your <strong>spam</strong> or{' '}
                    <strong>junk</strong> folder. If it&apos;s there, mark it as &quot;Not Spam&quot; so
                    future emails reach your inbox.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setForm({ firstName: '', middleName: '', lastName: '', email: '', password: '', confirmPassword: '' });
                      setSuccess(false);
                    }}
                    className="clay-btn clay-btn-ghost flex-1 py-3 text-sm">
                    Register Another
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="clay-btn clay-btn-primary flex-1 py-3 text-sm">
                    Go to Sign In
                  </button>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-2xl text-sm"
                    style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
                    <AlertTriangle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* First Name + Last Name */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                        First Name
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <User size={14} color="#7a8aaa" strokeWidth={2} />
                        </span>
                        <input
                          type="text"
                          required
                          value={form.firstName}
                          onChange={e => set('firstName', e.target.value)}
                          placeholder="Juan"
                          className="clay-input"
                          style={{ paddingLeft: '36px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                        Last Name
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <User size={14} color="#7a8aaa" strokeWidth={2} />
                        </span>
                        <input
                          type="text"
                          required
                          value={form.lastName}
                          onChange={e => set('lastName', e.target.value)}
                          placeholder="Dela Cruz"
                          className="clay-input"
                          style={{ paddingLeft: '36px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Middle Name */}
                  <div>
                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                      Middle Name <span style={{ color: '#9aaabb', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <User size={14} color="#7a8aaa" strokeWidth={2} />
                      </span>
                      <input
                        type="text"
                        value={form.middleName}
                        onChange={e => set('middleName', e.target.value)}
                        placeholder="e.g. Santos"
                        className="clay-input"
                        style={{ paddingLeft: '36px' }}
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                      Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Mail size={14} color="#7a8aaa" strokeWidth={2} />
                      </span>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={e => set('email', e.target.value)}
                        placeholder="juan@psu.edu.ph"
                        className="clay-input"
                        style={{ paddingLeft: '36px' }}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                      Password
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Lock size={14} color="#7a8aaa" strokeWidth={2} />
                      </span>
                      <input
                        type="password"
                        required
                        value={form.password}
                        onChange={e => set('password', e.target.value)}
                        placeholder="Create a strong password"
                        className="clay-input"
                        style={{ paddingLeft: '36px' }}
                        autoComplete="new-password"
                      />
                    </div>
                    <PasswordRequirements password={form.password} />
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                      Confirm Password
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Lock size={14} color="#7a8aaa" strokeWidth={2} />
                      </span>
                      <input
                        type="password"
                        required
                        value={form.confirmPassword}
                        onChange={e => set('confirmPassword', e.target.value)}
                        placeholder="Re-enter password"
                        className="clay-input"
                        style={{ paddingLeft: '36px' }}
                        autoComplete="new-password"
                      />
                    </div>
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: '#dc2626' }}>
                        <XCircle size={12} strokeWidth={2.5} /> Passwords do not match
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="clay-btn clay-btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2 mt-2"
                    style={{ opacity: submitting ? 0.65 : 1 }}>
                    {submitting ? 'Creating account…' : (
                      <>
                        Create Scholar Account
                        <ArrowRight size={15} strokeWidth={2.5} />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          <div className="text-center mt-5">
            <Link to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color: 'var(--text)' }}>
              <ArrowLeft size={13} strokeWidth={2.5} />
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
