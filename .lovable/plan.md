# Slang Globe – Entkopplung von Auto-Rotation, Drag, Trägheit und FlyTo

Ziel: Der User-Drag wird ausschließlich aus der Pointer-Bewegung auf dem Bildschirm interpretiert. Finger nach links → Globe nach links, unabhängig von Auto-Rotation, aktueller Orientierung, Zoomstufe oder Neigung. Keine Änderungen an Datenbank, SlangTag-Daten, Filtern, Markern, Design, Position/Größe oder sonstigem UI.

## 1. Aktuell gemeinsam verwendeter Zustand

Alle vier Systeme schreiben direkt in dieselben zwei Zahlen:

- `yaw`, `pitch` (Zeilen 221–222) – einziger Rotationszustand.
- `targetYaw`, `targetPitch` – von FlyTo genutzt, aber bei jedem Drag-Frame und in jedem Idle-Frame auf `yaw`/`pitch` zurückgesetzt.
- `velYaw`, `velPitch` – Trägheit, addiert ebenfalls auf `yaw`/`pitch`.
- Auto-Rotation dekrementiert `yaw` (`this.yaw -= dt * 0.055 * ramp * ramp`).
- Ausgabe: `this.globe.rotation.set(this.pitch, this.yaw, 0)` mit `rotation.order = "YXZ"`.

Folge: Es gibt keine Trennung zwischen „wohin hat der Nutzer gedreht“ und „wie weit hat die Auto-Rotation weitergedreht“. Weil Yaw und Pitch als verkettete Euler-Winkel ausgegeben werden, hängt die Achse, um die die zweite Rotation wirkt, vom Wert der ersten ab. Bei stärkerer Neigung (bis ±1.35 rad) und nach längerer Auto-Rotation entspricht die Yaw-Achse nicht mehr der Bildschirm-Horizontalen, wodurch eine horizontale Fingerbewegung schräg oder gespiegelt auf die sichtbare Oberfläche wirkt.

## 2. Betroffene Dateien/Funktionen

Nur `src/lib/globe/globe-engine.ts`:

- `orientationFor()` (Z. 59–62)
- Felder `yaw/pitch/targetYaw/targetPitch/velYaw/velPitch/samples/autoRotate/flying`
- `setAutoRotate()` (Z. 354)
- `flyTo()` (Z. 358–366)
- `bindEvents()` → `pointerdown`, `applyMove`, `pointerup` (Z. 400–500)
- Marker-/Region-Klick-Pfad, der `flyTo` aufruft (Z. 584)
- Renderloop (Z. 595–645)

Keine Änderungen an `globe.tsx`, Overlays, Gesten-Navigation oder Datenlogik.

## 3. Trennung von Auto-Rotation und User-Drag

Neuer Zustand, drei unabhängige Teile:

```text
qUser      Quaternion  – vom Nutzer erzeugte Orientierung (Drag + Trägheit + FlyTo)
autoYaw    number      – reiner Auto-Rotations-Winkel, wächst monoton, nur um Welt-Y
qOut       Quaternion  – pro Frame komponiert, wird auf globe.quaternion gesetzt
```

- Auto-Rotation schreibt ausschließlich `autoYaw` und niemals `qUser`.
- Drag/Trägheit/FlyTo schreiben ausschließlich `qUser` und niemals `autoYaw`.
- `globe.rotation` wird nicht mehr direkt gesetzt; stattdessen `globe.quaternion`.

## 4. Zusammenführung der Rotationsanteile

Pro Frame:

```text
qAuto = quaternionFromAxisAngle(WORLD_Y, autoYaw)
qOut  = qUser * qAuto        // Auto-Rotation zuerst, danach die User-Orientierung
globe.quaternion.copy(qOut)
```

Da `qAuto` als erster Faktor angewendet wird, verschiebt sie nur den „Untergrund“ und verändert die Achsen der User-Rotation nicht. Der Drag bleibt damit rechnerisch unabhängig vom Auto-Rotations-Fortschritt.

## 5. Drag: bildschirmbasierte Achsen

`applyMove` (Einzelpointer) berechnet weiterhin `dx`, `dy` in Pixeln und `radiansPerPixel()` bleibt unverändert (1:1-Gefühl, Zoomabhängigkeit wie heute). Statt Euler-Addition:

```text
axisYaw   = WORLD_Y                                  // konstante Weltachse (Polachse)
axisPitch = Kameraachse rechts = (1, 0, 0) in Kamera-Raum
qUser = quaternionFromAxisAngle(axisYaw,   dx * rad) * qUser
qUser = quaternionFromAxisAngle(axisPitch, dy * rad) * qUser
```

Beide Achsen werden im Weltraum vor `qUser` links-multipliziert. Damit sind sie kamerafest und niemals von der aktuellen Globe-Orientierung abhängig. Die Vorzeichen werden einmal so gewählt, dass Finger links → sichtbare Oberfläche links, Finger nach oben → Oberfläche nach oben; dieselbe Formel gilt anschließend für jeden Rotationszustand.

Pitch-Begrenzung: statt Winkel-Clamp wird nach jedem Schritt geprüft, ob die transformierte Polachse den Grenzwinkel (entspricht heutigem ±1.35 rad) überschreitet; falls ja, wird der Pitch-Anteil des aktuellen Schritts verworfen. Der Yaw-Anteil bleibt in diesem Fall trotzdem erhalten, damit horizontales Drehen an den Polen nicht blockiert.

## 6. Trägheit nach dem Loslassen

- Das bestehende 90-ms-Sample-Fenster bleibt, speichert aber jetzt Pixel-Deltas (`dx`, `dy`) statt Euler-Deltas.
- Bei `pointerup` ergibt sich daraus `velYawPx`, `velPitchPx` (rad/s um dieselben kamerafesten Achsen).
- Im Renderloop wird die Trägheit über exakt denselben Achsen-Multiplikationspfad wie der Drag angewendet, mit unveränderter Dämpfung `exp(-dt * 3.4)` und Schwelle `0.0015`. Richtungsverhalten der Trägheit ist damit identisch mit dem Drag.
- Bei `pointerdown` werden beide Geschwindigkeiten auf 0 gesetzt (wie heute).

## 7. FlyTo

- `orientationFor(lat, lng)` liefert weiterhin Ziel-Yaw/Pitch; daraus wird ein Ziel-Quaternion `qTarget` gebaut (Yaw um Welt-Y, Pitch um Kamera-X, gleiche Reihenfolge wie beim Drag).
- FlyTo kompensiert den Auto-Anteil: `qTargetUser = qTarget * inverse(qAuto)`, damit die Zielregion nach dem Compositing wirklich vorne steht.
- Interpolation per `slerp(qUser, qTargetUser, 1 - exp(-dt * 6))` – identische Kurvencharakteristik wie heute; `flying` endet, wenn der Winkelabstand < ~0.002 rad ist.
- Auto-Rotation läuft während des Flugs weiter oder ruht wie bisher; da FlyTo den Auto-Anteil pro Frame neu kompensiert, entsteht kein Zielversatz.
- Marker-/Region-Klick-Verhalten und Zoom-Ziel (`Math.min(this.targetDist, 2.2)`) bleiben unverändert.

## 8. Verhindern der Richtungsumkehr

Drei Maßnahmen gemeinsam:

1. Der Drag rechnet nie mit dem aktuellen Rotationszustand – die Achsen sind konstante Welt-/Kameraachsen und werden vor `qUser` multipliziert.
2. Auto-Rotation liegt in einem separaten Faktor und kann die Drag-Achsen nicht mehr verändern.
3. Kein verketteter Euler-Ausgang mehr (`rotation.order = "YXZ"` entfällt), damit der Pitch die effektive Yaw-Achse nicht mehr kippt.

## 9. Zoom bleibt getrennt

`dist`, `targetDist`, Pinch und Wheel werden nicht angefasst. Zoom bleibt weich gedämpft (`exp(-dt*16)`), `MIN_DIST`/`MAX_DIST` und `radiansPerPixel()` unverändert – Drag skaliert weiterhin mit dem Zoom, ohne die Rotationslogik zu berühren. Pinch mit zwei Pointern setzt wie heute die Rotationsgeschwindigkeiten auf 0 und dreht nicht.

## 10. Vertikale Steuerung bleibt erhalten

Die vertikale Bewegung nutzt dieselbe Pixel-zu-Radiant-Umrechnung und denselben Grenzwinkel wie heute; nur die Anwendung erfolgt über die kamerafeste Rechtsachse. Gefühlte Empfindlichkeit, Begrenzung und Trägheit bleiben gleich.

## 11. Auto-Rotation während des Drags

- `pointerdown`: `dragging = true`, `flying = false`, Geschwindigkeiten 0, `idleTime = 0`.
- Im Renderloop wird `autoYaw` nur fortgeschrieben, wenn `!dragging && !flying`, keine Trägheit aktiv ist und die bestehende Ruhezeit `IDLE_RESUME` mit derselben quadratischen Ramp abgelaufen ist.
- `autoYaw` wird beim Drag nicht zurückgesetzt, sondern nur eingefroren – dadurch kein Sprung beim Wiederanlaufen und keine Gegenbewegung zur Fingerbewegung.
- `setAutoRotate(false)` friert `autoYaw` dauerhaft ein (Verhalten wie bisher).

## Verifikation

- Manuelle Richtungsprüfung bei 0°, 90°, 180°, 270° Yaw sowie bei maximaler Neigung: Finger links → Globe links.
- Prüfung direkt während laufender Auto-Rotation und unmittelbar nach dem Anfassen.
- Trägheit läuft in Fingerrichtung aus; Auto-Rotation setzt danach sanft ein.
- FlyTo aus Marker-/Region-Klick zentriert die Zielregion korrekt.
- Zoom (Pinch/Wheel), Design, Größe und Position unverändert; Typecheck/Lint grün.
