import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getScholarProfile, upsertScholarProfile, getGrades, addGrade } from '../api/scholars';
import { getPrograms, getScholarshipTypes } from '../api/lookups';
import { useTitle } from '../hooks/useTitle';

export default function ScholarDetailPage() {
  useTitle('Scholar Profile');
  const { userId } = useParams();
  const { token, user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [grades, setGrades] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [scholarshipTypes, setScholarshipTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [showAddGrade, setShowAddGrade] = useState(false);

  const isAdminOrCoord = currentUser?.role === 'Administrator' || currentUser?.role === 'ScholarshipCoordinator';
  const targetUserId   = userId ?? currentUser?.id;
  const isOwnProfile   = !isAdminOrCoord && currentUser?.id === targetUserId;

  async function load() {
    setLoading(true);
    try {
      const [p, prog, st, g] = await Promise.all([
        getScholarProfile(targetUserId, token),
        getPrograms(token),
        getScholarshipTypes(token),
        getGrades(targetUserId, token).catch(() => []),
      ]);
      setProfile(p);
      setPrograms(prog);
      setScholarshipTypes(st);
      setGrades(g);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [targetUserId]);

  if (loading) return <Layout><div className="p-8 text-sm" style={{ color: '#7a8aaa' }}>Loading…</div></Layout>;
  if (error) return <Layout><div className="p-8 text-sm" style={{ color: '#e03030' }}>{error}</div></Layout>;

  return (
    <Layout>
      <div className="p-8 max-w-3xl">
        <button onClick={() => navigate(-1)} className="text-sm mb-5 flex items-center gap-1 hover:underline" style={{ color: '#4a5a7a' }}>
          ← Back
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="page-title">{profile?.fullName ?? 'Scholar Profile'}</h1>
            <p className="page-subtitle">{profile?.email}</p>
            <span className="page-title-bar" />
          </div>
          {(isAdminOrCoord || isOwnProfile) && (
            <button onClick={() => setEditing(true)} className="clay-btn clay-btn-ghost px-4 py-2 text-sm">
              {isOwnProfile ? 'Edit My Info' : 'Edit Profile'}
            </button>
          )}
        </div>

        {!profile ? (
          <div className="clay-card p-5 text-sm" style={{ background: '#fffbe8', border: '1.5px solid #f5d060', color: '#7a5500' }}>
            {isOwnProfile
            ? 'Your scholar profile has not been set up yet.'
            : 'No scholar profile set up yet.'}
            {(isAdminOrCoord || isOwnProfile) && (
              <button onClick={() => setEditing(true)} className="ml-2 underline font-medium">Set up profile</button>
            )}
          </div>
        ) : (
          <>
            <div className="clay-card p-6 mb-5">
              <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#7a8aaa' }}>Scholar Information</h2>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                <Detail label="Student ID" value={profile.studentId} />
                <Detail label="Year Level" value={`Year ${profile.yearLevel}`} />
                <Detail label="Program" value={profile.programName ?? '—'} />
                <Detail label="Campus" value={profile.campusName ?? '—'} />
                <Detail label="Scholarship Type" value={profile.scholarshipTypeName ?? '—'} />
                <Detail label="Min. GWA Required" value={profile.minimumGwa?.toFixed(2) ?? '—'} />
                <Detail label="Contact Number" value={profile.contactNumber ?? '—'} />
                <Detail label="Birth Date" value={profile.birthDate ? new Date(profile.birthDate).toLocaleDateString('en-PH') : '—'} />
                {profile.address && <Detail label="Address" value={profile.address} />}
              </dl>
            </div>

            <div className="clay-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>Academic Grades</h2>
                {isAdminOrCoord && (
                  <button onClick={() => setShowAddGrade(true)} className="text-sm font-medium hover:underline" style={{ color: '#003087' }}>
                    + Add Grade
                  </button>
                )}
              </div>

              {grades.length === 0 ? (
                <p className="text-sm" style={{ color: '#7a8aaa' }}>No grades recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead style={{ borderBottom: '1.5px solid rgba(0,0,0,0.07)' }}>
                    <tr>
                      {['Academic Year', 'Sem', 'GWA', 'Status', 'Remarks'].map(h => (
                        <th key={h} className="text-left py-2 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((g, i) => (
                      <tr key={g.id} style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                        <td className="py-2.5" style={{ color: '#2a3a5a' }}>{g.academicYear}</td>
                        <td className="py-2.5" style={{ color: '#2a3a5a' }}>{g.semester}</td>
                        <td className="py-2.5 font-mono font-bold" style={{ color: '#0d1a33' }}>{g.gwa.toFixed(2)}</td>
                        <td className="py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${g.meetsRequirement ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {g.meetsRequirement ? 'Compliant' : 'Flagged'}
                          </span>
                        </td>
                        <td className="py-2.5 text-xs" style={{ color: '#4a5a7a' }}>{g.remarks ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {editing && (
        <EditProfileModal
          profile={profile}
          userId={targetUserId}
          programs={programs}
          scholarshipTypes={scholarshipTypes}
          token={token}
          scholarMode={isOwnProfile}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}

      {showAddGrade && (
        <AddGradeModal
          userId={targetUserId}
          token={token}
          onClose={() => setShowAddGrade(false)}
          onSaved={() => { setShowAddGrade(false); load(); }}
        />
      )}
    </Layout>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: '#7a8aaa' }}>{label}</dt>
      <dd className="text-sm font-semibold mt-0.5" style={{ color: '#0d1a33' }}>{value}</dd>
    </div>
  );
}

function EditProfileModal({ profile, userId, programs, scholarshipTypes, token, scholarMode, onClose, onSaved }) {
  const [form, setForm] = useState({
    studentId: profile?.studentId ?? '',
    programId: profile?.programId ?? '',
    scholarshipTypeId: profile?.scholarshipTypeId ?? '',
    yearLevel: profile?.yearLevel ?? 1,
    contactNumber: profile?.contactNumber ?? '',
    birthDate: profile?.birthDate ? profile.birthDate.split('T')[0] : '',
    address: profile?.address ?? '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await upsertScholarProfile(userId, {
        studentId: form.studentId,
        programId: form.programId ? parseInt(form.programId) : null,
        scholarshipTypeId: form.scholarshipTypeId ? parseInt(form.scholarshipTypeId) : null,
        yearLevel: parseInt(form.yearLevel),
        contactNumber: form.contactNumber || null,
        birthDate: form.birthDate || null,
        address: form.address || null,
      }, token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const programLabel       = programs.find(p => p.id === parseInt(form.programId))?.name ?? '—';
  const scholarshipLabel   = scholarshipTypes.find(s => s.id === parseInt(form.scholarshipTypeId))?.name ?? '—';

  return (
    <ClayModal title={scholarMode ? 'Edit My Info' : 'Edit Scholar Profile'} onClose={onClose}>
      {error && <ErrorBox>{error}</ErrorBox>}
      {scholarMode && (
        <p className="text-xs mb-4 p-3 rounded-2xl" style={{ background: 'rgba(0,48,135,0.06)', color: '#4a5a7a', border: '1px solid rgba(0,48,135,0.1)' }}>
          Program and scholarship type are managed by your coordinator.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Student ID"><input required value={form.studentId} onChange={e => set('studentId', e.target.value)} className="clay-input" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Year Level">
            <select value={form.yearLevel} onChange={e => set('yearLevel', e.target.value)} className="clay-input">
              {[1,2,3,4,5].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </Field>
          <Field label="Contact Number"><input value={form.contactNumber} onChange={e => set('contactNumber', e.target.value)} className="clay-input" placeholder="09xx" /></Field>
        </div>
        {scholarMode ? (
          <>
            <Field label="Program">
              <input value={programLabel} readOnly disabled className="clay-input opacity-60 cursor-not-allowed" />
            </Field>
            <Field label="Scholarship Type">
              <input value={scholarshipLabel} readOnly disabled className="clay-input opacity-60 cursor-not-allowed" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Program">
              <select value={form.programId} onChange={e => set('programId', e.target.value)} className="clay-input">
                <option value="">— Select Program —</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </Field>
            <Field label="Scholarship Type">
              <select value={form.scholarshipTypeId} onChange={e => set('scholarshipTypeId', e.target.value)} className="clay-input">
                <option value="">— Select Scholarship —</option>
                {scholarshipTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="Birth Date"><input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className="clay-input" /></Field>
        <Field label="Address"><textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} className="clay-input" /></Field>
        <ModalButtons onClose={onClose} submitting={submitting} label="Save" />
      </form>
    </ClayModal>
  );
}

function AddGradeModal({ userId, token, onClose, onSaved }) {
  const [form, setForm] = useState({ academicYear: '', semester: '1', gwa: '', remarks: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await addGrade(userId, {
        academicYear: form.academicYear,
        semester: parseInt(form.semester),
        gwa: parseFloat(form.gwa),
        remarks: form.remarks || null,
      }, token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ClayModal title="Record GWA" onClose={onClose}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Academic Year">
            <input required value={form.academicYear} onChange={e => set('academicYear', e.target.value)} className="clay-input" placeholder="2025-2026" />
          </Field>
          <Field label="Semester">
            <select value={form.semester} onChange={e => set('semester', e.target.value)} className="clay-input">
              <option value="1">1st Semester</option>
              <option value="2">2nd Semester</option>
            </select>
          </Field>
        </div>
        <Field label="GWA (1.0 – 5.0)">
          <input required type="number" step="0.01" min="1" max="5" value={form.gwa} onChange={e => set('gwa', e.target.value)} className="clay-input" placeholder="e.g. 1.75" />
        </Field>
        <Field label="Remarks (optional)">
          <input value={form.remarks} onChange={e => set('remarks', e.target.value)} className="clay-input" />
        </Field>
        <ModalButtons onClose={onClose} submitting={submitting} label="Save Grade" />
      </form>
    </ClayModal>
  );
}

function ClayModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,20,60,0.45)' }}>
      <div className="clay-card-modal w-full max-w-md p-7">
        <h2 className="text-base font-black mb-5" style={{ color: '#0d1a33' }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ErrorBox({ children }) {
  return (
    <div className="mb-4 p-3 rounded-2xl text-sm font-medium"
      style={{ background: '#dce8ff', color: '#003087', border: '1.5px solid #80aaee' }}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: '#4a5a7a' }}>{label}</label>
      {children}
    </div>
  );
}

function ModalButtons({ onClose, submitting, label }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
      <button type="submit" disabled={submitting} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm" style={{ opacity: submitting ? 0.65 : 1 }}>
        {submitting ? 'Saving…' : label}
      </button>
    </div>
  );
}
