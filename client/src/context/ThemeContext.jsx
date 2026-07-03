import { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Always light mode, but keeping the provider to avoid breaking consumers
  const darkMode = false;
  const toggleTheme = () => {};

  useEffect(() => {
    // Ensure dark class is removed from document root
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('envirocheck-theme');
  }, []);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
