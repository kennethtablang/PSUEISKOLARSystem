import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getMe } from '../api/auth';

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
  const [sessionExpired, setSessionExpired] = useState(false);
  const [inactivityMin, setInactivityMinState] = useState(readInactivityMin);
  const inactivityTimer = useRef(null);

  const setInactivityMin = useCallback((min) => {
    const val = Number.isFinite(min) && min > 0 ? min : DEFAULT_INACTIVITY_MIN;
    localStorage.setItem(INACTIVITY_KEY, String(val));
    setInactivityMinState(val);
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

  const resetTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setSessionExpired(true);
    }, inactivityMin * 60 * 1000);
  }, [inactivityMin]);

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
    setSessionExpired(false);
  }

  function signOut() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setSessionExpired(false);
  }

  async function refreshUser() {
    if (!token) return;
    try {
      const data = await getMe(token);
      setUser(data);
    } catch { /* session may have expired */ }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, refreshUser, sessionExpired, setSessionExpired, inactivityMin, setInactivityMin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
