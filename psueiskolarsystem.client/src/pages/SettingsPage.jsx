import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getActiveSemester, setActiveSemester } from '../api/settings';
import { useTitle } from '../hooks/useTitle';
import { CalendarDays, CheckCircle } from 'lucide-react';

function yearOptions() {
  const y = new Date().getFullYear();
  const opts = [];
  for (let i = y - 3; i <= y + 2; i++) opts.push(`${i}-${i + 1}`);
  return opts;
}

export default function SettingsPage() {
  useTitle('System Settings');
  const { token } = useAuth();

  const [current, setCurrent] = useState(null);
  const [form, setForm]       = useState({ academicYear: '', semester: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [saved, setSaved]     = useState(false);

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
                      <p style={{ fontSize: 22, fontWeight: 900, color: '#0d1a33', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
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
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0d1a33', marginBottom: 20 }}>
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
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#4a5a7a' }}>
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
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: '#4a5a7a' }}>
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
                              background: '#e8edf5',
                              color: '#4a5a7a',
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

          </div>
        )}
      </div>
    </Layout>
  );
}
