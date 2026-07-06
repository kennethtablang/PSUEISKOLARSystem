import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getScholars } from '../api/scholars';
import { getPrograms, getScholarshipTypes } from '../api/lookups';
import Pagination from '../components/Pagination';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';

const GWA_BADGE = (meets) => {
  if (meets === null || meets === undefined) return 'bg-[#e8edf5] text-[#7a8aaa]';
  return meets ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
};

const LIFECYCLE_STYLE = {
  Active:    { bg: '#d4f4e2', color: '#166534' },
  Renewed:   { bg: '#dbeafe', color: '#1e40af' },
  Lapsed:    { bg: '#fee2e2', color: '#991b1b' },
  Suspended: { bg: '#ffedd5', color: '#9a3412' },
  Graduated: { bg: '#e5e7eb', color: '#374151' },
};
const LIFECYCLE_OPTIONS = ['Active', 'Renewed', 'Lapsed', 'Suspended', 'Graduated'];

export default function ScholarsPage() {
  useTitle('Scholars');
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') ?? '';
  const initialSearch = searchParams.get('search') ?? '';
  const [pageSize, setPageSize] = useState(20);

  const [scholars, setScholars] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [scholarshipTypes, setScholarshipTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paging, setPaging] = useState({ page: 1, totalPages: 1, total: 0 });

  const [filters, setFilters] = useState({
    search: initialSearch,
    programId: '',
    scholarshipTypeId: '',
    meetsRequirement: '',
    lifecycleStatus: initialStatus,
  });

  async function loadScholars(f = filters, page = 1, size = pageSize) {
    setLoading(true);
    setError('');
    try {
      const data = await getScholars(token, {
        search: f.search || undefined,
        programId: f.programId || undefined,
        scholarshipTypeId: f.scholarshipTypeId || undefined,
        meetsRequirement: f.meetsRequirement !== '' ? f.meetsRequirement : undefined,
        lifecycleStatus: f.lifecycleStatus || undefined,
        page,
        pageSize: size,
      });
      setScholars(data.items);
      setPaging({ page: data.page, totalPages: data.totalPages, total: data.total });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([getPrograms(token), getScholarshipTypes(token)])
      .then(([p, st]) => { setPrograms(p); setScholarshipTypes(st); });
    loadScholars();
  }, []);

  function setFilter(key, value) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    loadScholars(next, 1);
  }

  function goToPage(page) {
    if (page < 1 || page > paging.totalPages || page === paging.page) return;
    loadScholars(filters, page);
  }

  function changePageSize(n) {
    setPageSize(n);
    loadScholars(filters, 1, n);
  }

  const subtitle = `${paging.total} scholar${paging.total !== 1 ? 's' : ''} · PSU Lingayen Campus`;

  return (
    <Layout>
      <div className="p-4 sm:p-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <div>
            <h1 className="page-title">Scholars</h1>
            <p className="page-subtitle">{subtitle}</p>
            <span className="page-title-bar" />
          </div>
        </div>

        {/* Filters — compact */}
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <input
            type="search"
            placeholder="Search name, ID, email…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className={inputCls}
            style={{ ...ctlStyle, width: 220 }}
          />
          <select value={filters.programId} onChange={e => setFilter('programId', e.target.value)} className={inputCls} style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All Programs</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
          <select value={filters.scholarshipTypeId} onChange={e => setFilter('scholarshipTypeId', e.target.value)} className={inputCls} style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All Scholarships</option>
            {scholarshipTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
          <select value={filters.meetsRequirement} onChange={e => setFilter('meetsRequirement', e.target.value)} className={inputCls} style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All Compliance</option>
            <option value="true">GWA Compliant</option>
            <option value="false">Below Threshold</option>
          </select>
          <select value={filters.lifecycleStatus} onChange={e => setFilter('lifecycleStatus', e.target.value)} className={inputCls} style={{ ...ctlStyle, width: 'auto' }}>
            <option value="">All Statuses</option>
            {LIFECYCLE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: '#e03030' }}>{error}</p>}

        <div className="clay-card overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : scholars.length === 0 ? (
            <EmptyState title="No scholars found" message="Try adjusting your filters." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Scholar', 'Student ID', 'Program', 'Scholarship', 'GWA', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scholars.map(s => (
                  <tr key={s.id} className="clay-table-row">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{s.fullName}</p>
                      <p className="text-xs" style={{ color: '#7a8aaa' }}>{s.email}</p>
                    </td>
                    <td className="px-5 py-3.5 font-mono" style={{ color: 'var(--text)' }}>{s.studentId}</td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{s.programCode ?? '—'}</td>
                    <td className="px-5 py-3.5 max-w-[140px] truncate" style={{ color: 'var(--text)' }}>{s.scholarshipTypeName ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      {s.latestGwa != null ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${GWA_BADGE(s.meetsRequirement)}`}>
                          {s.latestGwa.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#7a8aaa' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {(() => {
                        const st = LIFECYCLE_STYLE[s.lifecycleStatus] ?? LIFECYCLE_STYLE.Active;
                        return (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: st.bg, color: st.color }}>
                            {s.lifecycleStatus ?? 'Active'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => navigate(`/scholars/${s.userId}`)}
                        className="clay-btn clay-btn-ghost text-xs px-3"
                        style={{ minHeight: '32px', borderRadius: '10px', color: '#003087', fontWeight: 700 }}
                      >
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
          <Pagination
            page={paging.page}
            totalPages={paging.totalPages}
            total={paging.total}
            pageSize={pageSize}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
            label="scholars"
          />
        )}
      </div>
    </Layout>
  );
}

const inputCls = 'clay-input';
