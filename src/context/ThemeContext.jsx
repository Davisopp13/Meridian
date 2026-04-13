import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({ theme: 'dark', setTheme: () => {} });

const THEME_STYLE_ID = 'meridian-theme-vars';

const THEME_CSS = `
[data-theme="dark"] {
  --dash-bg:        #0f1117;
  --dash-card:      rgba(255,255,255,0.05);
  --dash-border:    rgba(255,255,255,0.08);
  --dash-text-pri:  rgba(255,255,255,0.92);
  --dash-text-sec:  rgba(255,255,255,0.55);
  --dash-text-dim:  rgba(255,255,255,0.30);
}
[data-theme="light"] {
  --dash-bg:        #f1f5f9;
  --dash-card:      #ffffff;
  --dash-border:    rgba(0,0,0,0.08);
  --dash-text-pri:  #0f172a;
  --dash-text-sec:  #475569;
  --dash-text-dim:  #94a3b8;
}
`;

function injectThemeStyle() {
  if (document.getElementById(THEME_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = THEME_STYLE_ID;
  style.textContent = THEME_CSS;
  document.head.appendChild(style);
}

export function ThemeProvider({ initialTheme, children }) {
  const [theme, setTheme] = useState(initialTheme === 'light' ? 'light' : 'dark');

  useEffect(() => {
    injectThemeStyle();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
