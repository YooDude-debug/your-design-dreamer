# Y-Dude — Stable Build — Pre Refactoring

Stand: 2026-08-08. Dieser Stand ist der letzte verifiziert funktionierende Zustand
unmittelbar vor der Refactoring-Phase.

Sicherungen (nicht verändern):

- Dateikopie: `.lovable/backup/stable-pre-refactoring/`
- Archiv: `Y-Dude_stable-pre-refactoring.tar.gz` (Download-Ordner)

## 1. Datenbank / Schema

- 65 Tabellen im Schema `public`, **alle mit aktivierter Row Level Security**.
- Policy-Abdeckung je Tabelle zum Backup-Zeitpunkt: siehe Übersicht unten
  (Ausschnitt der tragenden Tabellen).

| Tabelle                                                | Spalten     | Policies  |
| ------------------------------------------------------ | ----------- | --------- |
| posts                                                  | 23          | 4         |
| profiles                                               | 36          | 3         |
| slang_tags                                             | 55          | 5         |
| slang_tag_grants                                       | 6           | 3         |
| slang_tag_votes                                        | 5           | 6         |
| comments                                               | 7           | 3         |
| post_likes / post_saves / post_shares / post_views     | 3           | 3–4       |
| conversations / conversation_members / messages        | 7 / 5 / 12  | 3 / 4 / 5 |
| arena_challenges / arena_submissions / arena_votes     | 16 / 11 / 3 | 4 / 3 / 3 |
| notifications / notification_jobs                      | 11 / 9      | 4 / 0     |
| reports / user_bans / user_warnings                    | 13 / 8 / 6  | 5 / 5 / 4 |
| feed_signals / feed_score_cache / feed_learned_weights | 8 / 5 / 6   | 3 / 1 / 1 |
| interest\_\*                                           | –           | 1–2       |
| user_roles                                             | 4           | 1         |

Hinweis: `notification_jobs` hat RLS aktiv, aber keine Policies — Zugriff läuft
ausschließlich über Server-Code mit Service-Rolle (bewusster Zustand).

Rollenmodell: separate Tabelle `user_roles` plus Security-Definer-Funktion
`has_role`. Rollen liegen nicht auf `profiles`.

## 2. Konfiguration

- TanStack Start v1 + Vite 7, React 19, Tailwind v4 über `src/styles.css`.
- `vite.config.ts` erweitert die Vorgabe-Plugins, ohne sie zu duplizieren.
- `src/start.ts`: `functionMiddleware: [attachSupabaseAuth]`,
  `requestMiddleware: [errorMiddleware, csrfMiddleware]` (CSRF nur für ServerFns).
- Auth-Gate: `src/routes/_authenticated/route.tsx`.
- PWA: `public/push-sw.js`, Manifest/Icons, Splash über `AppSplash.tsx`.
- Turnstile in allen Auth-Formularen (`src/components/Turnstile.tsx`,
  `src/lib/turnstile.functions.ts`), dokumentiert in `docs/TURNSTILE.md`.
- E-Mail: `src/lib/email-templates/*`, Absendername „Y-Dude“.

## 3. SlangTag-Architektur

- SlangTags sind **owner-scoped Varianten**: `UNIQUE(owner_id, normalized_name)`.
- Freigaben über `slang_tag_grants` und `slang_tag_share_requests`;
  `community_shared` steuert die Sichtbarkeit für andere Nutzer.
- Typen: Hashtag `#` (rot), Community `$` (grün), Creator `$$` (blau) —
  Farbtokens in `src/lib/tag-colors.ts`.
- Platzierung relativ zum Bild in Prozent (`SlangTagCanvas.tsx`), inkl. Drag,
  Pinch-Scale und Rotation.
- Redaction/Mosaik: `src/lib/slangtag-redaction.ts`, `image-redaction.ts`.
- Moderation asynchron über `post_moderation_jobs` und
  `slang_tag_moderation_events`.

## 4. Navigation

- Hauptfeed `/dev`: horizontaler Swipe **nur aus dem mittleren Content-Bereich**
  (`useHorizontalNavSwipe`, Randzonen 18 % bzw. min. 48 px bleiben frei für
  System-Gesten). Links → `/arena`, rechts → `/globe`.
- `/arena` und `/globe`: seitliches Zieh-Handle (`NavDragHandle.tsx`) als Portal
  an `document.body`, dadurch viewport-fixiert und contentlängen-unabhängig.
  Das Handle zieht die ganze Seite (`[data-page-root]`) mit dem Finger, Snap
  zur Zielseite oder Spring-Back.
- Übergangsanimation über `setSlideDirection` / `useSlideInClass`.
- Bei offenem Overlay/Dialog werden Feed-Navigationsgesten deaktiviert.

## 5. Globe-Rotationsarchitektur

`src/lib/globe/globe-engine.ts`, strikt getrennte Zustände:

- `qUser` (Quaternion): User-Drag, Trägheit, FlyTo.
- `autoYaw` (Zahl) / `qAuto`: Auto-Rotation.
- Komposition pro Frame: `globe.quaternion = qUser * Ry(autoYaw)`.
- Drag über konstante, bildschirmfeste Achsen (`WORLD_Y`, `CAM_X`) via
  `premultiply` — Richtung ist unabhängig vom aktuellen Rotationszustand.
- Pitch-Begrenzung über die transformierte Polachse (`MAX_PITCH`).
- Auto-Rotation pausiert bei `pointerdown`, nimmt nach Inertia wieder auf.
- FlyTo per `slerp` mit Kompensation des aktuellen `autoYaw`.
- Zoom über Kameraabstand, LOD auf Natural-Earth-Daten.

## 6. Performance-relevante Einstellungen

- Bootstrap des Nutzerzustands über eine RPC (`bootstrap_user_state`).
- Serverseitiges Caching 60 s (`src/lib/server-cache.server.ts`),
  Client-Cache `src/lib/client-cache.ts`.
- Signierte Media-URLs mit langer Gültigkeit, Bildvarianten
  (`image` / `imageMedium`) in `src/lib/media.ts`.
- Nachbarbilder im Post-Viewer werden vorgeladen.
- Messenger und schwere Panels lazy geladen.
- Feed-Ranking in `src/lib/feed-ranking/` (Server-Engine + Client-Hook).
- `NavDragHandle` arbeitet während der Geste rein imperativ über DOM-Styles.
