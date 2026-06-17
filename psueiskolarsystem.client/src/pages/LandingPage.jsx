import { Link } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { UserCheck, FolderUp, BarChart2, Bell, Building2, Lock, Settings, ClipboardList, GraduationCap } from 'lucide-react';

const features = [
  { Icon: UserCheck,   title: 'Scholar Profiling',   desc: 'Centralized scholar profiles with academic and personal information across all PSU campuses.' },
  { Icon: FolderUp,    title: 'Document Submission', desc: 'Scholars upload COR, grade reports, and IDs. Coordinators verify and give feedback instantly.' },
  { Icon: BarChart2,   title: 'Data Analytics',      desc: 'Compliance rates, submission trends, and scholar distribution in clear, filterable dashboards.' },
  { Icon: Bell,        title: 'Announcements',       desc: 'Administrators post deadlines and notices directly to scholar and coordinator dashboards.' },
  { Icon: Building2,   title: 'Multi-Campus',        desc: 'One unified system for all 7 PSU campuses — Lingayen, Bayambang, Urdaneta, and more.' },
  { Icon: Lock,        title: 'Role-Based Access',   desc: 'Admins, Coordinators, and Scholars each see only what is relevant to their role.' },
];

const roles = [
  { role: 'Administrator', Icon: Settings,     color: '#ede0ff', border: '#b888f8', text: '#4a1a7a', desc: 'Manage users, view system-wide analytics, post announcements.' },
  { role: 'Coordinator',   Icon: ClipboardList, color: '#dce8ff', border: '#88aaff', text: '#1a3a7a', desc: 'Review submissions, record grades, monitor compliance.' },
  { role: 'Scholar',       Icon: GraduationCap, color: '#d4f5e2', border: '#5cd89a', text: '#0f6b35', desc: 'Upload documents, track status, view scholarship info.' },
];

const campuses = ['Lingayen (Main)', 'Alaminos', 'Asingan', 'Bayambang', 'Infanta', 'Sta. Maria', 'Urdaneta'];

export default function LandingPage() {
  useTitle('Home');

  return (
    <div style={{ background: '#e8edf5', minHeight: '100vh', fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif" }}>

      {/* Navbar */}
      <nav style={{ background: '#faf7f5', borderBottom: '1.5px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 0px rgba(0,0,0,0.06)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black text-white"
              style={{ background: '#003087', boxShadow: '2px 2px 0px #001a4a' }}>
              PSU
            </div>
            <span className="font-black text-base" style={{ color: '#0d1a33' }}>e-Iskolar</span>
          </div>
          <Link to="/login" className="clay-btn clay-btn-primary px-5 py-2.5 text-sm">
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center relative">
        <div className="absolute top-0 left-0 w-48 h-48 rounded-full pointer-events-none -z-0"
          style={{ background: 'rgba(0,48,135,0.07)', transform: 'translate(-30%, -20%)' }} />
        <div className="absolute top-8 right-0 w-64 h-64 rounded-full pointer-events-none -z-0"
          style={{ background: 'rgba(0,48,135,0.05)', transform: 'translate(20%, 0)' }} />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl mb-6 text-xs font-bold"
            style={{ background: '#dce8ff', color: '#003087', border: '1.5px solid #80aaee', boxShadow: '2px 2px 0px rgba(0,0,0,0.08)' }}>
            Pangasinan State University
          </div>

          <h1 className="text-5xl font-black leading-tight mb-4" style={{ color: '#0d1a33', letterSpacing: '-1px' }}>
            PSU <span style={{ color: '#003087' }}>e-Iskolar</span><br />
            System
          </h1>
          <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: '#4a5a7a' }}>
            A web-based Scholar Profiling and Records Management System for all PSU campuses.
            Streamline document submission, compliance tracking, and scholarship management.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/login" className="clay-btn clay-btn-primary px-8 py-3.5 text-base">
              Get Started
            </Link>
            <a href="#features" className="clay-btn clay-btn-ghost px-8 py-3.5 text-base"
              style={{ color: '#0d1a33', textDecoration: 'none' }}>
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Role cards */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {roles.map(({ role, Icon, color, border, text, desc }) => (
            <div key={role} className="clay-card p-5 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: color, border: `1.5px solid ${border}` }}>
                <Icon size={22} color={text} strokeWidth={2} />
              </div>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold mb-3"
                style={{ background: color, color: text, border: `1.5px solid ${border}`, boxShadow: '2px 2px 0px rgba(0,0,0,0.08)' }}>
                {role}
              </div>
              <p className="text-sm" style={{ color: '#4a5a7a' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black mb-2" style={{ color: '#0d1a33' }}>Everything you need</h2>
          <p className="text-sm" style={{ color: '#4a5a7a' }}>Integrated modules covering every aspect of scholarship management</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ Icon, title, desc }) => (
            <div key={title} className="clay-card p-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(0,48,135,0.08)', border: '1px solid rgba(0,48,135,0.10)' }}>
                <Icon size={18} color="#003087" strokeWidth={2} />
              </div>
              <h3 className="font-bold text-sm mb-1.5" style={{ color: '#0d1a33' }}>{title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: '#4a5a7a' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Campuses */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="clay-card-blue p-8 text-center">
          <h2 className="text-2xl font-black text-white mb-2">7 PSU Campuses</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
            One unified system serving scholars across all campuses of Pangasinan State University
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {campuses.map(c => (
              <span key={c} className="px-4 py-2 rounded-2xl text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.25)', boxShadow: '2px 2px 0px rgba(0,0,0,0.15)' }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-12 text-center">
        <div className="clay-card p-10">
          <h2 className="text-3xl font-black mb-3" style={{ color: '#0d1a33' }}>Ready to get started?</h2>
          <p className="text-sm mb-6" style={{ color: '#4a5a7a' }}>Sign in with your PSU account to access your scholarship dashboard.</p>
          <Link to="/login" className="clay-btn clay-btn-primary px-10 py-3.5 text-base">
            Sign In Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-xs" style={{ color: '#7a8aaa', borderTop: '1.5px solid rgba(0,0,0,0.07)' }}>
        © {new Date().getFullYear()} Pangasinan State University · PSU e-Iskolar System
      </footer>
    </div>
  );
}
