import { lazy, Suspense } from "react";

/**
 * Code-Splitting für die Toast-Ausgabe (sonner).
 *
 * `sonner` gehört zu den größten Abhängigkeiten im Start-Bundle, wird aber
 * erst gebraucht, sobald die erste Meldung erscheint. Die Komponente wird
 * daher nach der Hydration als eigener Chunk nachgeladen; sie rendert nichts
 * Sichtbares, also entsteht kein Layout-Sprung.
 */
const ToasterImpl = lazy(() =>
  import("sonner").then((m) => ({ default: m.Toaster })),
);

export function LazyToaster() {
  return (
    <Suspense fallback={null}>
      <ToasterImpl position="top-center" theme="dark" richColors />
    </Suspense>
  );
}
