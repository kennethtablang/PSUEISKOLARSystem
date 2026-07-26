import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

function effectiveTheme(theme) {
  return theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'system');
  // The concrete light/dark in force. CSS reads it off `data-theme`; charts need it
  // in JS because their mark colours are per-mode values, not a filter on one set.
  const [resolved, setResolved] = useState(() => effectiveTheme(localStorage.getItem('theme') || 'system'));

  useEffect(() => {
    const apply = () => {
      const eff = effectiveTheme(theme);
      document.documentElement.setAttribute('data-theme', eff);
      setResolved(eff);
    };
    apply();
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  const setTheme = useCallback((t) => {
    localStorage.setItem('theme', t);
    setThemeState(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
