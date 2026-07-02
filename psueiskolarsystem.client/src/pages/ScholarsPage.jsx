import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getScholars } from '../api/scholars';
import { getCampuses } from '../api/campuses';
import { getPrograms, getScholarshipTypes } from '../api/lookups';
import { useTitle } from '../hooks/useTitle';

const GWA_BADGE = (meets) => {
  if (meets === null || meets === undefined) return 'bg-[#e8edf5] text-[#7a8aaa]';
  return meets ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
};

export default function ScholarsPage() {
  useTitle('Scholars');
  const { token } = useAuth();
  const navigate = useNavigate();

  const [scholars, setScholars] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [scholarshipTypes, setScholarshipTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paging, setPaging] = useState({ page: 1, totalPages: 1, total: 0 });

  const PAGE_SIZE = 20;

  const [filters, setFilters] = useState({
    search: '',
    campusId: '',
    programId: '',
    scholarshipTypeId: '',
    meetsRequirement: '',
  });

  async function loadScholars(f = filters, page = 1) {
    setLoading(true);
    setError('');
    try {
      const data = await getScholars(token, {
        search: f.search || undefined,
        campusId: f.campusId || undefined,
        programId: f.programId || undefined,
        scholarshipTypeId: f.scholarshipTypeId || undefined,
        meetsRequirement: f.meetsRequirement !== '' ? f.meetsRequirement : undefined,
        page,
        pageSize: PAGE_SIZE,
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
    Promise.all([getCampuses(token), getPrograms(token), getScholarshipTypes(token)])
      .then(([c, p, st]) => { setCampuses(c); setPrograms(p); setScholarshipTypes(st); });
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

  const subtitle = (() => {
    const count = `${paging.total} scholar${paging.total !== 1 ? 's' : ''}`;
    const campus = campuses.find(c => String(c.id) === String(filters.campusId));
    return campus ? `${count} · ${campus.name}` : `${count} · All Campuses`;
  })();

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Scholars</h1>
            <p className="page-subtitle">{subtitle}</p>
            <span className="page-title-bar" />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <input
            type="search"
            placeholder="Search name, student ID, email…"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className={`${inputCls} w-60`}
          />
          <select value={filters.campusId} onChange={e => setFilter('campusId', e.target.value)} className={inputCls}>
            <option value="">All Campuses</option>
            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filters.programId} onChange={e => setFilter('programId', e.target.value)} className={inputCls}>
            <option value="">All Programs</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
          <select value={filters.scholarshipTypeId} onChange={e => setFilter('scholarshipTypeId', e.target.value)} className={inputCls}>
            <option value="">All Scholarships</option>
            {scholarshipTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
          <select value={filters.meetsRequirement} onChange={e => setFilter('meetsRequirement', e.target.value)} className={inputCls}>
            <option value="">All Compliance</option>
            <option value="true">GWA Compliant</option>
            <option value="false">Below Threshold</option>
          </select>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: '#e03030' }}>{error}</p>}

        <div className="clay-card overflow-hidden">
          {loading ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
          ) : scholars.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>No scholars found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Scholar', 'Student ID', 'Campus', 'Program', 'Scholarship', 'GWA', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scholars.map(s => (
                  <tr key={s.id} className="clay-table-row">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold" style={{ color: '#0d1a33' }}>{s.fullName}</p>
                      <p className="text-xs" style={{ color: '#7a8aaa' }}>{s.email}</p>
                    </td>
                    <td className="px-5 py-3.5 font-mono" style={{ color: '#2a3a5a' }}>{s.studentId}</td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: '#4a5a7a' }}>{s.campusName ?? '—'}</td>
                    <td className="px-5 py-3.5" style={{ color: '#4a5a7a' }}>{s.programCode ?? '—'}</td>
                    <td className="px-5 py-3.5 max-w-[140px] truncate" style={{ color: '#4a5a7a' }}>{s.scholarshipTypeName ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      {s.latestGwa != null ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${GWA_BADGE(s.meetsRequirement)}`}>
                          {s.latestGwa.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#7a8aaa' }}>—</span>
                      )}
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
            </table>
          )}
        </div>

        {!loading && paging.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs" style={{ color: '#7a8aaa' }}>
              Page {paging.page} of {paging.totalPages} · {paging.total} scholars
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => goToPage(paging.page - 1)}
                disabled={paging.page <= 1}
                className="clay-btn clay-btn-ghost text-xs px-4"
                style={{ minHeight: '34px', borderRadius: '10px', fontWeight: 700, opacity: paging.page <= 1 ? 0.4 : 1 }}
              >
                Previous
              </button>
              <button
                onClick={() => goToPage(paging.page + 1)}
                disabled={paging.page >= paging.totalPages}
                className="clay-btn clay-btn-ghost text-xs px-4"
                style={{ minHeight: '34px', borderRadius: '10px', fontWeight: 700, opacity: paging.page >= paging.totalPages ? 0.4 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

const inputCls = 'clay-input';
