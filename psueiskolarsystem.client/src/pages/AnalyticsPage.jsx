import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getAnalyticsOverview } from '../api/analytics';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { GraduationCap, FileCheck, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { useTitle } from '../hooks/useTitle';

const BLUE_SHADES = ['#003087', '#1a4fa0', '#3368b8', '#4d80d0', '#6699e8', '#80b2ff'];
const PIE_COLORS  = ['#003087', '#f5b800', '#10b981', '#8b5cf6', '#f97316', '#06b6d4'];

export default function AnalyticsPage() {
  useTitle('Analytics');
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAnalyticsOverview(token)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Layout>
      <div className="p-8 flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: '#7a8aaa' }}>Loading analytics…</p>
      </div>
    </Layout>
  );

  if (error) return (
    <Layout>
      <div className="p-8">
        <p className="text-sm" style={{ color: '#e03030' }}>{error}</p>
      </div>
    </Layout>
  );

  const { totalScholars, compliant, nonCompliant, noGwa, byProgram, byScholarshipType, submissions, byPeriod } = data;
  const complianceRate = totalScholars > 0
    ? Math.round((compliant / totalScholars) * 100)
    : 0;
  const verifiedRate = submissions.total > 0
    ? Math.round((submissions.verified / submissions.total) * 100)
    : 0;

  return (
    <Layout>
      <div className="p-8 max-w-6xl space-y-8">

        {/* Header */}
        <div>
          <h1 className="page-title">Analytics &amp; Reports</h1>
          <p className="page-subtitle">Descriptive analytics — PSU Lingayen Campus</p>
          <span className="page-title-bar" />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard Icon={GraduationCap} label="Total Scholars"     value={totalScholars}          color="#dce8ff" iconColor="#003087" />
          <KpiCard Icon={FileCheck}     label="Verified Docs"      value={submissions.verified}   color="#d4f5e2" iconColor="#10a060" />
          <KpiCard Icon={Clock}         label="Pending Review"     value={submissions.pending}    color="#fff3cd" iconColor="#c07800" />
          <KpiCard Icon={AlertTriangle} label="Non-Compliant GWA"  value={nonCompliant}           color="#ffe8d6" iconColor="#c05000" />
        </div>

        {/* Compliance overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* GWA compliance */}
          <div className="clay-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp size={16} strokeWidth={2} style={{ color: '#003087' }} />
              <h2 className="text-sm font-black" style={{ color: '#0d1a33' }}>GWA Compliance</h2>
            </div>

            <div className="flex items-end gap-3 mb-4">
              <span className="text-5xl font-black" style={{ color: '#003087' }}>{complianceRate}%</span>
              <span className="text-sm pb-2" style={{ color: '#4a5a7a' }}>of scholars meeting GWA requirement</span>
            </div>

            <div className="clay-progress-track w-full h-3 mb-4">
              <div className="clay-progress-fill" style={{
                width: `${complianceRate}%`,
                background: complianceRate === 100
                  ? 'linear-gradient(90deg, #f5b800, #ffd060)'
                  : 'linear-gradient(90deg, #003087, #0040b8)',
              }} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Compliant"  value={compliant}    color="#d4f5e2" text="#0a5a3a" />
              <MiniStat label="Flagged"    value={nonCompliant} color="#ffe8d6" text="#c05000" />
              <MiniStat label="No GWA yet" value={noGwa}        color="#e8edf5" text="#4a5a7a" />
            </div>
          </div>

          {/* Document submission overview */}
          <div className="clay-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <FileCheck size={16} strokeWidth={2} style={{ color: '#003087' }} />
              <h2 className="text-sm font-black" style={{ color: '#0d1a33' }}>Document Submissions</h2>
            </div>

            <div className="flex items-end gap-3 mb-4">
              <span className="text-5xl font-black" style={{ color: '#003087' }}>{verifiedRate}%</span>
              <span className="text-sm pb-2" style={{ color: '#4a5a7a' }}>verification rate</span>
            </div>

            <div className="clay-progress-track w-full h-3 mb-4">
              <div className="clay-progress-fill" style={{
                width: `${verifiedRate}%`,
                background: 'linear-gradient(90deg, #10a060, #12c070)',
              }} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Verified"   value={submissions.verified}   color="#d4f5e2" text="#0a5a3a" />
              <MiniStat label="Pending"    value={submissions.pending}    color="#fff3cd" text="#7d5a00" />
              <MiniStat label="Incomplete" value={submissions.incomplete} color="#ffe8d6" text="#c05000" />
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Scholars by program — bar chart */}
          <div className="clay-card p-6">
            <h2 className="text-sm font-black mb-5" style={{ color: '#0d1a33' }}>Scholars by Program</h2>
            {byProgram.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byProgram} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,48,0.06)" vertical={false} />
                  <XAxis dataKey="program" tick={{ fontSize: 11, fill: '#7a8aaa' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#7a8aaa' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1.5px solid rgba(0,48,135,0.12)', boxShadow: '3px 3px 0px rgba(0,0,48,0.1)', fontSize: '12px' }}
                    cursor={{ fill: 'rgba(0,48,135,0.05)' }}
                  />
                  <Bar dataKey="count" name="Scholars" radius={[6, 6, 0, 0]}>
                    {byProgram.map((_, i) => (
                      <Cell key={i} fill={BLUE_SHADES[i % BLUE_SHADES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Scholars by scholarship type — pie chart */}
          <div className="clay-card p-6">
            <h2 className="text-sm font-black mb-5" style={{ color: '#0d1a33' }}>Scholars by Scholarship Type</h2>
            {byScholarshipType.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={byScholarshipType}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={3}
                    label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {byScholarshipType.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1.5px solid rgba(0,48,135,0.12)', boxShadow: '3px 3px 0px rgba(0,0,48,0.1)', fontSize: '12px' }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: '#4a5a7a' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Submissions by period — bar chart */}
        {byPeriod.length > 0 && (
          <div className="clay-card p-6">
            <h2 className="text-sm font-black mb-5" style={{ color: '#0d1a33' }}>Submission Activity by Period</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byPeriod} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,48,0.06)" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#7a8aaa' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#7a8aaa' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1.5px solid rgba(0,48,135,0.12)', boxShadow: '3px 3px 0px rgba(0,0,48,0.1)', fontSize: '12px' }}
                  cursor={{ fill: 'rgba(0,48,135,0.05)' }}
                />
                <Bar dataKey="verified"   name="Verified"   stackId="a" fill="#10a060" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pending"    name="Pending"    stackId="a" fill="#f5b800" />
                <Bar dataKey="incomplete" name="Incomplete" stackId="a" fill="#f07030" radius={[6, 6, 0, 0]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: '#4a5a7a' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
    </Layout>
  );
}

function KpiCard({ Icon, label, value, color, iconColor }) {
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

function MiniStat({ label, value, color, text }) {
  return (
    <div className="rounded-2xl p-3 text-center" style={{
      background: color,
      boxShadow: '4px 4px 10px rgba(163,177,198,0.4), -3px -3px 7px rgba(255,255,255,0.8)',
    }}>
      <p className="text-lg font-black" style={{ color: text }}>{value}</p>
      <p className="text-xs font-medium mt-0.5" style={{ color: text, opacity: 0.7 }}>{label}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[220px]">
      <p className="text-sm" style={{ color: '#b0bdd0' }}>No data available yet.</p>
    </div>
  );
}
