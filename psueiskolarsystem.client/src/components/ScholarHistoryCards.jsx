import { Link } from 'react-router-dom';
import { BanknoteArrowUp, CalendarClock, Lock, Wallet } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { peso } from '../constants/grants';

/*
 * A scholar's money and missed deadlines: scholarship releases, one-time grants, and the
 * requirements locked after their deadline passed. Staff see them on the scholar's profile;
 * the scholar sees them on their own dashboard, so My Profile holds only their information.
 */

/* ── Recurring scholarship payouts, one row per academic period ──
   Read-only here: recording and releasing are done from the Releases page, which has the
   period pickers and the batch generator. This card exists so the scholar can see the money
   they were notified about, and so staff see it beside the one-time grants. */
/* Requirements whose deadline passed with nothing submitted. Uploading is locked for that
   period, so the scholar sees here what they missed instead of a silent gap in the checklist. */
export function MissedDeadlinesCard({ missed, isAdminOrCoord }) {
  return (
    <div className="clay-card p-5 mb-6" style={{ border: '1.5px solid var(--danger-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Lock size={15} style={{ color: 'var(--danger)' }} />
        <h2 className="font-black text-sm" style={{ color: 'var(--text-strong)' }}>Missed Deadlines</h2>
        <span className="status-badge tone-bad ml-auto">{missed.length} locked</span>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        {isAdminOrCoord
          ? 'Nothing was submitted before these deadlines, so the scholar can no longer upload them. You can still file a document for them from Document Review.'
          : 'Nothing was submitted before these deadlines, so uploading is locked for them. Contact the scholarship office about any of these.'}
      </p>
      <ul className="space-y-2">
        {missed.map(m => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--danger-bg)' }}>
            <span className="font-semibold" style={{ color: 'var(--danger)' }}>{m.requirementName}</span>
            <span className="text-xs shrink-0" style={{ color: 'var(--danger)' }}>
              {m.academicYear} · Sem {m.semester} · due {new Date(m.dueDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScholarshipReleasesCard({ releases, isAdminOrCoord }) {
  const released = releases.filter(r => r.status === 'Released');
  const totalReleased = released.reduce((sum, r) => sum + r.amount, 0);
  const pending = releases.filter(r => r.status === 'Pending');
  const pendingTotal = pending.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="clay-card p-6 mb-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Scholarship Releases
        </h2>
        {isAdminOrCoord && (
          <Link to="/scholarship-releases" className="text-xs font-medium hover:underline flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            <Wallet size={12} strokeWidth={2.8} /> Manage releases
          </Link>
        )}
      </div>

      {releases.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No scholarship releases recorded yet. These are the per-semester or per-year payouts
          for the scholarship above.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <MiniStat label="Released" value={peso(totalReleased)} color="#0a5a3a" />
            <MiniStat label="Pending" value={peso(pendingTotal)} color="#7d5a00" />
            <MiniStat label="Periods" value={String(releases.length)} />
          </div>
          <ul className="space-y-2">
            {releases.map(r => (
              <li key={r.id} className="clay-card-inner px-3.5 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>
                      {r.scholarshipTypeName}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {r.periodLabel}
                      {r.yearLevel ? ` · Year ${r.yearLevel}` : ''}
                      {r.campusName ? ` · ${r.campusName}` : ''}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      {r.releasedAt
                        ? `Received ${new Date(r.releasedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : r.scheduledDate
                          ? `Scheduled for ${new Date(String(r.scheduledDate).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : 'Not yet released'}
                      {r.referenceNo ? ` · ref ${r.referenceNo}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <span className="font-mono font-bold text-sm" style={{ color: 'var(--text-strong)' }}>{peso(r.amount)}</span>
                    <StatusBadge status={r.status} />
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

/* ── One-off financial awards on top of the scholarship ── */
export function OneTimeGrantsCard({ grants, isAdminOrCoord, onRelease }) {
  const items = grants?.items ?? [];

  return (
    <div className="clay-card p-6 mb-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          One-Time Grants
        </h2>
        {/* No "record grant" here: a scholar on a grant type's cross-matching list gets the
            grant on their profile automatically, so there is nothing to key in by hand. */}
        {isAdminOrCoord && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Added automatically from each grant type’s cross-matching list
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
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
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {[g.source, g.purpose].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      Awarded {new Date(g.awardedOn).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {g.releaseStatus === 'Released' && g.releasedAt &&
                        ` · Received ${new Date(g.releasedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      {g.referenceNo ? ` · ref ${g.referenceNo}` : ''}
                    </p>
                    {g.releaseStatus === 'Pending' && g.scheduledReleaseDate && (
                      <p className="text-xs mt-0.5 font-semibold flex items-center gap-1" style={{ color: 'var(--tone-warn-fg)' }}>
                        <CalendarClock size={11} strokeWidth={2.6} />
                        Release scheduled {new Date(String(g.scheduledReleaseDate).slice(0, 10) + 'T00:00:00')
                          .toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <span className="font-mono font-bold text-sm" style={{ color: 'var(--text-strong)' }}>{peso(g.amount)}</span>
                    <StatusBadge status={g.releaseStatus} />
                    {isAdminOrCoord && g.releaseStatus === 'Pending' && (
                      <button
                        onClick={() => onRelease(g)}
                        className="text-xs font-bold hover:underline flex items-center gap-1"
                        style={{ color: 'var(--tone-ok-fg)' }}
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
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-black font-mono mt-0.5" style={{ color: color ?? 'var(--text-strong)' }}>{value}</p>
    </div>
  );
}
