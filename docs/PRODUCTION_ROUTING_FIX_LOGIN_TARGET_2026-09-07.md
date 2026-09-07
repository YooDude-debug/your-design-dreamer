# Production Routing Fix – Login-Ziel /dev → /feed (2026-09-07)

## Ursache (belegt)
Der angemeldete Startbereich (Live-Feed) war die Routendatei
`src/routes/_authenticated/dev.tsx` und damit unter der URL `/dev` erreichbar –
ein historischer Entwicklungsname, der zur echten App-Startseite wurde.
Es gab keinen fehlerhaften Redirect: `useRedirectWhenSignedIn` (Default `/dev`),
`routeAfterLogin()` in `src/routes/auth.tsx` und ca. 25 weitere Stellen
(Back-Buttons, Push-Links, Share-Target, Swipe-Navigation) zeigten korrekt auf
diese Route – die Route selbst hieß falsch.
Nicht ursächlich: Supabase `redirectTo`, Auth-Gate `_authenticated/route.tsx`,
Environment-Variablen (kein `/dev` vorhanden), PWA/SPA-Deep-Links.
Das Verhalten war unabhängig vom Session-Zustand immer identisch.

## Änderung
- `src/routes/_authenticated/dev.tsx` → `src/routes/_authenticated/feed.tsx`,
  Route-ID `/_authenticated/feed` (URL `/feed`), Titel/OG „Feed — Y-Dude“,
  `robots: noindex` unverändert.
- Alle `/dev`-Verweise in `src/` und `tests/` auf `/feed` umgestellt
  (u. a. `use-session.ts` Default, `auth.tsx` `routeAfterLogin`, `admin.tsx`,
  `share-target.ts`, `push-shared.ts`, `push.server.ts`, `feedback.server.ts`,
  `social.tsx`, Back-Buttons, `NavTarget`).
- Neue Kompatibilitätsroute `src/routes/_authenticated/dev.tsx`: `beforeLoad`
  leitet `/dev` inkl. Query-String und Hash per `replace` auf `/feed` (alte
  Push-Links `?chat=…`, Lesezeichen).
- Keine neuen Features, keine DB-/RLS-/Policy-/Grant-Änderung.

## Verifikation
- Typecheck PASS, Build OK, 616/616 Tests PASS.
- Browser-Test (390px), angemeldet: `/auth`→`/feed`, `/`→`/feed`, `/dev`→`/feed`,
  `/dev?chat=abc`→`/feed` (Chat-Parameter wird verarbeitet), `/feed`→`/feed`,
  `/market`→`/market`, Refresh bleibt auf `/market`.
- Browser-Test abgemeldet: `/`→`/` (öffentliche Startseite), `/feed`, `/dev`,
  `/market` → `/auth`.
- `/dev` ist damit kein automatisches Login-Ziel mehr, sondern nur noch
  Weiterleitung für Altlinks.

## Offen
Live-Wirkung auf https://y-dude.com erst nach Veröffentlichung.
