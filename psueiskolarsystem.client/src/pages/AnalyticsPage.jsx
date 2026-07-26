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
import { GraduationCap, FileCheck, Clock, AlertTriangle, TrendingUp, Download, Loader, Table2, ChartColumn, ArrowRight, Minus, TrendingDown } from 'lucide-react';
import { useTitle } from '../hooks/useTitle';
import { exportScholars, exportSubmissions } from '../api/reports';
import { getAnalyticsTrends } from '../api/analytics';
import { vizTokens, tooltipStyle } from '../constants/viz';
import InfoTip from '../components/InfoTip';

export default function AnalyticsPage() {
  useTitle('Data Visualization');
  const { token } = useAuth();
  const toast = useToast();
  const { resolved } = useTheme();
  const { subscribeToAnalytics } = useNotifications();
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(''); // '' = all-time, else "AY__semester"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(null); // "<report>:<format>" while downloading
  const [lastUpdated, setLastUpdated] = useState(null);
  const [trends, setTrends] = useState(null);       // per-period rows for the comparison charts
  const periodRef = useRef(period);

  // Mark colours are per-mode values, so they come from the resolved theme rather
  // than being derived from the light set.
  const t = vizTokens(resolved);

  const refetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ay, sem] = (periodRef.current || '').split('__');
      const d = await getAnalyticsOverview(token, {
        academicYear: ay || undefined,
        semester: sem || undefined,
      });
      setData(d);
      setLastUpdated(new Date());
      setError('');
    } catch (e) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token]);

  async function handleExport(type, format) {
    setExporting(`${type}:${format}`);
    try {
      if (type === 'scholars') {
        await exportScholars(token, {}, format);
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

  // Refetch when the period filter changes.
  useEffect(() => { periodRef.current = period; refetch(); }, [period, refetch]);

  // Trends span every period by design, so they are independent of the period filter.
  const loadTrends = useCallback(() => {
    getAnalyticsTrends(token).then(setTrends).catch(() => {});
  }, [token]);
  useEffect(() => { loadTrends(); }, [loadTrends]);

  // Real-time: refetch (silently) on server broadcast, plus a periodic fallback.
  useEffect(() => {
    let timer;
    const trigger = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { refetch(true); loadTrends(); }, 600);
    };
    const unsub = subscribeToAnalytics(trigger);
    const interval = setInterval(() => { refetch(true); loadTrends(); }, 30000);
    return () => { clearTimeout(timer); unsub(); clearInterval(interval); };
  }, [subscribeToAnalytics, refetch, loadTrends]);

  if (loading) return (
    <Layout>
      <div className="p-4 sm:p-8 flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: '#7a8aaa' }}>Loading analytics…</p>
      </div>
    </Layout>
  );

  if (error) return (
    <Layout>
      <div className="page-shell">
        <p className="text-sm" style={{ color: '#e03030' }}>{error}</p>
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
        <div className="flex items-start justify-between gap-4 flex-wrap mb-7">
          <div>
            <h1 className="page-title">Data Visualization &amp; Reports</h1>
            <p className="page-subtitle">Descriptive analytics for PSU Lingayen Campus</p>
            <span className="page-title-bar" />
          </div>
          {/* Filters in one row above the charts. Exports live in the rail so this row
              stays a single line instead of wrapping. */}
          <div className="flex items-center gap-2">
            <LiveBadge lastUpdated={lastUpdated} />
            {(data?.availablePeriods?.length ?? 0) > 0 && (
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="clay-input text-sm"
                style={{ width: 200, flex: '0 0 auto' }}
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
                info="Every scholar profile on record, including archived and graduated ones. Not affected by the period filter." />
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
                  : 'linear-gradient(90deg, #003087, #0040b8)'}
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
                  { label: 'Incomplete', value: submissions.incomplete, color: '#ffe8d6', text: '#c05000' },
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
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={byProgram} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                    <XAxis dataKey="program" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
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
                  columns: ['Period', 'Verified', 'Pending', 'Incomplete'],
                  rows: byPeriod.map(p => [p.period, p.verified, p.pending, p.incomplete]),
                }}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byPeriod} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle(t)} cursor={{ fill: t.cursor }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: t.axis }} />
                    {/* A 2px surface-coloured stroke keeps adjacent segments from fusing. */}
                    <Bar dataKey="verified"   name="Verified"   stackId="a" fill={t.status.verified}   stroke={t.gap} strokeWidth={2} maxBarSize={64} />
                    <Bar dataKey="pending"    name="Pending"    stackId="a" fill={t.status.pending}    stroke={t.gap} strokeWidth={2} maxBarSize={64} />
                    <Bar dataKey="incomplete" name="Incomplete" stackId="a" fill={t.status.incomplete} stroke={t.gap} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={64} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* ── Semester-over-semester comparison ── */}
            <PeriodComparison trends={trends} t={t} />
          </div>

          {/* ── Right rail: composition and the numbers behind the charts ── */}
          <aside className="page-rail min-w-0 space-y-6">

            {/* Composition as labelled meters rather than a donut. The counts here are
                close together, which a donut compares badly, and its wedges would put
                every colour against every other — six categorical steps don't clear
                that all-pairs bar (see constants/viz.js). One measure, one colour,
                names in text: nothing rests on hue. */}
            <MeterList
              title="Scholars by Scholarship Type"
              subtitle={`Share of ${totalScholars} scholar${totalScholars !== 1 ? 's' : ''}`}
              rows={byScholarshipType.map(r => ({ label: r.type, value: r.count }))}
              total={totalScholars}
              color={t.markColor}
              track={t.grid}
            />

            {/* No program panel here — that would restate the bar chart beside it. Its
                numbers are one click away via the chart's table toggle instead. */}
            <div className="clay-card p-5">
              <h2 className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>Reports</h2>
              <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--text-muted)' }}>
                Excel to work with the numbers, PDF to print or file
              </p>
              <div className="space-y-3">
                <ExportRow
                  label="Scholar Roster"
                  exporting={exporting}
                  type="scholars"
                  onExport={handleExport}
                />
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
        <p className="text-sm" style={{ color: '#b0bdd0' }}>
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
          columns: ['Period', 'Verified', 'Pending', 'Incomplete', 'Total'],
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
              { label: 'Incomplete', color: t.status.incomplete },
            ]} />
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={periods} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle(t)} labelFormatter={l => periodFor(periods, l)} />
                {/* Semesters are discrete, so the bands step between them rather than curving —
                    a monotone spline would draw values that no period actually had. */}
                <Area type="linear" dataKey="verified"   name="Verified"   stackId="s" stroke={t.gap} strokeWidth={2} fill={t.status.verified} fillOpacity={0.92} />
                <Area type="linear" dataKey="pending"    name="Pending"    stackId="s" stroke={t.gap} strokeWidth={2} fill={t.status.pending} fillOpacity={0.92} />
                <Area type="linear" dataKey="incomplete" name="Incomplete" stackId="s" stroke={t.gap} strokeWidth={2} fill={t.status.incomplete} fillOpacity={0.92} />
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
              <AreaChart data={periods} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
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
          <p className="text-sm" style={{ color: '#b0bdd0' }}>
            Pick two different periods to see a comparison.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr style={{ borderBottom: '1.5px solid rgba(0,0,0,0.07)' }}>
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
                <DeltaRow label="Incomplete" from={a.incomplete} to={b.incomplete} goodWhenDown />
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
    <p className="text-sm py-8 text-center" style={{ color: '#b0bdd0' }}>
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
    <tr style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
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
        <p className="text-sm" style={{ color: '#b0bdd0' }}>No data available yet.</p>
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
        ? { background: 'rgba(0,48,135,0.12)', color: '#003087' }
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
          <tr style={{ borderBottom: '1.5px solid rgba(0,0,0,0.07)' }}>
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
            <tr key={ri} style={{ borderTop: ri > 0 ? '1px solid rgba(0,0,0,0.05)' : undefined }}>
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
        <Icon size={16} strokeWidth={2} style={{ color: '#003087' }} />
        <h2 className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>{title}</h2>
        {info && <InfoTip text={info} />}
      </div>

      <div className="flex items-end gap-3 mb-4">
        <span className="text-5xl font-black leading-none" style={{ color: '#003087' }}>{rate}%</span>
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
  const [, force] = useState(0);
  useEffect(() => { const i = setInterval(() => force(n => n + 1), 15000); return () => clearInterval(i); }, []);
  const secs = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : null;
  const label = secs == null ? '' : secs < 60 ? 'just now' : `${Math.floor(secs / 60)}m ago`;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold" style={{ background: '#d4f5e2', color: '#0a5a3a' }}>
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
      <p className="text-sm" style={{ color: '#b0bdd0' }}>No data available yet.</p>
    </div>
  );
}

/* One report, two formats: the same data either as a spreadsheet or as a printable PDF. */
function ExportRow({ label, type, exporting, onExport }) {
  return (
    <div>
      <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--text-strong)' }}>{label}</p>
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
