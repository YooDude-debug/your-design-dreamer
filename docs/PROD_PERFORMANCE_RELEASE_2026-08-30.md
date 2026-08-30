# Y-Dude Production – Performance-Release (Paket 2026-08-29)

Ausgefuehrt: 2026-08-30, Paket `production-performance-2026-08-29`.
Umfang: ausschliesslich Code (Bloecke A–D). Keine Migration, keine RLS-/Grant-,
Storage-, Auth-, Payments- oder Secret-Aenderung.

## Phase 0 – Preflight
- Pruefsummen der sechs Production-Dateien: **6/6 identisch** mit
  `checksums/PRODUCTION_ORIGINAL.sha256`.
- Zieldateien: **6/6 identisch** mit `checksums/TARGET_FILES.sha256`.
- Rollback-Punkt: `/tmp/ydude-rollback-2026-08-29/` (zusaetzlich
  `rollback-production-original/` im Paket).
- Ausgangs-`bun run verify`: gruen (480 Unit, 26 DB-Integration, 10 E2E).

## Angewendete Bloecke
| Block | Dateien | Verify nach Block |
|-------|---------|-------------------|
| A – React-Query-Defaults + Preload 30 s | `src/router.tsx` | gruen |
| B – SSR-Cache `/post/$postId` (TTL 60 s, Marker-Gate, MAX_ENTRIES 200) | `src/lib/http-cache.server.ts`, `src/lib/public-post.functions.ts` | gruen |
| C – View-Batch (700 ms Sammelfenster, Einzel-Fallback) | `src/lib/data.tsx` | gruen |
| D – Translation-Batch (`translatePostsBatch`, 120 ms / max 20 IDs) | `src/lib/translate.functions.ts`, `src/lib/use-post-translation.ts` | gruen |

## Abweichungen vom Paket (dokumentiert, minimal)
1. `src/lib/data.tsx`: Union-Typ in Zeile ~202 verstiess gegen die
   Projekt-Prettier-Regel (`bun run lint` = Fehler). Rein formatierende
   Korrektur per `prettier --write`, keine Logikaenderung.
2. `src/lib/http-cache.server.ts`: Der interne Marker `x-ydude-public-post`
   wurde bei Anfragen mit `Cookie`/`Authorization` noch ausgeliefert
   (TEST_PLAN Block B, Punkt 2). Marker wird jetzt auf allen Pfaden entfernt.

## Verifikation (Phase E)
- `bun run verify` gruen: 480 Unit-, 26 DB-Integrations-, 10 E2E-Tests, Lint,
  Typecheck, Build (`build OK`).
- Header-Smoketest anonym auf `/post/<public-uuid>`:
  1. Aufruf `x-ydude-cache: miss`, 2. Aufruf `hit`,
  `cache-control: public, max-age=0, s-maxage=60, stale-while-revalidate=60`,
  `vary: Cookie, Authorization`.
- Nicht oeffentliche/unbekannte ID: kein Cacheeintrag, neutrale Seite.
- Anfrage mit `Cookie`/`Authorization`: kein Cache, kein Marker in der Antwort.

**Status: RELEASE ABGESCHLOSSEN – Bloecke A–D aktiv.**
