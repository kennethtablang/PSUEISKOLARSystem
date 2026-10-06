import { useEffect, useState, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { getAnalyticsOverview } from '../api/analytics';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
} from 'recharts';
import { GraduationCap, FileCheck, Clock, AlertTriangle, TrendingUp, Download, Loader, Table2, ChartColumn, ArrowRight, Minus, TrendingDown, BanknoteArrowUp, Wallet, HandCoins, UserX, Users, UserCheck, FileText, MapPin } from 'lucide-react';
import { useTitle } from '../hooks/useTitle';
import { exportScholars, exportSubmissions, exportSummary } from '../api/reports';
import { useMyCampus } from '../hooks/useMyCampus';
import { getAnalyticsTrends, getAnalyticsDisbursements, getAnalyticsDemographics, getAnalyticsGrantees } from '../api/analytics';
import { getScholarshipTypes, getPrograms } from '../api/lookups';
import { getCampuses } from '../api/campuses';
import { vizTokens, tooltipStyle } from '../constants/viz';
import { peso, FREQUENCY_LABELS } from '../constants/grants';
import InfoTip from '../components/InfoTip';
import { downloadListReport } from '../api/listReports';
import { getGrantTypes } from '../api/grantTypes';
import { SEX_OPTIONS } from '../constants/personal';
import { useNow } from '../hooks/useNow';

/* Recharts reserves 60px for the Y axis and these charts count small integers, so the
   old `left: -20` pulled the plot back over its own tick labels — three-digit counts
   lost their leading digit. Narrowing the axis to 38px reclaims the same space without
   cropping anything, and the bottom margin leaves room for tilted category labels. */
const CHART_MARGIN = { top: 4, right: 10, left: 0, bottom: 0 };

export default function AnalyticsPage() {
  useTitle('Data Visualization');
  const { token, user } = useAuth();
  const toast = useToast();
  const { resolved } = useTheme();
  // A coordinator's every figure is their own campus's (the server scopes it), so the
  // campus pickers would offer nothing; they are hidden and the campus is named instead.
  const isCoordinator = user?.role === 'ScholarshipCoordinator';
  const myCampus = useMyCampus();
  const { subscribeToAnalytics } = useNotifications();
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(''); // '' = all-time, else "AY__semester"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(null); // "<report>:<format>" while downloading
  const [lastUpdated, setLastUpdated] = useState(null);
  const [trends, setTrends] = useState(null);       // per-period rows for the comparison charts
  const [money, setMoney] = useState(null);         // release + grant disbursement figures
  const [scholarshipTypes, setScholarshipTypes] = useState([]);
  const [campuses, setCampuses] = useState([]);
  // null hides every campus picker on the page.
  const pickCampuses = isCoordinator ? null : campuses;
  // Scholar roster export filters: a type exports that scholarship alone; none splits by type.
  const [reportTypeId, setReportTypeId] = useState('');
  const [reportCampusId, setReportCampusId] = useState('');
  // Bumped on every live refresh so the profile and grantee sections refetch too.
  const [liveTick, setLiveTick] = useState(0);
  const periodRef = useRef(period);
  // Only the newest overview/disbursement request may write state: switching periods quickly
  // let a slow earlier response land last and show another period's figures under this one.
  const overviewSeq = useRef(0);
  const moneySeq = useRef(0);

  // Mark colours are per-mode values, so they come from the resolved theme rather
  // than being derived from the light set.
  const t = vizTokens(resolved);

  const refetch = useCallback(async (silent = false) => {
    const seq = ++overviewSeq.current;
    if (!silent) setLoading(true);
    try {
      const [ay, sem] = (periodRef.current || '').split('__');
      const d = await getAnalyticsOverview(token, {
        academicYear: ay || undefined,
        semester: sem || undefined,
      });
      if (seq !== overviewSeq.current) return;
      setData(d);
      setLastUpdated(new Date());
      setError('');
    } catch (e) {
      if (!silent && seq === overviewSeq.current) setError(e.message);
    } finally {
      if (!silent && seq === overviewSeq.current) setLoading(false);
    }
  }, [token]);

  async function handleExport(type, format) {
    setExporting(`${type}:${format}`);
    try {
      if (type === 'scholars') {
        await exportScholars(token, {
          scholarshipTypeId: reportTypeId || undefined,
          campusId: reportCampusId || undefined,
        }, format);
      } else {
        // Submissions carry an academic period, so the export honours the filter above.
        const [academicYear, semester] = (period || '').split('__');
        await exportSubmissions(token, { academicYear: academicYear || undefined, semester: semester || undefined }, format);
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    getScholarshipTypes(token).then(setScholarshipTypes).catch(() => {});
    getCampuses(token).then(setCampuses).catch(() => {});
  }, [token]);

  // Refetch when the period filter changes.
  useEffect(() => { periodRef.current = period; refetch(); }, [period, refetch]);

  // Trends span every period by design, so they are independent of the period filter.
  const loadTrends = useCallback(() => {
    getAnalyticsTrends(token).then(setTrends).catch(() => {});
  }, [token]);
  useEffect(() => { loadTrends(); }, [loadTrends]);

  // Disbursements follow the period filter, same as the overview.
  const loadMoney = useCallback(() => {
    const seq = ++moneySeq.current;
    const [ay, sem] = (periodRef.current || '').split('__');
    getAnalyticsDisbursements(token, { academicYear: ay || undefined, semester: sem || undefined })
      .then(m => { if (seq === moneySeq.current) setMoney(m); })
      .catch(() => {});
  }, [token]);
  useEffect(() => { loadMoney(); }, [period, loadMoney]);

  // Real-time: refetch (silently) on server broadcast, plus a periodic fallback.
  useEffect(() => {
    let timer;
    const trigger = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { refetch(true); loadTrends(); loadMoney(); setLiveTick(n => n + 1); }, 600);
    };
    const unsub = subscribeToAnalytics(trigger);
    const interval = setInterval(() => { refetch(true); loadTrends(); loadMoney(); setLiveTick(n => n + 1); }, 30000);
    return () => { clearTimeout(timer); unsub(); clearInterval(interval); };
  }, [subscribeToAnalytics, refetch, loadTrends, loadMoney]);

  if (loading) return (
    <Layout>
      <div className="p-4 sm:p-8 flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading analytics…</p>
      </div>
    </Layout>
  );

  // This replaces the whole page, filter included, so it has to offer the way back.
  if (error) return (
    <Layout>
      <div className="page-shell">
        <p role="alert" className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{error}</p>
        <button onClick={() => refetch()} className="clay-btn clay-btn-ghost px-4 py-2 text-sm">
          Try again
        </button>
      </div>
    </Layout>
  );

  const { totalScholars, compliant, nonCompliant, noGwa, byProgram, byScholarshipType, submissions, byPeriod } = data;
  const complianceRate = totalScholars > 0 ? Math.round((compliant / totalScholars) * 100) : 0;
  const verifiedRate = submissions.total > 0 ? Math.round((submissions.verified / submissions.total) * 100) : 0;

  return (
    <Layout>
      {/* Full-width split: charts get the working column, breakdown tables sit in the
          right rail. The tables are not decoration — several categorical steps fall
          below 3:1 on the light card, and the relief for that is the same numbers in
          text form. */}
      <div className="page-shell">

        {/* Header — filters and exports in one row above the charts */}
        <div className="page-head">
          <div style={{ minWidth: 0 }}>
            <h1 className="page-title">Data Visualization &amp; Reports</h1>
            <p className="page-subtitle">
              {isCoordinator
                ? `Descriptive analytics for the scholars and grantees studying at ${myCampus ? `PSU ${myCampus.name}` : 'your campus'}`
                : 'Descriptive analytics for Pangasinan State University scholars and grantees'}
            </p>
            {isCoordinator && myCampus && (
              <span className="clay-badge mt-2 inline-flex items-center gap-1"
                style={{ background: 'var(--accent-wash)', color: 'var(--accent)', border: '1px solid rgba(0,48,135,0.15)' }}>
                <MapPin size={10} strokeWidth={2.6} /> {myCampus.name} only
              </span>
            )}
            <span className="page-title-bar" />
          </div>
          {/* Filters in one row above the charts. Exports live in the rail so this row
              stays a single line instead of wrapping. */}
          <div className="page-head-actions">
            <LiveBadge lastUpdated={lastUpdated} />
            {(data?.availablePeriods?.length ?? 0) > 0 && (
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="clay-input text-sm"
                style={{ width: 200, maxWidth: '100%', flex: '0 1 auto' }}
                aria-label="Academic period"
              >
                <option value="">All Periods</option>
                {data.availablePeriods.map(p => (
                  <option key={p.label} value={`${p.academicYear}__${p.semester}`}>{p.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="page-split">

          {/* ── Working column ── */}
          <div className="min-w-0 space-y-6">

            {/* KPI row — four single numbers; each is the chart */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard Icon={GraduationCap} label="Total Scholars" value={totalScholars} color="#dce8ff" iconColor="#003087"
                info={isCoordinator
                  ? 'Every scholar profile at your campus, including archived and graduated ones. Not affected by the period filter.'
                  : 'Every scholar profile on record, including archived and graduated ones. Not affected by the period filter.'} />
              <KpiCard Icon={FileCheck} label="Verified Docs" value={submissions.verified} color="#d4f5e2" iconColor="#10a060"
                info="Submissions a coordinator has reviewed and accepted, within the selected period." />
              <KpiCard Icon={Clock} label="Pending Review" value={submissions.pending} color="#fff3cd" iconColor="#c07800"
                info="Submitted but not yet reviewed. This is your review queue — it should trend toward zero." />
              <KpiCard Icon={AlertTriangle} label="Non-Compliant GWA" value={nonCompliant} color="#ffe8d6" iconColor="#c05000"
                info="Scholars whose most recent recorded GWA is above their scholarship's maximum. Scholars with no grade yet are counted separately." />
            </div>

            {/* Two headline rates — a hero number each, not a chart */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <RateCard
                Icon={TrendingUp}
                title="GWA Compliance"
                info="Share of all scholars whose latest grade meets their scholarship's maximum GWA. Scholars with no grade recorded count against the rate — they sit in 'No GWA yet'."
                rate={complianceRate}
                caption="of scholars meeting their GWA requirement"
                fill={complianceRate === 100
                  ? 'linear-gradient(90deg, #f5b800, #ffd060)'
                  : 'linear-gradient(90deg, var(--accent-bar-from), var(--accent-bar-to))'}
                stats={[
                  { label: 'Compliant',  value: compliant,    color: '#d4f5e2', text: '#0a5a3a' },
                  { label: 'Flagged',    value: nonCompliant, color: '#ffe8d6', text: '#c05000' },
                  { label: 'No GWA yet', value: noGwa,        color: '#e8edf5', text: '#4a5a7a' },
                ]}
              />
              <RateCard
                Icon={FileCheck}
                title="Document Submissions"
                info="Verified submissions as a share of all submissions in the selected period. A low rate with high 'Pending' means a review backlog rather than a scholar problem."
                rate={verifiedRate}
                caption="verification rate"
                fill="linear-gradient(90deg, #10a060, #12c070)"
                stats={[
                  { label: 'Verified',   value: submissions.verified,   color: '#d4f5e2', text: '#0a5a3a' },
                  { label: 'Pending',    value: submissions.pending,    color: '#fff3cd', text: '#7d5a00' },
                  { label: 'Rejected', value: submissions.incomplete, color: '#ffe8d6', text: '#c05000' },
                ]}
              />
            </div>

            {/* Scholars by program — one measure, so one colour for every bar.
                Colouring bars by rank would restate the bar length in hue. */}
            <ChartCard
              title="Scholars by Program"
              subtitle="Head count per academic program"
              info="Scholars grouped by the program on their profile, using the program code. Scholars with no program set are not shown."
              table={{
                columns: ['Program', 'Scholars', 'Share'],
                rows: [...byProgram]
                  .sort((a, b) => b.count - a.count)
                  .map(p => [p.program, p.count, `${totalScholars > 0 ? Math.round((p.count / totalScholars) * 100) : 0}%`]),
              }}
            >
              {byProgram.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={byProgram.length > 6 ? 300 : 250}>
                  <BarChart data={byProgram} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                    {/* `interval={0}` forces every program to be labelled, which is the point of
                        the chart — so past a handful the labels have to tilt or they overlap into
                        an unreadable smear. The extra height is what keeps the tilted text inside
                        the plot area instead of clipped at the card's edge. */}
                    <XAxis
                      dataKey="program"
                      tick={{ fontSize: 11, fill: t.axis }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={byProgram.length > 6 ? -35 : 0}
                      textAnchor={byProgram.length > 6 ? 'end' : 'middle'}
                      height={byProgram.length > 6 ? 68 : 30}
                    />
                    <YAxis allowDecimals={false} width={38} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle(t)} cursor={{ fill: t.cursor }} />
                    <Bar dataKey="count" name="Scholars" fill={t.markColor} radius={[4, 4, 0, 0]} maxBarSize={56} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Submission activity — a stacked status breakdown per period. Status
                colours are reserved for state and always carry a written label. */}
            {byPeriod.length > 0 && (
              <ChartCard
                title="Submission Activity by Period"
                subtitle="Document outcomes per academic semester"
                info="Submissions in the selected period range, stacked by review outcome. Use the Semester Comparison below to see the trend across all periods at once."
                table={{
                  columns: ['Period', 'Verified', 'Pending', 'Rejected'],
                  rows: byPeriod.map(p => [p.period, p.verified, p.pending, p.incomplete]),
                }}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byPeriod} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} width={38} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle(t)} cursor={{ fill: t.cursor }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: t.axis }} />
                    {/* A 2px surface-coloured stroke keeps adjacent segments from fusing. */}
                    <Bar dataKey="verified"   name="Verified"   stackId="a" fill={t.status.verified}   stroke={t.gap} strokeWidth={2} maxBarSize={64} />
                    <Bar dataKey="pending"    name="Pending"    stackId="a" fill={t.status.pending}    stroke={t.gap} strokeWidth={2} maxBarSize={64} />
                    <Bar dataKey="incomplete" name="Rejected" stackId="a" fill={t.status.incomplete} stroke={t.gap} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={64} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* ── Scholarship money ── */}
            <Disbursements money={money} t={t} />

            {/* ── Semester-over-semester comparison ── */}
            <PeriodComparison trends={trends} t={t} />

            {/* ── Scholar's Data sheet: who the scholars and grantees are ── */}
            <Demographics token={token} t={t} campuses={pickCampuses} liveTick={liveTick} />

            {/* ── Grantee accounts and one-time grants ── */}
            <GranteeAnalytics token={token} t={t} campuses={pickCampuses} liveTick={liveTick} />
          </div>

          {/* ── Right rail: composition and the numbers behind the charts ── */}
          <aside className="page-rail min-w-0 space-y-6">

            {/* Composition as labelled meters rather than a donut. The counts here are
                close together, which a donut compares badly, and its wedges would put
                every colour against every other — six categorical steps don't clear
                that all-pairs bar (see constants/viz.js). One measure, one colour,
                names in text: nothing rests on hue. */}
            <SummaryReportCard campuses={pickCampuses} campusName={isCoordinator ? myCampus?.name : null} />

            <MeterList
              title="Scholars by Scholarship Type"
              subtitle={`Share of ${totalScholars} scholar${totalScholars !== 1 ? 's' : ''}`}
              rows={byScholarshipType.map(r => ({ label: r.type, value: r.count }))}
              total={totalScholars}
              color={t.markColor}
              track={t.grid}
            />

            <ReportBuilder campuses={pickCampuses} scholarshipTypes={scholarshipTypes} />

            {/* No program panel here — that would restate the bar chart beside it. Its
                numbers are one click away via the chart's table toggle instead. */}
            <div className="clay-card p-5">
              <h2 className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>Reports</h2>
              <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--text-muted)' }}>
                Excel to work with the numbers, PDF to print or file
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--text-strong)' }}>Scholar Master List</p>
                  <select value={reportTypeId} onChange={e => setReportTypeId(e.target.value)}
                    className="clay-input text-xs mb-2" style={{ height: 34, minHeight: 34 }} aria-label="Scholarship type to export">
                    <option value="">All scholarship types (one sheet each)</option>
                    {scholarshipTypes.map(st => <option key={st.id} value={st.id}>{st.name} only</option>)}
                  </select>
                  {pickCampuses && (
                    <select value={reportCampusId} onChange={e => setReportCampusId(e.target.value)}
                      className="clay-input text-xs mb-2" style={{ height: 34, minHeight: 34 }} aria-label="Campus to export">
                      <option value="">All campuses</option>
                      {pickCampuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  <ExportRow
                    label=""
                    exporting={exporting}
                    type="scholars"
                    onExport={handleExport}
                  />
                </div>
                <ExportRow
                  label="Submissions"
                  exporting={exporting}
                  type="submissions"
                  onExport={handleExport}
                />
              </div>
              <p className="text-xs mt-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Figures on this page refresh automatically when scholars, grades, or document
                reviews change.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}

/* ── Scholarship money ───────────────────────────────── */

/**
 * What has actually been paid out, and to whom.
 *
 * Two streams, kept apart: recurring scholarship releases (the per-semester / per-year
 * obligation) and one-off grants. They answer different questions — "did we meet this
 * period's obligation?" versus "how much extra assistance did we give?" — so folding them
 * into a single total would destroy both.
 *
 * Coverage per type is the number that matters: released ÷ scholars holding the type. A
 * bar short of 100% is scholars who hold the scholarship and have not been paid.
 */
function Disbursements({ money, t }) {
  if (!money) {
    return (
      <div className="clay-card p-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading scholarship releases…</p>
      </div>
    );
  }

  const nothingYet = money.releasedCount === 0 && money.pendingCount === 0
    && money.grants.releasedCount === 0 && money.grants.pendingCount === 0;

  if (nothingYet) {
    return (
      <div className="clay-card p-6">
        <h2 className="text-sm font-black mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-strong)' }}>
          <BanknoteArrowUp size={15} strokeWidth={2.2} style={{ color: 'var(--accent)' }} />
          Scholarship Releases
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
          Nothing recorded yet. Open a period on the Scholarship Releases page and the payout
          figures appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RateCard
        Icon={BanknoteArrowUp}
        title="Scholarship Releases"
        info="Released payouts as a share of everything scheduled for the selected period. Cancelled rows are excluded from the rate but still counted below — a cancellation is a decision, not a backlog."
        rate={money.releaseRate}
        caption={`released · ${peso(money.releasedAmount)} paid out to ${money.scholarsPaid} scholar${money.scholarsPaid === 1 ? '' : 's'}`}
        fill={money.releaseRate === 100
          ? 'linear-gradient(90deg, #f5b800, #ffd060)'
          : 'linear-gradient(90deg, var(--accent-bar-from), var(--accent-bar-to))'}
        stats={[
          { label: 'Released',  value: money.releasedCount,  color: '#d4f5e2', text: '#0a5a3a' },
          { label: 'Awaiting',  value: money.pendingCount,   color: '#fff3cd', text: '#7d5a00' },
          { label: 'Cancelled', value: money.cancelledCount, color: '#e8edf5', text: '#4a5a7a' },
        ]}
      />

      {money.byPeriod.length > 0 && (
        <ChartCard
          title="Disbursement by Period"
          subtitle="Pesos released versus still awaiting release, per academic period"
          info="Every recorded release, stacked by whether the money has actually gone out. A tall amber band is money the office has committed to but not yet disbursed. Spans all periods regardless of the filter above, so the trend stays readable."
          table={{
            columns: ['Period', 'Released', 'Awaiting', 'Paid', 'Awaiting'],
            rows: money.byPeriod.map(p => [
              p.period, peso(p.releasedAmount), peso(p.pendingAmount), p.releasedCount, p.pendingCount,
            ]),
          }}
        >
          <ChartLegend items={[
            { label: 'Released', color: t.status.verified },
            { label: 'Awaiting release', color: t.status.pending },
          ]} />
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={money.byPeriod} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
              {/* Peso amounts run to six figures, so the axis is abbreviated — the tooltip
                  and the table view carry the exact number. */}
              <YAxis
                width={54}
                tick={{ fontSize: 11, fill: t.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
              />
              <Tooltip
                contentStyle={tooltipStyle(t)}
                cursor={{ fill: t.cursor }}
                formatter={v => peso(v)}
                labelFormatter={l => money.byPeriod.find(p => p.shortLabel === l)?.period ?? l}
              />
              <Bar dataKey="releasedAmount" name="Released" stackId="m" fill={t.status.verified} stroke={t.gap} strokeWidth={2} maxBarSize={64} />
              <Bar dataKey="pendingAmount"  name="Awaiting" stackId="m" fill={t.status.pending}  stroke={t.gap} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={64} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {money.byType.length > 0 && (
        <div className="clay-card p-6">
          <h2 className="text-sm font-black flex items-center gap-1.5" style={{ color: 'var(--text-strong)' }}>
            Release Coverage by Scholarship
            <InfoTip text="Scholars paid as a share of scholars holding the scholarship. Below 100% means holders who have not received this period's payout — the Scholarship Releases page names them." />
          </h2>
          <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--text-muted)' }}>
            How much of each scholarship’s roster has actually been paid
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--hairline-strong)' }}>
                  {['Scholarship', 'Paid', 'Awaiting', 'Released', 'Coverage'].map((c, i) => (
                    <th key={c} className="text-xs font-bold uppercase tracking-wider py-2"
                      style={{ color: 'var(--text-muted)', textAlign: i === 0 ? 'left' : 'right' }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {money.byType.map((row, i) => (
                  <tr key={row.scholarshipTypeId} style={{ borderTop: i > 0 ? '1px solid var(--hairline)' : undefined }}>
                    <td className="py-2.5" style={{ color: 'var(--text)' }}>
                      <span className="font-semibold" style={{ color: 'var(--text-strong)' }}>{row.type}</span>
                      <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>
                        {FREQUENCY_LABELS[row.frequency] ?? row.frequency}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: 'var(--text-strong)' }}>
                      {row.releasedCount}<span style={{ color: 'var(--text-muted)', fontWeight: 600 }}> / {row.holders}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums" style={{ color: 'var(--text)' }}>{row.pendingCount}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold" style={{ color: 'var(--text-strong)' }}>
                      {peso(row.releasedAmount)}
                    </td>
                    <td className="py-2.5 pl-4" style={{ width: 150 }}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1" style={{ height: 6, borderRadius: 3, background: t.grid, overflow: 'hidden' }}>
                          <div style={{
                            width: `${row.coverage}%`,
                            height: '100%',
                            borderRadius: 3,
                            background: row.coverage >= 100 ? t.status.verified : t.markColor,
                          }} />
                        </div>
                        <span className="text-xs font-bold tabular-nums w-9 text-right" style={{ color: 'var(--text)' }}>
                          {row.coverage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* One-off grants sit beside the recurring figures, never inside them. */}
          <div className="clay-card-inner mt-5 px-4 py-3 flex items-center gap-3 flex-wrap">
            <Wallet size={15} strokeWidth={2.2} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              One-time grants
            </span>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-strong)' }}>
              {peso(money.grants.releasedAmount)} released
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {money.grants.releasedCount} paid · {money.grants.pendingCount} awaiting
              {money.grants.pendingAmount > 0 && ` (${peso(money.grants.pendingAmount)})`}
            </span>
            <span className="text-xs ml-auto" style={{ color: 'var(--text-faint)' }}>
              Counted separately — grants are on top of the scholarship, not part of it.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Semester-over-semester comparison ───────────────── */

/**
 * Two stacked area charts across the period timeline, plus an explicit A-vs-B panel.
 *
 * A stacked area is right here because each period's segments sum to a meaningful whole
 * (all submissions / all graded scholars) and the periods form an ordered sequence. Status
 * colours are reserved for state and each series is both legended and named in the delta
 * table below, so nothing rests on hue alone.
 */
function PeriodComparison({ trends, t }) {
  const periods = trends?.periods ?? [];
  const [aKey, setAKey] = useState('');
  const [bKey, setBKey] = useState('');

  // Default to the two most recent periods once data arrives.
  useEffect(() => {
    if (periods.length === 0) return;
    setBKey(prev => prev || periods[periods.length - 1].period);
    setAKey(prev => prev || (periods.length > 1 ? periods[periods.length - 2].period : periods[0].period));
  }, [periods]);

  if (!trends) {
    return (
      <div className="clay-card p-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading period comparison…</p>
      </div>
    );
  }

  if (periods.length === 0) {
    return (
      <div className="clay-card p-6">
        <h2 className="text-sm font-black mb-1" style={{ color: 'var(--text-strong)' }}>Semester Comparison</h2>
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
          No period data yet. Comparisons appear once documents are submitted or grades recorded
          across at least one semester.
        </p>
      </div>
    );
  }

  const a = periods.find(p => p.period === aKey) ?? periods[0];
  const b = periods.find(p => p.period === bKey) ?? periods[periods.length - 1];
  const single = periods.length === 1;

  return (
    <div className="space-y-6">
      <ChartCard
        title="Submissions Across Semesters"
        subtitle="Document outcomes per period — the stack height is that period's total"
        info="Every document submitted in each academic period, stacked by its review outcome. A rising stack means more submissions overall; a growing orange band means more are coming back incomplete."
        table={{
          columns: ['Period', 'Verified', 'Pending', 'Rejected', 'Total'],
          rows: periods.map(p => [p.period, p.verified, p.pending, p.incomplete, p.totalSubmissions]),
        }}
      >
        {single ? (
          <SingletonNote label="submission" />
        ) : (
          <>
            {/* Hand-built legend. Recharts derives an Area's legend chip from its *stroke*,
                and the stroke here is the surface colour that separates the bands — so the
                built-in legend renders invisible chips (measured: #e8edf5 on #e8edf5) and an
                explicit `payload` doesn't override it. Plain markup is reliable. */}
            <ChartLegend items={[
              { label: 'Verified',   color: t.status.verified },
              { label: 'Pending',    color: t.status.pending },
              { label: 'Rejected', color: t.status.incomplete },
            ]} />
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={periods} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} width={38} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle(t)} labelFormatter={l => periodFor(periods, l)} />
                {/* Semesters are discrete, so the bands step between them rather than curving —
                    a monotone spline would draw values that no period actually had. */}
                <Area type="linear" dataKey="verified"   name="Verified"   stackId="s" stroke={t.gap} strokeWidth={2} fill={t.status.verified} fillOpacity={0.92} />
                <Area type="linear" dataKey="pending"    name="Pending"    stackId="s" stroke={t.gap} strokeWidth={2} fill={t.status.pending} fillOpacity={0.92} />
                <Area type="linear" dataKey="incomplete" name="Rejected" stackId="s" stroke={t.gap} strokeWidth={2} fill={t.status.incomplete} fillOpacity={0.92} />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </ChartCard>

      <ChartCard
        title="GWA Compliance Across Semesters"
        subtitle="Graded scholars per period, split by whether they met their threshold"
        info="Counts recorded grades, not scholars — a scholar with no grade for a period is not in the stack. The green band is scholars at or under their scholarship's maximum GWA."
        table={{
          columns: ['Period', 'Compliant', 'Flagged', 'Graded', 'Avg GWA'],
          rows: periods.map(p => [p.period, p.compliant, p.flagged, p.totalGraded, p.averageGwa?.toFixed(2) ?? '—']),
        }}
      >
        {single ? (
          <SingletonNote label="grade" />
        ) : (
          <>
            <ChartLegend items={[
              { label: 'Compliant', color: t.status.verified },
              { label: 'Flagged',   color: t.status.incomplete },
            ]} />
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={periods} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} width={38} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle(t)} labelFormatter={l => periodFor(periods, l)} />
                <Area type="linear" dataKey="compliant" name="Compliant" stackId="g" stroke={t.gap} strokeWidth={2} fill={t.status.verified} fillOpacity={0.92} />
                <Area type="linear" dataKey="flagged"   name="Flagged"   stackId="g" stroke={t.gap} strokeWidth={2} fill={t.status.incomplete} fillOpacity={0.92} />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </ChartCard>

      {/* Explicit A vs B — a stacked area shows the shape of a trend, not the size of a change. */}
      <div className="clay-card p-6">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-sm font-black flex items-center gap-1.5" style={{ color: 'var(--text-strong)' }}>
              Compare Two Periods
              <InfoTip text="Pick any two semesters to see the change between them. Percentages are relative to the first period; a dash means there was nothing to compare against." />
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Side-by-side figures and the change between them
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <PeriodSelect value={a.period} periods={periods} onChange={setAKey} label="First period" />
            <ArrowRight size={14} strokeWidth={2.4} style={{ color: 'var(--text-faint)' }} />
            <PeriodSelect value={b.period} periods={periods} onChange={setBKey} label="Second period" />
          </div>
        </div>

        {a.period === b.period ? (
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
            Pick two different periods to see a comparison.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--hairline-strong)' }}>
                  <th className="text-left text-xs font-bold uppercase tracking-wider py-2" style={{ color: 'var(--text-muted)' }}>Measure</th>
                  <th className="text-right text-xs font-bold uppercase tracking-wider py-2" style={{ color: 'var(--text-muted)' }}>{a.period}</th>
                  <th className="text-right text-xs font-bold uppercase tracking-wider py-2" style={{ color: 'var(--text-muted)' }}>{b.period}</th>
                  <th className="text-right text-xs font-bold uppercase tracking-wider py-2" style={{ color: 'var(--text-muted)' }}>Change</th>
                </tr>
              </thead>
              <tbody>
                <DeltaRow label="Documents submitted" from={a.totalSubmissions} to={b.totalSubmissions} />
                <DeltaRow label="Verified" from={a.verified} to={b.verified} />
                <DeltaRow label="Pending review" from={a.pending} to={b.pending} goodWhenDown />
                <DeltaRow label="Rejected" from={a.incomplete} to={b.incomplete} goodWhenDown />
                <DeltaRow label="Verification rate" from={a.verifiedRate} to={b.verifiedRate} suffix="%" />
                <DeltaRow label="Grades recorded" from={a.totalGraded} to={b.totalGraded} />
                <DeltaRow label="GWA compliant" from={a.compliant} to={b.compliant} />
                <DeltaRow label="GWA flagged" from={a.flagged} to={b.flagged} goodWhenDown />
                <DeltaRow label="Compliance rate" from={a.complianceRate} to={b.complianceRate} suffix="%" />
                <DeltaRow label="Average GWA" from={a.averageGwa} to={b.averageGwa} decimals={2} goodWhenDown />
              </tbody>
            </table>
            <p className="text-xs mt-3" style={{ color: 'var(--text-faint)' }}>
              For GWA, lower is better — 1.00 is the highest mark. Arrows show whether a change is
              an improvement, not merely whether the number went up.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Legend as plain markup: a colour chip beside text that carries the identity. */
function ChartLegend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
      {items.map(i => (
        <li key={i.label} className="flex items-center gap-1.5 text-xs">
          <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: i.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{i.label}</span>
        </li>
      ))}
    </ul>
  );
}

function SingletonNote({ label }) {
  return (
    <p className="text-sm py-8 text-center" style={{ color: 'var(--text-faint)' }}>
      Only one period has {label} data so far — a trend needs at least two. The table view shows
      the figures.
    </p>
  );
}

function PeriodSelect({ value, periods, onChange, label }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label={label}
      className="clay-input text-sm"
      style={{ width: 170, height: 34, minHeight: 34, fontSize: 12.5 }}
    >
      {periods.map(p => <option key={p.period} value={p.period}>{p.period}</option>)}
    </select>
  );
}

/** One measure across two periods, with the change read as better/worse rather than up/down. */
function DeltaRow({ label, from, to, suffix = '', decimals = 0, goodWhenDown = false }) {
  const has = from != null && to != null;
  const fmt = v => v == null ? '—' : `${Number(v).toFixed(decimals)}${suffix}`;
  const diff = has ? Number(to) - Number(from) : null;
  const pct = has && Number(from) !== 0 ? (diff / Math.abs(Number(from))) * 100 : null;

  const flat = diff === null || Math.abs(diff) < (decimals > 0 ? 0.005 : 0.5);
  const improved = flat ? null : goodWhenDown ? diff < 0 : diff > 0;
  const color = flat ? 'var(--text-muted)' : improved ? '#0a5a3a' : '#c03010';
  const Icon = flat ? Minus : (diff > 0 ? TrendingUp : TrendingDown);

  return (
    <tr style={{ borderTop: '1px solid var(--hairline)' }}>
      <td className="py-2" style={{ color: 'var(--text)' }}>{label}</td>
      <td className="py-2 text-right tabular-nums font-semibold" style={{ color: 'var(--text-strong)' }}>{fmt(from)}</td>
      <td className="py-2 text-right tabular-nums font-semibold" style={{ color: 'var(--text-strong)' }}>{fmt(to)}</td>
      <td className="py-2 text-right">
        {!has ? (
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>—</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold tabular-nums" style={{ color }}>
            <Icon size={12} strokeWidth={2.6} />
            {diff > 0 ? '+' : ''}{Number(diff).toFixed(decimals)}{suffix}
            {pct != null && !flat && (
              <span style={{ opacity: 0.75 }}>({pct > 0 ? '+' : ''}{pct.toFixed(0)}%)</span>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}

// Recharts hands the axis tick back to labelFormatter; map it to the full period name.
function periodFor(periods, shortLabel) {
  return periods.find(p => p.shortLabel === shortLabel)?.period ?? shortLabel;
}

/* ── Building blocks ─────────────────────────────────── */

/**
 * A ranked list of labelled meters — the right form for part-to-whole at rail
 * width. Each row names itself and shows its own number, so the bar carries
 * magnitude and nothing carries identity by colour alone.
 */
function MeterList({ title, subtitle, rows, total, color, track }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="clay-card p-5">
      <h2 className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No data available yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map(r => {
            const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
            return (
              <li key={r.label}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="flex-1 min-w-0 truncate text-sm" style={{ color: 'var(--text)' }} title={r.label}>
                    {r.label}
                  </span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-strong)' }}>{r.value}</span>
                  <span className="text-xs tabular-nums w-9 text-right" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                </div>
                {/* Bars are scaled to the largest row so differences stay legible even
                    when every share is small. 4px rounded end, anchored at zero. */}
                <div style={{ height: 6, borderRadius: 3, background: track, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(r.value / max) * 100}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: color,
                  }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * A chart in a card. When `table` is supplied the header gains a chart/table
 * toggle, so the same numbers are always reachable as text — required whenever
 * the marks sit below 3:1 against the card.
 */
function ChartCard({ title, subtitle, children, table, compact, info }) {
  const [view, setView] = useState('chart');
  return (
    <div className={`clay-card ${compact ? 'p-5' : 'p-6'}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-black flex items-center gap-1.5" style={{ color: 'var(--text-strong)' }}>
            {title}
            {info && <InfoTip text={info} />}
          </h2>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        {table && (
          <div className="flex gap-1 shrink-0">
            <ViewToggle active={view === 'chart'} onClick={() => setView('chart')} Icon={ChartColumn} label="Chart view" />
            <ViewToggle active={view === 'table'} onClick={() => setView('table')} Icon={Table2} label="Table view" />
          </div>
        )}
      </div>
      {table && view === 'table' ? <DataTable {...table} /> : children}
    </div>
  );
}

function ViewToggle({ active, onClick, Icon, label }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
      style={active
        ? { background: 'rgba(0,48,135,0.12)', color: 'var(--accent)' }
        : { background: 'transparent', color: 'var(--text-muted)' }}
    >
      <Icon size={13} strokeWidth={2.4} />
    </button>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1.5px solid var(--hairline-strong)' }}>
            {columns.map((c, i) => (
              <th key={c} className="text-xs font-bold uppercase tracking-wider py-2"
                style={{ color: 'var(--text-muted)', textAlign: i === 0 ? 'left' : 'right' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderTop: ri > 0 ? '1px solid var(--hairline)' : undefined }}>
              {r.map((cell, ci) => (
                <td key={ci} className={`py-2 ${ci === 0 ? '' : 'text-right tabular-nums font-semibold'}`}
                  style={{ color: ci === 0 ? 'var(--text)' : 'var(--text-strong)' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A headline percentage with a progress meter and its supporting counts. */
function RateCard({ Icon, title, rate, caption, fill, stats, info }) {
  return (
    <div className="clay-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Icon size={16} strokeWidth={2} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>{title}</h2>
        {info && <InfoTip text={info} />}
      </div>

      <div className="flex items-end gap-3 mb-4">
        <span className="text-5xl font-black leading-none" style={{ color: 'var(--accent)' }}>{rate}%</span>
        <span className="text-sm" style={{ color: 'var(--text)' }}>{caption}</span>
      </div>

      <div className="clay-progress-track w-full h-3 mb-4">
        <div className="clay-progress-fill" style={{ width: `${rate}%`, background: fill }} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map(s => <MiniStat key={s.label} {...s} />)}
      </div>
    </div>
  );
}

function LiveBadge({ lastUpdated }) {
  // Was a counter forcing a re-render so that a Date.now() in the render body would be
  // re-read. Ticking the timestamp itself does the same job and keeps render pure.
  const now = useNow(15000);
  const secs = lastUpdated ? Math.floor((now - lastUpdated.getTime()) / 1000) : null;
  const label = secs == null ? '' : secs < 60 ? 'just now' : `${Math.floor(secs / 60)}m ago`;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold live-badge">
      <span className="animate-pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#10a060', display: 'inline-block' }} />
      Live{label && ` · ${label}`}
    </span>
  );
}

function KpiCard({ Icon, label, value, color, iconColor, info }) {
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

function MiniStat({ label, value, color, text }) {
  return (
    <div className="rounded-2xl p-3 text-center mini-stat" style={{ background: color }}>
      <p className="text-lg font-black tabular-nums" style={{ color: text }}>{value}</p>
      <p className="text-xs font-medium mt-0.5" style={{ color: text, opacity: 0.7 }}>{label}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[190px]">
      <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No data available yet.</p>
    </div>
  );
}

/* One report, two formats: the same data either as a spreadsheet or as a printable PDF. */
function ExportRow({ label, type, exporting, onExport }) {
  return (
    <div>
      {label && <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--text-strong)' }}>{label}</p>}
      <div className="flex gap-2">
        <ExportButton label="Excel" loading={exporting === `${type}:xlsx`} onClick={() => onExport(type, 'xlsx')} />
        <ExportButton label="PDF"   loading={exporting === `${type}:pdf`}  onClick={() => onExport(type, 'pdf')} />
      </div>
    </div>
  );
}

function ExportButton({ label, loading, onClick, block }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`clay-btn clay-btn-ghost flex items-center gap-2 px-4 py-2 text-xs font-bold ${block ? 'w-full justify-center' : 'flex-1 justify-center'}`}
      style={{ opacity: loading ? 0.65 : 1 }}
    >
      {loading
        ? <Loader size={13} strokeWidth={2.5} className="animate-spin" />
        : <Download size={13} strokeWidth={2.5} />}
      {loading ? 'Exporting…' : label}
    </button>
  );
}

/* ── Scholar's Data sheet ─────────────────────────────── */

const POPULATIONS = [
  { value: 'scholars', label: 'Scholars' },
  { value: 'grantees', label: 'Grantees' },
  { value: 'all', label: 'Both' },
];

/** A single-measure bar chart with its numbers one toggle away. */
function CountBars({ title, subtitle, info, rows, t, height = 240, name = 'Count', horizontal = false }) {
  return (
    <ChartCard title={title} subtitle={subtitle} info={info} compact
      table={{ columns: ['', name], rows: rows.map(r => [r.name, r.count]) }}>
      {rows.length === 0 || rows.every(r => r.count === 0) ? <EmptyChart /> : horizontal ? (
        <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 34)}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle(t)} cursor={{ fill: t.cursor }} />
            <Bar dataKey="count" name={name} fill={t.markColor} radius={[0, 4, 4, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={rows} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} width={38} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle(t)} cursor={{ fill: t.cursor }} />
            <Bar dataKey="count" name={name} fill={t.markColor} radius={[4, 4, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/**
 * Profile make-up from the Scholar's Data sheet collected at sign-up — campus, sex, age,
 * civil status, the equity flags, household income and support source — for scholars,
 * grantees, or both. Grantee profiles outlive their deactivated accounts, so they count here.
 */
function Demographics({ token, t, campuses, liveTick }) {
  const [population, setPopulation] = useState('scholars');
  const [campusId, setCampusId] = useState('');
  const [d, setD] = useState(null);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    getAnalyticsDemographics(token, { population, campusId: campusId || undefined })
      .then(r => { if (mine === seq.current) setD(r); })
      .catch(() => {});
  }, [token, population, campusId, liveTick]);

  const who = population === 'grantees' ? 'grantees' : population === 'all' ? 'scholars and grantees' : 'scholars';

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap pt-2">
        <div>
          <h2 className="text-base font-black" style={{ color: 'var(--text-strong)' }}>Scholar &amp; Grantee Profile</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            From the Scholar&apos;s Data sheet filled in at sign-up · {d?.total ?? 0} {who}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1">
            {POPULATIONS.map(p => (
              <button key={p.value} onClick={() => setPopulation(p.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold"
                aria-pressed={population === p.value}
                style={population === p.value ? { background: '#002570', color: '#fff' } : { background: 'var(--surface-inset)', color: 'var(--text)' }}>
                {p.label}
              </button>
            ))}
          </div>
          {campuses && (
            <select value={campusId} onChange={e => setCampusId(e.target.value)} className="clay-input text-xs"
              style={{ height: 32, minHeight: 32, width: 'auto' }} aria-label="Campus">
              <option value="">All campuses</option>
              {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {!d ? <div className="clay-card"><EmptyChart /></div> : (
        <>
          {!campusId && campuses && (
            <CountBars title="By Campus" subtitle={`Where the ${who} study`} rows={d.byCampus} t={t} name="People" horizontal
              info="Campus picked at sign-up. Profiles created before campuses existed were placed under Lingayen." />
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MeterList title="Sex" subtitle={`Share of ${d.total}`} total={d.total} color={t.markColor} track={t.grid}
              rows={d.bySex.map(r => ({ label: r.name, value: r.count }))} />
            <MeterList title="Civil Status" subtitle={`Share of ${d.total}`} total={d.total} color={t.markColor} track={t.grid}
              rows={d.byCivilStatus.map(r => ({ label: r.name, value: r.count }))} />
          </div>

          <MeterList title="Equity Indicators" subtitle={`How many of the ${d.total} ${who} answered Yes`}
            total={d.total} color={t.markColor} track={t.grid}
            rows={d.flags.map(f => ({ label: f.name, value: f.count }))} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <CountBars title="Age" subtitle="Calculated from the birthdate" rows={d.byAge} t={t} name="People" />
            <CountBars title="Year Level" subtitle="As recorded on the profile" rows={d.byYearLevel} t={t} name="People" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <CountBars title="Household Monthly Income" subtitle="Father's and mother's estimated income combined"
              rows={d.byIncome} t={t} name="People" horizontal
              info="Sum of the two parents' estimated monthly income from the sign-up form. 'Not stated' means neither was given." />
            <div className="space-y-6">
              <MeterList title="Main Source of Educational Support" subtitle={`Share of ${d.total}`}
                total={d.total} color={t.markColor} track={t.grid}
                rows={d.bySupportSource.map(r => ({ label: r.name, value: r.count }))} />
              <div className="clay-card p-5">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Average family size</p>
                <p className="text-3xl font-black mt-1" style={{ color: 'var(--text-strong)' }}>
                  {d.averageFamilySize ? d.averageFamilySize.toFixed(1) : '—'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>members per household</p>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Grantee accounts and the one-time grants behind them. Closed grant types and deactivated
 * accounts stay in every figure — deactivation ends access, not the record.
 */
function GranteeAnalytics({ token, t, campuses, liveTick }) {
  const [campusId, setCampusId] = useState('');
  const [g, setG] = useState(null);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    getAnalyticsGrantees(token, { campusId: campusId || undefined })
      .then(r => { if (mine === seq.current) setG(r); })
      .catch(() => {});
  }, [token, campusId, liveTick]);

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap pt-2">
        <div>
          <h2 className="text-base font-black" style={{ color: 'var(--text-strong)' }}>Grantees &amp; One-Time Grants</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Grantee accounts, and every grant paid under each grant type — including closed ones
          </p>
        </div>
        {campuses && (
          <select value={campusId} onChange={e => setCampusId(e.target.value)} className="clay-input text-xs"
            style={{ height: 32, minHeight: 32, width: 'auto' }} aria-label="Campus">
            <option value="">All campuses</option>
            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {!g ? <div className="clay-card"><EmptyChart /></div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard Icon={HandCoins} label="Grantees" value={g.totalGrantees} color="#fff3cd" iconColor="#c07800"
              info="Grantee accounts (one-time grant recipients who are not scholars), active or deactivated." />
            <KpiCard Icon={UserCheck} label="Active Accounts" value={g.activeAccounts} color="#d4f5e2" iconColor="#10a060"
              info="Grantees who can still sign in — usually those whose grant has not been released yet." />
            <KpiCard Icon={UserX} label="Deactivated" value={g.deactivatedAccounts} color="#e8edf5" iconColor="#4a5a7a"
              info="Grantee accounts closed after their grant was released. Their data is kept and still counted here." />
            <KpiCard Icon={Users} label="Scholars with Grants" value={g.scholarGrantees} color="#dce8ff" iconColor="#003087"
              info="Scholars who also received a one-time grant. A scholar can be a grantee; a grantee is never a scholar." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="clay-card p-5">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Released</p>
              <p className="text-2xl font-black mt-1" style={{ color: 'var(--tone-ok-fg)' }}>{peso(g.releasedAmount)}</p>
            </div>
            <div className="clay-card p-5">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Awaiting release</p>
              <p className="text-2xl font-black mt-1" style={{ color: 'var(--tone-warn-fg)' }}>{peso(g.pendingAmount)}</p>
            </div>
          </div>

          <ChartCard title="Grants by Type" subtitle="Amount released and still pending, per grant type"
            info="Cancelled grants are left out. A closed (deactivated) grant type keeps its figures."
            table={{
              columns: ['Grant type', 'Recipients', 'Grantees', 'Scholars', 'Released', 'Pending'],
              rows: g.byType.map(r => [r.name + (r.isActive ? '' : ' (closed)'), r.recipients, r.granteeRecipients, r.scholarRecipients, peso(r.releasedAmount), peso(r.pendingAmount)]),
            }}>
            {g.byType.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={Math.max(200, g.byType.length * 46)}>
                <BarChart data={g.byType} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₱${Number(v).toLocaleString()}`} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle(t)} cursor={{ fill: t.cursor }} formatter={v => peso(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: t.axis }} />
                  <Bar dataKey="releasedAmount" name="Released" stackId="a" fill={t.status.verified} stroke={t.gap} strokeWidth={2} maxBarSize={24} />
                  <Bar dataKey="pendingAmount" name="Pending" stackId="a" fill={t.status.pending} stroke={t.gap} strokeWidth={2} radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {!campusId && campuses && (
              <CountBars title="Grantees by Campus" subtitle="Active and deactivated accounts" t={t} name="Grantees" horizontal
                rows={g.byCampus.map(c => ({ name: c.name, count: c.count }))} />
            )}
            <ChartCard title="Grant Releases by Month" subtitle="Amount handed out each month" compact
              table={{ columns: ['Month', 'Grants', 'Amount'], rows: g.byMonth.map(m => [m.label, m.count, peso(m.amount)]) }}>
              {g.byMonth.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={g.byMonth} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                    <YAxis width={60} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} tickFormatter={v => `₱${Number(v).toLocaleString()}`} />
                    <Tooltip contentStyle={tooltipStyle(t)} cursor={{ fill: t.cursor }} formatter={v => peso(v)} />
                    <Bar dataKey="amount" name="Released" fill={t.markColor} radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </section>
  );
}

/* ── Auto-generated summary report ──────────────────── */

/**
 * The written-up version of this page: highlight sentences composed from the figures, then a
 * table per breakdown (type, category, program, year level, sex, releases, grants…). Nothing
 * to configure — a coordinator's always covers their campus; the administrator may pick one.
 */
function SummaryReportCard({ campuses, campusName }) {
  const { token } = useAuth();
  const toast = useToast();
  const [campusId, setCampusId] = useState('');
  const [busy, setBusy] = useState('');

  async function run(format) {
    setBusy(format);
    try { await exportSummary(token, { campusId: campusId || undefined }, format); }
    catch (e) { toast(e.message, 'error'); }
    finally { setBusy(''); }
  }

  return (
    <div className="clay-card p-5">
      <div className="flex items-center gap-2">
        <FileText size={15} strokeWidth={2.4} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>Summary Report</h2>
      </div>
      <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
        {campusName
          ? `Generated automatically from ${campusName}'s current figures — highlights plus every breakdown on this page.`
          : 'Generated automatically from the current figures — highlights plus every breakdown on this page.'}
      </p>
      {campuses && (
        <select value={campusId} onChange={e => setCampusId(e.target.value)} className="clay-input text-xs mb-2"
          style={{ height: 34, minHeight: 34 }} aria-label="Campus for the summary report">
          <option value="">All campuses</option>
          {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => run('pdf')} disabled={!!busy} className="clay-btn clay-btn-primary text-xs py-2 flex items-center justify-center gap-1.5">
          <Download size={13} /> {busy === 'pdf' ? 'Generating…' : 'PDF'}
        </button>
        <button onClick={() => run('xlsx')} disabled={!!busy} className="clay-btn clay-btn-ghost text-xs py-2 flex items-center justify-center gap-1.5">
          <Download size={13} /> {busy === 'xlsx' ? 'Generating…' : 'Excel'}
        </button>
      </div>
    </div>
  );
}

/* ── Report builder ──────────────────────────────── */

const REPORT_KINDS = [
  { key: 'scholars', label: 'Scholars' },
  { key: 'grantees', label: 'Grantees' },
  { key: 'masterlist', label: 'Master list (scholars & grantees)' },
];

/**
 * A report made to order: pick who to list and narrow it down, and the system generates
 * exactly that — e.g. every scholar at one campus with the scholarship each holds, or the
 * female grantees of one grant. Excel to work with, PDF to print; the filters are written into
 * the report's heading.
 */
function ReportBuilder({ campuses, scholarshipTypes }) {
  const { token } = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState('scholars');
  const [f, setF] = useState({ campusId: '', scholarshipTypeId: '', grantTypeId: '', programId: '', yearLevel: '', sex: '', status: '' });
  const [programs, setPrograms] = useState([]);
  const [grantTypes, setGrantTypes] = useState([]);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    getPrograms(token).then(setPrograms).catch(() => {});
    getGrantTypes(token).then(setGrantTypes).catch(() => {});
  }, [token]);

  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const ctl = 'clay-input text-xs';
  const ctlSt = { height: 34, minHeight: 34 };

  function filters() {
    const common = { campusId: f.campusId, sex: f.sex };
    if (kind === 'scholars') return { ...common, scholarshipTypeId: f.scholarshipTypeId, programId: f.programId, yearLevel: f.yearLevel, lifecycleStatus: f.status };
    if (kind === 'grantees') return { ...common, grantTypeId: f.grantTypeId, programId: f.programId, yearLevel: f.yearLevel, active: f.status };
    return { ...common, scholarshipTypeId: f.scholarshipTypeId, grantTypeId: f.grantTypeId, status: f.status };
  }

  async function run(format) {
    setBusy(format);
    try { await downloadListReport(kind, format, filters(), token); }
    catch (e) { toast(e.message, 'error'); }
    finally { setBusy(''); }
  }

  return (
    <div className="clay-card p-5">
      <h2 className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>Custom Report</h2>
      <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--text-muted)' }}>
        Choose who to list and narrow it down — the report contains exactly that.
      </p>
      <div className="space-y-2">
        <select value={kind} onChange={e => { setKind(e.target.value); set('status', ''); }} className={ctl} style={ctlSt} aria-label="Report of">
          {REPORT_KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
        {campuses && (
          <select value={f.campusId} onChange={e => set('campusId', e.target.value)} className={ctl} style={ctlSt} aria-label="Campus">
            <option value="">All campuses</option>
            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {kind !== 'grantees' && (
          <select value={f.scholarshipTypeId} onChange={e => set('scholarshipTypeId', e.target.value)} className={ctl} style={ctlSt} aria-label="Scholarship">
            <option value="">All scholarships</option>
            {scholarshipTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
        )}
        {kind !== 'scholars' && (
          <select value={f.grantTypeId} onChange={e => set('grantTypeId', e.target.value)} className={ctl} style={ctlSt} aria-label="Grant">
            <option value="">All grants</option>
            {grantTypes.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        {kind !== 'masterlist' && (
          <div className="grid grid-cols-2 gap-2">
            <select value={f.programId} onChange={e => set('programId', e.target.value)} className={ctl} style={ctlSt} aria-label="Program">
              <option value="">All programs</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.code}{p.major ? ` (${p.major})` : ''}</option>)}
            </select>
            <select value={f.yearLevel} onChange={e => set('yearLevel', e.target.value)} className={ctl} style={ctlSt} aria-label="Year level">
              <option value="">All years</option>
              {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <select value={f.sex} onChange={e => set('sex', e.target.value)} className={ctl} style={ctlSt} aria-label="Sex">
            <option value="">Male &amp; Female</option>
            {SEX_OPTIONS.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={f.status} onChange={e => set('status', e.target.value)} className={ctl} style={ctlSt} aria-label="Status">
            {kind === 'scholars' && <>
              <option value="">Any status</option>
              {['Active', 'Renewed', 'Lapsed', 'Suspended', 'Graduated'].map(x => <option key={x} value={x}>{x}</option>)}
            </>}
            {kind === 'grantees' && <>
              <option value="">Any account</option>
              <option value="true">Active accounts</option>
              <option value="false">Closed accounts</option>
            </>}
            {kind === 'masterlist' && <>
              <option value="">Any account status</option>
              <option value="claimed">Account created</option>
              <option value="unclaimed">Not yet signed up</option>
            </>}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={() => run('xlsx')} disabled={!!busy} className="clay-btn clay-btn-ghost text-xs py-2 flex items-center justify-center gap-1.5">
            <Download size={13} /> {busy === 'xlsx' ? 'Generating…' : 'Excel'}
          </button>
          <button onClick={() => run('pdf')} disabled={!!busy} className="clay-btn clay-btn-ghost text-xs py-2 flex items-center justify-center gap-1.5">
            <Download size={13} /> {busy === 'pdf' ? 'Generating…' : 'PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
