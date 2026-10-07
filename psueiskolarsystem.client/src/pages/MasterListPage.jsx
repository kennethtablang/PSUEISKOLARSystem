import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Pagination from '../components/Pagination';
import ExportButtons from '../components/ExportButtons';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';
import { SEX_OPTIONS } from '../constants/personal';
import { getMasterListPeople } from '../api/masterList';
import { getCampuses } from '../api/campuses';
import { getScholarshipTypes } from '../api/lookups';
import { getGrantTypes } from '../api/grantTypes';
import { ListChecks, CheckCircle2, Clock, GraduationCap, HandCoins, Info } from 'lucide-react';

const EMPTY_FILTERS = { search: '', kind: '', status: '', campusId: '', sex: '', scholarshipTypeId: '', grantTypeId: '' };

/**
 * Everyone the office has listed — scholars and grantees — one row per student. A scholar who
 * also received one-time grants appears once, with the scholarship and every grant together
 * in the Scholarship / Grant column.
 *
 * The cross-matching lists themselves are kept inside each scholarship type and grant type;
 * this page only reads them.
 */
export default function MasterListPage() {
  useTitle('Master List');
  const { token, user } = useAuth();
  const toast = useToast();
  // A coordinator works within one campus, so they have no campus to pick.
  const isAdmin = user?.role === 'Administrator';
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ page: 1, totalPages: 1, total: 0, withAccount: 0, withoutAccount: 0, scholars: 0, grantees: 0 });
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [campuses, setCampuses] = useState([]);
  const [types, setTypes] = useState([]);
  const [grantTypes, setGrantTypes] = useState([]);
  const seq = useRef(0);
  const searchTimer = useRef(null);

  async function load(f = filters, page = 1, size = pageSize) {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const data = await getMasterListPeople(token, { ...f, page, pageSize: size });
      if (mine !== seq.current) return;
      setRows(data.items);
      setStats(data);
    } catch (e) {
      if (mine === seq.current) toast(e.message, 'error');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([getCampuses(token), getScholarshipTypes(token), getGrantTypes(token)])
      .then(([c, t, g]) => { setCampuses(c); setTypes(t); setGrantTypes(g); })
      .catch(e => toast(e.message, 'error'));
    load();
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setFilter(key, value) {
    const next = { ...filters, [key]: value };
    // The scholarship and grant pickers narrow to one kind each.
    if (key === 'scholarshipTypeId' && value) next.grantTypeId = '';
    if (key === 'grantTypeId' && value) next.scholarshipTypeId = '';
    setFilters(next);
    clearTimeout(searchTimer.current);
    if (key === 'search') searchTimer.current = setTimeout(() => load(next, 1), 350);
    else load(next, 1);
  }

  function openPerson(p) {
    if (!p.userId) return;
    navigate(p.role === 'Grantee' ? `/grantees/${p.userId}` : `/scholars/${p.userId}`);
  }

  const filtered = Object.values(filters).some(Boolean);

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Master List</h1>
            <p className="page-subtitle">
              Every scholar and grantee on the office&apos;s lists, one row per student — each with all the
              scholarships and grants they are listed for.
            </p>
            <span className="page-title-bar" />
          </div>
          <ExportButtons dataset="masterlist" filters={filters} />
        </div>

        <div className="clay-card px-4 py-3 mb-5 flex items-start gap-2.5 text-xs" style={{ color: 'var(--text)' }}>
          <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
          <span>
            Who can sign up is set inside each type — open a{' '}
            <Link to="/scholarship-types" className="font-bold hover:underline" style={{ color: 'var(--accent)' }}>Scholarship Type</Link> or{' '}
            <Link to="/grant-types" className="font-bold hover:underline" style={{ color: 'var(--accent)' }}>Grant Type</Link> and use its
            Cross-Matching tab to add, import or review the students listed for it.
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Students listed', value: stats.total, Icon: ListChecks, tone: 'var(--accent-strong)' },
            { label: 'Scholars', value: stats.scholars, Icon: GraduationCap, tone: 'var(--accent)' },
            { label: 'Grantees', value: stats.grantees, Icon: HandCoins, tone: 'var(--tone-warn-fg)' },
            { label: 'Account created', value: stats.withAccount, Icon: CheckCircle2, tone: 'var(--tone-ok-fg)' },
            { label: 'Not yet signed up', value: stats.withoutAccount, Icon: Clock, tone: 'var(--text-muted)' },
          ].map(k => (
            <div key={k.label} className="clay-card p-4 flex items-center gap-3">
              <k.Icon size={20} style={{ color: k.tone }} />
              <div>
                <p className="text-xl font-black" style={{ color: 'var(--text-strong)' }}>{k.value}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <input type="search" placeholder="Search name or student no.…" value={filters.search}
            onChange={e => setFilter('search', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 230 }} />
          <select value={filters.kind} onChange={e => setFilter('kind', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Kind">
            <option value="">Scholars &amp; Grantees</option>
            <option value="Scholar">Scholars</option>
            <option value="Grantee">Grantees</option>
          </select>
          <select value={filters.sex} onChange={e => setFilter('sex', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Sex">
            <option value="">Male &amp; Female</option>
            {SEX_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Account">
            <option value="">Any account status</option>
            <option value="claimed">Account created</option>
            <option value="unclaimed">Not yet signed up</option>
          </select>
          {isAdmin && (
            <select value={filters.campusId} onChange={e => setFilter('campusId', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Campus">
              <option value="">All Campuses</option>
              {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select value={filters.scholarshipTypeId} onChange={e => setFilter('scholarshipTypeId', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Scholarship">
            <option value="">Any scholarship</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={filters.grantTypeId} onChange={e => setFilter('grantTypeId', e.target.value)} className="clay-input" style={{ ...ctlStyle, width: 'auto' }} aria-label="Grant">
            <option value="">Any grant</option>
            {grantTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {filtered && (
            <button onClick={() => { setFilters(EMPTY_FILTERS); load(EMPTY_FILTERS, 1); }} className="text-xs font-semibold hover:underline" style={{ color: 'var(--text-muted)' }}>
              Clear filters
            </button>
          )}
        </div>

        <div className="clay-card overflow-hidden">
          {loading ? <TableSkeleton /> : rows.length === 0 ? (
            <EmptyState icon={ListChecks} title={filtered ? 'Nobody matches' : 'Nobody listed yet'}
              message={filtered ? 'Clear a filter to see more students.' : 'Students are listed from inside each Scholarship Type and Grant Type.'} />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Student No.', 'Name', 'Sex', 'Kind', 'Scholarship / Grant', 'Campus', 'Account'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(p => {
                  const kinds = [...new Set(p.entries.map(e => e.kind))];
                  return (
                    <tr key={p.studentId} className="clay-table-row" style={{ cursor: p.userId ? 'pointer' : 'default' }}
                      onClick={() => openPerson(p)}>
                      <td className="px-5 py-3 font-mono" style={{ color: 'var(--text)' }}>{p.studentId}</td>
                      <td className="px-5 py-3 font-semibold" style={{ color: 'var(--text-strong)' }}>
                        {p.lastName}, {p.firstName}{p.middleName ? ` ${p.middleName}` : ''}
                        {p.email && <span className="block text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>{p.email}</span>}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text)' }}>{p.sex ?? '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {kinds.map(k => <span key={k} className={`status-badge tone-${k === 'Scholar' ? 'info' : 'warn'}`}>{k}</span>)}
                        </div>
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text)' }}>
                        <ul className="space-y-0.5">
                          {p.entries.map(e => (
                            <li key={e.lineId} className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: e.kind === 'Scholar' ? 'var(--accent)' : 'var(--tone-warn-fg)' }} />
                              <span>{e.name}</span>
                              {e.amount != null && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· ₱{Number(e.amount).toLocaleString('en-PH')}</span>}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text)' }}>{p.campusName ?? 'Any campus'}</td>
                      <td className="px-5 py-3">
                        {p.hasAccount
                          ? p.accountActive === false
                            ? <span className="status-badge tone-neutral">Account closed</span>
                            : <span className="status-badge tone-ok">Account created</span>
                          : <span className="status-badge tone-neutral">Not yet signed up</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>

        {!loading && stats.total > 0 && (
          <Pagination page={stats.page} totalPages={stats.totalPages} total={stats.total} pageSize={pageSize}
            onPageChange={p => load(filters, p)} onPageSizeChange={n => { setPageSize(n); load(filters, 1, n); }} label="students" />
        )}
      </div>
    </Layout>
  );
}
