import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getMe } from '../api/auth';

const AuthContext = createContext(null);

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const inactivityTimer = useRef(null);

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
    }, INACTIVITY_MS);
  }, []);

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
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, refreshUser, sessionExpired, setSessionExpired }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
