# Y-Dude — Stabilisierungs-, Backup-, Refactoring- und Performance-Phase

Keine neuen Features, kein Redesign, keine Produktlogik- oder Datenbankänderungen. Ziel ist ein sauberer, messbarer Build als Basis für künftige Features.

## Phase 1 — Stable Build sichern

- Vollständige Kopie des Quellstands nach `.lovable/backup/stable-pre-refactoring/` (unveränderlich, wird danach nicht mehr angefasst).
- Zusätzlich ein Archiv `Y-Dude_stable-pre-refactoring.tar.gz` als Wiederherstellungspunkt.
- Dokumentation in `docs/STABLE_BUILD_PRE_REFACTORING.md`:
  - Datenbank-/Schema-Übersicht (Tabellen, Policies, RPCs, Grants — nur lesend erhoben)
  - Konfiguration (Vite, Router, Start-Middleware, PWA, Turnstile, E-Mail)
  - SlangTag-Architektur (Owner-scoped Varianten, Grants, Redaction, Moderation)
  - Navigationsarchitektur (Feed/Arena/Globe, Handles, Swipe-Regeln)
  - Globe-Rotationsarchitektur (qUser / autoYaw / Inertia / FlyTo / Zoom)
  - Performance-relevante Einstellungen (Caching, Bootstrap-RPC, Lazy Loading, Bildvarianten)

## Phase 2 — Refactoring (technisch, verhaltensneutral)

Vorgehen: Datei-für-Datei-Audit mit Typecheck und Lint nach jedem Block; jede Änderung muss verhaltensneutral sein.

Prüf- und Bereinigungsliste:
- ungenutzte Imports, Variablen, Dateien, toter Code
- doppelte Komponenten/Hilfsfunktionen zusammenführen (nur echte Duplikate)
- `useEffect`-Abhängigkeiten korrigieren (u. a. fehlende Dep-Arrays, die pro Render neu binden)
- unnötige State-Updates während Pointer-Bewegung → Refs / imperative Styles
- Cleanup verifizieren: Event-Listener, `requestAnimationFrame`, `setTimeout`/`setInterval`, Observer, Audio-Objekte, Supabase-Realtime-Subscriptions
- konkurrierende Touch-/Pointer-Handler entlang der Ketten Feed → Overlay → Canvas
- redundante Netzwerk-/Bild-Requests (Doppel-Fetches, fehlende Deduplizierung, Prefetch-Duplikate)

Nicht angetastet: Design, Texte, Datenmodell, RLS, Feature-Verhalten.

## Phase 3 — Globe

- Verifizieren, dass `qUser` (Drag/Trägheit/FlyTo) und `autoYaw` (Auto-Rotation) getrennt bleiben und pro Frame nur komponiert werden.
- Richtungsinvarianz bei 0/90/180/270 Grad Auto-Rotation prüfen (links/rechts/oben/unten).
- Auto-Rotation pausiert bei `pointerdown`, setzt kontrolliert nach Inertia-Ende wieder ein.
- Nur Aufräumen (Namensklarheit, Cleanup, keine Rechenarbeit pro Frame ohne Bedarf) — keine Umbauten der Rotationslogik.

## Phase 4 — Navigation

- Feed: horizontale Geste nur aus dem mittleren Bereich, Randzonen frei, vertikales Scrollen unangetastet.
- Globe/Arena: Handle viewport-fixiert vertikal mittig, unabhängig von Contentlänge; echte Drag-Geste mit Seitenbewegung und Snap/Spring-Back.
- Sicherstellen, dass genau ein Handler pro Geste greift (Overlay offen ⇒ Navigationsgesten aus).

## Phase 5 — Post-Viewer

- Karte bleibt fixiert; nur horizontaler, begrenzter Übergangs-Offset.
- Kein kumulierender translateX/translateY, vollständiges Reset bei Schließen und Neuöffnen.
- Pointer-Capture, `pointercancel`, Multi-Touch, Zoom-Surface und Eingabefelder getrennt geprüft.

## Phase 6 — Funktionstest

Automatisiert per Browser-Test, mit Screenshots und Konsolen-/Netzwerkprotokoll:
Feed (Laden, Scrollen, Bilder, Likes, Shares, Kommentare, Navigation) · Post-Viewer (Öffnen/Schließen/Swipe/Scroll/Stabilität) · SlangTags (Erstellen, Bearbeiten, Löschen, eigene Tags, Owner-Scope, Fremd-Tags abspielen, Grants, Plays/Likes/Shares) · Manager (Freigaben, Globe-Einreichung, Status) · Arena (Challenges, Einreichungen, Voting, Handle) · Globe (Auto-Rotation, Drag X/Y, Trägheit, FlyTo, Zoom, Marker, Filter, Suche, Globe Vote) · Account (Login, Registrierung, Verifizierung, Profil, Einstellungen, Logout).

## Phase 7 — Cross-Device

- Desktop Chrome (echt) sowie Android-Chrome- und iOS-Safari-Emulation (Viewport, Touch, DPR, User-Agent) für Touch/Pointer, Scroll, Edge-Gesten, Pinch-Zoom, Post-Swipe, Handles, Responsive-Layouts.
- Grenze: echte Geräte-Engines (iOS WebKit) können hier nicht 1:1 ausgeführt werden; abweichende Punkte werden als Restrisiko benannt.

## Phase 8 — Performance-Check

Messgrößen: Heap (used/total), FPS während Globe-Rotation und Swipe, Re-Render-Zähler, Anzahl Netzwerk-/Bild-Requests beim Feed-Start, Listener- und AnimationFrame-Bilanz nach Seitenwechseln, Verhalten bei langer Session und großen Feed-Mengen. Lazy-/Eager-Loading bleibt unverändert.

## Phase 9 — Lasttest und Vergleich

Wiederholtes Durchlaufen von Feed → Post-Viewer → Arena → Globe über mehrere Zyklen; Vergleich der Werte vor/nach Refactoring (RAM, CPU, FPS, Feed- und Globe-Performance, Bildladeverhalten, Swipe-Responsiveness, Memory-Leaks).

## Phase 10 — Abschlussbericht

Kurzer technischer Bericht in `docs/REFACTORING_REPORT.md` mit den zehn geforderten Punkten inklusive ehrlicher Angabe, welche Werte gemessen und welche nur strukturell vergleichbar sind.

## Technische Hinweise

- Backup ist reine Dateikopie plus Dokumentation; es werden keine Migrationen ausgeführt und keine Schemaänderungen vorgenommen.
- Messungen laufen headless in der Sandbox (Software-Rendering): FPS-Absolutwerte sind nicht gerätegleich, Relativvergleiche und Heap-/Listener-Zahlen sind belastbar.
- Refactoring wird in kleinen, überprüfbaren Blöcken mit Typecheck durchgeführt, damit jederzeit auf den Stable Build zurückgesprungen werden kann.
