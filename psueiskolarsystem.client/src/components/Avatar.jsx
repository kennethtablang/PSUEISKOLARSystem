import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCachedAvatar } from '../api/avatars';

/**
 * A user's profile photo, falling back to their initials when there is none.
 * `version` busts the cached blob after an upload or removal.
 */
export default function Avatar({
  userId,
  name,
  hasAvatar = false,
  size = 36,
  radius,
  version = 0,
  title,
  onClick,
  style = {},
}) {
  const { token } = useAuth();
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!hasAvatar || !userId || !token) return;

    let cancelled = false;
    // Resolves through a promise even on a cache hit, so state is never set during
    // the effect body — one microtask, no visible flash of initials.
    getCachedAvatar(userId, token, { bustCache: version > 0 })
      .then(url => { if (!cancelled && url) setSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId, token, hasAvatar, version]);

  const initials = (name ?? '')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const base = {
    width: size,
    height: size,
    borderRadius: radius ?? Math.round(size * 0.3),
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : undefined,
    ...style,
  };

  // Guarded on hasAvatar as well, so clearing a photo falls straight back to initials
  // without needing an extra state reset.
  if (hasAvatar && src) {
    return (
      <div title={title ?? name} onClick={onClick} style={base}>
        <img
          src={src}
          alt={name ? `${name}'s profile photo` : 'Profile photo'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  return (
    <div
      title={title ?? name}
      onClick={onClick}
      style={{
        ...base,
        background: 'linear-gradient(145deg, #ffd030, #e0a000)',
        color: '#1a0e00',
        fontWeight: 900,
        fontSize: Math.max(9, Math.round(size * 0.32)),
        letterSpacing: '-0.02em',
      }}
    >
      {initials}
    </div>
  );
}
