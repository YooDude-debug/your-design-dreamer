# Sticky-Leiste: Ursache des zweiten Andockvorgangs gefunden (nur Analyse)

## Reproduktion (belegt, ohne Codeänderung)

Testbrowser 390x844, angemeldeter Feed, drei vollständige Zyklen gemessen:

| Messpunkt | feedMode | `--yd-header-h` | Leiste `position` / `top` | rect.top | Ergebnis |
|---|---|---|---|---|---|
| Start | false | `0px` | sticky / 0px | 275 | ok |
| Dock 1 | **true** | `0px` | relativ (fixierter Rahmen) | 0 | **dockt korrekt** |
| Nach Hochziehen 1 | false | **`54px`** | sticky / **54px** | 275 | Offset verfälscht |
| Dock 2 | **false** | `54px` | sticky / 54px | 54 | **kein Andocken** |
| Dock 3 | false | `54px` | sticky / 54px | 54 | **kein Andocken** |

Ausgeschlossen: doppelte Leiste (immer genau 1), Remount/stale Ref, transformierter
Vorfahre im Startlayout (keiner), stale Scroll-Owner (Feed-Scroller nur 1),
Stacking-Fehler, Layout-Shift durch Spacer.

## A) Hauptursache

`src/lib/use-feed-mode.ts`, Cleanup des Feed-Mode-Effekts (ca. Z. 312–322):

```ts
const h = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
root.style.setProperty("--yd-header-h", `${Math.round(h)}px`);
```

Auf dieser Seite existiert **kein** `header[data-app-header]` (gemessen:
`appHeader: false`). `document.querySelector("header")` trifft daher den **ersten
`<header>` einer Feed-Beitragskarte** – Höhe 54 px. Beim Verlassen des Feed-Modus
wird die zentrale Andockhöhe deshalb dauerhaft von `0px` auf `54px` verfälscht.

Beim Mount ist noch keine Beitragskarte gerendert, also `headerH = 0`, und der
ResizeObserver wird gar nicht angelegt (`header` war `null`). Der React-State
`headerH` bleibt damit für immer `0`.

Folge im zweiten Zyklus:

1. Die Leiste rastet nativ bei `top: 54px` ein (CSS-Variable).
2. Der Auslöser vergleicht gegen `headerH = 0`: `top (54) > headerH + 1` ist immer
   wahr → der Handler kehrt jedes Mal früh zurück, `enter()` wird **nie** gerufen.
3. Ohne Layoutwechsel bleibt es beim nativen Sticky: Die Leiste steht 54 px unter
   dem Rand und der Feed scrollt weiter dahinter durch – genau das gemeldete Bild
   „Leiste liegt über dem Feed“.

Es liegt also Fall **A + B** vor (falscher Offset, dadurch fehlender Layoutwechsel),
**nicht** C/D/E.

## B) Sekundäre Ursachen

1. Zwei Quellen für dieselbe Zahl (React-State `headerH` und CSS-Variable) laufen
   auseinander; nur eine wird beim Exit neu geschrieben.
2. Header-Messung ohne Kennzeichnung: `querySelector("header")` kann jedes
   beliebige `<header>` im Feed treffen.
3. `apply()` schreibt die Variable im Feed-Modus absichtlich nicht – die
   Divergenz kann so nicht mehr korrigiert werden.
4. `busy`/`exitTimer` sind nicht die Ursache; der frühere Fix war korrekt, aber
   wirkungslos, weil `enter()` überhaupt nicht mehr erreicht wird.

## C) Was entfernt/vereinfacht wird

- Kein zweites Auslesen der Headerhöhe im Effekt-Cleanup.
- Keine zusätzliche Übergangslogik, keine z-index-/sticky-Experimente.

## D) Was erhalten bleibt

Natives `position: sticky`, fixierter Feed-Rahmen im Feed-Modus, Pull-down-Exit,
Gesten-/Momentum-Sitzung, `feed-mode-lock`, `busy`/`phase`-Entkopplung, Session-
Wiederherstellung.

## E) Betroffene Dateien

- `src/lib/use-feed-mode.ts` (Hauptänderung)
- `tests/feed-sticky-cycles.test.ts` (Regressionsfall ergänzen)

## F) Minimale Änderung

1. Headerhöhe nur aus einem eindeutig gekennzeichneten Element lesen
   (`header[data-app-header]`), sonst `0` – als einzige Hilfsfunktion.
2. Die CSS-Variable ausschließlich aus dem gemessenen `headerH`-State schreiben
   (ein Effekt, eine Quelle). Das Cleanup setzt die Variable auf genau diesen
   Wert zurück, nicht auf eine neue Messung.
3. ResizeObserver/Neumessung auch dann greifen lassen, wenn das Element erst
   später erscheint (Messung bei Resize + beim Verlassen des Feed-Modus aus
   derselben Funktion).

## G) Warum das den zweiten Zyklus löst

Nach dem Exit ist die Andockhöhe wieder identisch mit `headerH` (hier `0px`).
Die Leiste rastet nativ genau am Vergleichspunkt ein, `top <= headerH + 1` wird
erneut wahr, `enter()` läuft, und der Layoutwechsel erfolgt wie im ersten Zyklus –
beliebig oft, unabhängig von Geschwindigkeit oder Android-Momentum.

## Prüfungen nach Freigabe

Typecheck, Lint/Prettier, Tests, Build sowie Browser-Smoke mit drei bis fünf
Zyklen (langsam, schnell, Fling) auf 390 px und 1280 px.

---

Diese Runde: Projektcode geändert: NEIN · DB: NEIN · Commit: NEIN · Deployment: NEIN.
