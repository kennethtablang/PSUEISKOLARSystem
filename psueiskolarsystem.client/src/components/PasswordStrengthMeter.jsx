import { CheckCircle, XCircle } from 'lucide-react';

/** Scores a password against the 5 policy rules. Exported for form-level validation. */
export function getPasswordStrength(pw) {
  const checks = {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    digit:     /[0-9]/.test(pw),
    special:   /[^A-Za-z0-9]/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, passed, total: 5 };
}

const LEVELS = [
  { label: 'Very weak', color: '#dc2626' },
  { label: 'Weak',      color: '#e0533a' },
  { label: 'Fair',      color: '#e0a000' },
  { label: 'Good',      color: '#3b9a4a' },
  { label: 'Strong',    color: '#16a34a' },
];

const RULES = [
  { key: 'length',    label: 'At least 8 characters' },
  { key: 'uppercase', label: 'One uppercase letter (A–Z)' },
  { key: 'lowercase', label: 'One lowercase letter (a–z)' },
  { key: 'digit',     label: 'One number (0–9)' },
  { key: 'special',   label: 'One special character (!@#$…)' },
];

/**
 * Password strength meter: a segmented bar with a strength label, plus an
 * optional per-rule checklist. Renders nothing until the user starts typing.
 */
export default function PasswordStrengthMeter({ password, showRules = true }) {
  const { checks, passed } = getPasswordStrength(password);
  if (!password) return null;

  const level = LEVELS[Math.max(0, passed - 1)];

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 4, flex: 1, borderRadius: 999,
              background: i < passed ? level.color : 'rgba(120,138,170,0.25)',
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>
      <p className="text-xs mt-1 font-semibold" style={{ color: level.color }}>
        {level.label}
      </p>

      {showRules && (
        <div className="mt-2 space-y-1">
          {RULES.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              {checks[key]
                ? <CheckCircle size={12} color="#16a34a" strokeWidth={2.5} />
                : <XCircle size={12} color="#9aaabb" strokeWidth={2.5} />}
              <span style={{ color: checks[key] ? '#16a34a' : '#9aaabb' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
