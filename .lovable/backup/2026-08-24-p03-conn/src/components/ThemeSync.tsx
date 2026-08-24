import { useEffect, useRef } from "react";
import { useData } from "@/lib/data-context";
import { normalizeTheme, useTheme } from "@/lib/theme";

/**
 * Übernimmt das im Konto gespeicherte Erscheinungsbild, sobald das eigene
 * Profil geladen ist. Dadurch bleibt die Wahl nach Reload, Seitenwechsel und
 * Logout/Login – auch auf einem neuen Gerät – erhalten. Rendert nichts.
 */
export function ThemeSync() {
  const { me } = useData();
  const { theme, setTheme } = useTheme();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!me?.theme) return;
    const stored = normalizeTheme(me.theme);
    if (applied.current === stored) return;
    applied.current = stored;
    if (stored !== theme) setTheme(stored);
  }, [me?.theme, theme, setTheme]);

  return null;
}
