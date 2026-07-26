import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getScholarshipVerification } from '../api/scholars';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { useTitle } from '../hooks/useTitle';
import { ShieldCheck, AlertTriangle, AlertOctagon, Info, RefreshCw, Users, GraduationCap, HelpCircle } from 'lucide-react';

const SEVERITY = {
  error:   { label: 'Conflict', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', Icon: AlertOctagon },
  warning: { label: 'Check',    bg: '#fff3cd', color: '#7d5a00', border: '#f5d060', Icon: AlertTriangle },
  info:    { label: 'History',  bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', Icon: Info },
};

export default function ScholarshipVerificationPage() {
  useTitle('Scholarship Verification');
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await getScholarshipVerification(token));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const conflicts = data?.findings.filter(f => f.severity === 'error').length ?? 0;

  return (
    <Layout>
      <div className="page-shell">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
          <div>
            <h1 className="page-title">Scholarship Verification</h1>
            <p className="page-subtitle">
              A student may hold only one scholarship at a time. This report lists every scholar
              whose scholarship records need a second look.
            </p>
            <span className="page-title-bar" />
          </div>
          <button onClick={load} disabled={loading} className="clay-btn clay-btn-ghost px-4 py-2.5 text-sm flex items-center gap-1.5">
            <RefreshCw size={14} strokeWidth={2.4} className={loading ? 'animate-spin' : ''} /> Re-run check
          </button>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: '#e03030' }}>{error}</p>}

        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Tile label="Scholars" value={data.totalScholars} Icon={Users} bg="#dce8ff" iconColor="#003087" />
            <Tile label="With a scholarship" value={data.scholarsWithOneScholarship} Icon={GraduationCap} bg="#d4f5e2" iconColor="#108050" />
            <Tile label="No scholarship yet" value={data.scholarsWithoutScholarship} Icon={HelpCircle} bg="#fff3cd" iconColor="#c07800" />
            <Tile
              label="Needs attention"
              value={data.flagged}
              Icon={conflicts > 0 ? AlertOctagon : ShieldCheck}
              bg={conflicts > 0 ? '#ffe0e0' : '#d4f5e2'}
              iconColor={conflicts > 0 ? '#c02020' : '#108050'}
            />
          </div>
        )}

        <div className="clay-card overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : !data || data.findings.length === 0 ? (
            <EmptyState
              title="Every scholar checks out"
              message="No duplicate student IDs, no overlapping scholarships, and every profile matches its assignment record."
            />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Scholar', 'Student ID', 'Current Scholarship', 'Records', 'Finding', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.findings.map(f => {
                  const sev = SEVERITY[f.severity] ?? SEVERITY.info;
                  return (
                    <tr key={f.userId} className="clay-table-row">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{f.fullName}</p>
                        <p className="text-xs" style={{ color: '#7a8aaa' }}>{f.email}</p>
                      </td>
                      <td className="px-5 py-3.5 font-mono" style={{ color: 'var(--text)' }}>{f.studentId || '—'}</td>
                      <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{f.currentScholarship ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs" style={{ color: 'var(--text)' }}>
                          <strong style={{ color: f.openAssignments > 1 ? '#c02020' : 'var(--text-strong)' }}>
                            {f.openAssignments}
                          </strong> open · {f.totalAssignments} total
                        </span>
                      </td>
                      <td className="px-5 py-3.5" style={{ maxWidth: 340 }}>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold mb-1.5"
                          style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                          <sev.Icon size={11} strokeWidth={2.6} />
                          {sev.label}
                        </span>
                        <ul className="space-y-0.5">
                          {f.issues.map(issue => (
                            <li key={issue} className="text-xs" style={{ color: 'var(--text)' }}>• {issue}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => navigate(`/scholars/${f.userId}`)}
                          className="clay-btn clay-btn-ghost text-xs px-3"
                          style={{ minHeight: 32, borderRadius: 10, color: '#003087', fontWeight: 700 }}
                        >
                          Resolve
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>

        <p className="text-xs mt-4 leading-relaxed" style={{ color: '#9aaabb' }}>
          <strong>Conflict</strong> — two scholarships are open at once, a profile disagrees with its
          assignment record, or a student ID is shared. <strong>Check</strong> — a scholarship is set
          without a matching record, or the reverse. <strong>History</strong> — the scholar transferred
          scholarships at some point; nothing is wrong, the trail is just worth reading.
        </p>
      </div>
    </Layout>
  );
}

function Tile({ label, value, Icon, bg, iconColor }) {
  return (
    <div className="rounded-3xl p-5 stat-tile" style={{ '--tile-bg': bg }}>
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3 stat-tile-icon">
        <Icon size={18} strokeWidth={2} style={{ color: iconColor }} />
      </div>
      <p className="text-xs font-bold uppercase tracking-wider mb-1 stat-tile-label">{label}</p>
      <p className="text-3xl font-black stat-tile-value">{value}</p>
    </div>
  );
}
