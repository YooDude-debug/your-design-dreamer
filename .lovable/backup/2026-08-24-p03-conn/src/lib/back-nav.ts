import type { AnyRouter } from "@tanstack/react-router";

/**
 * Einheitliche Zurück-Logik: Wenn es einen App-internen Verlauf gibt, folgt der
 * sichtbare Zurück-Pfeil exakt dem Browser-Back. Nur ohne Verlauf (Direkteinstieg,
 * Reload) wird auf das übergeordnete Ziel zurückgefallen.
 */
export function goBackOr(router: AnyRouter, fallback: string) {
  const history = router.history;
  if (typeof history.canGoBack === "function" ? history.canGoBack() : false) {
    history.back();
    return;
  }
  void router.navigate({ to: fallback });
}
