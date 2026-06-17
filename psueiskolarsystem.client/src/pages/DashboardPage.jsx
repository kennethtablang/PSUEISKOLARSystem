import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getAnnouncements } from '../api/announcements';
import { getScholars } from '../api/scholars';
import { getUsers } from '../api/users';
import { getSubmissions, getRequirements } from '../api/documents';
import { getActiveSemester } from '../api/settings';
import { getScholarProfile } from '../api/scholars';
import { GraduationCap, ClipboardList, AlertTriangle, BarChart2, Inbox, Clock, FileCheck } from 'lucide-react';
import { useTitle } from '../hooks/useTitle';

export default function DashboardPage() {
  useTitle('Dashboard');
  const { user, token } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState(null);
  const [compliance, setCompliance] = useState(null); // scholar-only

  useEffect(() => {
    getAnnouncements(token).then(setAnnouncements).catch(() => {});
    loadStats();
    if (user?.role === 'Scholar') loadScholarCompliance();
  }, []);

  async function loadStats() {
    try {
      if (user?.role === 'Administrator') {
        const [users, scholars, subs] = await Promise.all([
          getUsers(token),
          getScholars(token),
          getSubmissions(token, { status: 'Pending' }),
        ]);
        setStats({
          totalScholars: scholars.length,
          coordinators: users.filter(u => u.role === 'ScholarshipCoordinator' && u.isActive).length,
          flagged: scholars.filter(s => s.meetsRequirement === false).length,
          pendingReview: subs.length,
        });
      } else if (user?.role === 'ScholarshipCoordinator') {
        const [scholars, subs] = await Promise.all([
          getScholars(token),
          getSubmissions(token, { status: 'Pending' }),
        ]);
        setStats({
          totalScholars: scholars.length,
          noGwa: scholars.filter(s => s.latestGwa == null).length,
          flagged: scholars.filter(s => s.meetsRequirement === false).length,
          pendingReview: subs.length,
        });
      }
    } catch { /* stats are optional */ }
  }

  async function loadScholarCompliance() {
    try {
      const [profile, period] = await Promise.all([
        getScholarProfile(user.id, token).catch(() => null),
        getActiveSemester(token).catch(() => null),
      ]);
      const CURRENT_YEAR = period?.academicYear ?? (() => {
        const m = new Date().getMonth() + 1, y = new Date().getFullYear(), s = m >= 8 ? y : y - 1;
        return `${s}-${s + 1}`;
      })();
      const [reqs, subs] = await Promise.all([
        getRequirements(token, { scholarshipTypeId: profile?.scholarshipTypeId }),
        getSubmissions(token, { academicYear: CURRENT_YEAR }),
      ]);
      const required = reqs.filter(r => r.isRequired);
      const verified = subs.filter(s => s.status === 'Verified');
      const pending = subs.filter(s => s.status === 'Pending');
      const incomplete = reqs.filter(r =>
        subs.find(s => s.requirementId === r.id)?.status === 'Incomplete'
      );
      setCompliance({
        totalRequired: required.length,
        verifiedCount: verified.length,
        pendingCount: pending.length,
        incompleteItems: incomplete.map(r => r.name),
        scholarshipTypeName: profile?.scholarshipTypeName ?? null,
      });
    } catch { /* compliance is optional */ }
  }

  return (
    <Layout>
      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-7">
          <h1 className="page-title">
            Welcome back, {user?.fullName?.split(' ')[0]}
          </h1>
          <p className="page-subtitle">
            PSU Lingayen Campus · {user?.role === 'ScholarshipCoordinator' ? 'Coordinator' : user?.role}
          </p>
          <span className="page-title-bar" />
        </div>

        {/* Admin / Coordinator stats */}
        {stats && user?.role !== 'Scholar' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {user?.role === 'Administrator' && (
              <>
                <StatCard label="Total Scholars" value={stats.totalScholars} Icon={GraduationCap} color="#dce8ff" iconColor="#003087" />
                <StatCard label="Coordinators"   value={stats.coordinators}  Icon={ClipboardList}  color="#ede0ff" iconColor="#6030b0" />
                <StatCard label="Flagged GWA"    value={stats.flagged}       Icon={AlertTriangle}  color={stats.flagged > 0 ? '#ffe8d6' : '#d4f5e2'} iconColor={stats.flagged > 0 ? '#c05000' : '#108050'} />
                <StatCard label="Pending Review" value={stats.pendingReview} Icon={Clock}          color={stats.pendingReview > 0 ? '#fff3cd' : '#d4f5e2'} iconColor={stats.pendingReview > 0 ? '#c07800' : '#108050'} />
              </>
            )}
            {user?.role === 'ScholarshipCoordinator' && (
              <>
                <StatCard label="Scholars"      value={stats.totalScholars} Icon={GraduationCap} color="#dce8ff" iconColor="#003087" />
                <StatCard label="No GWA Yet"    value={stats.noGwa}         Icon={BarChart2}     color="#fff3cd" iconColor="#c07800" />
                <StatCard label="Flagged GWA"   value={stats.flagged}       Icon={AlertTriangle} color={stats.flagged > 0 ? '#ffe8d6' : '#d4f5e2'} iconColor={stats.flagged > 0 ? '#c05000' : '#108050'} />
                <StatCard label="Pending Review" value={stats.pendingReview} Icon={Clock}        color={stats.pendingReview > 0 ? '#fff3cd' : '#d4f5e2'} iconColor={stats.pendingReview > 0 ? '#c07800' : '#108050'} />
              </>
            )}
          </div>
        )}

        {/* Scholar compliance section */}
        {user?.role === 'Scholar' && compliance && (
          <div className="mb-8 space-y-4">
            <h2 className="text-base font-black" style={{ color: '#0d1a33' }}>Document Compliance</h2>

            {/* Progress card */}
            <div className="clay-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold" style={{ color: '#0d1a33' }}>
                    {compliance.scholarshipTypeName ?? 'Required Documents'} · 2025–2026
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#4a5a7a' }}>
                    {compliance.verifiedCount} of {compliance.totalRequired} required documents verified
                  </p>
                </div>
                <span className="text-2xl font-black" style={{ color: '#003087' }}>
                  {compliance.totalRequired > 0
                    ? `${Math.round((compliance.verifiedCount / compliance.totalRequired) * 100)}%`
                    : '—'}
                </span>
              </div>

              {/* Progress bar */}
              {(() => {
                const pct = compliance.totalRequired > 0
                  ? Math.round((compliance.verifiedCount / compliance.totalRequired) * 100)
                  : 0;
                const isComplete = pct === 100;
                return (
                  <div className="clay-progress-track w-full h-3 mt-3">
                    <div className="clay-progress-fill" style={{
                      width: `${pct}%`,
                      background: isComplete
                        ? 'linear-gradient(90deg, #f5b800, #ffd060)'
                        : 'linear-gradient(90deg, #003087, #0040b8)',
                    }} />
                  </div>
                );
              })()}

              {/* Status pills */}
              <div className="flex gap-3 mt-4 flex-wrap">
                <Pill label={`${compliance.verifiedCount} Verified`}  bg="#d4f5e2" color="#0a5a3a" Icon={FileCheck} />
                {compliance.pendingCount > 0 && (
                  <Pill label={`${compliance.pendingCount} Pending`} bg="#fff3cd" color="#7d5a00" Icon={Clock} />
                )}
                {compliance.incompleteItems.length > 0 && (
                  <Pill label={`${compliance.incompleteItems.length} Incomplete`} bg="#ffe8d6" color="#c05000" Icon={AlertTriangle} />
                )}
              </div>
            </div>

            {/* Incomplete items list */}
            {compliance.incompleteItems.length > 0 && (
              <div className="clay-card p-5" style={{ background: '#fffbe8', border: '1.5px solid #f5d060' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#7a5500' }}>
                  Needs Resubmission
                </p>
                <ul className="space-y-1.5">
                  {compliance.incompleteItems.map(name => (
                    <li key={name} className="flex items-center gap-2 text-sm" style={{ color: '#7a5500' }}>
                      <AlertTriangle size={13} strokeWidth={2.5} />
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Announcements */}
        <div>
          <h2 className="text-base font-black mb-4" style={{ color: '#0d1a33' }}>Announcements</h2>
          {announcements.length === 0 ? (
            <div className="clay-card p-8 text-center">
              <Inbox size={32} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: '#b0bdd0' }} />
              <p className="text-sm" style={{ color: '#7a8aaa' }}>No announcements at this time.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map(a => <AnnouncementItem key={a.id} a={a} />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ label, value, Icon, color, iconColor }) {
  return (
    <div className="rounded-3xl p-5" style={{
      background: color,
      boxShadow: '6px 6px 16px rgba(163,177,198,0.5), -4px -4px 12px rgba(255,255,255,0.85)',
    }}>
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3"
        style={{ background: 'rgba(255,255,255,0.5)', boxShadow: '3px 3px 8px rgba(163,177,198,0.35), -2px -2px 5px rgba(255,255,255,0.9)' }}>
        <Icon size={18} strokeWidth={2} style={{ color: iconColor }} />
      </div>
      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(0,0,0,0.42)' }}>{label}</p>
      <p className="text-3xl font-black" style={{ color: '#0d1a33' }}>{value}</p>
    </div>
  );
}

function Pill({ label, bg, color, Icon }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold"
      style={{ background: bg, color, border: '1.5px solid rgba(0,0,0,0.06)' }}>
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </span>
  );
}

function AnnouncementItem({ a }) {
  const date = new Date(a.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div className="clay-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: '#0d1a33' }}>{a.title}</p>
          <p className="text-sm mt-1 leading-relaxed whitespace-pre-line" style={{ color: '#2a3a5a' }}>{a.content}</p>
        </div>
        {a.expiresAt && (
          <span className="clay-badge shrink-0 text-xs" style={{ background: '#fff3cd', color: '#7d5a00', border: '1.5px solid #f0d060' }}>
            Expires {new Date(a.expiresAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className="text-xs" style={{ color: '#7a8aaa' }}>{date} · {a.createdBy}</span>
        {a.targetRole && <span className="clay-badge text-xs badge-coord">{a.targetRole}</span>}
      </div>
    </div>
  );
}
