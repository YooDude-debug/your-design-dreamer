import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useLang, LANGS, type Lang } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t.langLabel}
        aria-expanded={open}
        className="text-brand-cyan hover:opacity-80 inline-flex items-center gap-1.5"
      >
        <Globe className="h-6 w-6" />
        <span className="text-xs font-semibold uppercase tracking-wider">{lang}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-border bg-surface-2 shadow-card overflow-hidden z-50">
          <div className="px-3 py-2 text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border">
            {t.langLabel}
          </div>
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code as Lang);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-brand/10 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <span className="text-base">{l.flag}</span>
                <span>{l.label}</span>
              </span>
              {lang === l.code && <Check className="h-4 w-4 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
