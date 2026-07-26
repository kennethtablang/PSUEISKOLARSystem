import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Printer, Award, ShieldCheck, ShieldX, Plus, BanknoteArrowUp, History, Camera } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { getScholarProfile, upsertScholarProfile, getGrades, addGrade, setLifecycleStatus, getScholarshipHistory } from '../api/scholars';
import { getPrograms, getScholarshipTypes } from '../api/lookups';
import { getOneTimeGrants, releaseOneTimeGrant } from '../api/oneTimeGrants';
import { approveScholar, rejectScholar } from '../api/scholarApprovals';
import { uploadAvatarFor, clearAvatarCache } from '../api/avatars';
import { useTitle } from '../hooks/useTitle';
import { useTheme } from '../context/ThemeContext';
import { vizTokens, tooltipStyle } from '../constants/viz';
import Modal from '../components/Modal';
import Avatar from '../components/Avatar';
import { StatusBadge } from './ScholarApprovalsPage';
import { GrantModal, GrantStatusBadge } from './OneTimeGrantsPage';
import { peso } from '../constants/grants';

export default function ScholarDetailPage() {
  useTitle('Scholar Profile');
  const { userId } = useParams();
  const { token, user: currentUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [grades, setGrades] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [scholarshipTypes, setScholarshipTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [showAddGrade, setShowAddGrade] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [scholarshipHistory, setScholarshipHistory] = useState([]);
  const [grants, setGrants] = useState(null);         // { items, totalAmount, … }
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [decision, setDecision] = useState(null);      // 'approve' | 'reject'

  async function handleStatusChange(status) {
    setSavingStatus(true);
    try { await setLifecycleStatus(targetUserId, status, token); await load(); }
    catch (e) { toast(e.message, 'error'); }
    finally { setSavingStatus(false); }
  }

  function handlePrint() {
    if (!profile) return;
    const esc = s => String(s ?? '—').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    const field = (k, v) => `<div><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`;
    const rows = grades.map(g =>
      `<tr><td>${esc(g.academicYear)}</td><td>Sem ${g.semester}</td><td>${g.gwa.toFixed(2)}</td><td>${g.meetsRequirement ? 'Compliant' : 'Flagged'}</td><td>${esc(g.remarks)}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Scholar Summary — ${esc(profile.fullName)}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;color:#0d1a33;padding:36px;max-width:800px;margin:auto;}
      h1{color:#002570;font-size:20px;margin:0;} .sub{color:#667;font-size:12px;margin:4px 0 20px;}
      .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px 20px;margin-bottom:24px;}
      .k{color:#889;font-size:10px;text-transform:uppercase;letter-spacing:.05em;} .v{font-weight:bold;font-size:14px;margin-top:2px;}
      h3{color:#002570;font-size:14px;border-bottom:2px solid #002570;padding-bottom:4px;} table{width:100%;border-collapse:collapse;}
      th,td{border:1px solid #ccd;padding:6px 8px;text-align:left;font-size:12px;} th{background:#eef2fb;}
      .foot{margin-top:28px;color:#99a;font-size:10px;border-top:1px solid #ddd;padding-top:8px;}</style></head><body>
      <h1>PSU e-Iskolar — Scholar Compliance Summary</h1>
      <div class="sub">Generated ${new Date().toLocaleString()} · by ${esc(currentUser?.fullName)}</div>
      <div class="grid">
        ${field('Full Name', profile.fullName)}${field('Student ID', profile.studentId)}${field('Status', profile.lifecycleStatus)}
        ${field('Program', profile.programName)}${field('Scholarship', profile.scholarshipTypeName)}
        ${field('Year Level', 'Year ' + profile.yearLevel)}${field('Latest GWA', profile.latestGwa?.toFixed(2))}${field('Min. GWA', profile.minimumGwa?.toFixed(2))}
        ${field('Compliance', profile.meetsRequirement == null ? 'No GWA' : profile.meetsRequirement ? 'Compliant' : 'Below threshold')}${field('Contact', profile.contactNumber)}${field('Email', profile.email)}
      </div>
      <h3>Academic Grades</h3>
      <table><thead><tr><th>Academic Year</th><th>Sem</th><th>GWA</th><th>Status</th><th>Remarks</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No grades recorded.</td></tr>'}</tbody></table>
      <div class="foot">PSU e-Iskolar · Scholar Profiling and Records Management System · Confidential (RA 10173)</div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  const isAdminOrCoord = currentUser?.role === 'Administrator' || currentUser?.role === 'ScholarshipCoordinator';
  const targetUserId   = userId ?? currentUser?.id;
  const isOwnProfile   = !isAdminOrCoord && currentUser?.id === targetUserId;

  /* Staff-side profile photo. Scholars manage their own from My Profile; this is here so
     the office can attach an ID photo or take down an inappropriate one. */
  const [photoBusy, setPhotoBusy]       = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const photoInput = useRef(null);

  async function handlePhotoPicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) {
      toast('Profile photo must be a PNG, JPG, or WEBP image.', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast('Profile photo must be 4 MB or smaller.', 'error');
      return;
    }

    setPhotoBusy(true);
    try {
      await uploadAvatarFor(targetUserId, file, token);
      clearAvatarCache(targetUserId);
      setPhotoVersion(v => v + 1);
      await load();
      toast('Profile photo updated.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally { setPhotoBusy(false); }
  }

  async function load() {
    setLoading(true);
    try {
      const [p, prog, st, g, hist, gr] = await Promise.all([
        getScholarProfile(targetUserId, token),
        getPrograms(token),
        getScholarshipTypes(token),
        getGrades(targetUserId, token).catch(() => []),
        getScholarshipHistory(targetUserId, token).catch(() => []),
        getOneTimeGrants(token, { scholarId: targetUserId, pageSize: 50 }).catch(() => null),
      ]);
      setProfile(p);
      setPrograms(prog);
      setScholarshipTypes(st);
      setGrades(g);
      setScholarshipHistory(hist);
      setGrants(gr);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReleaseGrant(grant) {
    try {
      await releaseOneTimeGrant(grant.id, {}, token);
      toast(`${grant.title} released.`, 'success');
      await load();
    } catch (e) { toast(e.message, 'error'); }
  }

  useEffect(() => { load(); }, [targetUserId]);

  if (loading) return <Layout><div className="p-4 sm:p-8 text-sm" style={{ color: '#7a8aaa' }}>Loading…</div></Layout>;
  if (error) return <Layout><div className="p-4 sm:p-8 text-sm" style={{ color: '#e03030' }}>{error}</div></Layout>;

  return (
    <Layout>
      <div className="page-shell">
        <button onClick={() => navigate(-1)} className="text-sm mb-5 flex items-center gap-1 hover:underline" style={{ color: 'var(--text)' }}>
          ← Back
        </button>

        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            {profile && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar
                  userId={profile.userId}
                  name={profile.fullName}
                  hasAvatar={profile.hasAvatar}
                  version={photoVersion}
                  size={56}
                  radius={16}
                  style={{
                    boxShadow: '4px 4px 0 rgba(0,0,0,0.1)',
                    opacity: photoBusy ? 0.55 : 1,
                    transition: 'opacity 0.15s',
                  }}
                />
                {/* Staff can set or clear a scholar's photo — e.g. attaching an ID photo
                    on their behalf, or removing an inappropriate one. */}
                {isAdminOrCoord && (
                  <>
                    <button
                      type="button"
                      onClick={() => photoInput.current?.click()}
                      disabled={photoBusy}
                      title={profile.hasAvatar ? 'Replace photo' : 'Upload a photo'}
                      style={{
                        position: 'absolute', right: -5, bottom: -5,
                        width: 24, height: 24, borderRadius: 8, border: 'none',
                        cursor: photoBusy ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: '#003087', color: '#fff',
                        boxShadow: '2px 2px 0 rgba(0,0,0,0.15)',
                      }}
                    >
                      <Camera size={12} strokeWidth={2.4} />
                    </button>
                    <input
                      ref={photoInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handlePhotoPicked}
                      style={{ display: 'none' }}
                    />
                  </>
                )}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="page-title">{profile?.fullName ?? 'Scholar Profile'}</h1>
              <p className="page-subtitle">{profile?.email}</p>
              <span className="page-title-bar" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile && (
              <button onClick={handlePrint} className="clay-btn clay-btn-ghost px-4 py-2 text-sm flex items-center gap-1.5">
                <Printer size={14} strokeWidth={2.4} /> Print Summary
              </button>
            )}
            {(isAdminOrCoord || isOwnProfile) && (
              <button onClick={() => setEditing(true)} className="clay-btn clay-btn-ghost px-4 py-2 text-sm">
                {isOwnProfile ? 'Edit My Info' : 'Edit Profile'}
              </button>
            )}
          </div>
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
            {/* GWA threshold alert */}
            {profile.latestGwa != null && profile.minimumGwa != null && profile.latestGwa > profile.minimumGwa && (
              <div className="flex items-start gap-3 p-4 rounded-2xl mb-5"
                style={{ background: '#fff2ec', border: '1.5px solid #fca572', color: '#7a3010' }}>
                <AlertTriangle size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" style={{ color: '#d05010' }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: '#7a3010' }}>GWA Below Scholarship Threshold</p>
                  <p className="text-xs mt-0.5">
                    Current GWA <strong>{profile.latestGwa.toFixed(2)}</strong> exceeds the maximum of{' '}
                    <strong>{profile.minimumGwa.toFixed(2)}</strong> required for{' '}
                    {profile.scholarshipTypeName ?? 'this scholarship'}.
                    {isAdminOrCoord ? ' Review the scholar\'s standing.' : ' Please contact your coordinator.'}
                  </p>
                </div>
              </div>
            )}

            {/* Registration verification (admin approval of a self-registered scholar) */}
            {profile.approvalStatus && profile.approvalStatus !== 'Approved' && (
              <div className="rounded-2xl p-4 mb-5 flex items-start gap-3 flex-wrap"
                style={profile.approvalStatus === 'Rejected'
                  ? { background: '#fff1f1', border: '1.5px solid #fca5a5' }
                  : { background: '#fffbe8', border: '1.5px solid #f5d060' }}>
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={profile.approvalStatus} />
                    <span className="text-sm font-black" style={{ color: 'var(--text-strong)' }}>
                      {profile.approvalStatus === 'Rejected'
                        ? 'Registration was not approved'
                        : 'Registration awaiting verification'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
                    {isOwnProfile
                      ? 'You can sign in and finish your profile, but document submission stays locked until the scholarship office verifies your registration.'
                      : 'This scholar cannot submit documents until their registration is verified.'}
                  </p>
                  {profile.approvalNote && (
                    <p className="text-xs mt-1.5 italic" style={{ color: '#7a5500' }}>“{profile.approvalNote}”</p>
                  )}
                </div>
                {isAdminOrCoord && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDecision('approve')}
                      className="clay-btn clay-btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5">
                      <ShieldCheck size={13} strokeWidth={2.6} /> Approve
                    </button>
                    {profile.approvalStatus !== 'Rejected' && (
                      <button onClick={() => setDecision('reject')}
                        className="clay-btn clay-btn-ghost px-3.5 py-2 text-xs flex items-center gap-1.5"
                        style={{ color: '#c02020' }}>
                        <ShieldX size={13} strokeWidth={2.6} /> Reject
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Scholarship lifecycle status (FR-18) */}
            <div className="clay-card p-4 mb-5 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>Scholarship Status</span>
                <LifecycleBadge status={profile.lifecycleStatus} />
                {profile.approvalStatus === 'Approved' && <StatusBadge status="Approved" />}
              </div>
              {isAdminOrCoord && (
                <select
                  value={profile.lifecycleStatus}
                  disabled={savingStatus}
                  onChange={e => handleStatusChange(e.target.value)}
                  className="clay-input"
                  style={{ width: 'auto' }}
                >
                  {['Active', 'Renewed', 'Lapsed', 'Suspended', 'Graduated'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>

            {/* The two reference cards sit side by side on a wide screen — who the scholar
                is, and what they hold — instead of stacking down a narrow column. */}
            <div className="card-grid-wide mb-5">
              <div className="clay-card p-6">
                <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#7a8aaa' }}>Scholar Information</h2>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <Detail label="Student ID" value={profile.studentId} />
                  <Detail label="Year Level" value={`Year ${profile.yearLevel}`} />
                  <Detail label="Program" value={profile.programName ?? '—'} />
                  <Detail label="Scholarship Type" value={profile.scholarshipTypeName ?? '—'} />
                  <Detail label="Type Category" value={profile.scholarshipTypeCategory ?? '—'} />
                  <Detail label="Min. GWA Required" value={profile.minimumGwa?.toFixed(2) ?? '—'} />
                  <Detail label="Contact Number" value={profile.contactNumber ?? '—'} />
                  <Detail label="Birth Date" value={profile.birthDate ? new Date(profile.birthDate).toLocaleDateString('en-PH') : '—'} />
                  {profile.address && <Detail label="Address" value={profile.address} />}
                </dl>
              </div>

              {/* The one scholarship this student holds, plus the full assignment trail */}
              <ScholarshipCard
                profile={profile}
                history={scholarshipHistory}
                isAdminOrCoord={isAdminOrCoord}
                onChange={() => setEditing(true)}
              />
            </div>

            {/* One-time grants — one-off awards on top of the scholarship */}
            <OneTimeGrantsCard
              grants={grants}
              isAdminOrCoord={isAdminOrCoord}
              onAdd={() => setShowGrantModal(true)}
              onRelease={handleReleaseGrant}
            />

            {grades.length >= 2 && (
              <GradeTrendChart grades={grades} minimumGwa={profile.minimumGwa} />
            )}

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
                <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
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
                        <td className="py-2.5" style={{ color: 'var(--text)' }}>{g.academicYear}</td>
                        <td className="py-2.5" style={{ color: 'var(--text)' }}>Sem {g.semester}</td>
                        <td className="py-2.5">
                          <span className="font-mono font-bold" style={{ color: g.meetsRequirement ? 'var(--text-strong)' : '#c03010' }}>
                            {g.gwa.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {g.meetsRequirement ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#d4f4e2', color: '#166534' }}>
                              Compliant
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#ffe4dc', color: '#c03010' }}>
                              <AlertTriangle size={10} strokeWidth={2.5} />
                              Flagged
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-xs" style={{ color: 'var(--text)' }}>{g.remarks ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
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

      {showGrantModal && profile && (
        <GrantModal
          initial={null}
          scholars={[]}
          fixedScholar={{ userId: targetUserId, fullName: profile.fullName }}
          token={token}
          onClose={() => setShowGrantModal(false)}
          onSaved={() => { setShowGrantModal(false); load(); }}
        />
      )}

      {decision && profile && (
        <ApprovalDecisionModal
          profile={profile}
          approve={decision === 'approve'}
          token={token}
          onClose={() => setDecision(null)}
          onDone={msg => { setDecision(null); toast(msg, 'success'); load(); }}
        />
      )}
    </Layout>
  );
}

/* ── The single scholarship a student holds, plus its assignment trail ── */
function ScholarshipCard({ profile, history, isAdminOrCoord, onChange }) {
  const active = history.find(h => h.isActive);
  const past = history.filter(h => !h.isActive);
  const conflict = history.filter(h => h.isActive).length > 1;

  return (
    /* No bottom margin: this card is a grid item now, so the grid owns the spacing. */
    <div className="clay-card p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#7a8aaa' }}>
          <Award size={13} strokeWidth={2.4} /> Scholarship
        </h2>
        {isAdminOrCoord && (
          <button onClick={onChange} className="text-xs font-medium hover:underline" style={{ color: '#003087' }}>
            {profile.scholarshipTypeId ? 'Transfer scholarship' : 'Assign scholarship'}
          </button>
        )}
      </div>

      {conflict && (
        <div className="rounded-xl p-3 mb-4 flex items-start gap-2"
          style={{ background: '#fff1f1', border: '1.5px solid #fca5a5' }}>
          <AlertTriangle size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" style={{ color: '#c02020' }} />
          <p className="text-xs" style={{ color: '#991b1b' }}>
            More than one scholarship is open for this scholar. A student may hold only one —
            close the extra assignment from the Scholarship Check report.
          </p>
        </div>
      )}

      {!profile.scholarshipTypeId ? (
        <p className="text-sm" style={{ color: '#7a8aaa' }}>
          No scholarship assigned yet. A student may hold exactly one scholarship at a time.
        </p>
      ) : (
        <div className="rounded-2xl p-4"
          style={{ background: 'rgba(96,48,176,0.06)', border: '1.5px solid rgba(96,48,176,0.18)' }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-base font-black" style={{ color: 'var(--text-strong)' }}>
                {profile.scholarshipTypeName}
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {profile.scholarshipTypeCategory && (
                  <span className="text-xs px-1.5 py-0.5 rounded-lg font-medium"
                    style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>
                    {profile.scholarshipTypeCategory}
                  </span>
                )}
                {profile.minimumGwa != null && (
                  <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>
                    max GWA {profile.minimumGwa.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs" style={{ color: '#7a8aaa' }}>Registered</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>
                {(active?.assignedAt ?? profile.scholarshipAssignedAt)
                  ? new Date(active?.assignedAt ?? profile.scholarshipAssignedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—'}
              </p>
              {active?.assignedBy && (
                <p className="text-xs mt-0.5" style={{ color: '#9aaabb' }}>by {active.assignedBy}</p>
              )}
            </div>
          </div>
          <p className="text-xs mt-3 pt-3" style={{ color: '#7a8aaa', borderTop: '1px solid rgba(96,48,176,0.14)' }}>
            This is the scholar's only active scholarship. Assigning another closes this one and is
            recorded below.
          </p>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5" style={{ color: '#7a8aaa' }}>
            <History size={12} strokeWidth={2.4} /> Previous scholarships ({past.length})
          </p>
          <ol className="space-y-2">
            {past.map(h => (
              <li key={h.id} className="clay-card-inner px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>{h.scholarshipTypeName}</span>
                  <span className="text-xs" style={{ color: '#7a8aaa' }}>
                    {new Date(h.assignedAt).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                    {' → '}
                    {new Date(h.endedAt).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {h.endReason && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{h.endReason}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ── One-off financial awards on top of the scholarship ── */
function OneTimeGrantsCard({ grants, isAdminOrCoord, onAdd, onRelease }) {
  const items = grants?.items ?? [];

  return (
    <div className="clay-card p-6 mb-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>
          One-Time Grants
        </h2>
        {isAdminOrCoord && (
          <button onClick={onAdd} className="text-xs font-medium hover:underline flex items-center gap-1" style={{ color: '#003087' }}>
            <Plus size={12} strokeWidth={2.8} /> Record grant
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: '#7a8aaa' }}>
          No one-time grants recorded. These are one-off awards separate from the scholarship above.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <MiniStat label="Awarded" value={peso(grants.totalAmount)} />
            <MiniStat label="Released" value={peso(grants.releasedAmount)} color="#0a5a3a" />
            <MiniStat label="Pending" value={peso(grants.pendingAmount)} color="#7d5a00" />
          </div>
          <ul className="space-y-2">
            {items.map(g => (
              <li key={g.id} className="clay-card-inner px-3.5 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>{g.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#7a8aaa' }}>
                      {[g.source, g.purpose].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#9aaabb' }}>
                      Awarded {new Date(g.awardedOn).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {g.referenceNo ? ` · ref ${g.referenceNo}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <span className="font-mono font-bold text-sm" style={{ color: 'var(--text-strong)' }}>{peso(g.amount)}</span>
                    <GrantStatusBadge status={g.releaseStatus} />
                    {isAdminOrCoord && g.releaseStatus === 'Pending' && (
                      <button
                        onClick={() => onRelease(g)}
                        className="text-xs font-bold hover:underline flex items-center gap-1"
                        style={{ color: '#166534' }}
                      >
                        <BanknoteArrowUp size={11} strokeWidth={2.6} /> Release
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="flex-1 min-w-[110px]">
      <p className="text-xs" style={{ color: '#7a8aaa' }}>{label}</p>
      <p className="text-sm font-black font-mono mt-0.5" style={{ color: color ?? 'var(--text-strong)' }}>{value}</p>
    </div>
  );
}

/* ── Approve / reject a registration straight from the profile ── */
function ApprovalDecisionModal({ profile, approve, token, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = approve || note.trim().length >= 5;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (approve) {
        await approveScholar(profile.userId, note.trim() || null, token);
        onDone(`${profile.fullName}'s registration is approved.`);
      } else {
        await rejectScholar(profile.userId, note.trim(), token);
        onDone(`${profile.fullName}'s registration was rejected.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ClayModal
      title={approve ? 'Approve registration' : 'Reject registration'}
      subtitle={`${profile.fullName} · ${profile.email}`}
      onClose={onClose}
    >
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={approve ? 'Note (optional)' : 'Reason (sent to the scholar)'}>
          <textarea
            rows={3}
            required={!approve}
            value={note}
            onChange={e => setNote(e.target.value)}
            className="clay-input"
            placeholder={approve ? 'Anything the scholar should know…' : 'Explain what needs fixing…'}
          />
        </Field>
        <p className="text-xs" style={{ color: '#7a8aaa' }}>
          {approve
            ? 'The scholar is notified and can start submitting documents immediately.'
            : 'Document submission stays locked until the registration is approved.'}
        </p>
        <ModalButtons
          onClose={onClose}
          submitting={submitting}
          disabled={!canSubmit}
          label={approve ? 'Approve' : 'Reject'}
        />
      </form>
    </ClayModal>
  );
}

function GradeTrendChart({ grades, minimumGwa }) {
  const { resolved } = useTheme();
  const t = vizTokens(resolved);

  // GWA: lower is better (1.0 best, 5.0 worst). Reverse the Y axis so "up = better".
  const data = [...grades]
    .sort((a, b) => a.academicYear.localeCompare(b.academicYear) || a.semester - b.semester)
    .map(g => ({ period: `${g.academicYear.split('-')[0]} S${g.semester}`, gwa: g.gwa }));

  return (
    <div className="clay-card p-6 mb-5">
      <h2 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: '#7a8aaa' }}>GWA Trend</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
          <YAxis domain={[1, 5]} reversed tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle(t)} formatter={v => [Number(v).toFixed(2), 'GWA']} />
          {minimumGwa != null && (
            <ReferenceLine y={minimumGwa} stroke="#d05010" strokeDasharray="5 4"
              label={{ value: `Max ${minimumGwa.toFixed(2)}`, fontSize: 10, fill: '#d05010', position: 'insideTopRight' }} />
          )}
          {/* One series, so no legend box — the heading names it. */}
          <Line type="monotone" dataKey="gwa" name="GWA" stroke={t.markColor} strokeWidth={2}
            dot={{ r: 4, fill: t.markColor, stroke: t.gap, strokeWidth: 2 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs mt-2" style={{ color: '#9aaabb' }}>
        Higher on the chart is better (lower GWA). The dashed line is the scholarship's maximum allowed GWA.
      </p>
    </div>
  );
}

const LIFECYCLE_STYLE = {
  Active:    { bg: '#d4f4e2', color: '#166534' },
  Renewed:   { bg: '#dbeafe', color: '#1e40af' },
  Lapsed:    { bg: '#fee2e2', color: '#991b1b' },
  Suspended: { bg: '#ffedd5', color: '#9a3412' },
  Graduated: { bg: '#e5e7eb', color: '#374151' },
};

function LifecycleBadge({ status }) {
  const s = LIFECYCLE_STYLE[status] ?? LIFECYCLE_STYLE.Active;
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: '#7a8aaa' }}>{label}</dt>
      <dd className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-strong)' }}>{value}</dd>
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
    scholarshipChangeReason: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // Staff moving a scholar off an existing scholarship: capture why, since it closes
  // the current assignment and opens a new one in the ledger.
  const originalTypeId = profile?.scholarshipTypeId ?? '';
  const isTransfer = !scholarMode
    && originalTypeId !== ''
    && String(form.scholarshipTypeId) !== String(originalTypeId);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Client-side validation for immediate feedback.
    const sid = form.studentId.trim();
    if (!/^[A-Za-z0-9-]{3,30}$/.test(sid)) {
      setError('Student ID may only contain letters, numbers, and hyphens (3–30 characters).');
      return;
    }
    if (form.contactNumber && !/^(09\d{9}|\+639\d{9})$/.test(form.contactNumber.trim())) {
      setError('Contact number must be a valid PH mobile number (e.g. 09171234567).');
      return;
    }
    if (form.birthDate && new Date(form.birthDate) > new Date()) {
      setError('Birth date cannot be in the future.');
      return;
    }

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
        scholarshipChangeReason: isTransfer ? (form.scholarshipChangeReason.trim() || null) : null,
      }, token);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ClayModal title={scholarMode ? 'Edit My Info' : 'Edit Scholar Profile'} onClose={onClose} width={520}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Student ID">
          <input required value={form.studentId} onChange={e => set('studentId', e.target.value)} className="clay-input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Year Level">
            <select value={form.yearLevel} onChange={e => set('yearLevel', e.target.value)} className="clay-input">
              {[1,2,3,4,5].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </Field>
          <Field label="Contact Number">
            <input value={form.contactNumber} onChange={e => set('contactNumber', e.target.value)} className="clay-input" placeholder="09xx" />
          </Field>
        </div>
        <Field label="Program">
          <select value={form.programId} onChange={e => set('programId', e.target.value)} className="clay-input">
            <option value="">— Select Program —</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
        </Field>
        <Field label="Scholarship Type">
          <select value={form.scholarshipTypeId} onChange={e => set('scholarshipTypeId', e.target.value)} className="clay-input">
            <option value="">— Select Scholarship Type —</option>
            {scholarshipTypes.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
          {scholarMode ? (
            <p className="text-xs mt-1.5" style={{ color: '#7a8aaa' }}>
              Choose the scholarship you are enrolled in — this sets which documents you need to
              submit. You may hold only one scholarship, and only your coordinator can change it
              once it is set.
            </p>
          ) : (
            <p className="text-xs mt-1.5" style={{ color: '#7a8aaa' }}>
              A student may hold only one scholarship at a time. Choosing a different one closes the
              current assignment and records the transfer.
            </p>
          )}
        </Field>

        {isTransfer && (
          <Field label="Reason for the transfer">
            <input
              value={form.scholarshipChangeReason}
              onChange={e => set('scholarshipChangeReason', e.target.value)}
              className="clay-input"
              placeholder="e.g. Awarded a DOST-SEI slot for A.Y. 2026-2027"
            />
            <p className="text-xs mt-1.5" style={{ color: '#b45309' }}>
              This closes the scholar's current scholarship and opens the new one. The reason is kept
              in their scholarship history.
            </p>
          </Field>
        )}
        <Field label="Birth Date">
          <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} className="clay-input" />
        </Field>
        <Field label="Address">
          <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} className="clay-input" />
        </Field>
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

    if (!/^\d{4}-\d{4}$/.test(form.academicYear.trim())) {
      setError('Academic year must be in the format YYYY-YYYY (e.g. 2025-2026).');
      return;
    }
    const gwaVal = parseFloat(form.gwa);
    if (Number.isNaN(gwaVal) || gwaVal < 1 || gwaVal > 5) {
      setError('GWA must be between 1.00 and 5.00.');
      return;
    }

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

function ClayModal({ title, subtitle, onClose, children, width = 460 }) {
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} width={width}>
      {children}
    </Modal>
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
      <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text)' }}>{label}</label>
      {children}
    </div>
  );
}

function ModalButtons({ onClose, submitting, label, disabled = false }) {
  const off = submitting || disabled;
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
      <button type="submit" disabled={off} className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm" style={{ opacity: off ? 0.65 : 1 }}>
        {submitting ? 'Saving…' : label}
      </button>
    </div>
  );
}
