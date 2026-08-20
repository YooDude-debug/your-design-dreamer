/**
 * Channel folgen / entfolgen.
 *
 * Nutzt ausschliesslich die bestehende Relation `channel_follows` (Server
 * Function `setChannelFollow`, RLS: nur die eigene Zeile). Der Zustand wird
 * sofort nach dem Klick umgeschaltet (optimistisch) und danach ueber die
 * betroffenen Query-Keys aufgefrischt.
 *
 * Wichtig: Folgen ist unabhaengig von der Channel-Verwaltung. Ein Owner
 * verliert durch „Entfolgen“ weder seinen Channel noch seine Rechte.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { setChannelFollow } from "@/lib/channels.functions";
import { useLang } from "@/lib/lang-context";
import { channelTexts } from "@/lib/i18n-channels";

type Props = {
  channelId: string;
  following: boolean;
  size?: "sm" | "md";
  className?: string;
};

export function ChannelFollowButton({ channelId, following, size = "sm", className = "" }: Props) {
  const { lang } = useLang();
  const c = channelTexts[lang];
  const qc = useQueryClient();
  const toggle = useServerFn(setChannelFollow);
  // Optimistischer lokaler Zustand: der Button reagiert unmittelbar.
  const [local, setLocal] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const isFollowing = local ?? following;

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !isFollowing;
    setLocal(next);
    setBusy(true);
    try {
      await toggle({ data: { channelId, follow: next } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["followed-channels"] }),
        qc.invalidateQueries({ queryKey: ["followed-channel-ids"] }),
        qc.invalidateQueries({ queryKey: ["channel", channelId] }),
        qc.invalidateQueries({ queryKey: ["channel-search"] }),
      ]);
      toast.success(next ? c.followed : c.unfollowed);
    } catch {
      setLocal(!next);
      toast.error(c.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  const pad = size === "md" ? "px-3.5 py-2 text-sm" : "px-2.5 py-1.5 text-xs";
  const icon = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={isFollowing}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition-colors disabled:opacity-60 ${pad} ${
        isFollowing
          ? "border-brand/60 bg-brand/10 text-brand"
          : "border-border bg-background text-foreground hover:border-brand/60 hover:text-brand"
      } ${className}`}
    >
      {busy ? (
        <Loader2 className={`${icon} animate-spin`} />
      ) : isFollowing ? (
        <Check className={icon} />
      ) : (
        <Plus className={icon} />
      )}
      {isFollowing ? c.followingLabel : c.follow}
    </button>
  );
}
