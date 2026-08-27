import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { useData } from "@/lib/data-context";
import { PostDetailOverlay } from "@/components/PostDetailOverlay";

/**
 * Geteilter Beitrag für angemeldete Nutzer.
 * Nutzt denselben Datenkontext wie der Feed – damit funktionieren SlangTags,
 * Audio, Likes und Kommentare identisch. Die Sichtbarkeit (öffentlich /
 * ich folge / privat) wird serverseitig über die Datenbankregeln erzwungen:
 * Beiträge, die der Nutzer nicht sehen darf, sind im Kontext nicht enthalten.
 */
export const Route = createFileRoute("/_authenticated/p/$postId")({
  head: () => ({
    meta: [
      { title: "Beitrag — Y-Dude" },
      { name: "description", content: "Geteilter Y-Dude Beitrag mit SlangTags." },
      { property: "og:title", content: "Beitrag — Y-Dude" },
      { property: "og:description", content: "Geteilter Y-Dude Beitrag mit SlangTags." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedPostPage,
});

function SharedPostPage() {
  const { postId } = useParams({ from: "/_authenticated/p/$postId" });
  const navigate = useNavigate();
  const { posts, loading } = useData();
  const [closed, setClosed] = useState(false);

  const single = useMemo(() => posts.filter((p) => p.id === postId), [posts, postId]);

  if (closed) {
    void navigate({ to: "/dev", replace: true });
    return null;
  }

  if (single.length === 0) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        {loading ? (
          <p className="text-sm text-muted-foreground">Beitrag wird geladen…</p>
        ) : (
          <>
            <span className="grid h-14 w-14 place-items-center rounded-full border border-border bg-surface/70 text-brand">
              <Lock className="h-6 w-6" />
            </span>
            <h1 className="text-xl font-black text-foreground">Beitrag nicht verfügbar</h1>
            <p className="text-sm text-muted-foreground">
              Dieser Beitrag ist privat oder nur für ausgewählte Personen sichtbar.
            </p>
            <Link
              to="/dev"
              className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Zum Feed
            </Link>
          </>
        )}
      </main>
    );
  }

  return (
    <PostDetailOverlay
      posts={single}
      index={0}
      onIndexChange={() => undefined}
      onClose={() => setClosed(true)}
    />
  );
}
