import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import AnnouncementCard from '../components/AnnouncementCard';
import CollapsibleSection from '../components/CollapsibleSection';
import { getDashboard } from '../api/dashboard';
import { exportSummary } from '../api/reports';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { vizTokens, tooltipStyle } from '../constants/viz';
import InfoTip from '../components/InfoTip';
import { MissedDeadlinesCard, ScholarshipReleasesCard, OneTimeGrantsCard } from '../components/ScholarHistoryCards';
import { getScholarReleases } from '../api/scholarshipReleases';
import { getOneTimeGrants } from '../api/oneTimeGrants';
import { getMissedDeadlines } from '../api/deadlines';
import { GraduationCap, ClipboardList, AlertTriangle, BarChart2, Inbox, Clock, FileCheck, ArrowRight, RefreshCw, CalendarClock, MessageSquare, Megaphone, FolderOpen, User, Activity, UserCheck, Banknote, ShieldX, ShieldQuestion, MapPin, Download, FileText } from 'lucide-react';
import { useTitle } from '../hooks/useTitle';
import { useMyCampus } from '../hooks/useMyCampus';
import { useNow, daysUntil } from '../hooks/useNow';

export default function DashboardPage() {
  useTitle('Dashboard');
  const { user, token } = useAuth();
  const myCampus = useMyCampus();
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [scholarGwa, setScholarGwa] = useState(null);      // { latestGwa, minimumGwa, scholarshipTypeName, meetsRequirement }
  const [renewal, setRenewal] = useState(null);            // { count } of lapsed/suspended scholars
  const [overview, setOverview] = useState(null);          // analytics overview (staff)
  const [deadlines, setDeadlines] = useState([]);          // next open deadlines (scholar)
  const [activity, setActivity] = useState([]);            // recent audit-log activity (staff)
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [grantSummary, setGrantSummary] = useState(null);  // one-time grant totals (staff)
  // The scholar's own history, moved here from My Profile: releases, grants, missed deadlines.
  const [myReleases, setMyReleases] = useState([]);
  const [myGrants, setMyGrants] = useState(null);
  const [myMissed, setMyMissed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Deadline countdowns are rendered against this rather than a Date.now() in the loop, so
  // they stay pure and a dashboard left open still counts down.
  const now = useNow(60 * 60 * 1000);

  // The signed-in scholar's own verification state travels on the auth user.
  const approval = user?.approvalStatus
    ? { status: user.approvalStatus, note: user.approvalNote }
    : null;

  /* One request for the whole screen. This page used to fire eleven — analytics, scholars,
     submissions, requirements, users, announcements, deadlines, activity, approvals, grants,
     and the active semester — and then cross-reference three of the responses in the browser
     to work out compliance. GET /api/dashboard returns the payload for whichever role the
     token carries, so there is no role branch here beyond unpacking it. */
  useEffect(() => {
    let cancelled = false;

    getDashboard(token)
      .then(data => {
        if (cancelled) return;
        setLoadError('');
        setAnnouncements(data.announcements ?? []);

        if (data.scholar) {
          setCompliance(data.scholar.compliance);
          setScholarGwa(data.scholar.gwa);
          setDeadlines(data.scholar.deadlines ?? []);
        }

        if (data.staff) {
          const { overview: ov, coordinators, renewalCount, pendingApprovals: pending, grants, activity: log } = data.staff;
          setOverview(ov);
          setStats({
            totalScholars: ov.totalScholars,
            coordinators,
            noGwa: ov.noGwa,
            flagged: ov.nonCompliant,
            pendingReview: ov.submissions.pending,
          });
          setRenewal({ count: renewalCount });
          setPendingApprovals(pending);
          setGrantSummary(grants);
          setActivity(log ?? []);
        }
      })
      /* This used to be swallowed on the grounds that the empty states read as "nothing to
         show" — which is exactly the problem: a failed load told the user there were no
         announcements, no pending reviews and no deadlines, when the truth was unknown. */
      .catch(e => { if (!cancelled) setLoadError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [token, reloadKey]);

  useEffect(() => {
    if (user?.role !== 'Scholar' || !user?.id) return;
    let cancelled = false;
    Promise.all([
      getScholarReleases(user.id, token).catch(() => []),
      getOneTimeGrants(token, { scholarId: user.id, pageSize: 50 }).catch(() => null),
      getMissedDeadlines(token, user.id).catch(() => []),
    ]).then(([rel, gr, miss]) => {
      if (cancelled) return;
      setMyReleases(rel ?? []);
      setMyGrants(gr);
      setMyMissed(miss ?? []);
    });
    return () => { cancelled = true; };
  }, [token, user?.role, user?.id, reloadKey]);

  function retry() {
    setLoading(true);
    setLoadError('');
    setReloadKey(k => k + 1);
  }

  const isStaff = user?.role !== 'Scholar';
  const isCoordinator = user?.role === 'ScholarshipCoordinator';

  // The auto-generated summary report: a coordinator's covers their campus only.
  const [reporting, setReporting] = useState(null);   // 'pdf' | 'xlsx' while downloading
  const [reportError, setReportError] = useState('');
  async function downloadSummary(format) {
    setReporting(format); setReportError('');
    try { await exportSummary(token, {}, format); }
    catch (e) { setReportError(e.message); }
    finally { setReporting(null); }
  }

  return (
    <Layout>
      {/* Full-width dashboard: the primary column carries the working content, the right
          rail carries the feeds (announcements, activity, deadlines) that used to be
          stacked underneath it. The rail collapses under the main column below 1440px. */}
      <div className="page-shell">
        {/* Header */}
        <div className="page-head">
          <div>
            <h1 className="page-title">
              Welcome back, {user?.fullName?.split(' ')[0]}
            </h1>
            {isCoordinator && myCampus && (
              <p className="text-xs font-black uppercase tracking-wider mt-1 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                <MapPin size={12} strokeWidth={2.6} /> {myCampus.name} Dashboard
              </p>
            )}
            <p className="page-subtitle">
              {user?.role === 'ScholarshipCoordinator'
                ? `${myCampus ? `PSU ${myCampus.name}` : 'Pangasinan State University'} · Coordinator`
                : `Pangasinan State University · ${user?.role}`}
            </p>
            <span className="page-title-bar" />
          </div>
        </div>

        {loadError && (
          <div role="alert" className="mb-6 p-4 rounded-2xl flex items-center gap-3 flex-wrap"
            style={{ background: 'var(--danger-bg)', border: '1.5px solid var(--danger-border)', color: 'var(--danger)' }}>
            <AlertTriangle size={18} strokeWidth={2.4} className="shrink-0" />
            <p className="text-sm font-medium flex-1 min-w-0">
              The dashboard could not be loaded, so the figures below may be missing. {loadError}
            </p>
            <button onClick={retry} className="clay-btn clay-btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5">
              <RefreshCw size={12} strokeWidth={2.5} /> Try again
            </button>
          </div>
        )}
        {loading && !loadError && (
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }} aria-live="polite">Loading your dashboard…</p>
        )}

        <div className="page-split">
        <div className="min-w-0">

        {/* Scholar: registration still awaiting verification */}
        {user?.role === 'Scholar' && approval && approval.status !== 'Approved' && (
          <div className="flex items-start gap-4 p-4 rounded-2xl mb-8"
            style={approval.status === 'Rejected'
              ? { background: 'linear-gradient(135deg, #a01818, #c83030)', color: '#fff' }
              : { background: 'linear-gradient(135deg, #8a6000, #c08800)', color: '#fff' }}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
              {approval.status === 'Rejected'
                ? <ShieldX size={22} strokeWidth={2.4} />
                : <ShieldQuestion size={22} strokeWidth={2.4} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black">
                {approval.status === 'Rejected'
                  ? 'Your registration was not approved'
                  : 'Your registration is awaiting verification'}
              </p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {approval.status === 'Rejected'
                  ? 'Document submission stays locked. Please contact the scholarship office to sort this out.'
                  : 'The scholarship office is reviewing your details. You can finish your profile now — document submission unlocks once you are approved.'}
              </p>
              {approval.note && (
                <p className="text-xs mt-1.5 italic" style={{ color: 'rgba(255,255,255,0.92)' }}>“{approval.note}”</p>
              )}
            </div>
            <Link to="/my-profile" className="shrink-0 self-center" style={{ color: '#fff' }}>
              <ArrowRight size={20} strokeWidth={2.4} />
            </Link>
          </div>
        )}

        {/* Scholar: prominent next-action nudge when documents need attention */}
        {user?.role === 'Scholar' && compliance && (() => {
          // Submitted-and-waiting documents are not something the scholar can act on. Counting
          // them as "still to submit" raised an "Action needed" banner for a scholar who had
          // handed everything in and was simply waiting for review.
          const incomplete = compliance.incompleteItems?.length ?? 0;
          const missing = Math.max(0,
            (compliance.totalRequired ?? 0) - (compliance.verifiedCount ?? 0) - (compliance.pendingCount ?? 0) - incomplete);
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

        {/* Campus scope + auto-generated report (admin / coordinator). A coordinator's whole
            dashboard is their campus's; say so, and offer the written-up version of it. */}
        {isStaff && user?.role !== 'Grantee' && (
          <div className="clay-card p-4 mb-6 flex items-center gap-4 flex-wrap">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-wash)' }}>
              <FileText size={20} strokeWidth={2.2} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>
                {isCoordinator
                  ? `Showing ${myCampus ? myCampus.name : 'your campus'} only`
                  : 'Showing every campus'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
                {isCoordinator
                  ? 'Every figure here comes from the scholars and grantees studying at your campus. Download the summary report for a ready-to-print write-up of it.'
                  : 'Download the summary report for a ready-to-print write-up of the whole university, or pick a campus on the Data Visualization page.'}
              </p>
              {reportError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{reportError}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => downloadSummary('pdf')} disabled={!!reporting}
                className="clay-btn clay-btn-primary px-4 py-2 text-xs flex items-center gap-1.5">
                <Download size={13} strokeWidth={2.5} /> {reporting === 'pdf' ? 'Generating…' : 'Summary Report (PDF)'}
              </button>
              <button onClick={() => downloadSummary('xlsx')} disabled={!!reporting}
                className="clay-btn clay-btn-ghost px-4 py-2 text-xs flex items-center gap-1.5">
                <Download size={13} strokeWidth={2.5} /> {reporting === 'xlsx' ? 'Generating…' : 'Excel (.xlsx)'}
              </button>
            </div>
          </div>
        )}

        {/* Admin / Coordinator stats */}
        {stats && user?.role !== 'Scholar' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {user?.role === 'Administrator' && (
              <>
                <StatCard label="Total Scholars" value={stats.totalScholars} Icon={GraduationCap} color="#dce8ff" iconColor="#003087"
                  info="Every scholar profile on record, whatever their lifecycle status." />
                <StatCard label="Coordinators" value={stats.coordinators} Icon={ClipboardList} color="#ede0ff" iconColor="#6030b0"
                  info="Active scholarship-coordinator accounts. Archived accounts are excluded." />
                <StatCard label="Flagged GWA" value={stats.flagged} Icon={AlertTriangle} color={stats.flagged > 0 ? '#ffe8d6' : '#d4f5e2'} iconColor={stats.flagged > 0 ? '#c05000' : '#108050'}
                  info="Scholars whose most recent GWA is above their scholarship's maximum. Review their standing before the next renewal." />
                <StatCard label="Pending Review" value={stats.pendingReview} Icon={Clock} color={stats.pendingReview > 0 ? '#fff3cd' : '#d4f5e2'} iconColor={stats.pendingReview > 0 ? '#c07800' : '#108050'}
                  info="Documents scholars have submitted that nobody has reviewed yet — your queue on the Document Review page." />
              </>
            )}
            {user?.role === 'ScholarshipCoordinator' && (
              <>
                <StatCard label="Scholars" value={stats.totalScholars} Icon={GraduationCap} color="#dce8ff" iconColor="#003087"
                  info="Every scholar profile at your campus, whatever their lifecycle status." />
                <StatCard label="No GWA Yet" value={stats.noGwa} Icon={BarChart2} color="#fff3cd" iconColor="#c07800"
                  info="Scholars with no grade recorded at all, so their compliance can't be assessed. Record a GWA from their profile." />
                <StatCard label="Flagged GWA" value={stats.flagged} Icon={AlertTriangle} color={stats.flagged > 0 ? '#ffe8d6' : '#d4f5e2'} iconColor={stats.flagged > 0 ? '#c05000' : '#108050'}
                  info="Scholars whose most recent GWA is above their scholarship's maximum. Review their standing before the next renewal." />
                <StatCard label="Pending Review" value={stats.pendingReview} Icon={Clock} color={stats.pendingReview > 0 ? '#fff3cd' : '#d4f5e2'} iconColor={stats.pendingReview > 0 ? '#c07800' : '#108050'}
                  info="Documents scholars have submitted that nobody has reviewed yet — your queue on the Document Review page." />
              </>
            )}
          </div>
        )}

        {/* Quick actions (admin / coordinator) */}
        {user?.role !== 'Scholar' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <QuickAction to="/document-review" Icon={FileCheck} label="Review Documents" />
            <QuickAction to="/scholarship-types" Icon={GraduationCap} label="Scholarship Types" />
            <QuickAction to="/announcements" Icon={Megaphone} label="Announcements" />
            <QuickAction to="/analytics" Icon={BarChart2} label="Data Visualization" />
          </div>
        )}

        {/* Visual breakdown (admin / coordinator) */}
        {overview && user?.role !== 'Scholar' && (
          <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <DonutCard
              title="GWA Compliance"
              info="Every scholar split by their most recent grade: at or under their scholarship's maximum GWA, above it, or no grade recorded yet."
              data={[
                { name: 'Compliant', value: overview.compliant, color: '#10a060' },
                { name: 'Flagged', value: overview.nonCompliant, color: '#e0603a' },
                { name: 'No GWA', value: overview.noGwa, color: '#b0bdd0' },
              ]}
            />
            <DonutCard
              title="Document Submissions"
              info="All document submissions by review outcome. 'Pending' is waiting on staff; 'Rejected' was sent back to the scholar to resubmit."
              data={[
                { name: 'Verified', value: overview.submissions.verified, color: '#10a060' },
                { name: 'Pending', value: overview.submissions.pending, color: '#e0a000' },
                { name: 'Rejected', value: overview.submissions.incomplete, color: '#e0603a' },
              ]}
            />
            <TypeBreakdownCard
              title="Scholars by Scholarship Type"
              info={isCoordinator
                ? 'How the scholars at your campus are spread across scholarship types.'
                : 'How every scholar is spread across scholarship types.'}
              rows={overview.byScholarshipType ?? []}
              total={overview.totalScholars}
            />
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
            {/* Tone tokens, so the card follows dark mode instead of staying a pale slab. */}
            <div className={`rounded-3xl p-5 flex items-center gap-4 tone-${scholarGwa.meetsRequirement === false ? 'attention' : 'ok'}`}
              style={{ background: 'var(--tone-bg)', border: '1.5px solid var(--tone-border)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--surface-2)' }}>
                {scholarGwa.meetsRequirement === false
                  ? <AlertTriangle size={22} strokeWidth={2} style={{ color: 'var(--tone-fg)' }} />
                  : <FileCheck size={22} strokeWidth={2} style={{ color: 'var(--tone-fg)' }} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--tone-fg)' }}>
                  GWA Status · {scholarGwa.scholarshipTypeName ?? 'Scholarship'}
                </p>
                <p className="text-3xl font-black" style={{ color: 'var(--text-strong)' }}>
                  {scholarGwa.latestGwa.toFixed(2)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
                  {/* GWA runs 1.00 (best) to 5.00, and the rule is "at or under the limit".
                      "Below threshold — minimum required: 2.50" told a scholar with 2.75 they
                      needed a *higher* number. */}
                  {scholarGwa.meetsRequirement === false
                    ? `Not meeting the requirement — your GWA needs to be ${scholarGwa.minimumGwa?.toFixed(2)} or better (lower is better).`
                    : 'Meeting scholarship GWA requirement'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scholar compliance section */}
        {user?.role === 'Scholar' && compliance && (() => {
          // Capped at 100%: verified can never usefully exceed required, and a stale count
          // once rendered "4 of 2 verified · 200%".
          const verified = Math.min(compliance.verifiedCount ?? 0, compliance.totalRequired ?? 0);
          const pct = compliance.totalRequired > 0
            ? Math.min(100, Math.round((verified / compliance.totalRequired) * 100))
            : 0;
          return (
          <div className="mb-8 space-y-4">
            <h2 className="text-base font-black" style={{ color: 'var(--text-strong)' }}>Document Compliance</h2>
            {myMissed.length > 0 && <MissedDeadlinesCard missed={myMissed} />}

            {/* Progress card */}
            <div className="clay-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-strong)' }}>
                    {compliance.scholarshipTypeName ?? 'Required Documents'} · {compliance.academicYear ?? ''}
                    {compliance.semester ? ` · Sem ${compliance.semester}` : ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
                    {verified} of {compliance.totalRequired} required documents verified
                  </p>
                </div>
                <span className="text-2xl font-black" style={{ color: 'var(--accent)' }}>
                  {compliance.totalRequired > 0 ? `${pct}%` : '—'}
                </span>
              </div>

              {/* Progress bar */}
              {(() => {
                const isComplete = pct === 100;
                return (
                  <div className="clay-progress-track w-full h-3 mt-3">
                    <div className="clay-progress-fill" style={{
                      width: `${pct}%`,
                      background: isComplete
                        ? 'linear-gradient(90deg, #f5b800, #ffd060)'
                        : 'linear-gradient(90deg, var(--accent-bar-from), var(--accent-bar-to))',
                    }} />
                  </div>
                );
              })()}

              {/* Status pills */}
              <div className="flex gap-3 mt-4 flex-wrap">
                <Pill label={`${verified} Verified`} tone="ok" Icon={FileCheck} />
                {compliance.pendingCount > 0 && (
                  <Pill label={`${compliance.pendingCount} Awaiting review`} tone="warn" Icon={Clock} />
                )}
                {compliance.incompleteItems.length > 0 && (
                  <Pill label={`${compliance.incompleteItems.length} Rejected`} tone="attention" Icon={AlertTriangle} />
                )}
              </div>
            </div>

            {/* Each document's status and its tracker live on My Documents. */}
            {(compliance.pendingCount > 0 || compliance.incompleteItems.length > 0 || verified < compliance.totalRequired) && (
              <Link to="/my-documents"
                className="flex items-center justify-between p-4 rounded-2xl"
                style={{ background: '#002570', color: '#ffffff', textDecoration: 'none' }}>
                <div>
                  <p className="text-sm font-bold">Go to My Documents</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {compliance.incompleteItems.length > 0
                      ? `${compliance.incompleteItems.length} document${compliance.incompleteItems.length !== 1 ? 's' : ''} need resubmission`
                      : `${compliance.totalRequired - verified} document${compliance.totalRequired - verified !== 1 ? 's' : ''} still to verify`}
                  </p>
                </div>
                <ArrowRight size={20} strokeWidth={2} />
              </Link>
            )}
          </div>
          );
        })()}

        {/* Scholarship releases and one-time grants (scholar) — the history used to sit on
            My Profile; a release or grant notification now links here. */}
        {user?.role === 'Scholar' && (
          <div className="mb-8">
            <h2 className="text-base font-black mb-4" style={{ color: 'var(--text-strong)' }}>My Scholarship Releases &amp; Grants</h2>
            <ScholarshipReleasesCard releases={myReleases} />
            <OneTimeGrantsCard grants={myGrants} />
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

        </div>{/* /main column */}

        {/* ── Right rail: feeds and queues ── */}
        <aside className="page-rail min-w-0">

          {/* Scholars waiting for verification (staff) */}
          {isStaff && pendingApprovals > 0 && (
            <Link to="/scholar-approvals" className="block mb-6">
              <div className="rounded-3xl p-5 flex items-center gap-4"
                style={{ background: 'rgba(192,120,0,0.13)', border: '1.5px solid rgba(192,120,0,0.32)', boxShadow: '4px 4px 14px rgba(0,0,0,0.06)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(192,120,0,0.18)' }}>
                  <UserCheck size={20} strokeWidth={2} style={{ color: '#8a5a00' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>
                    {pendingApprovals} scholar{pendingApprovals !== 1 ? 's' : ''} awaiting approval
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#8a5a00' }}>
                    They cannot submit documents until you verify their registration.
                  </p>
                </div>
                <ArrowRight size={18} strokeWidth={2.5} style={{ color: '#8a5a00' }} />
              </div>
            </Link>
          )}

          {/* One-time grants awaiting release (staff) */}
          {isStaff && grantSummary?.pendingCount > 0 && (
            <Link to="/one-time-grants" className="block mb-6">
              <div className="clay-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--accent-wash)' }}>
                  <Banknote size={20} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>
                    {grantSummary.pendingCount} grant{grantSummary.pendingCount !== 1 ? 's' : ''} to release
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    ₱{Number(grantSummary.pendingAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} awarded but not yet disbursed.
                  </p>
                </div>
                <ArrowRight size={18} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
              </div>
            </Link>
          )}

          {/* Upcoming deadlines (scholar) */}
          {user?.role === 'Scholar' && deadlines.length > 0 && (
            <div className="mb-8">
              <h2 className="text-base font-black mb-4" style={{ color: 'var(--text-strong)' }}>Upcoming Deadlines</h2>
              <div className="space-y-2">
                {deadlines.map(d => {
                  const days = daysUntil(d.dueDate, now);
                  return (
                    <Link key={d.id} to="/my-documents" className="clay-card p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(234,88,12,0.1)' }}>
                        <CalendarClock size={18} color="#c2410c" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold" style={{ color: 'var(--text-strong)' }}>{d.requirementName}</p>
                        <p className="text-xs" style={{ color: days <= 3 ? '#c2410c' : 'var(--text-muted)' }}>
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

          {/* Recent activity (staff) */}
          {isStaff && activity.length > 0 && (
            <CollapsibleSection id="recent-activity" title="Recent Activity">
              <div className="clay-card divide-y" style={{ borderColor: 'transparent' }}>
                {activity.map(a => (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-3.5" style={{ borderTop: '1px solid rgba(0,48,135,0.05)' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-wash)' }}>
                      <Activity size={15} strokeWidth={2.2} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: 'var(--text-strong)' }}>
                        <span className="font-semibold">{a.userName}</span>{' '}
                        <span style={{ color: 'var(--text)' }}>{a.details || a.action}</span>
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{relativeTime(a.timestampUtc)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Announcements */}
          <CollapsibleSection id="announcements" title="Announcements">
            {announcements.length === 0 ? (
              <div className="clay-card p-8 text-center">
                <Inbox size={32} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No announcements at this time.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {announcements.map(a => <AnnouncementCard key={a.id} a={a} variant="feed" />)}
              </div>
            )}
          </CollapsibleSection>
        </aside>
        </div>{/* /page-split */}
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

function StatCard({ label, value, Icon, color, iconColor, info }) {
  return (
    <div className="rounded-3xl p-5 stat-tile" style={{ '--tile-bg': color }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center stat-tile-icon">
          <Icon size={18} strokeWidth={2} style={{ color: iconColor }} />
        </div>
        {info && <InfoTip text={info} align="end" label={`What "${label}" means`} />}
      </div>
      <p className="text-xs font-bold uppercase tracking-wider mb-1 stat-tile-label">{label}</p>
      <p className="text-3xl font-black stat-tile-value">{value}</p>
    </div>
  );
}

function Pill({ label, tone, Icon }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold tone-${tone}`}
      style={{ background: 'var(--tone-bg)', color: 'var(--tone-fg)', border: '1.5px solid var(--tone-border)' }}>
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </span>
  );
}

/* A shortcut reads as a row — icon, label, chevron — rather than a tall stacked tile.
   Same information in roughly half the height, and the arrow makes it obviously a link. */
function QuickAction({ to, Icon, label }) {
  return (
    <Link to={to} className="clay-card px-4 py-3 flex items-center gap-3 transition-opacity hover:opacity-90">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-wash)' }}>
        <Icon size={17} style={{ color: 'var(--accent)' }} strokeWidth={2.2} />
      </div>
      <span className="text-xs font-bold flex-1 min-w-0" style={{ color: 'var(--text-strong)' }}>{label}</span>
      <ArrowRight size={14} strokeWidth={2.5} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
    </Link>
  );
}

function TypeBreakdownCard({ title, info, rows, total }) {
  return (
    <div className="clay-card p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        {title}
        {info && <InfoTip text={info} size={12} />}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-faint)' }}>No data yet.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.slice(0, 5).map(r => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            return (
              <div key={r.type}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="truncate" style={{ color: 'var(--text)' }}>{r.type}</span>
                  <span className="ml-auto font-bold tabular-nums" style={{ color: 'var(--text-strong)' }}>{r.count}</span>
                  <span className="text-xs tabular-nums w-9 text-right" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: 'var(--surface-2)', marginTop: 4 }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: 'var(--accent)' }} />
                </div>
              </div>
            );
          })}
          {rows.length > 5 && (
            <Link to="/analytics" className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
              +{rows.length - 5} more on Data Visualization
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function DonutCard({ title, data, info }) {
  const { resolved } = useTheme();
  const t = vizTokens(resolved);
  const items = data.filter(d => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="clay-card p-5">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        {title}
        {info && <InfoTip text={info} size={12} />}
      </h3>
      {total === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-faint)' }}>No data yet.</p>
      ) : (
        <div className="flex items-center gap-4">
          {/* Fixed pixel size rather than a ResponsiveContainer: the donut is always
              118px, and the container measured its parent as -1 here and drew nothing. */}
          <div style={{ width: 118, height: 118, flexShrink: 0 }}>
            <PieChart width={118} height={118}>
              {/* A 2px surface ring stops adjacent segments fusing into one shape. */}
              {/* Animation off: the sectors grow from radius 0, and when the entry
                  animation doesn't run the donut stays invisible — a hole in the card. */}
              <Pie data={items} dataKey="value" nameKey="name" innerRadius={34} outerRadius={54}
                paddingAngle={2} stroke={t.gap} strokeWidth={2} isAnimationActive={false}>
                {items.map(d => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle(t)} />
            </PieChart>
          </div>
          {/* The written counts beside a colour chip — identity never rests on hue. */}
          <div className="flex-1 space-y-1.5">
            {data.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text)' }}>{d.name}</span>
                <span className="ml-auto font-bold tabular-nums" style={{ color: 'var(--text-strong)' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

