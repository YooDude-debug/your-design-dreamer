import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { profileTexts } from "@/lib/i18n-profile";

/**
 * Karte/Modal mit der Liste der Nutzer, die einem Profil folgen.
 * Nutzt die bestehende `follows`-Tabelle und das Profilverzeichnis.
 */
export function FollowersDialog({
  userId,
  open,
  onClose,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useLang();
  const p = profileTexts[lang];
  const { profiles, ensureProfiles } = useData();
  const [ids, setIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setIds(null);
    void (async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", userId)
        .limit(200);
      if (!alive) return;
      const list = (data ?? []).map((row) => (row as { follower_id: string }).follower_id);
      setIds(list);
      if (list.length > 0) await ensureProfiles(list);
    })();
    return () => {
      alive = false;
    };
  }, [open, userId, ensureProfiles]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.statFollowers}
      className="fixed inset-0 z-[2000] grid place-items-center bg-background/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[75svh] w-full max-w-sm flex-col rounded-2xl border border-border bg-surface/95 p-4 shadow-glow"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-black tracking-tight">
            <Users className="h-4 w-4 text-brand" /> {p.statFollowers}
          </h2>
          <CloseButton onClick={onClose} label={t.close} />
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {ids === null ? (
            <p className="text-xs text-muted-foreground">{t.loading}</p>
          ) : ids.length === 0 ? (
            <p className="text-xs text-muted-foreground">{p.statFollowers}: 0</p>
          ) : (
            <ul className="space-y-2">
              {ids.map((id) => {
                const person = profiles[id];
                const name = person?.displayName ?? "…";
                return (
                  <li key={id}>
                    {person ? (
                      <Link
                        to="/profile/$username"
                        params={{ username: person.username }}
                        onClick={onClose}
                        className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2 hover:border-brand/60"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/40 bg-background text-sm font-black text-brand">
                          {person.avatarThumb || person.avatar ? (
                            <img
                              src={person.avatarThumb ?? person.avatar ?? ""}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            name.slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            @{person.username}
                          </span>
                        </span>
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
                        {name}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
