import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Modal from './Modal';
import AnnouncementCard from './AnnouncementCard';
import { useAuth } from '../context/AuthContext';
import { getAnnouncements } from '../api/announcements';
import { NOTIFICATION_CATEGORIES, announcementIdOf } from '../constants/notifications';

const isAnnouncementNotification = n =>
  n?.category === NOTIFICATION_CATEGORIES.Announcement || announcementIdOf(n) != null;

/**
 * Opens a notification in full. The bell shows each one cut down to a preview; this is where
 * it is read. An announcement notification shows the announcement itself — the whole text and
 * its image — which matters most to grantees, who have no announcements page to go to.
 */
export default function NotificationDetailModal({ notification: n, onClose }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState(undefined);   // undefined = loading
  const wantsAnnouncement = isAnnouncementNotification(n);

  useEffect(() => {
    if (!wantsAnnouncement) return undefined;
    let cancelled = false;
    const id = announcementIdOf(n);
    getAnnouncements(token)
      .then(list => {
        if (cancelled) return;
        // Older notifications carry no id; the title is the next best thing.
        setAnnouncement(list.find(a => a.id === id) ?? list.find(a => a.title === n.title) ?? null);
      })
      .catch(() => { if (!cancelled) setAnnouncement(null); });
    return () => { cancelled = true; };
  }, [token, n, wantsAnnouncement]);

  // A link worth following: somewhere other than the dashboard the announcement lives on.
  const link = n.linkUrl && !announcementIdOf(n) && n.linkUrl !== '/dashboard' ? n.linkUrl : null;
  const when = new Date(n.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Modal title={announcement?.title ?? n.title} subtitle={when} onClose={onClose} width={600}>
      {wantsAnnouncement && announcement === undefined && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading the announcement…</p>
      )}
      {wantsAnnouncement && announcement ? (
        <AnnouncementCard a={announcement} />
      ) : (!wantsAnnouncement || announcement === null) && (
        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text)' }}>{n.message}</p>
      )}
      <div className="flex gap-3 pt-5">
        <button onClick={onClose} className="clay-btn clay-btn-ghost flex-1 py-2.5 text-sm">Close</button>
        {link && (
          <button onClick={() => { onClose(); navigate(link); }}
            className="clay-btn clay-btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
            Open <ArrowRight size={14} />
          </button>
        )}
      </div>
    </Modal>
  );
}
