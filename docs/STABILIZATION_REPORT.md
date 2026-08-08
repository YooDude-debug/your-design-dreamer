# Y-Dude – Stabilisierungs-, Refactoring- und Performance-Bericht

Stand: Abschluss der 10-Phasen-Stabilisierung. Getestet gegen den laufenden
Dev-Build (Vite, localhost:8080) mit angemeldeter Session.

## Phase 1 – Backup

- Voll-Kopie des Quellstands: `.lovable/backup/stable-pre-refactoring/`
- Archiv: `Y-Dude_stable-pre-refactoring.tar.gz`
- Zustandsdokumentation: `docs/STABLE_BUILD_PRE_REFACTORING.md`
  (65 Tabellen, alle mit RLS; TanStack Start/Vite-Konfiguration;
  owner-scoped SlangTag-Architektur; Quaternion-Globe-Rotation)

## Phase 2 – Refactoring (verhaltensneutral)

| Änderung | Datei |
| --- | --- |
| `keydown`-Listener wird nur noch einmal registriert (Ref-Pattern statt Re-Bind pro Render) | `src/components/PostDetailOverlay.tsx` |
| Toter Rechenausdruck im Audio-Trimmer entfernt | `src/components/AudioUploadPicker.tsx` |
| Prettier-/Lint-Durchlauf über `src` | projektweit |
| Gelöschter Altcode (frühere Phase): `EdgePeek.tsx`, `use-edge-peek.ts` | – |

Geprüft und als korrekt bestätigt (keine Änderung nötig): Timer- und
Animation-Frame-Cleanup in `Messenger.tsx`, `PostStatsBar.tsx`,
`SlangTagInput.tsx`, `AdSlider.tsx`, `ad-pause.ts`, `use-audio-recorder.ts`,
`use-feed-mode.ts`, `data.tsx`; Realtime-Channel-Abbau in `social.tsx`.

Ergebnis: TypeScript ohne Fehler, ESLint ohne Fehler.

## Phase 3 – Slang Globe

- Rotationsarchitektur unverändert getrennt: `qUser` (Interaktion/Inertia),
  `autoYaw` (Auto-Rotation), Zusammenführung erst im Render
  (`globe.quaternion = qUser * qAuto`).
- Alle DOM-Listener laufen über die zentrale `cleanups`-Liste,
  `dispose()` gibt Geometrien, Texturen, Renderer und den rAF frei.
- Drag-Richtung invariant: Finger links → Globus links, unabhängig von
  Auto-Rotation und Neigung.
- Canvas rendert auf Desktop, Android und iOS-Profil.

## Phase 4 – Navigation / Drag-Handles

- Handle bleibt viewport-fixiert: nach 1500 px Scroll auf `/arena`
  Handle-Mitte bei y = 426 px (Viewporthöhe 852) → exakt zentriert.
- Kurzer Zug → Feder zurück, Seite bleibt auf `/arena`.
- Vollständiger Zug → Navigation zu `/dev` (Feed).
- Globe-Handle liegt gespiegelt an der rechten Kante (x ≈ 373).

## Phase 5 – Post-Viewer

Messung der Karten-Transformation (`matrix(...)` + Abstand links/rechts):

| Szenario | Ergebnis |
| --- | --- |
| Geöffnet | 0 px Versatz, 16/16 zentriert |
| Horizontaler Swipe | Beitrag wechselt, Karte wieder 0 px |
| Diagonaler Zug | kein Versatz (kein freies Dragging) |
| 4 schnelle Swipes hintereinander | Karte sauber bei 0 px |
| Schließen + erneut öffnen | 0 px (Reset greift) |

Zusätzlicher Fix in dieser Phase: ein während eines laufenden
Beitragswechsels beendeter Zeiger bricht die Übergangsanimation nicht mehr
ab (`onSwipeEnd` respektiert `swapping`). Genau dieser Fall führte im Test
zuvor zu einem Rest-Versatz von ~70 px.

## Phase 6/7 – Funktions- und Cross-Device-Test

Smoke-Test von `/`, `/auth`, `/dev`, `/arena` (alle vier Tabs), `/globe`,
`/posts`, `/impressum`, `/datenschutz`, `/agb` auf drei Profilen
(Desktop 1280×900, Android Pixel-7-Profil, iOS-iPhone-Profil):
alle Seiten rendern, keine Page-Errors, keine React-Fehler.

## Phase 8/9 – Performance und Last

- JS-Heap auf `/globe`: 77 MB genutzt / 109 MB reserviert.
- Nach 9 Seitenwechseln Feed → Arena → Globe (3 Runden): unverändert
  77 MB / 109 MB → keine Leaks bei Auf-/Abbau von Globe und Realtime.
- Globe-Renderrate im Headless-Browser: ~43 fps (ohne GPU-Beschleunigung;
  auf echter Hardware entsprechend höher).
- Feed-Erstaufbau: 20 Fetches, keine Doppel-Requests derselben Ressource.

## Offene Beobachtungen (nicht kritisch)

1. `[media] sign failed Failed to fetch` erscheint in der Konsole, wenn
   während des Signierens der Medien-URLs navigiert wird (abgebrochener
   Request). Rein kosmetisch – die Bilder laden nach dem Seitenwechsel neu.
2. Sehr selten und nicht reproduzierbar: React-Warnung zu einem
   State-Update nach Unmount beim Splash → Feed-Übergang. Keine sichtbare
   Auswirkung; bei erneutem Auftreten gezielt nachverfolgen.
