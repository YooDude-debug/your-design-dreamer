import { lazy, Suspense } from "react";

/**
 * Code-Splitting für den Beitrags-Composer.
 *
 * Der Composer (inkl. SlangTag-Eingabe, Audio-Recorder, Canvas) ist der
 * größte Baustein der Feed-Seite, wird aber erst benötigt, wenn tatsächlich
 * ein Beitrag erstellt wird. Er wird daher als eigener Chunk nachgeladen.
 * Der Platzhalter hat dieselbe Grundhöhe, damit kein Layout-Sprung entsteht.
 */
const PostComposerImpl = lazy(() =>
  import("@/components/CreatePostDialog").then((m) => ({ default: m.PostComposer })),
);

function ComposerSkeleton() {
  return (
    <div
      aria-hidden
      className="min-h-[220px] animate-pulse rounded-2xl border border-border bg-surface/60"
    />
  );
}

export function LazyPostComposer(props: {
  onDone?: () => void;
  collapsible?: boolean;
  forceOpen?: boolean;
}) {
  return (
    <Suspense fallback={<ComposerSkeleton />}>
      <PostComposerImpl {...props} />
    </Suspense>
  );
}
