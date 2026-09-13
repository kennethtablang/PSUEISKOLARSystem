import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import AnnouncementImage from './AnnouncementImage';
import { ANNOUNCEMENT_INTENTS } from '../api/announcements';
import { useNow, daysUntil } from '../hooks/useNow';

/**
 * Shared announcement card used across the app.
 *
 *  variant="feed"   – read-only feed (dashboard): intent renders as a CTA button,
 *                     expiry shows an urgency countdown when close.
 *  variant="manage" – management list (announcements page): full target badges,
 *                     intent shown as a label, plus Edit/Delete controls on hover.
 */
export default function AnnouncementCard({ a, variant = 'feed', onEdit, onDelete, onPublishNow }) {
  const date = new Date(a.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const intent = a.intentAction ? ANNOUNCEMENT_INTENTS[a.intentAction] : null;

  // Only managers ever see a scheduled announcement — its audience gets it at publish time.
  const scheduledFor = a.isScheduled
    ? new Date(a.publishAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  // Hourly is ample for a day countdown, and it means a dashboard left open overnight
  // stops claiming an announcement expires "in 3 days" the morning after it expired.
  const now = useNow(60 * 60 * 1000);
  const daysLeft = a.expiresAt ? daysUntil(a.expiresAt, now) : null;
  const isUrgent = variant === 'feed' && daysLeft !== null && daysLeft <= 7;

  const targets = [a.targetRole, a.targetScholarshipType, a.targetProgram].filter(Boolean);

  return (
    <div
      className={`clay-card p-5${variant === 'manage' ? ' group relative' : ''}`}
      style={
        scheduledFor ? { border: '1.5px dashed var(--accent-soft-border)' }
        : isUrgent ? { border: '1.5px solid #f0a860' }
        : undefined
      }
    >
      {scheduledFor && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="clay-badge text-xs inline-flex items-center gap-1"
            style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1px solid var(--accent-soft-border)' }}>
            <Clock size={10} strokeWidth={2.6} /> Scheduled
          </span>
          <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
            Goes out {scheduledFor} — not yet visible to its audience.
          </span>
        </div>
      )}

      {a.hasImage && <AnnouncementImage announcementId={a.id} style={{ marginBottom: 12 }} />}

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: 'var(--text-strong)' }}>{a.title}</p>
          <p className="text-sm mt-1 leading-relaxed whitespace-pre-line" style={{ color: 'var(--text)' }}>{a.content}</p>

          {intent && variant === 'feed' && (
            <Link to={intent.to} className="inline-flex items-center gap-1.5 mt-3 clay-btn clay-btn-primary px-3.5 py-2 text-xs font-bold">
              {intent.label}
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          )}
          {intent && variant === 'manage' && (
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-xl font-medium"
              style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>
              Action: {intent.label}
            </span>
          )}
        </div>

        {a.expiresAt && (
          isUrgent ? (
            <span className="clay-badge shrink-0 text-xs" style={{ background: '#ffe4d1', color: '#8a3d00', border: '1.5px solid #f0a860' }}>
              {daysLeft <= 0 ? 'Deadline today' : daysLeft === 1 ? 'Deadline tomorrow' : `Deadline in ${daysLeft} days`}
            </span>
          ) : (
            <span className="clay-badge shrink-0 text-xs" style={{ background: '#fff3cd', color: '#7d5a00', border: '1.5px solid #f0d060' }}>
              Expires {new Date(a.expiresAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </span>
          )
        )}
      </div>

      {variant === 'feed' ? (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date} · {a.createdBy}</span>
          {a.targetRole && <span className="clay-badge text-xs badge-coord">{a.targetRole}</span>}
        </div>
      ) : (
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date} · {a.createdBy}</span>
            {/* Named scholars are the whole audience, so they replace the filter badges. */}
            {a.recipientCount > 0 ? (
              <span
                className="clay-badge text-xs"
                title={(a.recipientNames ?? []).join(', ')}
                style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}
              >
                {a.recipientCount} specific scholar{a.recipientCount !== 1 ? 's' : ''}
              </span>
            ) : targets.length > 0 ? (
              targets.map(t => (
                <span key={t} className="clay-badge text-xs" style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1px solid var(--accent-soft-border)' }}>
                  {t}
                </span>
              ))
            ) : (
              <span className="clay-badge text-xs" style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid rgba(0,0,0,0.08)' }}>
                All users
              </span>
            )}
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {scheduledFor && onPublishNow && (
              <button onClick={onPublishNow} className="text-xs font-medium hover:underline" style={{ color: '#1a6b3c' }}>
                Publish now
              </button>
            )}
            <button onClick={onEdit} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>Edit</button>
            <button onClick={onDelete} className="text-xs font-medium hover:underline" style={{ color: 'var(--danger)' }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}
