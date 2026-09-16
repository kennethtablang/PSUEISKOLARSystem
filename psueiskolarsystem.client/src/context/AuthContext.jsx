import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getMe } from '../api/auth';
import { getPublicSettings } from '../api/systemSettings';
import { setUnauthorizedHandler } from '../api/_client';

const AuthContext = createContext(null);

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];
const INACTIVITY_KEY = 'inactivityTimeoutMin';
const DEFAULT_INACTIVITY_MIN = 30;

function readInactivityMin() {
  const raw = parseInt(localStorage.getItem(INACTIVITY_KEY), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INACTIVITY_MIN;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  // Null while the session is live; otherwise why it ended — 'inactivity' (this tab's timer
  // fired) or 'expired' (the server rejected the token). The modal says different things.
  const [sessionExpired, setSessionExpired] = useState(null);
  const [inactivityMin, setInactivityMinState] = useState(readInactivityMin);
  const inactivityTimer = useRef(null);

  const setInactivityMin = useCallback((min) => {
    const val = Number.isFinite(min) && min > 0 ? min : DEFAULT_INACTIVITY_MIN;
    localStorage.setItem(INACTIVITY_KEY, String(val));
    setInactivityMinState(val);
  }, []);

  // The institution sets a default timeout in System Settings. It only applies to users who
  // have not chosen their own on this browser — a personal choice, once made, wins.
  useEffect(() => {
    if (localStorage.getItem(INACTIVITY_KEY)) return;
    let cancelled = false;
    getPublicSettings()
      .then(s => {
        if (!cancelled && Number.isFinite(s?.sessionTimeoutMinutes) && s.sessionTimeoutMinutes > 0) {
          setInactivityMinState(s.sessionTimeoutMinutes);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getMe(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const endSession = useCallback((reason) => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setSessionExpired(reason);
  }, []);

  /* The JWT expires after JwtSettings:ExpiryMinutes, which is independent of — and usually
     shorter than — the inactivity timeout above. Without this the token could die while the
     tab still looked signed in, and every subsequent call would fail with a generic toast.
     apiFetch calls us on any 401 that carried a token. */
  useEffect(() => {
    setUnauthorizedHandler(failedToken => {
      if (failedToken && failedToken !== localStorage.getItem('token')) return;
      endSession('expired');
    });
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  const resetTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => endSession('inactivity'), inactivityMin * 60 * 1000);
  }, [inactivityMin, endSession]);

  // Start/clear the inactivity timer based on auth state
  useEffect(() => {
    if (!token) {
      clearTimeout(inactivityTimer.current);
      return;
    }
    resetTimer();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    return () => {
      clearTimeout(inactivityTimer.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [token, resetTimer]);

  function signIn(authResponse) {
    localStorage.setItem('token', authResponse.token);
    setToken(authResponse.token);
    setUser(authResponse.user);
    setSessionExpired(null);
  }

  function signOut() {
    endSession(null);
  }

  /* Swap in a token the server re-issued for this same session (after a password or 2FA
     change rotated the account's security stamp). Unlike signIn it leaves the Session
     Expired state alone and is a no-op for a response without a token. */
  function renewSession(authResponse) {
    if (!authResponse?.token) return;
    localStorage.setItem('token', authResponse.token);
    setToken(authResponse.token);
    if (authResponse.user) setUser(authResponse.user);
  }

  async function refreshUser() {
    if (!token) return;
    try {
      const data = await getMe(token);
      setUser(data);
    } catch { /* session may have expired */ }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, renewSession, refreshUser, sessionExpired, setSessionExpired, inactivityMin, setInactivityMin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
