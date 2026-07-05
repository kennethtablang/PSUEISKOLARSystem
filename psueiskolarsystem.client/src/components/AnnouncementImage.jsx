import { useEffect, useState } from 'react';
import { getAnnouncementImage } from '../api/announcements';
import { useAuth } from '../context/AuthContext';

// Loads an announcement's auth-protected image as a blob and renders it.
export default function AnnouncementImage({ announcementId, className, style }) {
  const { token } = useAuth();
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    getAnnouncementImage(announcementId, token)
      .then(u => { if (cancelled) { URL.revokeObjectURL(u); } else { objectUrl = u; setUrl(u); } })
      .catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [announcementId, token]);

  if (!url) return null;
  return (
    <img
      src={url}
      alt="Announcement"
      className={className}
      style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 12, ...style }}
    />
  );
}
