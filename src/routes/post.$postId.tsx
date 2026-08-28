import { TagRow } from "@/components/TagRow";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Heart, ImageOff, Lock, MapPin, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { getPublicPost } from "@/lib/public-post.functions";
import { ShareSheet } from "@/components/ShareSheet";
import { postShareUrl, shareTitle } from "@/lib/share";
import { Share2 } from "lucide-react";

export const Route = createFileRoute("/post/$postId")({
  loader: async ({ params }) => ({
    post: await getPublicPost({ data: { postId: params.postId } }),
  }),
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) {
      return {
        meta: [
          { title: "Beitrag nicht verfügbar — Y-Dude" },
          {
            name: "description",
            content: "Dieser Y-Dude Beitrag ist privat oder nicht mehr verfügbar.",
          },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${shareTitle(post.title, post.description)} — Y-Dude`;
    const description =
      (post.description || post.title || "Beitrag mit SlangTags auf Y-Dude").slice(0, 155) || "";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(post.image
          ? [
              { property: "og:image", content: post.image },
              { name: "twitter:image", content: post.image },
            ]
          : []),
      ],
    };
  },
  component: PublicPostPage,
});

function PublicPostPage() {
  const { post } = Route.useLoaderData();
  const { postId } = Route.useParams();
  const navigate = useNavigate();
  const [share, setShare] = useState(false);
  /** null = Sitzung wird noch geprüft, true = angemeldet, false = Gast */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  // Angemeldete Nutzer sehen den Beitrag direkt im internen Bereich – dort
  // funktionieren SlangTags, Audio, Likes und Kommentare wie im Feed. Es gibt
  // keine Weiterleitung zur Anmeldung, wenn bereits eine Sitzung besteht.
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setSignedIn(true);
        void navigate({ to: "/p/$postId", params: { postId }, replace: true });
      } else {
        setSignedIn(false);
      }
    });
    return () => {
      active = false;
    };
  }, [navigate, postId]);

  if (signedIn) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <p className="text-sm text-muted-foreground">Beitrag wird geöffnet…</p>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full border border-border bg-background text-brand">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-black text-foreground">Beitrag nicht verfügbar</h1>
        <p className="text-sm text-muted-foreground">
          Dieser Beitrag ist privat oder nur für ausgewählte Personen sichtbar. Private Inhalte
          können auf Y-Dude nicht geteilt werden.
        </p>
        <Link
          to="/"
          className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Zur Startseite
        </Link>
      </main>
    );
  }

  const payload = {
    url: postShareUrl(post.id),
    title: shareTitle(post.title, post.description),
    author: post.authorName,
    image: post.image,
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <article className="overflow-hidden rounded-2xl border border-border bg-background shadow-glow">
        <header className="flex items-center gap-3 border-b border-border/60 p-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-cyan to-brand" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              {post.authorName}
              {post.authorVerified && <BadgeCheck className="h-4 w-4 text-brand-cyan" />}
            </p>
            <p className="text-[11px] text-muted-foreground">@{post.authorUsername}</p>
          </div>
          <button
            type="button"
            onClick={() => setShare(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand"
          >
            <Share2 className="h-3.5 w-3.5" /> Teilen
          </button>
        </header>

        {post.image ? (
          <img src={post.image} alt={post.title} className="w-full object-cover" />
        ) : (
          <div className="grid aspect-video place-items-center bg-background/60 text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}

        <div className="p-4">
          {/* Eine Caption: H1 bleibt fuer SEO, aber nie derselbe Text zweimal. */}
          {isRedundantTitle(post.title, post.description) ? (
            <h1 className="text-lg font-black leading-tight text-foreground">
              {post.description}
            </h1>
          ) : (
            <>
              <h1 className="text-lg font-black leading-tight text-foreground">{post.title}</h1>
              {post.description && (
                <p className="mt-1.5 text-sm text-muted-foreground">{post.description}</p>
              )}
            </>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5" /> {post.likes}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> {post.comments}
            </span>
            {post.region && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {post.region}
              </span>
            )}
          </div>
          <TagRow hashtags={post.hashtags} className="mt-2" />
        </div>
      </article>

      <section className="mt-4 rounded-2xl border border-border bg-background p-5 text-center">
        <h2 className="text-base font-bold text-foreground">Mehr davon auf Y-Dude</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Melde dich an oder registriere dich kostenlos, um Beiträge zu liken, zu kommentieren und
          eigene SlangTags zu erstellen.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/auth"
            className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Anmelden
          </Link>
          <Link
            to="/auth"
            className="rounded-full border border-border px-5 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand"
          >
            Kostenlos registrieren
          </Link>
        </div>
      </section>

      {share && <ShareSheet payload={payload} onClose={() => setShare(false)} />}
    </main>
  );
}
