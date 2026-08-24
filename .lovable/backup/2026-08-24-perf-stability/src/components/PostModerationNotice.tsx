/**
 * Dezente Statusanzeige der KI-Prüfung am eigenen Beitrag.
 *
 * Die Veröffentlichung wartet nie auf die Prüfung: der Beitrag ist sofort im
 * Feed. Diese Anzeige informiert den Eigentümer über den gespeicherten Stand
 * (`posts.moderation_status`) und verschwindet automatisch, sobald der Beitrag
 * freigegeben ist. Sie fügt sich als schmale Zeile in das bestehende
 * Beitrags-Design ein – ohne Popups und ohne Unterbrechung des Nutzerflusses.
 */
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import type { Post, PostModerationStatus } from "@/lib/types";

/** Prüfstand eines Beitrags (fehlende Angabe = noch nicht geprüft). */
export function postStatus(post: Post): PostModerationStatus {
  return post.moderationStatus ?? "pending";
}

/** Eigener Beitrag, der noch nicht freigegeben ist → dezent dargestellt. */
export function isPostUnderReview(post: Post, ownUserId?: string | null): boolean {
  return !!ownUserId && post.userId === ownUserId && postStatus(post) !== "approved";
}

export function PostModerationNotice({
  post,
  ownUserId,
  showEditAction = true,
}: {
  post: Post;
  ownUserId?: string | null;
  /** Auf der eigenen Beitragsseite gibt es die Bearbeiten-Aktion schon. */
  showEditAction?: boolean;
}) {
  const { t } = useLang();
  if (!isPostUnderReview(post, ownUserId)) return null;
  const status = postStatus(post);

  if (status === "pending") {
    return (
      <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-70" />
        <span className="animate-pulse">{t.postStatusChecking}</span>
      </div>
    );
  }

  if (status === "review") {
    return (
      <div className="mx-3 mt-2 rounded-lg border border-border/70 bg-background/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="font-semibold">{t.postStatusInProgress}</span>
        </div>
        <p className="mt-0.5 pl-[22px] opacity-80">{t.postStatusManual}</p>
        <p className="pl-[22px] opacity-60">{t.postStatusNoAction}</p>
      </div>
    );
  }

  // "blocked" – der Beitrag bleibt erhalten, der Nutzer kann ihn korrigieren.
  return (
    <div className="mx-3 mt-2 rounded-lg border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="font-semibold">{t.postStatusActionNeeded}</span>
      </div>
      {post.moderationReason ? (
        <p className="mt-0.5 pl-[22px] opacity-80">{post.moderationReason}</p>
      ) : (
        <p className="mt-0.5 pl-[22px] opacity-80">{t.modBlocked}</p>
      )}
      {showEditAction && (
        <Link
          to="/posts"
          className="mt-1 ml-[22px] inline-block font-semibold text-brand hover:underline"
        >
          {t.postStatusEdit}
        </Link>
      )}
    </div>
  );
}
