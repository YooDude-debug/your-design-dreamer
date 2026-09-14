# Docking-Flash der Feed-Leiste beheben

## Ursache
Beim Wechsel in den Feed-Modus rendert React den Feed-Rahmen bereits `fixed`, während die zugehörige Root-Klasse und `--yd-header-h: 0px` erst in einem normalen Effekt nach dem Browser-Paint gesetzt werden. Dadurch kann ein Zwischen-Frame mit dem alten oberen Abstand entstehen; in dieser Lücke wird kurz der dahinterliegende Profilbereich sichtbar.

## Änderung
- Den bestehenden Feed-Modus-Layout-Effekt in `src/lib/use-feed-mode.ts` als synchronen Layout-Effekt ausführen.
- Root-Klasse, Andockhöhe und Scroll-Sperre dadurch vor dem ersten sichtbaren Frame des neuen Layouts setzen.
- Finale Position, Animation, Profil-Header-Design und übrige Feed-Logik unverändert lassen.
- Den Frame-Ordnungsfall in `tests/feed-sticky-cycles.test.ts` als Regression absichern.

## Prüfung
- Relevante Regressionstests und Projektprüfung ausführen.
- Im Browser auf Mobile und Desktop mehrfach langsam, schnell und per Fling an-/abdocken.
- Screenshots direkt um den Zustandswechsel vergleichen und auf eine offene obere Lücke beziehungsweise sichtbare Profilfragmente prüfen.
