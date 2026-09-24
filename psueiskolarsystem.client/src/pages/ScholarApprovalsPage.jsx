import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { getScholarApprovals } from '../api/scholarApprovals';
import { deleteUser } from '../api/users';
import Pagination from '../components/Pagination';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { useTitle } from '../hooks/useTitle';
import { ctlStyle } from '../constants/ui';
import { ShieldCheck, AlertTriangle, MailCheck, MailWarning, Trash2 } from 'lucide-react';

/* Registrations are no longer approved by hand: sign-up is cross-matched against the Master
   List, so an account only exists if the student was on it. This page is what remains of the
   old approval queue — a log of who signed up, with the profile one click away and the
   option to delete an account that should not be there. */
export default function ScholarApprovalsPage() {
  useTitle('Scholar Registrations');
  const { token, user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'Administrator';

  const [items, setItems] = useState([]);
  const [paging, setPaging] = useState({ page: 1, totalPages: 1, total: 0 });
  const [pageSize, setPageSize] = useState(20);
  const status = '';
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await getScholarApprovals(token, {
        status: status || undefined,
        search: debouncedSearch || undefined,
        page,
        pageSize,
      });
      setItems(data.items);
      setPaging({ page: data.page, totalPages: data.totalPages, total: data.total });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, status, debouncedSearch, pageSize]);

  useEffect(() => { load(1); }, [load]);

  async function handleDelete(scholar) {
    const ok = await confirm({
      title: 'Delete this account?',
      message: `This permanently deletes ${scholar.fullName}'s account, profile, documents and grades. ` +
        'Their Master List line becomes available again, so they could sign up anew.',
      confirmLabel: 'Delete account',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteUser(scholar.id, token);
      toast(`${scholar.fullName}'s account was deleted.`, 'success');
      const stepBack = items.length === 1 && paging.page > 1;
      load(stepBack ? paging.page - 1 : paging.page);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Scholar Registrations</h1>
            <p className="page-subtitle">
              Scholars who signed up. Accounts are accepted automatically when the student matches the
              Master List, so there is nothing to approve — open a profile to review it, or delete an account.
            </p>
            <span className="page-title-bar" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <input
            type="search"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="clay-input"
            style={{ ...ctlStyle, width: 220 }}
          />
          <button onClick={() => navigate('/master-list')} className="text-xs font-bold hover:underline" style={{ color: 'var(--accent)' }}>
            Manage the Master List →
          </button>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="clay-card overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : items.length === 0 ? (
            <EmptyState title="No registrations yet" message="Scholars appear here once they sign up." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Scholar', 'Student ID', 'Program', 'Scholarship', 'Registered', 'Checks', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(s => (
                  <tr key={s.id} className="clay-table-row">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{s.fullName}</p>
                      <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        {s.emailConfirmed
                          ? <MailCheck size={11} strokeWidth={2.4} style={{ color: '#166534' }} />
                          : <MailWarning size={11} strokeWidth={2.4} style={{ color: '#b45309' }} />}
                        {s.email}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-mono" style={{ color: 'var(--text)' }}>{s.studentId ?? '—'}</td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--text)' }}>{s.programCode ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      {s.scholarshipTypeName ? (
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-strong)' }}>{s.scholarshipTypeName}</p>
                          {s.scholarshipTypeCategory && (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.scholarshipTypeCategory}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs italic" style={{ color: '#b45309' }}>Not selected</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text)' }}>
                      {new Date(s.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5" style={{ maxWidth: 240 }}>
                      {s.warnings.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#166534' }}>
                          <ShieldCheck size={12} strokeWidth={2.4} /> All checks passed
                        </span>
                      ) : (
                        <ul className="space-y-0.5">
                          {s.warnings.map(w => (
                            <li key={w} className="flex items-start gap-1 text-xs" style={{ color: '#b45309' }}>
                              <AlertTriangle size={11} strokeWidth={2.4} className="mt-0.5 shrink-0" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => navigate(`/scholars/${s.id}`)}
                          className="text-xs font-medium hover:underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          View profile
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(s)}
                            className="text-xs font-bold hover:underline flex items-center gap-1"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={12} strokeWidth={2.6} /> Delete
                          </button>
                        )}
                      </div>
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
            onPageChange={load}
            onPageSizeChange={setPageSize}
            label="registrations"
          />
        )}
      </div>

    </Layout>
  );
}
