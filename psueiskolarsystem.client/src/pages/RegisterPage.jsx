import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerScholar, checkEmailAvailable, checkEligibility } from '../api/auth';
import { getPrograms } from '../api/lookups';
import { getCampuses } from '../api/campuses';
import { useTitle } from '../hooks/useTitle';
import { Lock, UserCheck, FolderUp, TrendingUp, Bell, ArrowRight, ArrowLeft, AlertTriangle, GraduationCap, CheckCircle2, XCircle, ShieldCheck, IdCard, BadgeCheck } from 'lucide-react';
import PasswordStrengthMeter, { getPasswordStrength } from '../components/PasswordStrengthMeter';
import Logo from '../components/Logo';
import {
  SectionTitle, UpperInput, ContactInput, InstitutionalEmailInput, BirthDateAge,
  PersonalQuestions, FamilyQuestions,
} from '../components/PersonalDetailsFields';
import { EMPTY_PERSONAL, INSTITUTIONAL_DOMAIN, personalToApi } from '../constants/personal';

const HIGHLIGHTS = [
  { Icon: UserCheck,  label: 'Scholar Profiling',   desc: 'Academic records and personal information' },
  { Icon: FolderUp,   label: 'Document Submission', desc: 'Upload and track compliance per semester' },
  { Icon: TrendingUp, label: 'Grade Monitoring',    desc: 'GWA tracking and requirement alerts' },
  { Icon: Bell,       label: 'Announcements',       desc: 'Deadlines and notices in one place' },
];

const STEPS = ['Verify', 'Personal', 'Family', 'Account'];

const EMPTY_FORM = {
  // Step 1 — matched against the office's master list
  studentId: '', lastName: '', firstName: '', middleName: '', campusId: '',
  // Step 2
  programId: '', yearLevel: '1', birthDate: '', address: '', contactLocal: '',
  personal: EMPTY_PERSONAL,
  // Step 4
  emailLocal: '', password: '', confirmPassword: '', consent: false,
};

const LABEL = 'block text-xs font-bold mb-2 uppercase tracking-wider';

export default function RegisterPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep]         = useState(1);
  const [campuses, setCampuses] = useState([]);
  // Courses are loaded per campus; tagged with the campus they belong to so a stale list is
  // never shown for a newly chosen campus.
  const [loadedPrograms, setLoadedPrograms] = useState({ campusId: '', list: [] });
  const [match, setMatch]       = useState(null); // result of the master-list check
  const [checking, setChecking] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Availability result tagged with the address it was for: { email, status }.
  const [emailCheck, setEmailCheck] = useState({ email: '', status: null });

  useTitle('Create Account');
  const navigate = useNavigate();

  const email = form.emailLocal ? `${form.emailLocal}@${INSTITUTIONAL_DOMAIN}` : '';
  const emailValid = /^[a-z0-9._-]+$/.test(form.emailLocal);
  const emailStatus = emailValid && emailCheck.email === email ? emailCheck.status : (emailValid ? 'checking' : null);
  const programs = form.campusId && loadedPrograms.campusId === form.campusId ? loadedPrograms.list : [];

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  // Changing anything that was matched invalidates the match.
  function setIdentity(field, value) {
    setMatch(null);
    setForm(f => ({ ...f, [field]: value, ...(field === 'campusId' ? { programId: '' } : {}) }));
  }

  useEffect(() => {
    getCampuses(null).then(setCampuses).catch(() => setCampuses([]));
  }, []);

  // Only the courses the chosen campus offers.
  useEffect(() => {
    if (!form.campusId) return;
    const campusId = form.campusId;
    getPrograms(null, campusId)
      .then(list => setLoadedPrograms({ campusId, list }))
      .catch(() => setLoadedPrograms({ campusId, list: [] }));
  }, [form.campusId]);

  /* Debounced live check for whether the email is already registered */
  useEffect(() => {
    if (!emailValid) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const available = await checkEmailAvailable(email, controller.signal);
        setEmailCheck({ email, status: available ? 'available' : 'taken' });
      } catch {
        if (!controller.signal.aborted) setEmailCheck({ email, status: null });
      }
    }, 450);
    return () => { clearTimeout(t); controller.abort(); };
  }, [email, emailValid]);

  /* Step 1: the details are cross-matched against the master list before the student is
     asked for anything else — a student who is not on it cannot create an account at all. */
  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    if (!/^[A-Za-z0-9-]{3,30}$/.test(form.studentId.trim())) {
      setError('Student No. may only contain letters, numbers, and hyphens (3–30 characters).');
      return;
    }
    if (!form.campusId) { setError('Select your campus.'); return; }

    setChecking(true);
    try {
      const result = await checkEligibility({
        studentId: form.studentId.trim(),
        lastName: form.lastName.trim(),
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        campusId: parseInt(form.campusId),
      });
      if (!result?.matched) {
        setMatch(null);
        setError(result?.message || 'Your details do not match the scholarship office’s list.');
        return;
      }
      setMatch(result);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  function handlePersonalNext(e) {
    e.preventDefault();
    setError('');
    if (!form.programId) { setError('Select your course.'); return; }
    if (!form.birthDate) { setError('Enter your birthdate.'); return; }
    if (new Date(form.birthDate) > new Date()) { setError('Birthdate cannot be in the future.'); return; }
    if (!/^9\d{9}$/.test(form.contactLocal)) { setError('Enter a valid mobile number: +63 followed by 10 digits starting with 9.'); return; }
    if (!form.personal.sex) { setError('Select your sex.'); return; }
    if (!form.personal.civilStatus) { setError('Select your civil status.'); return; }
    setStep(3);
  }

  function handleFamilyNext(e) {
    e.preventDefault();
    setError('');
    const p = form.personal;
    if (p.siblings !== '' && p.siblingsStudying !== '' && Number(p.siblingsStudying) > Number(p.siblings)) {
      setError('Siblings currently studying cannot be more than the number of siblings.');
      return;
    }
    setStep(4);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!/^[a-z0-9._-]+$/.test(form.emailLocal)) { setError(`Enter your institutional email (the part before @${INSTITUTIONAL_DOMAIN}).`); return; }
    if (emailStatus === 'taken') { setError('An account with this email already exists.'); return; }
    if (getPasswordStrength(form.password).passed !== 5) { setError('Password does not meet the requirements below.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (!form.consent) { setError('You must agree to the Data Privacy notice to create an account.'); return; }

    setSubmitting(true);
    try {
      const user = await registerScholar({
        firstName:  form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName:   form.lastName.trim(),
        email,
        password:   form.password,
        studentId:  form.studentId.trim(),
        campusId:   parseInt(form.campusId),
        programId:  parseInt(form.programId),
        yearLevel:  parseInt(form.yearLevel),
        contactNumber: `+63${form.contactLocal}`,
        birthDate:  form.birthDate,
        address:    form.address.trim(),
        personal:   personalToApi(form.personal),
        consentAccepted: form.consent,
      });
      setSuccess({ role: user?.role || match?.kind, email });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const onSubmit = [handleVerify, handlePersonalNext, handleFamilyNext, handleSubmit][step - 1];
  const campusName = campuses.find(c => String(c.id) === String(form.campusId))?.name;

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
            <Logo size={48} shadow="0 4px 0px rgba(0,0,0,0.25)" />
            <div>
              <p className="font-black text-xl text-white leading-tight tracking-tight">e-Iskolar</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Pangasinan State University</p>
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
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-12"
        style={{ background: 'var(--bg)', overflowY: 'auto' }}>

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-8 lg:hidden">
          <Logo size={40} shadow="0 3px 0px rgba(0,37,112,0.35)" />
          <div>
            <p className="font-black text-base leading-tight" style={{ color: 'var(--text-strong)' }}>e-Iskolar</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Pangasinan State University</p>
          </div>
        </div>

        <div className="w-full" style={{ maxWidth: '560px' }}>

          <div className="mb-6 px-1">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(0,37,112,0.08)', border: '1px solid rgba(0,37,112,0.12)' }}>
                <GraduationCap size={14} style={{ color: 'var(--accent-strong)' }} strokeWidth={2} />
              </div>
              <h2 className="text-2xl font-black" style={{ color: 'var(--text-strong)' }}>Scholar &amp; Grantee Sign Up</h2>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
              Your details are checked against the scholarship office&apos;s list — no waiting for approval.
            </p>
          </div>

          <div className="clay-card-modal p-5 sm:p-8">

            {success ? (
              /* ── Account Created State ── */
              <div className="text-center py-4" role="status">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'var(--tone-ok-bg)', border: '2px solid rgba(16,160,96,0.25)' }}>
                  <CheckCircle2 size={32} style={{ color: 'var(--tone-ok-fg)' }} strokeWidth={1.8} />
                </div>
                <p className="font-black text-lg mb-2" style={{ color: 'var(--text-strong)' }}>Account Created!</p>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text)' }}>
                  Your {success.role === 'Grantee' ? 'grantee' : 'scholar'} account for <strong>{success.email}</strong> is
                  ready. It was matched to the scholarship office&apos;s list, so no approval is needed.
                </p>

                <div className="rounded-2xl p-4 mb-5 text-left"
                  style={{ background: '#fffbea', border: '1px solid rgba(245,184,0,0.35)' }}>
                  <p className="text-xs leading-relaxed" style={{ color: '#7a5c00' }}>
                    If email verification is on, we sent a link to your inbox — click it before signing in.
                    Can&apos;t find it? Check your <strong>spam</strong> or <strong>junk</strong> folder.
                  </p>
                </div>

                <button onClick={() => navigate('/login')}
                  className="clay-btn clay-btn-primary w-full py-3 text-sm">
                  Go to Sign In
                </button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-2xl text-sm" role="alert"
                    style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1.5px solid var(--danger-border)' }}>
                    <AlertTriangle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-5 text-xs font-bold" aria-label={`Step ${step} of ${STEPS.length}`}>
                  {STEPS.map((label, i) => {
                    const active = step === i + 1;
                    const done = step > i + 1;
                    return (
                      <div key={label} className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: active || done ? 'var(--accent-strong)' : 'var(--surface-inset)',
                            color: active || done ? '#fff' : 'var(--text-muted)',
                          }}>
                          {i + 1}
                        </span>
                        <span className="truncate hidden sm:inline" style={{ color: active ? 'var(--text-strong)' : 'var(--text-muted)' }}>{label}</span>
                      </div>
                    );
                  })}
                </div>

                {match && step > 1 && (
                  <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-2xl text-sm"
                    style={{ background: 'var(--tone-ok-bg)', color: 'var(--tone-ok-fg)' }}>
                    <BadgeCheck size={16} strokeWidth={2.4} className="mt-px shrink-0" />
                    <span>
                      <strong>Matched as {match.kind === 'Grantee' ? 'a grantee' : 'a scholar'}</strong>
                      {match.scholarshipTypeName && <> — {match.scholarshipTypeName}</>}
                      {match.grantTypeNames?.length > 0 && <> · Grant: {match.grantTypeNames.join(', ')}</>}
                      {campusName && <> · {campusName}</>}
                    </span>
                  </div>
                )}

                <form onSubmit={onSubmit} className="space-y-4">

                  {step === 1 && (<>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      Enter your student number and complete name exactly as they appear on your school
                      records. Only students on the scholarship office&apos;s list of scholars and grantees can
                      create an account.
                    </p>

                    <div>
                      <label htmlFor="reg-student-id" className={LABEL} style={{ color: 'var(--text)' }}>Student No.</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <IdCard size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
                        </span>
                        <input id="reg-student-id" type="text" required maxLength={30}
                          value={form.studentId}
                          onChange={e => setIdentity('studentId', e.target.value.toUpperCase())}
                          placeholder="23-LN-0001" className="clay-input" style={{ paddingLeft: '36px' }} />
                      </div>
                    </div>

                    <p className="text-[11px] font-black uppercase tracking-widest pt-1" style={{ color: 'var(--accent-strong)' }}>
                      Complete Name
                    </p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="reg-last-name" className={LABEL} style={{ color: 'var(--text)' }}>Last Name</label>
                        <UpperInput id="reg-last-name" required maxLength={100} value={form.lastName}
                          onChange={v => setIdentity('lastName', v)} placeholder="DELA CRUZ" />
                      </div>
                      <div>
                        <label htmlFor="reg-first-name" className={LABEL} style={{ color: 'var(--text)' }}>First Name</label>
                        <UpperInput id="reg-first-name" required maxLength={100} value={form.firstName}
                          onChange={v => setIdentity('firstName', v)} placeholder="JUAN" />
                      </div>
                      <div>
                        <label htmlFor="reg-middle-name" className={LABEL} style={{ color: 'var(--text)' }}>
                          Middle Name <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                        </label>
                        <UpperInput id="reg-middle-name" maxLength={100} value={form.middleName}
                          onChange={v => setIdentity('middleName', v)} placeholder="SANTOS" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="reg-campus" className={LABEL} style={{ color: 'var(--text)' }}>Campus</label>
                      <select id="reg-campus" required value={form.campusId}
                        onChange={e => setIdentity('campusId', e.target.value)} className="clay-input">
                        <option value="">— Select the campus where you study —</option>
                        {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <button type="submit" disabled={checking}
                      className="clay-btn clay-btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2 mt-2"
                      style={{ opacity: checking ? 0.65 : 1 }}>
                      {checking ? 'Checking the list…' : <>Verify &amp; Continue <ArrowRight size={15} strokeWidth={2.5} /></>}
                    </button>
                  </>)}

                  {step === 2 && (<>
                    <SectionTitle>Personal Information</SectionTitle>

                    <div className="grid sm:grid-cols-[1fr_120px] gap-3">
                      <div>
                        <label htmlFor="reg-program" className={LABEL} style={{ color: 'var(--text)' }}>Course</label>
                        <select id="reg-program" required value={form.programId}
                          onChange={e => set('programId', e.target.value)} className="clay-input">
                          <option value="">— Select your course —</option>
                          {programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                        </select>
                        {form.campusId && programs.length === 0 && (
                          <p className="text-xs mt-1" style={{ color: 'var(--tone-warn-fg)' }}>
                            No courses are set up for {campusName || 'this campus'} yet. Contact the scholarship office.
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="reg-year-level" className={LABEL} style={{ color: 'var(--text)' }}>Year Level</label>
                        <select id="reg-year-level" value={form.yearLevel}
                          onChange={e => set('yearLevel', e.target.value)} className="clay-input">
                          {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>Year {y}</option>)}
                        </select>
                      </div>
                    </div>

                    <BirthDateAge required value={form.birthDate} onChange={v => set('birthDate', v)} />

                    <div>
                      <label htmlFor="reg-address" className={LABEL} style={{ color: 'var(--text)' }}>Complete Address</label>
                      <textarea id="reg-address" rows={2} required maxLength={500}
                        value={form.address} onChange={e => set('address', e.target.value)}
                        placeholder="House No., Street, Barangay, Municipality, Province" className="clay-input" />
                    </div>

                    <div>
                      <label htmlFor="reg-contact" className={LABEL} style={{ color: 'var(--text)' }}>Contact Number</label>
                      <ContactInput id="reg-contact" required value={form.contactLocal} onChange={v => set('contactLocal', v)} />
                    </div>

                    <PersonalQuestions required value={form.personal} onChange={v => set('personal', v)} />

                    <StepButtons onBack={() => { setError(''); setStep(1); }} label="Next: Family Information" />
                  </>)}

                  {step === 3 && (<>
                    <SectionTitle>Family Information</SectionTitle>
                    <FamilyQuestions value={form.personal} onChange={v => set('personal', v)} />
                    <StepButtons onBack={() => { setError(''); setStep(2); }} label="Next: Account" />
                  </>)}

                  {step === 4 && (<>
                    <SectionTitle>Account</SectionTitle>

                    <div>
                      <label htmlFor="reg-email" className={LABEL} style={{ color: 'var(--text)' }}>Institutional Email Address</label>
                      <InstitutionalEmailInput id="reg-email" required value={form.emailLocal} onChange={v => set('emailLocal', v)} />
                      {emailStatus === 'checking' && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Checking availability…</p>}
                      {emailStatus === 'available' && <p className="text-xs mt-1" style={{ color: '#16a34a' }}>✓ This email is available.</p>}
                      {emailStatus === 'taken' && (
                        <p className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>An account with this email already exists.</p>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Personal email addresses are not accepted.</p>
                    </div>

                    <div>
                      <label htmlFor="reg-password" className={LABEL} style={{ color: 'var(--text)' }}>Password</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Lock size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
                        </span>
                        <input id="reg-password" type="password" required value={form.password}
                          onChange={e => set('password', e.target.value)} placeholder="Create a strong password"
                          className="clay-input" style={{ paddingLeft: '36px' }} autoComplete="new-password" />
                      </div>
                      <PasswordStrengthMeter password={form.password} />
                    </div>

                    <div>
                      <label htmlFor="reg-confirm-password" className={LABEL} style={{ color: 'var(--text)' }}>Confirm Password</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <Lock size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
                        </span>
                        <input id="reg-confirm-password" type="password" required value={form.confirmPassword}
                          onChange={e => set('confirmPassword', e.target.value)} placeholder="Re-enter password"
                          className="clay-input" style={{ paddingLeft: '36px' }} autoComplete="new-password" />
                      </div>
                      {form.confirmPassword && form.password !== form.confirmPassword && (
                        <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: 'var(--danger)' }}>
                          <XCircle size={12} strokeWidth={2.5} /> Passwords do not match
                        </p>
                      )}
                    </div>

                    {/* Data Privacy Clause (RA 10173) */}
                    <div className="rounded-2xl p-4 text-xs leading-relaxed space-y-2"
                      style={{ background: 'rgba(0,48,135,0.05)', border: '1px solid rgba(0,48,135,0.15)', color: 'var(--text)' }}>
                      <p className="flex items-center gap-1.5 font-black" style={{ color: 'var(--text-strong)' }}>
                        <ShieldCheck size={14} style={{ color: 'var(--accent-strong)' }} /> Data Privacy Clause
                      </p>
                      <p>
                        In compliance with the <strong>Data Privacy Act of 2012 (RA 10173)</strong>, Pangasinan State
                        University collects the personal, academic, and family information in this form solely for
                        scholarship and grant profiling, records management, release monitoring, and statistical
                        reporting. Your data is accessible only to authorized scholarship personnel, will not be shared
                        with third parties without your consent unless required by law, and is kept only as long as
                        needed for these purposes. You may view and request correction of your data at any time.
                      </p>
                      <label className="flex items-start gap-2 pt-1 cursor-pointer">
                        <input type="checkbox" checked={form.consent} onChange={e => set('consent', e.target.checked)}
                          className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: 'var(--accent-strong)' }} />
                        <span style={{ color: 'var(--text-strong)' }}>
                          I have read and understood this notice, certify that the information I gave is true and
                          correct, and consent to the processing of my personal data for these purposes.
                        </span>
                      </label>
                    </div>

                    <div className="flex gap-3 mt-2">
                      <button type="button" disabled={submitting} onClick={() => { setError(''); setStep(3); }}
                        className="clay-btn clay-btn-ghost py-3.5 px-5 text-sm flex items-center justify-center gap-2">
                        <ArrowLeft size={15} strokeWidth={2.5} /> Back
                      </button>
                      <button type="submit" disabled={submitting || !form.consent}
                        className="clay-btn clay-btn-primary flex-1 py-3.5 text-sm flex items-center justify-center gap-2"
                        style={{ opacity: submitting || !form.consent ? 0.65 : 1 }}>
                        {submitting ? 'Creating account…' : <>Create Account <ArrowRight size={15} strokeWidth={2.5} /></>}
                      </button>
                    </div>
                  </>)}
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

function StepButtons({ onBack, label }) {
  return (
    <div className="flex gap-3 mt-2">
      <button type="button" onClick={onBack}
        className="clay-btn clay-btn-ghost py-3.5 px-5 text-sm flex items-center justify-center gap-2">
        <ArrowLeft size={15} strokeWidth={2.5} /> Back
      </button>
      <button type="submit"
        className="clay-btn clay-btn-primary flex-1 py-3.5 text-sm flex items-center justify-center gap-2">
        {label} <ArrowRight size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}
