import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { getSystemSettings, saveSystemSettings } from '../api/systemSettings';
import { Save, RotateCcw, TriangleAlert } from 'lucide-react';

/**
 * System-wide policy, split across the Settings tabs but backed by one record.
 *
 * All fifteen settings live in a single row, so the panel holds one draft and one save no
 * matter which tab you're looking at. A change on the Submissions tab and a change on the
 * Access tab are saved together — which is also why the save bar follows you between tabs
 * while the draft is dirty, rather than stranding an unsaved edit on a tab you've left.
 */

const SECTIONS = {
  submissions: [
    {
      key: 'maxUploadMb', type: 'number', label: 'Maximum upload size',
      unit: 'MB', min: 1, max: 100,
      hint: 'Refused above this size, before the file is written to disk.',
    },
    {
      key: 'allowedFileExtensions', type: 'text', label: 'Allowed file types',
      placeholder: 'pdf,jpg,png',
      hint: 'Comma-separated. The server also checks the file’s actual content, so renaming an .exe to .pdf still fails.',
    },
    {
      key: 'allowLateSubmissions', type: 'bool', label: 'Accept late submissions',
      hint: 'On: a scholar can still upload after the deadline and it is marked late. Off: the upload is refused.',
    },
    {
      key: 'allowReplaceVerified', type: 'bool', label: 'Allow replacing a verified document',
      hint: 'Off protects a coordinator’s decision — once verified, only staff can swap the file.',
    },
    {
      key: 'requireProfileBeforeSubmission', type: 'bool', label: 'Require a complete profile first',
      hint: 'Scholars must set their student ID, program, and scholarship before submitting anything. Turning this off lets documents arrive that belong to no checklist.',
    },
  ],
  access: [
    {
      key: 'autoApproveScholars', type: 'bool', label: 'Auto-approve new scholars',
      hint: 'On: self-registered scholars skip the approval queue entirely. Only sensible if applicants are vetted somewhere else.',
    },
    {
      key: 'requireEmailVerification', type: 'bool', label: 'Require email verification',
      hint: 'Scholars must click the link in their inbox before they can sign in.',
    },
    {
      key: 'maxFailedLoginAttempts', type: 'number', label: 'Failed sign-ins before lockout',
      unit: 'attempts', min: 3, max: 20,
      hint: 'Below three and ordinary typos start locking people out.',
    },
    {
      key: 'lockoutMinutes', type: 'number', label: 'Lockout duration',
      unit: 'minutes', min: 1, max: 1440,
      hint: 'How long a locked account stays locked.',
    },
    {
      key: 'sessionTimeoutMinutes', type: 'number', label: 'Default session timeout',
      unit: 'minutes', min: 5, max: 480,
      hint: 'Signed out after this much inactivity. Each user may shorten it for their own browser under Preferences.',
    },
    {
      key: 'maintenanceMode', type: 'bool', label: 'Maintenance mode', danger: true,
      hint: 'Blocks sign-in for everyone except administrators. You will stay signed in — nobody else can get on.',
    },
    {
      key: 'maintenanceMessage', type: 'textarea', label: 'Maintenance message',
      dependsOn: 'maintenanceMode',
      hint: 'Shown on the sign-in page while maintenance mode is on.',
    },
  ],
  notifications: [
    {
      key: 'emailEnabled', type: 'bool', label: 'Send outbound email',
      hint: 'Off stops every email at the door — verification, reminders, announcements — while in-app notifications keep working. The switch to reach for when SMTP is misbehaving.',
    },
    {
      key: 'deadlineReminderDays', type: 'number', label: 'Deadline reminder lead time',
      unit: 'days', min: 1, max: 30,
      hint: 'How far ahead of a due date scholars who have not submitted are reminded.',
    },
    {
      key: 'notificationRetentionDays', type: 'number', label: 'Delete read notifications after',
      unit: 'days', min: 0, max: 3650,
      hint: 'Unread notifications are never deleted, however old. Set to 0 to keep everything.',
    },
  ],
  scholarships: [
    {
      key: 'defaultMinimumGwa', type: 'decimal', label: 'Default minimum GWA',
      min: 1, max: 5, step: 0.01,
      hint: 'Pre-filled when a new scholarship type is created. Each type still keeps its own value.',
    },
  ],
};

export default function SystemPolicyPanel({ section }) {
  const { token } = useAuth();
  const toast = useToast();

  const [saved, setSaved] = useState(null);   // last known server state
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getSystemSettings(token)
      .then(s => { if (!cancelled) { setSaved(s); setDraft(s); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="clay-card p-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading system settings…</p>
      </div>
    );
  }
  if (error && !draft) {
    return (
      <div className="clay-card p-6">
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const fields = SECTIONS[section] ?? [];

  function set(key, value) { setDraft(d => ({ ...d, [key]: value })); }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const result = await saveSystemSettings(draft, token);
      setSaved(result);
      setDraft(result);
      toast('System settings saved — the new policy is live now.', 'success');
    } catch (e) {
      setError(e.message);
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="clay-card p-6">
        <div className="space-y-1">
          {fields.map((f, i) => {
            // A dependent field is meaningless until its parent is on — hidden rather than
            // disabled, so the panel doesn't fill with dead controls.
            if (f.dependsOn && !draft[f.dependsOn]) return null;
            return <SettingRow key={f.key} field={f} value={draft[f.key]} onChange={v => set(f.key, v)} first={i === 0} />;
          })}
        </div>

        {error && (
          <p className="text-sm mt-4 flex items-start gap-1.5" style={{ color: 'var(--danger)' }}>
            <TriangleAlert size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        {saved?.updatedAt && !dirty && (
          <p className="text-xs mt-4" style={{ color: 'var(--text-faint)' }}>
            Last saved {new Date(saved.updatedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
            {saved.updatedByName ? ` by ${saved.updatedByName}` : ''}.
          </p>
        )}
      </div>

      {/* One record, one save — so the bar follows you across tabs while anything is unsaved. */}
      {dirty && (
        <div
          className="clay-card px-4 py-3 flex items-center gap-3 flex-wrap"
          style={{
            position: 'sticky',
            bottom: 16,
            zIndex: 20,
            borderLeft: '4px solid #f5b800',
          }}
        >
          <span className="text-sm font-bold" style={{ color: 'var(--text-strong)' }}>
            Unsaved changes
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            These apply to every user as soon as you save.
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => { setDraft(saved); setError(''); }}
              disabled={saving}
              className="clay-btn clay-btn-ghost px-4 py-2 text-sm flex items-center gap-1.5"
            >
              <RotateCcw size={14} strokeWidth={2.4} /> Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="clay-btn clay-btn-primary px-4 py-2 text-sm flex items-center gap-1.5"
            >
              <Save size={14} strokeWidth={2.4} /> {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SettingRow({ field, value, onChange, first }) {
  const { type, label, hint, unit, min, max, step, placeholder, danger } = field;

  return (
    <div
      className="flex items-start justify-between gap-4 gap-y-2 py-3.5 flex-wrap"
      style={{ borderTop: first ? undefined : '1px solid var(--hairline)' }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--text-strong)' }}>
          {label}
          {danger && value === true && (
            <span className="clay-badge text-xs" style={{ background: '#ffe4d1', color: '#8a3d00' }}>Active</span>
          )}
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      </div>

      <div className="shrink-0" style={{ width: type === 'bool' ? 'auto' : 170 }}>
        {type === 'bool' && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={e => onChange(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: danger ? 'var(--danger)' : 'var(--accent)' }}
            />
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
              {value ? 'On' : 'Off'}
            </span>
          </label>
        )}

        {(type === 'number' || type === 'decimal') && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={min}
              max={max}
              step={step ?? 1}
              value={value ?? ''}
              onChange={e => onChange(type === 'decimal' ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
              className="clay-input text-sm"
              style={{ height: 38, minHeight: 38, textAlign: 'right' }}
            />
            {unit && <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
          </div>
        )}

        {type === 'text' && (
          <input
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="clay-input text-sm"
            style={{ height: 38, minHeight: 38 }}
          />
        )}
      </div>

      {/* A textarea needs the full width, so it drops below its own label rather than
          squeezing into the 170px control column. */}
      {type === 'textarea' && (
        <div style={{ flexBasis: '100%' }}>
          <textarea
            rows={2}
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            className="clay-input text-sm"
            maxLength={300}
          />
        </div>
      )}
    </div>
  );
}
