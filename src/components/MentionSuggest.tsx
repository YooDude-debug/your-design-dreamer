/**
 * Autovervollständigung für @Erwähnungen sowie die Darstellung von Mentions
 * im Text. Bewusst eigenständig gehalten – unabhängig von SlangTags.
 */
import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { AtSign } from "lucide-react";
import {
  MENTION_GLOBAL,
  cachedMention,
  resolveMentions,
  searchMentions,
  type MentionProfile,
} from "@/lib/mentions";

/** Popup unter dem Eingabefeld mit passenden Benutzernamen. */
export function MentionPopover({
  anchor,
  query,
  onSelect,
}: {
  anchor: HTMLElement | null;
  query: string;
  onSelect: (profile: MentionProfile) => void;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const [results, setResults] = useState<MentionProfile[]>([]);

  useLayoutEffect(() => {
    if (!anchor || typeof window === "undefined") return;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(Math.max(r.width, 220), vw - 16);
      const openUp = vh - r.bottom < 220 && r.top > vh - r.bottom;
      let left = r.left;
      if (left + width > vw - 8) left = vw - 8 - width;
      if (left < 8) left = 8;
      setStyle({
        position: "fixed",
        left: Math.round(left),
        width: Math.round(width),
        zIndex: 9999,
        ...(openUp ? { bottom: Math.round(vh - r.top + 6) } : { top: Math.round(r.bottom + 6) }),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void searchMentions(query).then((list) => {
        if (active) setResults(list);
      });
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  if (typeof document === "undefined" || !style || results.length === 0) return null;

  return createPortal(
    <div
      style={style}
      data-mention-popover=""
      className="max-h-64 overflow-y-auto rounded-xl border border-brand/40 bg-[#000] p-1 shadow-glow"
    >
      {results.map((p) => (
        <button
          key={p.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(p)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-brand/10"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/50 text-brand">
            <AtSign className="h-3 w-3" />
          </span>
          <span className="truncate font-semibold text-brand">@{p.username}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

/**
 * Ersetzt `@username` im Text durch einen Link auf das Profil – aber nur,
 * wenn das Profil wirklich existiert. Unbekannte Handles bleiben Text.
 */
export function MentionText({ text }: { text: string }) {
  const parts = text.split(MENTION_GLOBAL);
  const handles = parts.filter((p) => p.startsWith("@")).map((p) => p.slice(1).toLowerCase());
  const [, bump] = useState(0);

  useEffect(() => {
    if (!handles.length) return;
    if (handles.every((h) => cachedMention(h) !== undefined)) return;
    void resolveMentions(handles).then(() => bump((n) => n + 1));
    // Nur die konkreten Handles sind relevant.
  }, [handles.join(",")]);

  return (
    <>
      {parts.map((part, i) => {
        if (!part.startsWith("@")) return <span key={i}>{part}</span>;
        const profile = cachedMention(part.slice(1));
        if (!profile) return <span key={i}>{part}</span>;
        return (
          <Link
            key={i}
            to="/profile/$username"
            params={{ username: profile.username }}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-brand hover:underline"
          >
            @{profile.username}
          </Link>
        );
      })}
    </>
  );
}
