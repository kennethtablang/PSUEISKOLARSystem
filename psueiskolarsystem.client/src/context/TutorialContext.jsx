import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import Tutorial from '../components/Tutorial';

const TutorialContext = createContext(null);

export function TutorialProvider({ children }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const seenKey = user ? `tutorial-seen-${user.id}` : null;

  // Auto-show once for a first-time user (per account, on this device).
  useEffect(() => {
    if (user && seenKey && !localStorage.getItem(seenKey)) setOpen(true);
  }, [user, seenKey]);

  const openTutorial = useCallback(() => setOpen(true), []);
  const closeTutorial = useCallback(() => {
    if (seenKey) localStorage.setItem(seenKey, '1');
    setOpen(false);
  }, [seenKey]);

  return (
    <TutorialContext.Provider value={{ openTutorial }}>
      {children}
      {open && user && (
        <Tutorial role={user.role} userName={user.fullName} onClose={closeTutorial} />
      )}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  return useContext(TutorialContext);
}
