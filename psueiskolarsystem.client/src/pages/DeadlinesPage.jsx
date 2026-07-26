import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { getRequirements } from '../api/documents';
import { getActiveSemester } from '../api/settings';
import { getDeadlines, upsertDeadline, deleteDeadline, getDeadlineReport } from '../api/deadlines';
import { useTitle } from '../hooks/useTitle';
import { CalendarClock, AlertTriangle, CheckCircle2, Clock, Users, ChevronDown, ChevronUp } from 'lucide-react';

function toDateInput(iso) {
  return iso ? iso.slice(0, 10) : '';
}

export default function DeadlinesPage() {
  useTitle('Deadlines');
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [period, setPeriod] = useState({ academicYear: '', semester: 1 });
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('manage');

  const [requirements, setRequirements] = useState([]);
  const [deadlineByReq, setDeadlineByReq] = useState({});   // requirementId -> deadline
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getActiveSemester(token)
      .then(d => setPeriod({ academicYear: d.academicYear, semester: d.semester }))
      .catch(() => {
        const y = new Date().getFullYear();
        setPeriod({ academicYear: `${y}-${y + 1}`, semester: 1 });
      })
      .finally(() => setReady(true));
  }, []);

  async function loadManage() {
    setLoading(true); setError('');
    try {
      const [reqs, deadlines] = await Promise.all([
        getRequirements(token),
        getDeadlines(token, period),
      ]);
      setRequirements(reqs);
      const map = {};
      deadlines.forEach(d => { map[d.requirementId] = d; });
      setDeadlineByReq(map);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadReport() {
    setLoading(true); setError('');
    try { setReport(await getDeadlineReport(token, period)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!ready || !period.academicYear) return;
    if (tab === 'manage') loadManage(); else loadReport();
  }, [ready, period.academicYear, period.semester, tab]);

  async function handleSetDeadline(requirementId, dateStr) {
    if (!dateStr) return;
    try {
      await upsertDeadline({
        requirementId,
        academicYear: period.academicYear,
        semester: period.semester,
        dueDate: `${dateStr}T23:59:59Z`,
      }, token);
      await loadManage();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleClear(id) {
    if (!(await confirm({ title: 'Remove deadline', message: 'Remove this deadline?', confirmLabel: 'Remove', danger: true }))) return;
    try { await deleteDeadline(id, token); await loadManage(); }
    catch (e) { toast(e.message, 'error'); }
  }

  return (
    <Layout>
      <div className="page-shell">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="page-title">Submission Deadlines</h1>
            <p className="page-subtitle">Set due dates per requirement and monitor compliance for the period.</p>
            <span className="page-title-bar" />
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={period.academicYear}
              onChange={e => setPeriod(p => ({ ...p, academicYear: e.target.value }))}
              className="clay-input w-28"
              placeholder="2025-2026"
            />
            <select
              value={period.semester}
              onChange={e => setPeriod(p => ({ ...p, semester: parseInt(e.target.value) }))}
              className="clay-input"
            >
              <option value={1}>Sem 1</option>
              <option value={2}>Sem 2</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <TabBtn active={tab === 'manage'} onClick={() => setTab('manage')} icon={CalendarClock} label="Manage Deadlines" />
          <TabBtn active={tab === 'report'} onClick={() => setTab('report')} icon={AlertTriangle} label="Compliance Report" />
        </div>

        {error && <p className="text-sm mb-4" style={{ color: '#e03030' }}>{error}</p>}

        {loading ? (
          <p className="text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
        ) : tab === 'manage' ? (
          <ManageTab
            requirements={requirements}
            deadlineByReq={deadlineByReq}
            onSet={handleSetDeadline}
            onClear={handleClear}
          />
        ) : (
          <ReportTab report={report} />
        )}
      </div>
    </Layout>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="clay-btn px-4 py-2 text-sm flex items-center gap-2"
      style={active
        ? { background: 'rgba(0,37,112,0.10)', color: '#002570', border: '1.5px solid rgba(0,37,112,0.25)' }
        : { color: 'var(--text)' }}
    >
      <Icon size={15} strokeWidth={2.2} /> {label}
    </button>
  );
}

function ManageTab({ requirements, deadlineByReq, onSet, onClear }) {
  if (requirements.length === 0)
    return <p className="text-sm" style={{ color: '#7a8aaa' }}>No active requirements.</p>;

  return (
    <div className="clay-card overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead className="clay-table-head">
          <tr>
            {['Requirement', 'Due Date', 'Status', ''].map(h => (
              <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requirements.map(req => {
            const dl = deadlineByReq[req.id];
            const past = dl && new Date(dl.dueDate) < new Date();
            return (
              <tr key={req.id} className="clay-table-row">
                <td className="px-5 py-3.5 font-semibold" style={{ color: 'var(--text-strong)' }}>
                  {req.name}
                  {req.isRequired && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-xl font-medium"
                      style={{ background: '#dce8ff', color: '#003087', border: '1px solid #80aaee' }}>Required</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <input
                    type="date"
                    defaultValue={toDateInput(dl?.dueDate)}
                    onChange={e => onSet(req.id, e.target.value)}
                    className="clay-input"
                    style={{ width: 'auto' }}
                  />
                </td>
                <td className="px-5 py-3.5">
                  {!dl ? (
                    <span className="text-xs" style={{ color: '#9aaabb' }}>No deadline set</span>
                  ) : past ? (
                    <span className="clay-badge badge-inactive">Past due</span>
                  ) : (
                    <span className="clay-badge badge-active">Open</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {dl && (
                    <button onClick={() => onClear(dl.id)} className="text-xs font-medium hover:underline" style={{ color: '#e03030' }}>
                      Clear
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </div>
  );
}

function ReportTab({ report }) {
  if (!report || report.length === 0)
    return <p className="text-sm" style={{ color: '#7a8aaa' }}>No deadlines set for this period. Set deadlines first to track compliance.</p>;

  return (
    <div className="space-y-4">
      {report.map(r => <ReportCard key={r.id} row={r} />)}
    </div>
  );
}

function ReportCard({ row }) {
  const [open, setOpen] = useState(false);
  const due = new Date(row.dueDate);

  return (
    <div className="clay-card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-bold" style={{ color: 'var(--text-strong)' }}>{row.requirementName}</p>
          <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: row.isPastDue ? '#c0342c' : '#7a8aaa' }}>
            <Clock size={12} /> Due {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {row.isPastDue && ' · Past due'}
          </p>
        </div>
        <div className="flex gap-4">
          <Stat icon={CheckCircle2} color="#0a7d43" value={row.onTime} label="On time" />
          <Stat icon={Clock} color="#c2410c" value={row.late} label="Late" />
          <Stat icon={AlertTriangle} color="#c0342c" value={row.missing} label="Missing" />
          <Stat icon={Users} color="#003087" value={row.applicable} label="Scholars" />
        </div>
      </div>

      {(row.missing > 0 || row.late > 0) && (
        <button onClick={() => setOpen(o => !o)} className="mt-3 text-xs flex items-center gap-1 hover:underline" style={{ color: '#003087' }}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {open ? 'Hide' : 'Show'} details
        </button>
      )}

      {open && (
        <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {row.missing > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#c0342c' }}>Missing ({row.missing})</p>
              <ul className="space-y-1">
                {row.missingScholars.map(s => (
                  <li key={s.id} className="text-xs" style={{ color: 'var(--text)' }}>
                    {s.fullName}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {row.late > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#c2410c' }}>Late ({row.late})</p>
              <ul className="space-y-1">
                {row.lateSubmissions.map(s => (
                  <li key={s.scholarId} className="text-xs" style={{ color: 'var(--text)' }}>
                    {s.scholarName}<span style={{ color: '#9aaabb' }}> · {new Date(s.submittedAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, color, value, label }) {
  return (
    <div className="text-center">
      <p className="text-xl font-black flex items-center justify-center gap-1" style={{ color }}>
        <Icon size={15} strokeWidth={2.4} /> {value}
      </p>
      <p className="text-xs font-semibold uppercase tracking-wide mt-0.5" style={{ color: '#7a8aaa' }}>{label}</p>
    </div>
  );
}
