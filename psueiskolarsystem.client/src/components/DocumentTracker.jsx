import { Check, X, Lock, RotateCcw } from 'lucide-react';

/* Where one submitted document stands, drawn as a short track:

     Submitted ─ Under Review ─ Verified
     Submitted ─ Under Review ─ Rejected ─ Need to resubmit

   A document whose deadline passed with nothing submitted shows as locked instead. */

const OK = 'var(--tone-ok-fg)';
const BAD = 'var(--tone-bad-fg)';
const NOW = 'var(--accent-strong)';
const TODO = 'var(--text-faint)';

function stepsFor(status, missed) {
  if (missed) return [{ label: 'Deadline missed', state: 'locked' }];
  switch (status) {
    case 'Pending':
      return [{ label: 'Submitted', state: 'done' }, { label: 'Under Review', state: 'todo' }, { label: 'Verified', state: 'todo' }];
    case 'UnderReview':
      return [{ label: 'Submitted', state: 'done' }, { label: 'Under Review', state: 'current' }, { label: 'Verified', state: 'todo' }];
    case 'Verified':
      return [{ label: 'Submitted', state: 'done' }, { label: 'Under Review', state: 'done' }, { label: 'Verified', state: 'done' }];
    case 'Rejected':
    case 'Incomplete':
      return [
        { label: 'Submitted', state: 'done' }, { label: 'Under Review', state: 'done' },
        { label: 'Rejected', state: 'failed' }, { label: 'Need to resubmit', state: 'current' },
      ];
    default:
      return [{ label: 'Not submitted', state: 'current' }, { label: 'Submitted', state: 'todo' }, { label: 'Under Review', state: 'todo' }, { label: 'Verified', state: 'todo' }];
  }
}

function Dot({ state }) {
  const size = 22;
  const base = { width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
  if (state === 'done') return <span style={{ ...base, background: OK }}><Check size={13} color="#fff" strokeWidth={3} /></span>;
  if (state === 'failed') return <span style={{ ...base, background: BAD }}><X size={13} color="#fff" strokeWidth={3} /></span>;
  if (state === 'locked') return <span style={{ ...base, background: BAD }}><Lock size={12} color="#fff" strokeWidth={2.6} /></span>;
  if (state === 'current') return (
    <span style={{ ...base, border: `2.5px solid ${NOW}`, background: 'var(--surface)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: NOW }} />
    </span>
  );
  return <span style={{ ...base, border: `2px solid ${TODO}`, background: 'var(--surface)' }} />;
}

/**
 * @param {string|null} status   the document's status, or null when nothing was submitted
 * @param {boolean}     missed   the deadline passed with nothing submitted (upload locked)
 * @param {boolean}     compact  smaller labels, for dense lists
 * @param {object}      dates    optional { [step label]: ISO date } shown under each reached step
 */
export default function DocumentTracker({ status, missed = false, compact = false, dates }) {
  const steps = stepsFor(status, missed);
  const resubmit = status === 'Rejected' || status === 'Incomplete';
  return (
    <ol className="flex items-start w-full" aria-label="Document progress">
      {steps.map((s, i) => {
        const color = s.state === 'done' ? OK : s.state === 'failed' || s.state === 'locked' ? BAD : s.state === 'current' ? NOW : TODO;
        return (
          <li key={s.label} className="flex items-start" style={{ flex: i < steps.length - 1 ? 1 : '0 0 auto' }}
            aria-current={s.state === 'current' ? 'step' : undefined}>
            <div className="flex flex-col items-center" style={{ minWidth: compact ? 64 : 84 }}>
              <Dot state={s.state} />
              <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-bold mt-1 text-center leading-tight flex items-center gap-0.5`}
                style={{ color: s.state === 'todo' ? 'var(--text-muted)' : color }}>
                {resubmit && s.label === 'Need to resubmit' && <RotateCcw size={10} strokeWidth={2.6} />}
                {s.label}
              </span>
              {dates?.[s.label] && (
                <span className="text-[10px] mt-0.5 text-center leading-tight" style={{ color: 'var(--text-muted)' }}>
                  {new Date(dates[s.label]).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="flex-1 mt-[10px] mx-1" style={{
                height: 3, borderRadius: 2,
                background: steps[i + 1].state === 'todo' ? 'var(--hairline-strong)'
                  : s.state === 'failed' || steps[i + 1].state === 'failed' ? BAD : OK,
              }} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
