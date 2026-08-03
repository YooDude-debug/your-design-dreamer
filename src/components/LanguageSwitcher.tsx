import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Globe, Check } from "lucide-react";
import { type Lang } from "@/lib/i18n";
import { useLang } from "@/lib/lang-context";
import { LANGS } from "@/lib/i18n-dict";

const MENU_W = 176; // w-44
const GAP = 8;

export function LanguageSwitcher() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuH = menuRef.current?.offsetHeight ?? 240;

    let left = r.right - MENU_W;
    left = Math.min(Math.max(GAP, left), Math.max(GAP, vw - MENU_W - GAP));

    const below = vh - r.bottom - GAP;
    const above = r.top - GAP;
    const openUp = below < Math.min(menuH, 240) && above > below;
    const maxHeight = Math.max(120, (openUp ? above : below) - GAP);
    const top = openUp ? Math.max(GAP, r.top - GAP - Math.min(menuH, maxHeight)) : r.bottom + GAP;

    setPos({ top, left, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        maxHeight: pos?.maxHeight,
      }}
      className="w-44 overflow-y-auto rounded-xl border border-border bg-surface-2 shadow-card z-[200]"
    >
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
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        aria-label={t.langLabel}
        aria-expanded={open}
        className="text-brand-cyan hover:opacity-80 inline-flex items-center gap-1.5"
      >
        <Globe className="h-6 w-6" />
        <span className="text-xs font-semibold uppercase tracking-wider">{lang}</span>
      </button>
      {open && typeof document !== "undefined" && createPortal(menu, document.body)}
    </div>
  );
}
