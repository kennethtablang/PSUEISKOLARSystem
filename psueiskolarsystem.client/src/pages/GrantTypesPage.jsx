import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Field from '../components/Field';
import { TableSkeleton, EmptyState } from '../components/ListState';
import { NumericInput } from '../components/PersonalDetailsFields';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { useTitle } from '../hooks/useTitle';
import {
  getGrantTypes, createGrantType, updateGrantType, deactivateGrantType, activateGrantType, deleteGrantType,
} from '../api/grantTypes';
import { Gift, Plus, Pencil, Power, RotateCcw, Trash2 } from 'lucide-react';

const peso = v => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const EMPTY = { name: '', description: '', sponsor: '', defaultAmount: '', scheduledDate: '' };

// Release dates are calendar days (no time zone), sent and received as yyyy-mm-dd.
const fmtDay = d => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : null);
const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

/**
 * Kinds of one-time grant, managed the way scholarship types are. Deactivating a type once it
 * has been released closes the grantee accounts under it; their data stays for the analytics.
 */
export default function GrantTypesPage() {
  useTitle('Grant Types');
  const { token, user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'Administrator';

  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try {
      setTypes(await getGrantTypes(token));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    setFormError('');
    const body = {
      name: editing.name.trim(),
      description: editing.description.trim() || null,
      sponsor: editing.sponsor.trim() || null,
      defaultAmount: editing.defaultAmount !== '' ? Number(editing.defaultAmount) : null,
      scheduledDate: editing.scheduledDate || null,
    };
    setSaving(true);
    try {
      if (editing.id) await updateGrantType(editing.id, body, token);
      else await createGrantType(body, token);
      toast(editing.id ? 'Grant type updated.' : 'Grant type added.', 'success');
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(t) {
    const ok = await confirm({
      title: `Deactivate ${t.name}?`,
      message:
        `This closes the grant and deactivates the ${t.granteeAccounts} grantee account${t.granteeAccounts === 1 ? '' : 's'} under it, ` +
        'so they can no longer sign in. Their profiles and grant records stay for reports and data visualization. ' +
        'Scholars who also received this grant keep their accounts.' +
        (t.pendingCount > 0 ? ` Note: ${t.pendingCount} grant${t.pendingCount === 1 ? ' is' : 's are'} still pending release.` : ''),
      confirmLabel: 'Deactivate',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await deactivateGrantType(t.id, token);
      toast(`${t.name} deactivated · ${res.deactivatedAccounts} account(s) closed` +
        (res.keptOpen ? ` · ${res.keptOpen} kept open (still owed another grant)` : ''), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function reactivate(t) {
    try {
      await activateGrantType(t.id, token);
      toast(`${t.name} reactivated.`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function remove(t) {
    const ok = await confirm({ title: `Delete ${t.name}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteGrantType(t.id, token);
      toast('Grant type deleted.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Grant Types</h1>
            <p className="page-subtitle">
              One-time grants the office gives out. Set a release date and every pending grant of that type is marked
              released automatically on that day. Deactivate a type after its release to close the grantee accounts under it.
            </p>
            <span className="page-title-bar" />
          </div>
          {isAdmin && (
            <button onClick={() => { setFormError(''); setEditing({ ...EMPTY }); }}
              className="clay-btn clay-btn-primary text-sm px-4 flex items-center gap-2">
              <Plus size={15} /> Add Grant Type
            </button>
          )}
        </div>

        <div className="clay-card overflow-hidden">
          {loading ? <TableSkeleton /> : types.length === 0 ? (
            <EmptyState icon={Gift} title="No grant types yet" message="Add a grant type, then put its grantees on the Master List." />
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Grant Type', 'Default Amount', 'Release Date', 'Grantee Accounts', 'Released', 'Pending', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {types.map(t => (
                  <tr key={t.id} className="clay-table-row" style={{ opacity: t.isActive ? 1 : 0.7 }}>
                    <td className="px-5 py-3">
                      <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{t.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {[t.sponsor, t.description].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text)' }}>{t.defaultAmount != null ? peso(t.defaultAmount) : 'Varies'}</td>
                    <td className="px-5 py-3 whitespace-nowrap" style={{ color: 'var(--text)' }}>
                      {t.scheduledDate ? (
                        <>
                          {fmtDay(t.scheduledDate)}
                          <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                            {String(t.scheduledDate).slice(0, 10) <= todayIso() ? 'Released on schedule' : 'Scheduled'}
                          </span>
                        </>
                      ) : <span style={{ color: 'var(--text-muted)' }}>Not set</span>}
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text)' }}>
                      {t.granteeAccounts}
                      <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>· {t.masterListLines} on list</span>
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--text)' }}>
                      {t.releasedCount} <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({peso(t.releasedAmount)})</span>
                    </td>
                    <td className="px-5 py-3" style={{ color: t.pendingCount ? 'var(--tone-warn-fg)' : 'var(--text)' }}>{t.pendingCount}</td>
                    <td className="px-5 py-3">
                      {t.isActive
                        ? <span className="status-badge tone-ok">Active</span>
                        : <span className="status-badge tone-neutral" title={t.deactivatedAt ? `Since ${new Date(t.deactivatedAt).toLocaleDateString()}` : ''}>Deactivated</span>}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {isAdmin && (
                        <>
                          <button className="p-2 rounded-lg" title="Edit" aria-label={`Edit ${t.name}`}
                            onClick={() => { setFormError(''); setEditing({ id: t.id, name: t.name, description: t.description ?? '', sponsor: t.sponsor ?? '', defaultAmount: t.defaultAmount ?? '', scheduledDate: t.scheduledDate ? String(t.scheduledDate).slice(0, 10) : '' }); }}>
                            <Pencil size={14} style={{ color: 'var(--accent)' }} />
                          </button>
                          {t.isActive ? (
                            <button className="p-2 rounded-lg" title="Deactivate after release" aria-label={`Deactivate ${t.name}`} onClick={() => deactivate(t)}>
                              <Power size={14} style={{ color: 'var(--tone-warn-fg)' }} />
                            </button>
                          ) : (
                            <button className="p-2 rounded-lg" title="Reactivate" aria-label={`Reactivate ${t.name}`} onClick={() => reactivate(t)}>
                              <RotateCcw size={14} style={{ color: 'var(--tone-ok-fg)' }} />
                            </button>
                          )}
                          {t.grantCount === 0 && t.masterListLines === 0 && (
                            <button className="p-2 rounded-lg" title="Delete" aria-label={`Delete ${t.name}`} onClick={() => remove(t)}>
                              <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit Grant Type' : 'Add Grant Type'} onClose={() => setEditing(null)} dismissible={!saving}>
          <form onSubmit={save} className="space-y-4">
            {formError && <p role="alert" className="text-sm p-3 rounded-2xl" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{formError}</p>}
            <Field label="Name">
              <input required maxLength={150} value={editing.name} onChange={e => setEditing(v => ({ ...v, name: e.target.value }))}
                className="clay-input" placeholder="e.g. Tulong Dunong Program" />
            </Field>
            <Field label="Sponsor / Source">
              <input maxLength={150} value={editing.sponsor} onChange={e => setEditing(v => ({ ...v, sponsor: e.target.value }))}
                className="clay-input" placeholder="e.g. CHED" />
            </Field>
            <Field label="Default Amount" hint="Pre-filled for each grantee. Leave blank if it varies.">
              <NumericInput prefix="₱" allowDecimal maxLength={10} value={String(editing.defaultAmount ?? '')}
                onChange={x => setEditing(v => ({ ...v, defaultAmount: x }))} />
            </Field>
            <Field label="Release Date"
              hint={editing.scheduledDate && editing.scheduledDate <= todayIso()
                ? 'This date has arrived — every pending grant of this type will be marked released within a few minutes of saving.'
                : 'The day grantees receive this grant. On that day every pending grant of this type is marked released automatically and shows as received on each grantee’s and scholar’s profile. Leave blank to release grants by hand.'}>
              <input type="date" value={editing.scheduledDate} min="2000-01-01"
                onChange={e => setEditing(v => ({ ...v, scheduledDate: e.target.value }))} className="clay-input" />
            </Field>
            <Field label="Description">
              <textarea rows={2} maxLength={500} value={editing.description} onChange={e => setEditing(v => ({ ...v, description: e.target.value }))} className="clay-input" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} disabled={saving} className="clay-btn clay-btn-ghost text-sm px-4">Cancel</button>
              <button type="submit" disabled={saving} className="clay-btn clay-btn-primary text-sm px-5">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
