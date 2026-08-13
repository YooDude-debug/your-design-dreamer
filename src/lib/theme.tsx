import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Zentrales Erscheinungsbild (Theme) der gesamten Plattform.
 *
 * Es gibt genau **ein** Theme-System: der Wert wird als `data-theme` auf
 * `<html>` gesetzt, alle Farben kommen aus den bestehenden CSS-Variablen in
 * `src/styles.css`. Damit übernehmen Feed, Globe, Arena, Profile, Menüs,
 * Dialoge und alle weiteren Bereiche automatisch dasselbe Theme.
 *
 * `aktuell` ist der Standard und entspricht exakt dem bisherigen Design –
 * dafür wird bewusst **kein** Attribut gesetzt, damit sich am bestehenden
 * Look nichts ändert.
 */
export const THEMES = ["aktuell", "dark", "white", "rainbow"] as const;
export type ThemeName = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeName = "aktuell";
export const THEME_STORAGE_KEY = "y-dude:theme";

/** Prüft einen unbekannten Wert gegen die erlaubten Themes. */
export function normalizeTheme(value: unknown): ThemeName {
  return THEMES.includes(value as ThemeName) ? (value as ThemeName) : DEFAULT_THEME;
}

/** Setzt das Theme am Dokument (ohne Reload, greift sofort überall). */
export function applyTheme(theme: ThemeName) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme === "white" ? "light" : "dark";
}

type ThemeCtx = {
  theme: ThemeName;
  /** Setzt das Theme lokal sofort (Persistenz im Profil erfolgt separat). */
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);

  // Zuletzt gewähltes Theme sofort nach dem Mounten anwenden (kein Flackern
  // bei Seitenwechseln, unabhängig von der Profil-Abfrage).
  useEffect(() => {
    try {
      const stored = normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
      setThemeState(stored);
      applyTheme(stored);
    } catch {
      applyTheme(DEFAULT_THEME);
    }
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    const value = normalizeTheme(next);
    setThemeState(value);
    applyTheme(value);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      /* Speicher nicht verfügbar – Theme bleibt für die Sitzung aktiv. */
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Zugriff auf das global gewählte Erscheinungsbild. */
export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
