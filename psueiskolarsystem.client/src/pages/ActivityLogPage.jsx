import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getAuditLog, getDistinctActions, exportAuditLog } from '../api/auditLog';
import { useTitle } from '../hooks/useTitle';
import { Activity, ChevronLeft, ChevronRight, RefreshCw, Download } from 'lucide-react';

const ACTION_COLORS = {
  Login:          { bg: '#dce8ff', color: '#003087' },
  CreateUser:     { bg: '#d4f5e2', color: '#0a5a3a' },
  UpdateUser:     { bg: '#fff3cd', color: '#7d5a00' },
  DeleteUser:     { bg: '#ffe8d6', color: '#c05000' },
  ActivateUser:   { bg: '#d4f5e2', color: '#0a5a3a' },
  DeactivateUser: { bg: '#ffe8d6', color: '#c05000' },
};

function ActionBadge({ action }) {
  const style = ACTION_COLORS[action] ?? { bg: 'var(--bg)', color: 'var(--text)' };
  return (
    <span className="clay-badge text-xs"
      style={{ background: style.bg, color: style.color, border: '1px solid rgba(0,0,0,0.06)' }}>
      {action}
    </span>
  );
}

function formatTs(ts) {
  return new Date(ts).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

const PAGE_SIZE = 50;

export default function ActivityLogPage() {
  useTitle('Activity Log');
  const { token } = useAuth();

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actions, setActions]   = useState([]);

  useEffect(() => {
    getDistinctActions(token).then(setActions).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getAuditLog(token, {
        page,
        pageSize: PAGE_SIZE,
        search:   search  || undefined,
        action:   actionFilter || undefined,
      });
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, actionFilter]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function handleActionChange(e) {
    setActionFilter(e.target.value);
    setPage(1);
  }

  const [exporting, setExporting] = useState(false);
  async function handleExport() {
    setExporting(true);
    try {
      await exportAuditLog(token, { search: search || undefined, action: actionFilter || undefined });
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <Layout>
      <div className="page-shell">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="page-title">Activity Log</h1>
            <p className="page-subtitle">
              {data ? `${data.total.toLocaleString()} event${data.total !== 1 ? 's' : ''}` : 'System audit trail'}
            </p>
            <span className="page-title-bar" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              title="Export to Excel"
              className="clay-btn clay-btn-ghost px-3 py-2.5 flex items-center gap-2 text-sm"
              style={{ opacity: exporting ? 0.65 : 1 }}
            >
              <Download size={14} strokeWidth={2.2} />
              {exporting ? 'Exporting…' : 'Export'}
            </button>
            <button
              onClick={() => load()}
              title="Refresh"
              className="clay-btn clay-btn-ghost px-3 py-2.5 flex items-center gap-2 text-sm"
            >
              <RefreshCw size={14} strokeWidth={2.2} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1" style={{ minWidth: 240, maxWidth: 400 }}>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="clay-input flex-1"
              placeholder="Search by name or email…"
            />
            <button type="submit" className="clay-btn clay-btn-primary px-4 py-2 text-sm">
              Search
            </button>
          </form>

          <select
            value={actionFilter}
            onChange={handleActionChange}
            className="clay-input"
            style={{ width: 'auto', minWidth: 180 }}
          >
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {(search || actionFilter) && (
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setActionFilter(''); setPage(1); }}
              className="clay-btn clay-btn-ghost px-4 py-2 text-sm"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="clay-card overflow-hidden">
          {loading ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
          ) : error ? (
            <p className="text-center py-12 text-sm" style={{ color: '#e03030' }}>{error}</p>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Activity size={32} strokeWidth={1.5} style={{ color: '#c0cce0' }} />
              <p className="text-sm" style={{ color: '#7a8aaa' }}>No events found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Timestamp', 'User', 'Action', 'Details'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider"
                      style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map(log => (
                  <tr key={log.id} className="clay-table-row">
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs" style={{ color: '#7a8aaa' }}>
                      {formatTs(log.timestampUtc)}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-strong)' }}>{log.userName}</p>
                      {log.userEmail && (
                        <p className="text-xs mt-0.5" style={{ color: '#7a8aaa' }}>{log.userEmail}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: 'var(--text)' }}>
                      {log.details ?? <span style={{ color: '#b0bdd0', fontStyle: 'italic' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        {/* Pagination */}
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-5">
            <p className="text-xs" style={{ color: '#7a8aaa' }}>
              Page {page} of {totalPages} · {data.total.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="clay-btn clay-btn-ghost px-3 py-2 text-sm flex items-center gap-1"
                style={{ opacity: page === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft size={13} strokeWidth={2.5} /> Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="clay-btn clay-btn-ghost px-3 py-2 text-sm flex items-center gap-1"
                style={{ opacity: page >= totalPages ? 0.4 : 1 }}
              >
                Next <ChevronRight size={13} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
