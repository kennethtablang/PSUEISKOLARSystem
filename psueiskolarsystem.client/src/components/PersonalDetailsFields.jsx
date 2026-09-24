import { useId } from 'react';
import { Check } from 'lucide-react';
import {
  SEX_OPTIONS, CIVIL_STATUS_OPTIONS, EDUCATION_OPTIONS, SUPPORT_SOURCE_OPTIONS, PERSONAL_FLAGS,
  INSTITUTIONAL_DOMAIN, ageFrom,
} from '../constants/personal';

/* The Scholar's Data sheet as form controls, shared by sign-up and the staff edit modals so
   the two can never ask different questions. Per the office's sheet: two-option questions are
   checkboxes, three-or-more are dropdowns, money and counts accept digits only, and names are
   upper-case as they are typed. */

const LABEL = 'block text-xs font-bold mb-1.5 uppercase tracking-wider';

export function SectionTitle({ children }) {
  return (
    <p className="text-[11px] font-black uppercase tracking-widest pt-2" style={{ color: 'var(--accent-strong)' }}>
      {children}
    </p>
  );
}

/**
 * Two mutually exclusive options drawn as checkboxes. `value` is the selected option's value;
 * clicking the selected one again leaves it selected (the question still has an answer).
 */
export function ChoiceChecks({ label, options, value, onChange, required, disabled }) {
  const id = useId();
  return (
    <fieldset>
      <legend id={id} className={LABEL} style={{ color: 'var(--text)' }}>
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={id}>
        {options.map(opt => {
          const checked = value === opt.value;
          return (
            <label key={String(opt.value)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer select-none"
              style={{
                background: checked ? 'rgba(0,48,135,0.08)' : 'var(--surface-inset)',
                border: `1.5px solid ${checked ? 'var(--accent-strong)' : 'transparent'}`,
                color: 'var(--text-strong)',
                opacity: disabled ? 0.6 : 1,
              }}>
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(opt.value)}
              />
              <span className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                style={{
                  background: checked ? 'var(--accent-strong)' : 'var(--input-bg)',
                  border: `1.5px solid ${checked ? 'var(--accent-strong)' : 'var(--text-faint)'}`,
                }}>
                {checked && <Check size={11} color="#fff" strokeWidth={3.5} />}
              </span>
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const YES_NO = [{ value: true, label: 'Yes' }, { value: false, label: 'No' }];

/** Digits-only text input; `prefix` renders a fixed adornment (₱, +63). */
export function NumericInput({ value, onChange, prefix, maxLength = 9, placeholder, id, required, allowDecimal = false }) {
  const clean = raw => {
    let v = raw.replace(allowDecimal ? /[^\d.]/g : /\D/g, '');
    if (allowDecimal) {
      const [a, ...rest] = v.split('.');
      v = rest.length ? `${a}.${rest.join('').slice(0, 2)}` : a;
    }
    return v.slice(0, maxLength);
  };
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none"
          style={{ color: 'var(--text-muted)' }}>{prefix}</span>
      )}
      <input
        id={id}
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        required={required}
        value={value ?? ''}
        onChange={e => onChange(clean(e.target.value))}
        placeholder={placeholder}
        className="clay-input"
        style={prefix ? { paddingLeft: prefix.length > 1 ? '48px' : '30px' } : undefined}
      />
    </div>
  );
}

/** PH mobile number with the +63 fixed in front; `value` is the 10 local digits (9XXXXXXXXX). */
export function ContactInput({ value, onChange, id, required }) {
  return (
    <NumericInput id={id} value={value} onChange={onChange} prefix="+63" maxLength={10}
      placeholder="9XX XXX XXXX" required={required} />
  );
}

/** Institutional email: the student types the part before the @, the domain is fixed. */
export function InstitutionalEmailInput({ value, onChange, id, required }) {
  return (
    <div className="flex items-stretch">
      <input
        id={id}
        type="text"
        required={required}
        value={value}
        onChange={e => onChange(e.target.value.replace(/[@\s]/g, '').toLowerCase())}
        placeholder="23ln0001_ms"
        className="clay-input"
        style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
        autoComplete="off"
      />
      <span className="flex items-center px-3 text-sm font-bold shrink-0 rounded-r-2xl"
        style={{ background: 'var(--surface-inset)', color: 'var(--text-muted)', border: '1.5px solid var(--surface-inset)' }}>
        @{INSTITUTIONAL_DOMAIN}
      </span>
    </div>
  );
}

/** A name field that is upper-cased as it is typed. */
export function UpperInput({ value, onChange, ...rest }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value.toUpperCase())}
      className="clay-input"
      style={{ textTransform: 'uppercase' }}
      {...rest}
    />
  );
}

function Select({ id, value, onChange, options, placeholder, required }) {
  return (
    <select id={id} value={value ?? ''} onChange={e => onChange(e.target.value)} className="clay-input" required={required}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Labelled({ label, children, required, htmlFor, hint }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={LABEL} style={{ color: 'var(--text)' }}>
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  );
}

/** Birth date with the age filled in next to it automatically. */
export function BirthDateAge({ value, onChange, required }) {
  const id = useId();
  const age = ageFrom(value);
  return (
    <div className="grid grid-cols-[1fr_88px] gap-3">
      <Labelled label="Birthdate" required={required} htmlFor={id}>
        <input id={id} type="date" value={value} required={required}
          max={new Date().toISOString().slice(0, 10)}
          onChange={e => onChange(e.target.value)} className="clay-input" />
      </Labelled>
      <Labelled label="Age">
        <input type="text" value={age ?? ''} readOnly tabIndex={-1} placeholder="—"
          className="clay-input" style={{ background: 'var(--surface-inset)', cursor: 'default' }}
          aria-label="Age, calculated from the birthdate" />
      </Labelled>
    </div>
  );
}

/** Sex, civil status and the six Yes/No questions (the personal half of the sheet). */
export function PersonalQuestions({ value, onChange, required = false }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const csId = useId();
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <ChoiceChecks label="Sex" required={required}
          options={SEX_OPTIONS.map(s => ({ value: s, label: s }))}
          value={value.sex} onChange={v => set('sex', v)} />
        <Labelled label="Civil Status" required={required} htmlFor={csId}>
          <Select id={csId} value={value.civilStatus} onChange={v => set('civilStatus', v)}
            options={CIVIL_STATUS_OPTIONS} placeholder="— Select —" required={required} />
        </Labelled>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
        {PERSONAL_FLAGS.map(f => (
          <ChoiceChecks key={f.key} label={f.label} options={YES_NO}
            value={value[f.key]} onChange={v => set(f.key, v)} />
        ))}
      </div>
    </div>
  );
}

function ParentBlock({ who, prefix, value, onChange }) {
  const set = (k, v) => onChange({ ...value, [prefix + k]: v });
  const nameId = useId(), eduId = useId(), occId = useId(), incId = useId();
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface-inset)' }}>
      <p className="text-xs font-black" style={{ color: 'var(--text-strong)' }}>{who}</p>
      <Labelled label={`${who}'s Name`} htmlFor={nameId}>
        <UpperInput id={nameId} value={value[prefix + 'Name']} onChange={v => set('Name', v)}
          placeholder="LAST NAME, FIRST NAME MIDDLE NAME" maxLength={150} />
      </Labelled>
      <ChoiceChecks label="Living" options={YES_NO} value={value[prefix + 'Living']} onChange={v => set('Living', v)} />
      <div className="grid sm:grid-cols-2 gap-3">
        <Labelled label="Highest Educational Attainment" htmlFor={eduId}>
          <Select id={eduId} value={value[prefix + 'Education']} onChange={v => set('Education', v)}
            options={EDUCATION_OPTIONS} placeholder="— Select —" />
        </Labelled>
        <Labelled label="Occupation" htmlFor={occId}>
          <input id={occId} type="text" maxLength={100} value={value[prefix + 'Occupation']}
            onChange={e => set('Occupation', e.target.value)} className="clay-input" placeholder="e.g. Farmer" />
        </Labelled>
      </div>
      <Labelled label="Estimated Monthly Income" htmlFor={incId}>
        <NumericInput id={incId} prefix="₱" allowDecimal maxLength={10}
          value={value[prefix + 'MonthlyIncome']} onChange={v => set('MonthlyIncome', v)} placeholder="0" />
      </Labelled>
    </div>
  );
}

/** The family half of the sheet. */
export function FamilyQuestions({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const famId = useId(), sibId = useId(), stId = useId(), srcId = useId();
  return (
    <div className="space-y-4">
      <ParentBlock who="Father" prefix="father" value={value} onChange={onChange} />
      <ParentBlock who="Mother" prefix="mother" value={value} onChange={onChange} />
      <div className="grid grid-cols-3 gap-3">
        <Labelled label="Family Members" htmlFor={famId}>
          <NumericInput id={famId} maxLength={2} value={value.familyMembers} onChange={v => set('familyMembers', v)} placeholder="0" />
        </Labelled>
        <Labelled label="Siblings" htmlFor={sibId}>
          <NumericInput id={sibId} maxLength={2} value={value.siblings} onChange={v => set('siblings', v)} placeholder="0" />
        </Labelled>
        <Labelled label="Siblings Studying" htmlFor={stId}>
          <NumericInput id={stId} maxLength={2} value={value.siblingsStudying} onChange={v => set('siblingsStudying', v)} placeholder="0" />
        </Labelled>
      </div>
      <Labelled label="Main Source of Educational Support" htmlFor={srcId}>
        <Select id={srcId} value={value.mainSupportSource} onChange={v => set('mainSupportSource', v)}
          options={SUPPORT_SOURCE_OPTIONS} placeholder="— Select —" />
      </Labelled>
    </div>
  );
}

/* ── Read-only view ─────────────────────────────────────────── */

const peso = v => (v == null || v === '' ? '—' : `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
const yn = v => (v == null ? '—' : v ? 'Yes' : 'No');

function Row({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-semibold mt-0.5 break-words" style={{ color: 'var(--text-strong)' }}>{value ?? '—'}</p>
    </div>
  );
}

/** The Scholar's Data sheet, read back — for profile pages and the staff profile view. */
export function PersonalDetailsView({ personal, birthDate }) {
  const p = personal || {};
  const age = ageFrom(birthDate);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Row label="Sex" value={p.sex || '—'} />
        <Row label="Age" value={age ?? '—'} />
        <Row label="Civil Status" value={p.civilStatus || '—'} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PERSONAL_FLAGS.map(f => (
          <span key={f.key} className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={p[f.key]
              ? { background: 'var(--tone-ok-bg)', color: 'var(--tone-ok-fg)' }
              : { background: 'var(--surface-inset)', color: 'var(--text-faint)' }}>
            {p[f.key] ? '✓ ' : ''}{f.label}
          </span>
        ))}
      </div>
      {[['Father', 'father'], ['Mother', 'mother']].map(([who, k]) => (
        <div key={k} className="rounded-2xl p-4" style={{ background: 'var(--surface-inset)' }}>
          <p className="text-xs font-black mb-3" style={{ color: 'var(--text-strong)' }}>{who}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Row label="Name" value={p[k + 'Name'] || '—'} />
            <Row label="Living" value={yn(p[k + 'Living'])} />
            <Row label="Education" value={p[k + 'Education'] || '—'} />
            <Row label="Occupation" value={p[k + 'Occupation'] || '—'} />
            <Row label="Monthly Income" value={peso(p[k + 'MonthlyIncome'])} />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Row label="Family Members" value={p.familyMembers ?? '—'} />
        <Row label="Siblings" value={p.siblings ?? '—'} />
        <Row label="Siblings Studying" value={p.siblingsStudying ?? '—'} />
        <Row label="Main Support" value={p.mainSupportSource || '—'} />
      </div>
    </div>
  );
}
