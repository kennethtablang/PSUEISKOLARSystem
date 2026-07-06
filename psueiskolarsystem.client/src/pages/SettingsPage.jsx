import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getActiveSemester, setActiveSemester } from '../api/settings';
import { useTitle } from '../hooks/useTitle';
import { useTheme } from '../context/ThemeContext';
import { CalendarDays, CheckCircle, Archive, AlertTriangle, X, Database, Sun, Moon, Monitor, Clock } from 'lucide-react';

function yearOptions() {
  const y = new Date().getFullYear();
  const opts = [];
  for (let i = y - 3; i <= y + 2; i++) opts.push(`${i}-${i + 1}`);
  return opts;
}

export default function SettingsPage() {
  useTitle('System Settings');
  const { token, inactivityMin, setInactivityMin } = useAuth();
  const { theme, setTheme } = useTheme();

  const [current, setCurrent] = useState(null);
  const [form, setForm]       = useState({ academicYear: '', semester: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [saved, setSaved]     = useState(false);
  const [archiveDays, setArchiveDays] = useState(180);
  const [archiving, setArchiving]     = useState(false);
  const [archiveResult, setArchiveResult] = useState(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [seeding, setSeeding]       = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [tab, setTab] = useState('period');

  const TABS = [
    { key: 'period',     label: 'Academic Period', Icon: CalendarDays },
    { key: 'maintenance', label: 'Maintenance',    Icon: Archive },
    { key: 'appearance', label: 'Preferences',      Icon: Monitor },
  ];

  async function handleSeed() {
    if (!confirm('Seed sample coordinators, scholars, grades, and announcements? This is safe to run more than once — it will not duplicate existing sample data.')) return;
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch('/api/admin/seed-sample-data', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Seeding failed.');
      setSeedResult(data);
    } catch (e) {
      setSeedResult({ error: e.message });
    } finally {
      setSeeding(false);
    }
  }

  useEffect(() => {
    getActiveSemester(token)
      .then(data => {
        setCurrent(data);
        setForm({ academicYear: data.academicYear, semester: data.semester });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const updated = await setActiveSemester(
        { academicYear: form.academicYear, semester: Number(form.semester) },
        token
      );
      setCurrent(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    setArchiveResult(null);
    try {
      const res = await fetch(`/api/users/archive-inactive?daysInactive=${archiveDays}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Archive failed.');
      setArchiveResult(data);
    } catch (e) {
      setArchiveResult({ error: e.message });
    } finally {
      setArchiving(false);
      setShowArchiveConfirm(false);
    }
  }

  const semOrdinal = s => s === 1 ? '1st Semester' : '2nd Semester';
  const changed = current && (form.academicYear !== current.academicYear || Number(form.semester) !== current.semester);

  return (
    <Layout>
      <div className="p-8" style={{ maxWidth: 680 }}>

        {/* Header */}
        <div className="mb-7">
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle">Configure system-wide parameters for the active academic period.</p>
          <span className="page-title-bar" />
        </div>

        {loading ? (
          <p className="text-sm text-center py-12" style={{ color: '#7a8aaa' }}>Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Tab bar */}
            <div className="flex gap-2 flex-wrap" role="tablist">
              {TABS.map(({ key, label, Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(key)}
                    className="clay-btn px-4 py-2.5 text-sm font-bold flex items-center gap-2"
                    style={active
                      ? { background: 'rgba(0,37,112,0.12)', color: '#003087', border: '1.5px solid rgba(0,37,112,0.3)' }
                      : { color: 'var(--text)' }}>
                    <Icon size={15} strokeWidth={2.3} /> {label}
                  </button>
                );
              })}
            </div>

            {/* ── Academic Period tab ── */}
            {tab === 'period' && (<>

            {/* Current period display */}
            <div className="clay-card p-6">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                  background: 'rgba(0,48,135,0.08)', border: '1px solid rgba(0,48,135,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CalendarDays size={20} color="#003087" strokeWidth={2} />
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#7a8aaa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    Currently Active Period
                  </p>
                  {current ? (
                    <>
                      <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                        A.Y. {current.academicYear}
                      </p>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#003087', marginTop: 2 }}>
                        {semOrdinal(current.semester)}
                      </p>
                      {current.updatedByName && (
                        <p style={{ fontSize: 11.5, color: '#9aaabb', marginTop: 8 }}>
                          Last updated by {current.updatedByName} &middot;{' '}
                          {new Date(current.updatedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      )}
                    </>
                  ) : (
                    <p style={{ fontSize: 14, color: '#9aaabb' }}>Not configured</p>
                  )}
                </div>
              </div>
            </div>

            {/* Change form */}
            <div className="clay-card p-6">
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 20 }}>
                Change Active Period
              </p>

              {error && (
                <div className="mb-5 p-3.5 rounded-2xl text-sm"
                  style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
                  {error}
                </div>
              )}

              {saved && (
                <div className="mb-5 flex items-center gap-2.5 p-3.5 rounded-2xl text-sm"
                  style={{ background: '#f0fdf4', color: '#166534', border: '1.5px solid #bbf7d0' }}>
                  <CheckCircle size={15} strokeWidth={2.5} />
                  Active period updated successfully.
                </div>
              )}

              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* Academic Year */}
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                    Academic Year
                  </label>
                  <select
                    className="clay-input"
                    value={form.academicYear}
                    onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))}
                  >
                    {yearOptions().map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Semester toggle */}
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                    Semester
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[1, 2].map(s => {
                      const active = Number(form.semester) === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, semester: s }))}
                          style={{
                            flex: 1,
                            padding: '11px 16px',
                            borderRadius: 12,
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 13.5,
                            transition: 'all 0.12s ease',
                            ...(active ? {
                              background: 'linear-gradient(145deg, #0040b8, #002570)',
                              color: '#fff',
                              boxShadow: '4px 4px 0px #001040, inset 0 1px 0 rgba(255,255,255,0.18)',
                            } : {
                              background: 'var(--bg)',
                              color: 'var(--text)',
                              boxShadow: '4px 4px 10px rgba(163,177,198,0.5), -3px -3px 8px rgba(255,255,255,0.9)',
                            }),
                          }}
                        >
                          {semOrdinal(s)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ paddingTop: 4 }}>
                  <button
                    type="submit"
                    disabled={saving || !changed}
                    className="clay-btn clay-btn-primary px-8 py-3 text-sm"
                    style={{ opacity: (saving || !changed) ? 0.55 : 1 }}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  {!changed && !saving && (
                    <span style={{ marginLeft: 12, fontSize: 12, color: '#9aaabb' }}>
                      No changes to save.
                    </span>
                  )}
                </div>

              </form>
            </div>

            </>)}

            {/* ── Maintenance tab ── */}
            {tab === 'maintenance' && (<>

            {/* Database maintenance — archive inactive scholars */}
            <div className="clay-card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: 'rgba(180,60,0,0.07)', border: '1px solid rgba(180,60,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Archive size={20} color="#b03000" strokeWidth={2} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>Archive Inactive Scholars</p>
                  <p style={{ fontSize: 12, color: '#7a8aaa', marginTop: 2 }}>
                    Deactivate scholar accounts with no document submissions within the specified period.
                  </p>
                </div>
              </div>

              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                    Inactive for more than
                  </label>
                  <select
                    className="clay-input"
                    value={archiveDays}
                    onChange={e => setArchiveDays(Number(e.target.value))}
                    style={{ minWidth: 160 }}
                  >
                    {[90, 180, 270, 365].map(d => (
                      <option key={d} value={d}>{d} days ({Math.round(d / 30)} months)</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => { setArchiveResult(null); setShowArchiveConfirm(true); }}
                  disabled={archiving}
                  className="clay-btn px-5 py-2.5 text-sm font-bold"
                  style={{ background: '#b03000', color: '#fff', opacity: archiving ? 0.65 : 1, boxShadow: '4px 4px 0 rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
                  <Archive size={13} strokeWidth={2.5} className="inline mr-1.5" />
                  Run Archive
                </button>
              </div>

              {archiveResult && !archiveResult.error && (
                <div className="mt-4 flex items-start gap-2 p-3.5 rounded-2xl text-sm"
                  style={{ background: '#f0fdf4', color: '#166534', border: '1.5px solid #bbf7d0' }}>
                  <CheckCircle size={15} strokeWidth={2.5} className="mt-px shrink-0" />
                  <span>
                    {archiveResult.archived === 0
                      ? 'No inactive scholars found. All accounts are up to date.'
                      : `${archiveResult.archived} scholar account${archiveResult.archived !== 1 ? 's' : ''} archived successfully.`}
                  </span>
                </div>
              )}
              {archiveResult?.error && (
                <div className="mt-4 flex items-start gap-2 p-3.5 rounded-2xl text-sm"
                  style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
                  <AlertTriangle size={15} strokeWidth={2.5} className="mt-px shrink-0" />
                  <span>{archiveResult.error}</span>
                </div>
              )}
            </div>

            {/* Sample data seeder */}
            <div className="clay-card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: 'rgba(0,120,80,0.07)', border: '1px solid rgba(0,120,80,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Database size={20} color="#0a7d43" strokeWidth={2} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>Sample Data</p>
                  <p style={{ fontSize: 12, color: '#7a8aaa', marginTop: 2 }}>
                    Populate the system with sample coordinators, scholars (with profiles &amp; grades), and announcements for demos and testing.
                  </p>
                </div>
              </div>

              <button onClick={handleSeed} disabled={seeding}
                className="clay-btn px-5 py-2.5 text-sm font-bold"
                style={{ background: '#0a7d43', color: '#fff', opacity: seeding ? 0.65 : 1, boxShadow: '4px 4px 0 rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
                <Database size={13} strokeWidth={2.5} className="inline mr-1.5" />
                {seeding ? 'Seeding…' : 'Seed Sample Data'}
              </button>

              {seedResult && !seedResult.error && (
                <div className="mt-4 flex items-start gap-2 p-3.5 rounded-2xl text-sm"
                  style={{ background: '#f0fdf4', color: '#166534', border: '1.5px solid #bbf7d0' }}>
                  <CheckCircle size={15} strokeWidth={2.5} className="mt-px shrink-0" />
                  <span>
                    {seedResult.alreadySeeded
                      ? 'Sample data already exists — nothing to add.'
                      : `Seeded ${seedResult.scholars} scholars, ${seedResult.coordinators} coordinators, ${seedResult.grades} grades, and ${seedResult.announcements} announcements. Sample accounts use the password "Sample123!".`}
                  </span>
                </div>
              )}
              {seedResult?.error && (
                <div className="mt-4 flex items-start gap-2 p-3.5 rounded-2xl text-sm"
                  style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
                  <AlertTriangle size={15} strokeWidth={2.5} className="mt-px shrink-0" />
                  <span>{seedResult.error}</span>
                </div>
              )}
            </div>

            </>)}

            {/* ── Preferences tab ── */}
            {tab === 'appearance' && (<>
            <div className="clay-card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: 'rgba(0,48,135,0.08)', border: '1px solid rgba(0,48,135,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Monitor size={20} color="#003087" strokeWidth={2} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>Appearance</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Choose light, dark, or match your device.</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'System']].map(([val, Icon, label]) => (
                  <button key={val} onClick={() => setTheme(val)}
                    className="clay-btn px-4 py-2.5 text-sm flex items-center gap-2"
                    style={theme === val
                      ? { background: 'rgba(0,37,112,0.12)', color: '#003087', border: '1.5px solid rgba(0,37,112,0.3)' }
                      : { color: 'var(--text)' }}>
                    <Icon size={15} strokeWidth={2.3} /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="clay-card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: 'rgba(0,48,135,0.08)', border: '1px solid rgba(0,48,135,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={20} color="#003087" strokeWidth={2} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>Session Timeout</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Automatically sign out after this much inactivity (applies to this browser).
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[15, 30, 60, 120].map(min => (
                  <button key={min} onClick={() => setInactivityMin(min)}
                    className="clay-btn px-4 py-2.5 text-sm flex items-center gap-2"
                    style={inactivityMin === min
                      ? { background: 'rgba(0,37,112,0.12)', color: '#003087', border: '1.5px solid rgba(0,37,112,0.3)' }
                      : { color: 'var(--text)' }}>
                    {min < 60 ? `${min} min` : `${min / 60} hr${min > 60 ? 's' : ''}`}
                  </button>
                ))}
              </div>
            </div>
            </>)}

          </div>
        )}
      </div>

      {/* Archive confirmation modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,20,60,0.52)' }}
          onClick={e => e.target === e.currentTarget && setShowArchiveConfirm(false)}>
          <div className="clay-card-modal w-full p-7" style={{ maxWidth: 420 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(180,60,0,0.08)' }}>
                  <Archive size={15} color="#b03000" strokeWidth={2} />
                </div>
                <h2 className="text-base font-black" style={{ color: 'var(--text-strong)' }}>Confirm Archive</h2>
              </div>
              <button onClick={() => setShowArchiveConfirm(false)}
                className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/5">
                <X size={15} color="#7a8aaa" strokeWidth={2.5} />
              </button>
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text)' }}>
              This will <strong>deactivate</strong> all scholar accounts with no document submissions in the last{' '}
              <strong>{archiveDays} days</strong>. Deactivated accounts cannot log in until re-activated by an administrator.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowArchiveConfirm(false)} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="clay-btn flex-1 py-2.5 text-sm font-bold"
                style={{ background: '#b03000', color: '#fff', opacity: archiving ? 0.65 : 1, boxShadow: '4px 4px 0 rgba(0,0,0,0.15)' }}>
                {archiving ? 'Archiving…' : 'Yes, Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
