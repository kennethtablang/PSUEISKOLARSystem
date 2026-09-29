import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Field from '../components/Field';
import StatusBadge from '../components/StatusBadge';
import { TableSkeleton } from '../components/ListState';
import {
  PersonalDetailsView, ContactInput, BirthDateAge, PersonalQuestions, FamilyQuestions, SectionTitle,
} from '../components/PersonalDetailsFields';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { useTitle } from '../hooks/useTitle';
import { getGrantee, updateGrantee } from '../api/grantees';
import { getCampuses } from '../api/campuses';
import { getPrograms } from '../api/lookups';
import { deleteUser, setUserStatus } from '../api/users';
import { personalFromApi, personalToApi, localMobile } from '../constants/personal';
import { ArrowLeft, HandCoins, Pencil, Trash2, Power, CalendarClock } from 'lucide-react';

const peso = v => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

/**
 * A grantee's profile. Grantees see their own (and may change only contact number and
 * address); staff open any grantee from the Grantees page and may edit everything.
 */
export default function GranteeProfilePage() {
  const { userId: routeId } = useParams();
  const { user, token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const isStaff = user?.role === 'Administrator' || user?.role === 'ScholarshipCoordinator';
  const userId = routeId || user?.id;
  useTitle(isStaff ? 'Grantee Profile' : 'My Grants');

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [programs, setPrograms] = useState([]);

  async function load() {
    try {
      setData(await getGrantee(userId, token));
    } catch (e) {
      setError(e.message);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (userId) load(); }, [userId]);

  useEffect(() => {
    if (!isStaff) return;
    Promise.all([getCampuses(token), getPrograms(token)])
      .then(([c, p]) => { setCampuses(c); setPrograms(p); })
      .catch(() => {});
  }, [isStaff, token]);

  function openEdit() {
    setFormError('');
    setEditing({
      contactLocal: localMobile(data.contactNumber),
      address: data.address ?? '',
      campusId: data.campusId ?? '',
      programId: data.programId ?? '',
      yearLevel: String(data.yearLevel ?? 1),
      birthDate: data.birthDate ? String(data.birthDate).slice(0, 10) : '',
      personal: personalFromApi(data.personal),
    });
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    if (editing.contactLocal && !/^9\d{9}$/.test(editing.contactLocal)) {
      setFormError('Enter a valid mobile number: +63 followed by 10 digits starting with 9.');
      return;
    }
    setSaving(true);
    try {
      await updateGrantee(userId, {
        contactNumber: editing.contactLocal ? `+63${editing.contactLocal}` : null,
        address: editing.address.trim() || null,
        ...(isStaff ? {
          campusId: editing.campusId ? Number(editing.campusId) : null,
          programId: editing.programId ? Number(editing.programId) : null,
          yearLevel: Number(editing.yearLevel),
          birthDate: editing.birthDate || null,
          personal: personalToApi(editing.personal),
        } : {}),
      }, token);
      toast('Profile saved.', 'success');
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const next = !data.isActive;
    if (!next && !(await confirm({ title: 'Deactivate account?', message: `${data.fullName} will no longer be able to sign in. Their records are kept.`, confirmLabel: 'Deactivate', danger: true }))) return;
    try {
      await setUserStatus(userId, next, token);
      toast(next ? 'Account reactivated.' : 'Account deactivated.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function remove() {
    if (!(await confirm({
      title: 'Delete grantee account?',
      message: `This permanently deletes ${data.fullName}'s account, profile and grant records. To keep the data for reports, deactivate the account instead.`,
      confirmLabel: 'Delete', danger: true,
    }))) return;
    try {
      await deleteUser(userId, token);
      toast('Grantee deleted.', 'success');
      navigate('/grantees');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const campusPrograms = editing?.campusId
    ? programs.filter(p => p.campusIds?.includes(Number(editing.campusId)))
    : programs;

  return (
    <Layout>
      <div className="page-shell">
        {isStaff && (
          <button onClick={() => navigate('/grantees')} className="text-sm font-semibold mb-4 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
            <ArrowLeft size={14} /> Back
          </button>
        )}

        {error && <p className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{error}</p>}
        {!data && !error && <div className="clay-card"><TableSkeleton rows={4} /></div>}

        {data && (
          <>
            <div className="page-head">
              <div>
                <h1 className="page-title">{data.fullName}</h1>
                <p className="page-subtitle">{data.email} · Grantee{!data.isActive && ' · account deactivated'}</p>
                <span className="page-title-bar" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={openEdit} className="clay-btn clay-btn-ghost text-sm px-4 flex items-center gap-2">
                  <Pencil size={14} /> {isStaff ? 'Edit Profile' : 'Edit Contact Info'}
                </button>
                {user?.role === 'Administrator' && (
                  <>
                    <button onClick={toggleActive} className="clay-btn clay-btn-ghost text-sm px-4 flex items-center gap-2">
                      <Power size={14} /> {data.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button onClick={remove} className="clay-btn clay-btn-ghost text-sm px-4 flex items-center gap-2" style={{ color: 'var(--danger)' }}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_380px] gap-5">
              <div className="space-y-5">
                <div className="clay-card p-5">
                  <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Grantee Information</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    {[
                      ['Student No.', data.studentId],
                      ['Campus', data.campusName],
                      ['Course', data.programName ? `${data.programName} (${data.programCode})` : null],
                      ['Year Level', data.yearLevel ? `Year ${data.yearLevel}` : null],
                      ['Contact Number', data.contactNumber],
                      ['Birthdate', data.birthDate ? String(data.birthDate).slice(0, 10) : null],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{k}</p>
                        <p className="font-semibold mt-0.5" style={{ color: 'var(--text-strong)' }}>{v || '—'}</p>
                      </div>
                    ))}
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Address</p>
                      <p className="font-semibold mt-0.5" style={{ color: 'var(--text-strong)' }}>{data.address || '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="clay-card p-5">
                  <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>Personal &amp; Family Information</p>
                  <PersonalDetailsView personal={data.personal} birthDate={data.birthDate} />
                </div>
              </div>

              <div className="clay-card p-5 h-fit">
                <p className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <HandCoins size={14} /> Grants
                </p>
                {data.grants.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No grants recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 pb-1">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Received</p>
                        <p className="text-sm font-black" style={{ color: 'var(--tone-ok-fg)' }}>
                          {peso(data.grants.filter(g => g.releaseStatus === 'Released').reduce((s, g) => s + g.amount, 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Pending</p>
                        <p className="text-sm font-black" style={{ color: 'var(--tone-warn-fg)' }}>
                          {peso(data.grants.filter(g => g.releaseStatus === 'Pending').reduce((s, g) => s + g.amount, 0))}
                        </p>
                      </div>
                    </div>
                    {data.grants.map(g => (
                      <div key={g.id} className="rounded-2xl p-3.5" style={{ background: 'var(--surface-inset)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm" style={{ color: 'var(--text-strong)' }}>{g.grantTypeName || g.title}</p>
                            {g.source && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.source}</p>}
                          </div>
                          <StatusBadge status={g.releaseStatus} icon={false} />
                        </div>
                        <p className="text-lg font-black mt-1" style={{ color: 'var(--text-strong)' }}>{peso(g.amount)}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {g.releaseStatus === 'Released'
                            ? <>Received {fmtDate(g.releasedAt)}{g.referenceNo ? ` · Ref ${g.referenceNo}` : ''}</>
                            : <>Awarded {fmtDate(g.awardedOn)}</>}
                        </p>
                        {g.releaseStatus === 'Pending' && g.scheduledReleaseDate && (
                          <p className="text-xs mt-1 font-semibold flex items-center gap-1" style={{ color: 'var(--tone-warn-fg)' }}>
                            <CalendarClock size={12} strokeWidth={2.4} />
                            Release scheduled {fmtDate(String(g.scheduledReleaseDate).slice(0, 10) + 'T00:00:00')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {editing && (
        <Modal title={isStaff ? 'Edit Grantee Profile' : 'Edit Contact Info'} onClose={() => setEditing(null)} dismissible={!saving} width={isStaff ? 680 : 480}>
          <form onSubmit={save} className="space-y-4">
            {formError && <p role="alert" className="text-sm p-3 rounded-2xl" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{formError}</p>}
            {!isStaff && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                You can update your contact number and address. For any other correction, contact the scholarship office.
              </p>
            )}
            <Field label="Contact Number"><ContactInput value={editing.contactLocal} onChange={v => setEditing(x => ({ ...x, contactLocal: v }))} /></Field>
            <Field label="Complete Address">
              <textarea rows={2} maxLength={500} value={editing.address} onChange={e => setEditing(x => ({ ...x, address: e.target.value }))} className="clay-input" />
            </Field>
            {isStaff && (
              <>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field label="Campus">
                    <select value={editing.campusId} onChange={e => setEditing(x => ({ ...x, campusId: e.target.value, programId: '' }))} className="clay-input">
                      <option value="">—</option>
                      {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Course">
                    <select value={editing.programId} onChange={e => setEditing(x => ({ ...x, programId: e.target.value }))} className="clay-input">
                      <option value="">—</option>
                      {campusPrograms.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                    </select>
                  </Field>
                  <Field label="Year Level">
                    <select value={editing.yearLevel} onChange={e => setEditing(x => ({ ...x, yearLevel: e.target.value }))} className="clay-input">
                      {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </Field>
                </div>
                <BirthDateAge value={editing.birthDate} onChange={v => setEditing(x => ({ ...x, birthDate: v }))} />
                <SectionTitle>Personal Information</SectionTitle>
                <PersonalQuestions value={editing.personal} onChange={v => setEditing(x => ({ ...x, personal: v }))} />
                <SectionTitle>Family Information</SectionTitle>
                <FamilyQuestions value={editing.personal} onChange={v => setEditing(x => ({ ...x, personal: v }))} />
              </>
            )}
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
