import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import CrossMatchList from '../components/CrossMatchList';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';
import { SEX_OPTIONS } from '../constants/personal';
import { getGrantTypes } from '../api/grantTypes';
import { getGrantees } from '../api/grantees';
import { getCampuses } from '../api/campuses';
import { ArrowLeft, Gift, ListChecks, Users, CalendarX2 } from 'lucide-react';

const peso = v => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDay = d => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : null);

/**
 * One grant type: the grantees who received it, and the cross-matching list of students the
 * office has listed for it.
 */
export default function GrantTypeDetailPage() {
  const { id } = useParams();
  const typeId = Number(id);
  const { token } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState(null);
  const [error, setError] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'grantees');
  useTitle(type?.name ?? 'Grant Type');

  const load = useCallback(async () => {
    try {
      const all = await getGrantTypes(token);
      const t = all.find(x => x.id === typeId);
      if (!t) setError('Grant type not found.');
      setType(t ?? null);
    } catch (e) {
      setError(e.message);
    }
  }, [token, typeId]);

  useEffect(() => {
    load();
    getCampuses(token).then(setCampuses).catch(() => {});
  }, [load, token]);

  function changeTab(key) {
    setTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', key);
    window.history.replaceState(null, '', url);
  }

  if (error) {
    return (
      <Layout>
        <div className="page-shell">
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
          <Link to="/grant-types" className="text-sm font-bold" style={{ color: 'var(--accent)' }}>← Back to Grant Types</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-shell">
        <button onClick={() => navigate('/grant-types')} className="text-xs font-bold flex items-center gap-1 mb-3 hover:underline" style={{ color: 'var(--accent)' }}>
          <ArrowLeft size={13} /> All grant types
        </button>
        <div className="page-head">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Gift size={26} style={{ color: 'var(--accent)' }} /> {type?.name ?? 'Loading…'}
            </h1>
            {type && (
              <p className="page-subtitle">
                {[type.sponsor, type.defaultAmount != null ? `${peso(type.defaultAmount)} each` : 'Amount varies',
                  `${type.granteeAccounts} grantee account${type.granteeAccounts === 1 ? '' : 's'}`,
                  `${type.releasedCount} received · ${type.pendingCount} pending`].filter(Boolean).join(' · ')}
                {!type.isActive && <span className="status-badge tone-neutral ml-2">Closed</span>}
              </p>
            )}
            <span className="page-title-bar" />
          </div>
        </div>

        {type && (
          <div className="clay-card px-4 py-3 mb-5 flex items-center gap-2.5 text-sm"
            style={type.scheduledDate ? { color: 'var(--text)' } : { background: 'var(--tone-warn-bg)', color: 'var(--tone-warn-fg)' }}>
            {type.scheduledDate ? (
              <span>Release date: <strong>{fmtDay(type.scheduledDate)}</strong> — grantee accounts under this grant close automatically once the day is over.</span>
            ) : (
              <><CalendarX2 size={16} /> <span>The release date has not been set yet. Set it from Grant Types once it is known — the grantees are notified automatically.</span></>
            )}
          </div>
        )}

        <div className="flex gap-1.5 mb-5 flex-wrap" role="tablist">
          {[{ key: 'grantees', label: 'Grantees', Icon: Users }, { key: 'crossmatch', label: 'Cross-Matching', Icon: ListChecks }].map(t => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => changeTab(t.key)}
              className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5"
              style={tab === t.key ? { background: '#002570', color: '#fff' } : { background: 'var(--surface-inset)', color: 'var(--text)' }}>
              <t.Icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {type && (
          <div className="clay-card p-5">
            {tab === 'grantees' && <GranteesTab type={type} campuses={campuses} />}
            {tab === 'crossmatch' && (
              <CrossMatchList campuses={campuses}
                scope={{ kind: 'Grantee', grantTypeId: type.id, typeName: type.name, defaultAmount: type.defaultAmount, isActive: type.isActive }} />
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function GranteesTab({ type, campuses }) {
  const { token, user } = useAuth();
  // A coordinator works within one campus, so they have no campus to pick.
  const isAdmin = user?.role === 'Administrator';
  const toast = useToast();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ search: '', campusId: '', yearLevel: '', sex: '', active: '' });
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    const t = setTimeout(() => {
      getGrantees(token, { ...filters, grantTypeId: type.id, page, pageSize })
        .then(d => { if (mine === seq.current) setData(d); })
        .catch(e => { if (mine === seq.current) toast(e.message, 'error'); });
    }, filters.search ? 300 : 0);
    return () => clearTimeout(t);
  }, [filters, page, pageSize, type.id, token, toast]);

  function set(k, v) { setFilters(f => ({ ...f, [k]: v })); setPage(1); }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input type="search" placeholder="Search name or student no.…" value={filters.search}
          onChange={e => set('search', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 220 }} />
        <select value={filters.sex} onChange={e => set('sex', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Sex">
          <option value="">Male &amp; Female</option>
          {SEX_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {isAdmin && (
          <select value={filters.campusId} onChange={e => set('campusId', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Campus">
            <option value="">All Campuses</option>
            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={filters.yearLevel} onChange={e => set('yearLevel', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Year level">
          <option value="">All Years</option>
          {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
        </select>
        <select value={filters.active} onChange={e => set('active', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Account">
          <option value="">Any account</option>
          <option value="true">Active</option>
          <option value="false">Closed</option>
        </select>
        <span className="flex-1" />
        <ExportButtons dataset="grantees" filters={{ ...filters, grantTypeId: type.id }} compact />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid var(--hairline)' }}>
        {!data ? <TableSkeleton /> : data.items.length === 0 ? (
          <EmptyState title="No grantees" message="Nobody with a grantee account matches. Students listed under Cross-Matching appear here once they sign up." />
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
            <thead className="clay-table-head">
              <tr>
                {['Grantee', 'Sex', 'Campus', 'Program', 'Year', 'This grant', 'Account'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map(g => {
                const grant = g.grants?.find(x => x.grantTypeId === type.id);
                return (
                  <tr key={g.userId} className="clay-table-row cursor-pointer" onClick={() => navigate(`/grantees/${g.userId}`)}>
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{g.fullName}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{g.studentId}</p>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>{g.sex ?? '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>{g.campusName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>{g.programCode ?? '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>Year {g.yearLevel}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text)' }}>
                      {grant ? <>{peso(grant.amount)} · <span style={{ color: grant.releaseStatus === 'Released' ? 'var(--tone-ok-fg)' : 'var(--tone-warn-fg)' }}>
                        {grant.releaseStatus === 'Released' ? 'Received' : grant.releaseStatus}</span></> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {g.isActive ? <span className="status-badge tone-ok">Active</span> : <span className="status-badge tone-neutral">Closed</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
      {data && data.total > 0 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} label="grantees" />
      )}
    </div>
  );
}
