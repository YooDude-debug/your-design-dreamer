# Test-Plan

## Automatisiert (nach Source-Übernahme)

1. `bun install`
2. `bunx tsgo --noEmit` – erwartet: fehlerfrei
3. `bunx eslint src tests` – erwartet: 0 Fehler
4. `bunx vitest run` – erwartet: 552 Tests grün
5. `bunx vitest run --config vitest.integration.config.ts` – erwartet: 68 grün
6. `bun run build` – erwartet: erfolgreich
7. Playwright gegen lokale Vorschau – erwartet: 10 grün, 1 übersprungen
   (Production als Ziel ist gesperrt)

## Smoke-Test Video V1

| Fall | Erwartung |
| --- | --- |
| MP4 ≤ 60 s auswählen | Vorschau, Thumbnail, Veröffentlichung möglich |
| iPhone-MOV (QuickTime) | akzeptiert, korrekte Maße/Rotation |
| Video > 60 s | serverseitig abgelehnt, verständliche Meldung |
| Datei > 50 MB | abgelehnt |
| Fremdes MIME (z. B. `video/webm`, PDF) | abgelehnt |
| Feed-Wiedergabe | eigener Videoton hörbar, Bedienelemente vorhanden |
| SlangShot-Regression | max. 5 s, stumm, SlangTag-Ton unverändert |
| `media_video_assets` | Eigentümer sieht nur eigene Zeilen; anonym kein Zugriff |

## Smoke-Test Business V1

| Rolle/Fall | Erwartung |
| --- | --- |
| Unternehmerregistrierung | Rolle `business` gesetzt, Weiterleitung `/business?onboarding=1` |
| „Später entscheiden“ | Konto ohne Abo voll nutzbar |
| `/business` ohne Abo | erreichbar, Tarifauswahl sichtbar (14,90 € / 39,00 €) |
| Kampagnen ohne Abo | sichtbar, deaktiviert, CTA zur Tarifauswahl |
| Business-Abo aktiv | Kampagnenbereich aktiv, Limit 2 |
| Business Pro aktiv | Limit 5 |
| Limit überschritten | serverseitig abgelehnt (DB-Trigger bleibt autoritativ) |
| Profilmenü | „Business & Kampagnen“ führt nach `/business` |

## Regressionen (müssen unverändert funktionieren)

Community-Feed, normale Beiträge, Creator-Profil, Creator-SlangTags,
Creator-Abo, Messenger, Market, Arena, Globe, Admin-Cockpit.
