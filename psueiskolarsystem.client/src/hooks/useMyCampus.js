import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCampuses } from '../api/campuses';

/**
 * The campus a coordinator is in charge of, as { id, name } — null for everyone else (the
 * administrator oversees every campus) and while it loads. The server lists only a
 * coordinator's own campus to them, so this is simply the one campus they are offered.
 */
export function useMyCampus() {
  const { token, user } = useAuth();
  const campusId = user?.role === 'ScholarshipCoordinator' ? user?.campusId : null;
  const [campus, setCampus] = useState(null);

  useEffect(() => {
    if (campusId == null) return undefined;
    let cancelled = false;
    getCampuses(token)
      .then(list => { if (!cancelled) setCampus(list.find(c => c.id === campusId) ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token, campusId]);

  return campusId == null ? null : campus;
}
