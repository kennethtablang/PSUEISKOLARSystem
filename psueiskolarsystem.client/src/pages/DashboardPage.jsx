import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getAnnouncements } from '../api/announcements';
import AnnouncementCard from '../components/AnnouncementCard';
import { getScholarProfile, getScholars } from '../api/scholars';
import { getUsers } from '../api/users';
import { getRecentActivity } from '../api/auditLog';
import { getAnalyticsOverview } from '../api/analytics';
import { getSubmissions, getRequirements } from '../api/documents';
import { getActiveSemester } from '../api/settings';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getDeadlines } from '../api/deadlines';
import { GraduationCap, ClipboardList, AlertTriangle, BarChart2, Inbox, Clock, FileCheck, ArrowRight, RefreshCw, CalendarClock, MessageSquare, Megaphone, FolderOpen, User, Activity } from 'lucide-react';
import { useTitle } from '../hooks/useTitle';

export default function DashboardPage() {
  useTitle('Dashboard');
  const { user, token } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [scholarGwa, setScholarGwa] = useState(null); // { latestGwa, minimumGwa, scholarshipTypeName, meetsRequirement }
  const [renewal, setRenewal] = useState(null); // { count } of lapsed/suspended scholars
  const [overview, setOverview] = useState(null); // full analytics overview (admin/coord)
  const [deadlines, setDeadlines] = useState([]); // upcoming deadlines (scholar)
  const [activity, setActivity] = useState([]); // recent audit-log activity (staff)

  useEffect(() => {
    getAnnouncements(token).then(setAnnouncements).catch(() => {});
    loadStats();
    if (user?.role === 'Scholar') {
      loadScholarCompliance();
      loadScholarGwa();
    } else {
      loadRenewal();
      getRecentActivity(token).then(setActivity).catch(() => {});
    }
  }, []);

  async function loadRenewal() {
    try {
      const [lapsed, suspended] = await Promise.all([
        getScholars(token, { lifecycleStatus: 'Lapsed', pageSize: 1 }),
        getScholars(token, { lifecycleStatus: 'Suspended', pageSize: 1 }),
      ]);
      setRenewal({ count: (lapsed.total ?? 0) + (suspended.total ?? 0) });
    } catch { /* optional */ }
  }

  async function loadStats() {
    try {
      if (user?.role === 'Administrator') {
        const [coords, ov] = await Promise.all([
          getUsers(token, { role: 'ScholarshipCoordinator', pageSize: 100 }),
          getAnalyticsOverview(token),
        ]);
        setOverview(ov);
        setStats({
          totalScholars: ov.totalScholars,
          coordinators: (coords.items ?? []).filter(u => u.isActive).length,
          flagged: ov.nonCompliant,
          pendingReview: ov.submissions.pending,
        });
      } else if (user?.role === 'ScholarshipCoordinator') {
        const ov = await getAnalyticsOverview(token);
        setOverview(ov);
        setStats({
          totalScholars: ov.totalScholars,
          noGwa: ov.noGwa,
          flagged: ov.nonCompliant,
          pendingReview: ov.submissions.pending,
        });
      }
    } catch { /* stats are optional */ }
  }

  async function loadScholarGwa() {
    try {
      const profile = await getScholarProfile(user.id, token).catch(() => null);
      if (profile?.latestGwa != null) {
        setScholarGwa({
          latestGwa: profile.latestGwa,
          minimumGwa: profile.minimumGwa,
          scholarshipTypeName: profile.scholarshipTypeName,
          meetsRequirement: profile.meetsRequirement,
        });
      }
    } catch { /* optional */ }
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
      const semester = period?.semester ?? 1;
      const [reqs, subs, dls] = await Promise.all([
        getRequirements(token, { scholarshipTypeId: profile?.scholarshipTypeId }),
        getSubmissions(token, { academicYear: CURRENT_YEAR }),
        getDeadlines(token, { academicYear: CURRENT_YEAR, semester }).catch(() => []),
      ]);

      // Upcoming deadlines for requirements not yet verified, due in the future.
      const reqIds = new Set(reqs.map(r => r.id));
      const submittedVerified = new Set(subs.filter(s => s.status === 'Verified').map(s => s.requirementId));
      const upcoming = dls
        .filter(d => reqIds.has(d.requirementId) && !submittedVerified.has(d.requirementId) && new Date(d.dueDate) > new Date())
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 3);
      setDeadlines(upcoming);

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
        academicYear: CURRENT_YEAR,
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
            {user?.campusName ?? 'PSU'} · {user?.role === 'ScholarshipCoordinator' ? 'Coordinator' : user?.role}
          </p>
          <span className="page-title-bar" />
        </div>

        {/* Scholar: prominent next-action nudge when documents need attention */}
        {user?.role === 'Scholar' && compliance && (() => {
          const missing = Math.max(0, (compliance.totalRequired ?? 0) - (compliance.verifiedCount ?? 0));
          const incomplete = compliance.incompleteItems?.length ?? 0;
          if (missing === 0 && incomplete === 0) return null;
          const primary = incomplete > 0
            ? `${incomplete} document${incomplete !== 1 ? 's' : ''} need${incomplete === 1 ? 's' : ''} resubmission`
            : `${missing} required document${missing !== 1 ? 's' : ''} still to submit`;
          return (
            <Link to="/my-documents"
              className="flex items-center gap-4 p-4 rounded-2xl mb-8"
              style={{ background: 'linear-gradient(135deg, #c05000, #e07020)', color: '#fff', textDecoration: 'none' }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <AlertTriangle size={22} strokeWidth={2.4} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black">Action needed: {primary}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  Submit before your deadline to keep your scholarship compliant. Tap to review now.
                </p>
              </div>
              <ArrowRight size={20} strokeWidth={2.4} className="shrink-0" />
            </Link>
          );
        })()}

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

        {/* Quick actions (admin / coordinator) */}
        {user?.role !== 'Scholar' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <QuickAction to="/document-review" Icon={FileCheck} label="Review Documents" />
            <QuickAction to="/scholars" Icon={GraduationCap} label="Scholars" />
            <QuickAction to="/announcements" Icon={Megaphone} label="Announcements" />
            <QuickAction to="/analytics" Icon={BarChart2} label="Data Visualization" />
          </div>
        )}

        {/* Visual breakdown (admin / coordinator) */}
        {overview && user?.role !== 'Scholar' && (
          <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <DonutCard title="GWA Compliance" data={[
              { name: 'Compliant', value: overview.compliant, color: '#10a060' },
              { name: 'Flagged', value: overview.nonCompliant, color: '#e0603a' },
              { name: 'No GWA', value: overview.noGwa, color: '#b0bdd0' },
            ]} />
            <DonutCard title="Document Submissions" data={[
              { name: 'Verified', value: overview.submissions.verified, color: '#10a060' },
              { name: 'Pending', value: overview.submissions.pending, color: '#e0a000' },
              { name: 'Incomplete', value: overview.submissions.incomplete, color: '#e0603a' },
            ]} />
          </div>
        )}

        {/* Renewal / lifecycle attention (FR-18.4) */}
        {user?.role !== 'Scholar' && renewal?.count > 0 && (
          <Link to="/scholars?status=Lapsed" className="block mb-8">
            <div className="rounded-3xl p-5 flex items-center gap-4"
              style={{ background: 'rgba(240,120,50,0.13)', border: '1.5px solid rgba(240,120,50,0.3)', boxShadow: '4px 4px 14px rgba(0,0,0,0.06)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(240,120,50,0.18)' }}>
                <RefreshCw size={20} strokeWidth={2} style={{ color: '#c05000' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>
                  {renewal.count} scholar{renewal.count !== 1 ? 's' : ''} need renewal attention
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#c86020' }}>
                  Scholars marked Lapsed or Suspended — review their standing.
                </p>
              </div>
              <ArrowRight size={18} strokeWidth={2.5} style={{ color: '#c05000' }} />
            </div>
          </Link>
        )}

        {/* Scholar GWA status card */}
        {user?.role === 'Scholar' && scholarGwa && (
          <div className="mb-6">
            <div className="rounded-3xl p-5 flex items-center gap-4"
              style={{
                background: scholarGwa.meetsRequirement === false ? '#fff2ec' : '#d4f5e2',
                boxShadow: '6px 6px 16px rgba(163,177,198,0.5), -4px -4px 12px rgba(255,255,255,0.85)',
              }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.55)',
                  boxShadow: '3px 3px 8px rgba(163,177,198,0.35), -2px -2px 5px rgba(255,255,255,0.9)',
                }}>
                {scholarGwa.meetsRequirement === false
                  ? <AlertTriangle size={22} strokeWidth={2} style={{ color: '#c05000' }} />
                  : <FileCheck size={22} strokeWidth={2} style={{ color: '#108050' }} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5"
                  style={{ color: scholarGwa.meetsRequirement === false ? 'rgba(192,80,0,0.6)' : 'rgba(16,128,80,0.6)' }}>
                  GWA Status · {scholarGwa.scholarshipTypeName ?? 'Scholarship'}
                </p>
                <p className="text-3xl font-black" style={{ color: '#0d1a33' }}>
                  {scholarGwa.latestGwa.toFixed(2)}
                </p>
                <p className="text-xs mt-0.5"
                  style={{ color: scholarGwa.meetsRequirement === false ? '#7a3010' : '#0a5a3a' }}>
                  {scholarGwa.meetsRequirement === false
                    ? `Below threshold — minimum required: ${scholarGwa.minimumGwa?.toFixed(2)}`
                    : 'Meeting scholarship GWA requirement'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming deadlines (scholar) */}
        {user?.role === 'Scholar' && deadlines.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-black mb-4" style={{ color: 'var(--text-strong)' }}>Upcoming Deadlines</h2>
            <div className="space-y-2">
              {deadlines.map(d => {
                const days = Math.ceil((new Date(d.dueDate) - Date.now()) / 86400000);
                return (
                  <Link key={d.id} to="/my-documents" className="clay-card p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(234,88,12,0.1)' }}>
                      <CalendarClock size={18} color="#c2410c" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: 'var(--text-strong)' }}>{d.requirementName}</p>
                      <p className="text-xs" style={{ color: days <= 3 ? '#c2410c' : '#7a8aaa' }}>
                        Due {new Date(d.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {days <= 0 ? 'today' : `in ${days} day${days > 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <ArrowRight size={16} color="#c2410c" strokeWidth={2.5} />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Scholar compliance section */}
        {user?.role === 'Scholar' && compliance && (
          <div className="mb-8 space-y-4">
            <h2 className="text-base font-black" style={{ color: 'var(--text-strong)' }}>Document Compliance</h2>

            {/* Progress card */}
            <div className="clay-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-strong)' }}>
                    {compliance.scholarshipTypeName ?? 'Required Documents'} · {compliance.academicYear ?? ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
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
              <div className="clay-card p-5" style={{ background: 'rgba(245,200,60,0.13)', border: '1.5px solid rgba(245,200,60,0.4)' }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#b58600' }}>
                  Needs Resubmission
                </p>
                <ul className="space-y-1.5">
                  {compliance.incompleteItems.map(name => (
                    <li key={name} className="flex items-center gap-2 text-sm" style={{ color: '#b58600' }}>
                      <AlertTriangle size={13} strokeWidth={2.5} />
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA to My Documents */}
            {(compliance.pendingCount > 0 || compliance.incompleteItems.length > 0 || compliance.verifiedCount < compliance.totalRequired) && (
              <Link to="/my-documents"
                className="flex items-center justify-between p-4 rounded-2xl"
                style={{ background: '#002570', color: '#ffffff', textDecoration: 'none' }}>
                <div>
                  <p className="text-sm font-bold">Go to My Documents</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {compliance.incompleteItems.length > 0
                      ? `${compliance.incompleteItems.length} document${compliance.incompleteItems.length !== 1 ? 's' : ''} need resubmission`
                      : `${compliance.totalRequired - compliance.verifiedCount} document${compliance.totalRequired - compliance.verifiedCount !== 1 ? 's' : ''} still to verify`}
                  </p>
                </div>
                <ArrowRight size={20} strokeWidth={2} />
              </Link>
            )}
          </div>
        )}

        {/* Quick actions (scholar) */}
        {user?.role === 'Scholar' && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <QuickAction to="/my-documents" Icon={FolderOpen} label="My Documents" />
            <QuickAction to="/messages" Icon={MessageSquare} label="Messages" />
            <QuickAction to="/my-profile" Icon={User} label="My Profile" />
          </div>
        )}

        {/* Recent activity (staff) */}
        {user?.role !== 'Scholar' && activity.length > 0 && (
          <div>
            <h2 className="text-base font-black mb-4" style={{ color: 'var(--text-strong)' }}>Recent Activity</h2>
            <div className="clay-card divide-y" style={{ borderColor: 'transparent' }}>
              {activity.map(a => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3.5" style={{ borderTop: '1px solid rgba(0,48,135,0.05)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,48,135,0.08)' }}>
                    <Activity size={15} strokeWidth={2.2} color="#003087" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: 'var(--text-strong)' }}>
                      <span className="font-semibold">{a.userName}</span>{' '}
                      <span style={{ color: 'var(--text)' }}>{a.details || a.action}</span>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#9aa6bc' }}>{relativeTime(a.timestampUtc)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Announcements */}
        <div>
          <h2 className="text-base font-black mb-4" style={{ color: 'var(--text-strong)' }}>Announcements</h2>
          {announcements.length === 0 ? (
            <div className="clay-card p-8 text-center">
              <Inbox size={32} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: '#b0bdd0' }} />
              <p className="text-sm" style={{ color: '#7a8aaa' }}>No announcements at this time.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map(a => <AnnouncementCard key={a.id} a={a} variant="feed" />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function relativeTime(iso) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
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

function QuickAction({ to, Icon, label }) {
  return (
    <Link to={to} className="clay-card p-4 flex flex-col items-center gap-2 text-center transition-opacity hover:opacity-90">
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,48,135,0.08)' }}>
        <Icon size={20} color="#003087" strokeWidth={2} />
      </div>
      <span className="text-xs font-bold" style={{ color: 'var(--text-strong)' }}>{label}</span>
    </Link>
  );
}

function DonutCard({ title, data }) {
  const items = data.filter(d => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="clay-card p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#7a8aaa' }}>{title}</h3>
      {total === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: '#9aaabb' }}>No data yet.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div style={{ width: 118, height: 118, flexShrink: 0 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={items} dataKey="value" nameKey="name" innerRadius={34} outerRadius={54} paddingAngle={2}>
                  {items.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            {data.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text)' }}>{d.name}</span>
                <span className="ml-auto font-bold" style={{ color: 'var(--text-strong)' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

