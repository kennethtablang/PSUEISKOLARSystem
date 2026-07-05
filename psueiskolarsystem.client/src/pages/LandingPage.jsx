import { Link } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { MapPin, Phone, Mail, GraduationCap, ClipboardList, Users, BookOpen } from 'lucide-react';

const roles = [
  {
    role: 'Scholar',
    items: [
      'Submit required documents each semester',
      'Track submission and verification status',
      'View scholarship type and GWA requirement',
      'Get feedback on incomplete documents',
    ],
  },
  {
    role: 'Coordinator',
    items: [
      'Review and verify document submissions',
      'Record GWA entries per scholar',
      'Post announcements and deadlines',
      'Monitor compliance across all scholars',
    ],
  },
  {
    role: 'Administrator',
    items: [
      'Manage user accounts across all roles',
      'Configure document requirements',
      'Access system-wide analytics',
      'Oversee all scholarship programs',
    ],
  },
];

const cssaServices = [
  { Icon: GraduationCap, label: 'Scholarship Processing', desc: 'Evaluates and processes scholarship applications for enrolled students.' },
  { Icon: ClipboardList, label: 'Compliance Monitoring', desc: 'Tracks document submissions and GWA compliance each semester.' },
  { Icon: Users,         label: 'Scholar Coordination', desc: 'Liaises between scholars, sponsors, and university offices.' },
  { Icon: BookOpen,      label: 'Records Management',   desc: 'Maintains official scholarship records and academic standing history.' },
];

export default function LandingPage() {
  useTitle('Home');

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: "Inter, system-ui, 'Segoe UI', sans-serif" }}>

      {/* Navbar */}
      <nav style={{
        background: '#002570',
        position: 'sticky', top: 0, zIndex: 20,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div className="max-w-5xl mx-auto px-6" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7, flexShrink: 0,
              background: '#f5b800',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 9.5, color: '#002570', letterSpacing: '0.02em',
            }}>PSU</div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em', lineHeight: 1.1 }}>e-Iskolar</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, lineHeight: 1 }}>Lingayen Campus</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link to="/register" style={{
              color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 13,
              textDecoration: 'none', padding: '6px 14px',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}>
              Register
            </Link>
            <Link to="/login" style={{
              background: '#f5b800', color: '#002570',
              fontWeight: 800, fontSize: 13,
              padding: '7px 18px', borderRadius: 7,
              textDecoration: 'none',
              boxShadow: '0 2px 0 rgba(0,0,0,0.2)',
            }}>
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Gold bar */}
      <div style={{ height: 5, background: 'linear-gradient(90deg, #f5b800, #ffd060, #f5b800)' }} />

      {/* Hero */}
      <section style={{ background: '#002570', padding: '72px 0 80px', position: 'relative', overflow: 'hidden' }}>

        {/* Background geometry (same as login page) */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {/* Gold arc glow top-right */}
          <div style={{
            position: 'absolute', top: -200, right: -200,
            width: 700, height: 700, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,184,0,0.14) 0%, transparent 70%)',
          }} />
          {/* Subtle bottom-left fill */}
          <div style={{
            position: 'absolute', bottom: -150, left: -100,
            width: 500, height: 500, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
          }} />
          {/* Dot grid */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }}>
            <defs>
              <pattern id="landing-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#landing-dots)" />
          </svg>
        </div>

        {/* Tumbling geometric shapes */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {/* 1. Large square outline — gold, top-left */}
          <div style={{
            position: 'absolute', top: '5%', left: '3%',
            width: 80, height: 80,
            border: '1.5px solid rgba(245,184,0,0.22)', borderRadius: 8,
            animation: 'shape-tumble-r 9s ease-in-out infinite',
          }} />
          {/* 2. Triangle — white, upper area */}
          <div style={{
            position: 'absolute', top: '8%', left: '20%',
            width: 58, height: 50,
            background: 'rgba(255,255,255,0.07)',
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            animation: 'shape-tumble-l 11s ease-in-out infinite',
            animationDelay: '-3s',
          }} />
          {/* 3. Tiny circle — gold, top-center */}
          <div style={{
            position: 'absolute', top: '7%', left: '45%',
            width: 18, height: 18,
            background: 'rgba(245,184,0,0.30)', borderRadius: '50%',
            animation: 'shape-tumble-spin 5s ease-in-out infinite',
            animationDelay: '-1s',
          }} />
          {/* 4. Pentagon outline — white, upper-right area */}
          <div style={{
            position: 'absolute', top: '12%', right: '22%',
            width: 52, height: 52,
            border: '1.5px solid rgba(255,255,255,0.11)',
            clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
            animation: 'shape-tumble-r 10s ease-in-out infinite',
            animationDelay: '-4s',
          }} />
          {/* 5. Circle outline — white, far right */}
          <div style={{
            position: 'absolute', top: '18%', right: '4%',
            width: 65, height: 65,
            border: '1.5px solid rgba(255,255,255,0.10)', borderRadius: '50%',
            animation: 'shape-tumble-d 14s ease-in-out infinite',
            animationDelay: '-5s',
          }} />
          {/* 6. Diamond fill — gold, left */}
          <div style={{
            position: 'absolute', top: '30%', left: '6%',
            width: 44, height: 44,
            background: 'rgba(245,184,0,0.17)',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            animation: 'shape-tumble-r 7s ease-in-out infinite',
            animationDelay: '-2s',
          }} />
          {/* 7. Octagon outline — white, center-right */}
          <div style={{
            position: 'absolute', top: '32%', right: '30%',
            width: 56, height: 56,
            border: '1.5px solid rgba(255,255,255,0.08)',
            clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
            animation: 'shape-tumble-arc 13s ease-in-out infinite',
            animationDelay: '-7s',
          }} />
          {/* 8. Cross — white, right side */}
          <div style={{
            position: 'absolute', top: '40%', right: '10%',
            width: 42, height: 42,
            background: 'rgba(255,255,255,0.08)',
            clipPath: 'polygon(33% 0%,67% 0%,67% 33%,100% 33%,100% 67%,67% 67%,67% 100%,33% 100%,33% 67%,0% 67%,0% 33%,33% 33%)',
            animation: 'shape-tumble-spin 9s ease-in-out infinite',
            animationDelay: '-3s',
          }} />
          {/* 9. Hexagon fill — gold, lower-left */}
          <div style={{
            position: 'absolute', bottom: '25%', left: '8%',
            width: 56, height: 56,
            background: 'rgba(245,184,0,0.13)',
            clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
            animation: 'shape-tumble-arc 12s ease-in-out infinite',
            animationDelay: '-6s',
          }} />
          {/* 10. Star — gold, right */}
          <div style={{
            position: 'absolute', bottom: '30%', right: '6%',
            width: 42, height: 42,
            background: 'rgba(245,184,0,0.15)',
            clipPath: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
            animation: 'shape-tumble-r 10s ease-in-out infinite',
            animationDelay: '-4s',
          }} />
          {/* 11. Rectangle outline — white, lower-center */}
          <div style={{
            position: 'absolute', bottom: '15%', left: '38%',
            width: 92, height: 44,
            border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 6,
            animation: 'shape-tumble-l 13s ease-in-out infinite',
            animationDelay: '-1s',
          }} />
          {/* 12. Small triangle — gold, bottom-left */}
          <div style={{
            position: 'absolute', bottom: '12%', left: '18%',
            width: 32, height: 28,
            background: 'rgba(245,184,0,0.16)',
            clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            animation: 'shape-tumble-up 8s ease-in-out infinite',
            animationDelay: '-7s',
          }} />
          {/* 13. Diamond outline — gold, bottom-right area */}
          <div style={{
            position: 'absolute', bottom: '8%', right: '20%',
            width: 50, height: 50,
            border: '1.5px solid rgba(245,184,0,0.20)',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            animation: 'shape-tumble-d 11s ease-in-out infinite',
            animationDelay: '-8s',
          }} />
          {/* 14. Small pentagon fill — gold, bottom-center-right */}
          <div style={{
            position: 'absolute', bottom: '6%', right: '38%',
            width: 28, height: 28,
            background: 'rgba(245,184,0,0.18)',
            clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
            animation: 'shape-tumble-spin 7s ease-in-out infinite',
            animationDelay: '-2s',
          }} />
          {/* 15. Large circle outline — white, bottom-far-right */}
          <div style={{
            position: 'absolute', bottom: '4%', right: '2%',
            width: 98, height: 98,
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: '50%',
            animation: 'shape-tumble-d 18s ease-in-out infinite',
            animationDelay: '-9s',
          }} />
        </div>

        <div className="max-w-5xl mx-auto px-6" style={{ position: 'relative', zIndex: 2 }}>

          <p style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'rgba(245,184,0,0.75)',
            marginBottom: 22,
          }}>
            Pangasinan State University &middot; Lingayen Campus
          </p>

          <h1 style={{
            fontSize: 'clamp(2.6rem, 7vw, 4.8rem)',
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1.03,
            letterSpacing: '-0.035em',
            marginBottom: 28,
            maxWidth: 620,
          }}>
            Scholar Profiling<br />
            &amp; Records<br />
            <span style={{ color: '#f5b800' }}>Management.</span>
          </h1>

          <p style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 16,
            lineHeight: 1.7,
            maxWidth: 460,
            marginBottom: 44,
            fontWeight: 400,
          }}>
            The official document compliance and scholarship records portal for
            PSU Lingayen Campus — managed by the Office of the Coordinator for School Student Affairs.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/login"
              style={{
                background: '#f5b800', color: '#002570',
                fontWeight: 800, fontSize: 14,
                padding: '13px 30px', borderRadius: 9,
                textDecoration: 'none',
                boxShadow: '0 4px 0 #b88800',
                display: 'inline-block',
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 0 #b88800'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 0 #b88800'; }}
              onMouseDown={e => { e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 2px 0 #b88800'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 0 #b88800'; }}
            >
              Sign In
            </Link>
            <Link to="/register"
              style={{
                background: 'transparent', color: 'rgba(255,255,255,0.75)',
                fontWeight: 700, fontSize: 14,
                padding: '13px 28px', borderRadius: 9,
                textDecoration: 'none',
                border: '1.5px solid rgba(255,255,255,0.18)',
                display: 'inline-block',
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
            >
              Create Scholar Account
            </Link>
          </div>
        </div>
      </section>

      {/* About: Campus + CSSA */}
      <section style={{ padding: '72px 0 64px' }}>
        <div className="max-w-5xl mx-auto px-6">

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 48 }}>

            {/* Campus Info */}
            <div>
              <p style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
                textTransform: 'uppercase', color: '#7a8aaa', marginBottom: 20,
              }}>
                About the Campus
              </p>
              <h2 style={{
                fontSize: 22, fontWeight: 900, color: 'var(--text-strong)',
                letterSpacing: '-0.02em', marginBottom: 14,
                lineHeight: 1.2,
              }}>
                PSU Lingayen<br />
                <span style={{ color: '#003087' }}>Main Campus</span>
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.75, marginBottom: 24 }}>
                Pangasinan State University Lingayen is the main campus of PSU, located in the
                provincial capital of Pangasinan. It serves as the administrative and academic hub
                offering undergraduate and graduate programs across various disciplines.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(0,48,135,0.08)', border: '1px solid rgba(0,48,135,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MapPin size={14} color="#003087" strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#003087', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Address</p>
                    <p style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>Alvear St., Lingayen, Pangasinan 2401, Philippines</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(0,48,135,0.08)', border: '1px solid rgba(0,48,135,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Phone size={14} color="#003087" strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#003087', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Telephone</p>
                    <p style={{ fontSize: 13.5, color: 'var(--text)' }}>(075) 654-1211</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(0,48,135,0.08)', border: '1px solid rgba(0,48,135,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Mail size={14} color="#003087" strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#003087', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Email</p>
                    <p style={{ fontSize: 13.5, color: 'var(--text)' }}>cssa.lingayen@psu.edu.ph</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CSSA Info */}
            <div>
              <p style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
                textTransform: 'uppercase', color: '#7a8aaa', marginBottom: 20,
              }}>
                Administering Office
              </p>
              <h2 style={{
                fontSize: 22, fontWeight: 900, color: 'var(--text-strong)',
                letterSpacing: '-0.02em', marginBottom: 14,
                lineHeight: 1.2,
              }}>
                Coordinator for<br />
                <span style={{ color: '#003087' }}>School Student Affairs</span>
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.75, marginBottom: 24 }}>
                The CSSA Office is the designated unit responsible for all scholarship-related
                programs at PSU Lingayen. It oversees scholar eligibility, document compliance,
                and coordination with government and private scholarship sponsors.
              </p>
              <div className="grid grid-cols-2" style={{ gap: 12 }}>
                {cssaServices.map(({ Icon, label, desc }) => (
                  <div key={label} style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: 'var(--bg)',
                    boxShadow: '4px 4px 10px rgba(163,177,198,0.5), -3px -3px 8px rgba(255,255,255,0.9)',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, marginBottom: 10,
                      background: 'rgba(0,48,135,0.08)', border: '1px solid rgba(0,48,135,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={13} color="#003087" strokeWidth={2.5} />
                    </div>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 4, lineHeight: 1.3 }}>{label}</p>
                    <p style={{ fontSize: 11, color: '#7a8aaa', lineHeight: 1.5 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div style={{ maxWidth: 960, margin: '0 auto 0', padding: '0 24px' }}>
        <div style={{ height: 1, background: 'rgba(0,48,135,0.09)' }} />
      </div>

      {/* What this system does */}
      <section style={{ padding: '64px 0' }}>
        <div className="max-w-5xl mx-auto px-6">

          <p style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: '#7a8aaa', marginBottom: 40,
          }}>
            What this system does
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 0 }}>
            {roles.map(({ role, items }, i) => (
              <div key={role} style={{
                paddingRight: 40,
                paddingLeft: i === 0 ? 0 : 40,
                borderLeft: i > 0 ? '1px solid rgba(0,48,135,0.1)' : 'none',
              }}>
                <p style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#003087',
                  marginBottom: 18, paddingBottom: 12,
                  borderBottom: '3px solid #f5b800',
                  display: 'inline-block',
                }}>
                  {role}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {items.map(item => (
                    <li key={item} style={{
                      fontSize: 13.5, color: 'var(--text)', lineHeight: 1.45,
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}>
                      <span style={{ color: '#f5b800', fontWeight: 900, fontSize: 14, lineHeight: 1.3, flexShrink: 0 }}>—</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gold bar */}
      <div style={{ height: 5, background: 'linear-gradient(90deg, #f5b800, #ffd060, #f5b800)' }} />

      {/* CTA strip */}
      <section style={{ background: '#002570', padding: '48px 0' }}>
        <div className="max-w-5xl mx-auto px-6" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 28,
        }}>
          <div>
            <p style={{
              color: '#fff', fontSize: 22, fontWeight: 800,
              letterSpacing: '-0.02em', marginBottom: 6,
            }}>
              Access your scholarship dashboard.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
              Sign in with your PSU account to continue.
            </p>
          </div>
          <Link to="/login"
            style={{
              background: '#f5b800', color: '#002570',
              fontWeight: 800, fontSize: 14,
              padding: '13px 30px', borderRadius: 9,
              textDecoration: 'none', whiteSpace: 'nowrap',
              boxShadow: '0 4px 0 #b88800',
              display: 'inline-block',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 0 #b88800'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 0 #b88800'; }}
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#001040', padding: '18px 24px', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, margin: 0 }}>
          &copy; {new Date().getFullYear()} Pangasinan State University &middot; PSU e-Iskolar System &middot; Lingayen Campus
        </p>
      </footer>
    </div>
  );
}
