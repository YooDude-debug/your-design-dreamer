import { useEffect, useRef } from "react";
import { Check, Palette } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { normalizeTheme, useTheme, type ThemeName } from "@/lib/theme";

/**
 * Einstellungen → Erscheinungsbild.
 *
 * Auswahl des einen, global gültigen Themes. Die Wahl wird sofort ohne Reload
 * angewendet (CSS-Variablen auf `<html>`) und dauerhaft im Profil gespeichert,
 * damit sie nach Reload und Logout/Login erhalten bleibt.
 */

type Preview = { bg: string; card: string; text: string; accent: string };

const OPTIONS: Record<ThemeName, { icon: string; label: string; hint: string; preview: Preview }> =
  {
    dark: {
      icon: "🌑",
      label: "DARK",
      hint: "Dunkel & weich, grüner Akzent",
      preview: {
        bg: "oklch(0.16 0.012 250)",
        card: "oklch(0.22 0.013 250)",
        text: "oklch(0.97 0.005 240)",
        accent: "oklch(0.82 0.24 150)",
      },
    },
    aktuell: {
      icon: "🎨",
      label: "AKTUELL",
      hint: "Standard – das bestehende Y-Dude-Design",
      preview: {
        bg: "#000000",
        card: "oklch(0.085 0 0)",
        text: "oklch(0.98 0.005 240)",
        accent: "oklch(0.82 0.24 150)",
      },
    },
    white: {
      icon: "☀️",
      label: "WHITE",
      hint: "Hell mit dunkler Schrift",
      preview: {
        bg: "oklch(0.995 0 0)",
        card: "oklch(0.955 0.003 250)",
        text: "oklch(0.19 0.01 250)",
        accent: "oklch(0.58 0.18 150)",
      },
    },
    rainbow: {
      icon: "🌈",
      label: "LGBTQ+ RAINBOW",
      hint: "Dunkel mit dezenten Regenbogen-Akzenten",
      preview: {
        bg: "oklch(0.12 0.02 285)",
        card: "oklch(0.195 0.028 285)",
        text: "oklch(0.98 0.004 240)",
        accent:
          "linear-gradient(90deg, oklch(0.68 0.22 25), oklch(0.78 0.17 75), oklch(0.84 0.2 140), oklch(0.72 0.16 230), oklch(0.7 0.2 320))",
      },
    },
  };

const ORDER: ThemeName[] = ["dark", "aktuell", "white", "rainbow"];

function ThemePreview({ preview }: { preview: Preview }) {
  return (
    <span
      aria-hidden
      className="grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border"
      style={{ background: preview.bg }}
    >
      <span className="flex w-full flex-col gap-1 px-1.5">
        <span className="h-1.5 w-full rounded-full" style={{ background: preview.accent }} />
        <span
          className="h-3 w-full rounded-[3px]"
          style={{ background: preview.card, border: "1px solid rgba(128,128,128,0.28)" }}
        />
        <span className="h-1 w-2/3 rounded-full opacity-80" style={{ background: preview.text }} />
      </span>
    </span>
  );
}

export function ThemeSection() {
  const { theme, setTheme } = useTheme();
  const { me, updateMyProfile } = useData();
  const synced = useRef(false);

  // Gespeicherte Wahl des Kontos übernehmen (Reload, Logout/Login, neues Gerät).
  useEffect(() => {
    if (synced.current || !me?.theme) return;
    synced.current = true;
    const stored = normalizeTheme(me.theme);
    if (stored !== theme) setTheme(stored);
  }, [me?.theme, theme, setTheme]);

  const choose = async (next: ThemeName) => {
    setTheme(next);
    if (!me) return;
    try {
      await updateMyProfile({ theme: next });
    } catch {
      toast.error("Theme konnte nicht gespeichert werden.");
    }
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
        <Palette className="h-4 w-4 text-brand" /> Erscheinungsbild
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Gilt überall: Feed, Slang Globe, Slang Arena, Profile, SlangBox, Menüs und Dialoge.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {ORDER.map((key) => {
          const o = OPTIONS[key];
          const active = theme === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => void choose(key)}
              aria-pressed={active}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                active ? "border-brand bg-brand/10" : "border-border hover:border-brand/60"
              }`}
            >
              <ThemePreview preview={o.preview} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <span aria-hidden>{o.icon}</span>
                  <span className="truncate">{o.label}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand" />}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {o.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
