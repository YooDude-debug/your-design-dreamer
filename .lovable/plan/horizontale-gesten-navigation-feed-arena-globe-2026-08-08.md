# Horizontale Gesten-Navigation: Feed ↔ Arena / Globe

## Ziel

- Hauptfeed: einfacher horizontaler Swipe **aus dem mittleren Content-Bereich** → links = Arena, rechts = Slang Globe.
- Arena und Globe: kleines, dezentes seitliches Zieh-Handle mit Zurück-Symbol → zurück zum Feed.
- Native Randgesten von Android/iOS bleiben frei; kein Edge-Swipe mehr im Feed.
- Feed-, Arena- und Globe-Funktionen, Datenbank, RLS und SlangTag-Logik bleiben unverändert.

## 1. Feed-Geste vereinfachen

Heute verlangt der Feed eine zweistufige Geste (kurz vor, dann zurück) und zusätzlich existiert ein Edge-Peek-Overlay, das direkt am Bildschirmrand startet.

Neu:

- Neuer Hook `useHorizontalNavSwipe` (in `src/lib/use-swipe-nav-gesture.ts`, additiv neben dem bestehenden Export):
  - Geste startet nur, wenn der Startpunkt in der **mittleren Zone** liegt: mindestens 18 % Abstand zu links und rechts (mind. 48 px), damit System-/Browser-Gesten am Rand unangetastet bleiben.
  - Auslösung, wenn `|dx| ≥ 70 px`, `|dx| > 1.6 × |dy|`, `|dy| ≤ 60 px` und die Geste unter 900 ms bleibt.
  - Swipe nach links → `/arena`, Swipe nach rechts → `/globe` (Ziele als Parameter).
  - Alle Listener bleiben **passiv**: vertikales Feed-Scrolling und Pull-down des Werbefeeds werden nicht beeinflusst.
  - Bestehende Schutzregeln bleiben: keine Auslösung in Inputs/Textareas/Dialogen, in horizontal scrollbaren Containern, im Composer oder bei offenem Overlay.
  - Slide-Richtung wird wie bisher über `pendingSlide`/`useSlideInClass` gesetzt, damit die vorhandene Übergangsanimation erhalten bleibt.
- `src/routes/_authenticated/dev.tsx`: die zwei `useSwipeNavGesture`-Aufrufe durch einen `useHorizontalNavSwipe({ left: "/arena", right: "/globe" })` ersetzen; die beiden `<EdgePeek …>`-Instanzen im Feed entfernen (Edge-Zone bleibt so für System-Gesten frei). Sonst keine Änderung an der Feed-Seite.

## 2. Neues Zieh-Handle (Arena + Globe)

Neue Komponente `src/components/NavDragHandle.tsx`:

- Kleines vertikales Griff-Element, mittig an der Seite (`top: 50%`, `translateY(-50%)`), Breite ca. 20 px, Höhe ca. 72 px, abgerundet, `bg-surface/60`, `border-border/60`, `backdrop-blur-md`, plus ein `ChevronLeft`/`ChevronRight`-Icon in `text-muted-foreground` mit Hover/Active in `text-brand` — passt zum bestehenden Y-Dude-Stil (gleiche Tokens wie die vorhandenen Overlay-Chips).
- Verhalten:
  - Eigene Touch-/Pointer-Listener **nur auf dem Handle** (`touchmove` hier `passive: false`, damit das Ziehen nicht mit der Seite scrollt).
  - Ziehen zur Bildschirmmitte: das Handle folgt dem Finger (max. ca. 120 px, gedämpft), ab 60 px gilt die Geste als ausgelöst; beim Loslassen Navigation zum Feed, sonst federt es zurück.
  - Klick/Tap ohne Ziehen navigiert ebenfalls zum Feed (Desktop-freundlich, per `<Link>`-Semantik bzw. `navigate`).
  - `touch-action: none` ausschließlich auf dem Handle-Element — der Rest der Seite bleibt unberührt.
- Props: `to` (Zielroute), `side` ("left" | "right"), optional `label` für `aria-label`.

## 3. Arena

`src/routes/_authenticated/arena.tsx`:

- `<EdgePeek to="/dev" />` und `useSwipeNavGesture("right-then-left", "/dev")` entfernen.
- Stattdessen `<NavDragHandle to="/dev" side="left" label="Zurück zum Feed" />`.
- Alle Arena-Tabs, Sektionen, Daten und Navigation bleiben unverändert.

## 4. Slang Globe

`src/routes/_authenticated/globe.tsx`:

- `<EdgePeek to="/dev" edge="right" />` und `useSwipeNavGesture("left-then-right", "/dev")` entfernen.
- `<NavDragHandle to="/dev" side="right" label="Zurück zum Feed" />` einsetzen (Seite gegenüber der Arena, Symbol zeigt zur Mitte).
- Handle liegt über dem Canvas (`z-30`); die Globe-Engine erhält dessen Events nicht, weil das Handle `stopPropagation` nutzt und die Engine-Listener am Canvas hängen. Rotation, Zoom, Pinch, Marker, Suche und Filter bleiben damit unverändert; `globe-engine.ts` wird nicht angefasst.

## 5. Aufräumen / Abgrenzung

- `EdgePeek.tsx` und `use-edge-peek.ts` bleiben als Dateien vorhanden, werden aber nicht mehr eingebunden (keine Edge-Gesten mehr). Kein weiterer Code hängt daran.
- Keine Migration, keine RLS-Änderung, keine Änderung an SlangTag-, Feed-Ranking- oder Moderationslogik.

## Technische Details

- Betroffene Dateien: `src/lib/use-swipe-nav-gesture.ts` (neuer Hook), `src/components/NavDragHandle.tsx` (neu), `src/routes/_authenticated/dev.tsx`, `arena.tsx`, `globe.tsx`.
- Schwellwerte zentral als Konstanten (`CENTER_INSET_RATIO`, `MIN_DX`, `DX_DY_RATIO`, `MAX_DY`, `MAX_MS`, `HANDLE_COMMIT_PX`) für spätere Feinjustierung.
- Prüfung: Typecheck sowie Playwright-Screenshots auf 393×852 (mobil) und Desktop für Feed, Arena und Globe; Konsolen-Check auf Fehler.
