# PRODUCTION BUGFIX – LONG POSTS (2026-08-30)

## Problem
Lange Beiträge ohne SlangTag konnten nicht veröffentlicht werden, sobald die Beschreibung ca. 300 Zeichen überschritt.

## Root Cause
In `src/components/CreatePostDialog.tsx` wurde bei fehlendem SlangTag die komplette Beschreibung in das Feld `title` übernommen:

```tsx
title: first ? `$${first.name}` : description.trim() || t.post,
```

Der serverseitige Zod-Validator in `src/lib/post-moderation.functions.ts` begrenzt `title` auf 300 Zeichen. Dadurch schlug die Validierung vor dem Datenbank-Insert fehl und der Nutzer sah den generischen Fehler `publishFailed`.

## Minimaler Fix
`title` wird bei fehlendem SlangTag auf maximal 40 Zeichen der Beschreibung gekürzt:

```tsx
title: first ? `$${first.name}` : description.trim().slice(0, 40) || t.post,
```

Dies hält sich deutlich unter dem 300-Zeichen-Limit und verhindert doppelte Caption-Darstellung im Feed, da `src/lib/post-caption.ts` Titel unterdrückt, die ein Präfix der Beschreibung sind.

## Verifikation
- `bun run verify` – alle Unit-/DB-/E2E-Tests bestanden (480+ Tests)
- `bun run build` – erfolgreich
- Browser-Smoke-Test (`/tmp/browser/long-post-smoke/smoke.py`):
  - Eingeloggt als Produktionsnutzer auf `/dev`
  - Text-Beitrag mit 830 Zeichen ohne SlangTag verfasst
  - Konsolen-Events: `post_create_started` → `post_media_upload_success` → `post_insert_success`
  - Toast "Beitrag veröffentlicht" sichtbar
  - Nach Reload war der volle Text im Feed sichtbar

## Sicherheitseinschätzung
Keine Auswirkung auf RLS, Auth oder Datensichtbarkeit. Rein clientseitige Konstruktion eines bereits validierten Feldes.

## Status
✅ Abgeschlossen.

