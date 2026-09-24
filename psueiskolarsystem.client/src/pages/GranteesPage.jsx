import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';
import { getGrantees } from '../api/grantees';
import { getCampuses } from '../api/campuses';
import { getPrograms } from '../api/lookups';
import { getGrantTypes } from '../api/grantTypes';
import { HandCoins } from 'lucide-react';

const peso = v => `₱${Number(v || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

/**
 * Grantee accounts — students who received a one-time grant without holding a scholarship.
 * Deactivated grantees stay listed: their account is closed, their record is not.
 */
export default function GranteesPage() {
  useTitle('Grantees');
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [paging, setPaging] = useState({ page: 1, totalPages: 1, total: 0 });
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', campusId: '', programId: '', grantTypeId: '', active: '' });
  const [campuses, setCampuses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [grantTypes, setGrantTypes] = useState([]);
  const seq = useRef(0);
  const searchTimer = useRef(null);

  async function load(f = filters, page = 1, size = pageSize) {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const data = await getGrantees(token, { ...f, page, pageSize: size });
      if (mine !== seq.current) return;
      setRows(data.items);
      setPaging({ page: data.page, totalPages: data.totalPages, total: data.total });
    } catch (e) {
      if (mine === seq.current) toast(e.message, 'error');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([getCampuses(token), getPrograms(token), getGrantTypes(token)])
      .then(([c, p, g]) => { setCampuses(c); setPrograms(p); setGrantTypes(g); })
      .catch(e => toast(e.message, 'error'));
    load();
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const campusPrograms = filters.campusId
    ? programs.filter(p => p.campusIds?.includes(Number(filters.campusId)))
    : programs;

  function setFilter(key, value) {
    const next = { ...filters, [key]: value };
    if (key === 'campusId') next.programId = '';
    setFilters(next);
    clearTimeout(searchTimer.current);
    if (key === 'search') searchTimer.current = setTimeout(() => load(next, 1), 350);
    else load(next, 1);
  }

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Grantees</h1>
            <p className="page-subtitle">{paging.total} grantee account{paging.total === 1 ? '' : 's'} · one-time grant recipients who are not scholars</p>
            <span className="page-title-bar" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <input type="search" placeholder="Search name, ID, email…" value={filters.search}
            onChange={e => setFilter('search', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 220 }} />
          <select value={filters.campusId} onChange={e => setFilter('campusId', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Campus">
            <option value="">All Campuses</option>
            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filters.programId} onChange={e => setFilter('programId', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Program">
            <option value="">All Programs</option>
            {campusPrograms.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
          <select value={filters.grantTypeId} onChange={e => setFilter('grantTypeId', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Grant type">
            <option value="">All Grants</option>
            {grantTypes.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={filters.active} onChange={e => setFilter('active', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Account status">
            <option value="">Active &amp; Deactivated</option>
            <option value="true">Active accounts</option>
            <option value="false">Deactivated accounts</option>
          </select>
        </div>

        <div className="clay-card overflow-hidden">
          {loading ? <TableSkeleton /> : rows.length === 0 ? (
            <EmptyState icon={HandCoins} title="No grantees found" message="Grantees appear here once they sign up from the Master List." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Grantee', 'Student No.', 'Campus', 'Program', 'Grants', 'Account', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(g => (
                  <tr key={g.userId} className="clay-table-row">
                    <td className="px-5 py-3">
                      <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{g.fullName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.email}</p>
                    </td>
                    <td className="px-5 py-3 font-mono" style={{ color: 'var(--text)' }}>{g.studentId}</td>
                    <td className="px-5 py-3 text-xs" style={{ color: 'var(--text)' }}>{g.campusName ?? '—'}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--text)' }}>{g.programCode ?? '—'}</td>
                    <td className="px-5 py-3">
                      {g.grants.length === 0 ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span> : g.grants.map(x => (
                        <div key={x.id} className="flex items-center gap-1.5 text-xs mb-0.5">
                          <span style={{ color: 'var(--text-strong)' }}>{x.title}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{peso(x.amount)}</span>
                          <StatusBadge status={x.releaseStatus} icon={false} />
                        </div>
                      ))}
                    </td>
                    <td className="px-5 py-3">
                      {g.isActive ? <span className="status-badge tone-ok">Active</span> : <span className="status-badge tone-neutral">Deactivated</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => navigate(`/grantees/${g.userId}`)} className="clay-btn clay-btn-ghost text-xs px-3"
                        style={{ minHeight: '32px', borderRadius: '10px', color: 'var(--accent)', fontWeight: 700 }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        {!loading && paging.total > 0 && (
          <Pagination page={paging.page} totalPages={paging.totalPages} total={paging.total} pageSize={pageSize}
            onPageChange={p => load(filters, p)} onPageSizeChange={n => { setPageSize(n); load(filters, 1, n); }} label="grantees" />
        )}
      </div>
    </Layout>
  );
}
