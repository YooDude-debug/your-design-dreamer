# Y-Dude – Medienauslieferung / Cache-Optimierung

Datum: 2026-08-27

## Ausgangslage (gemessen)

- Medien liegen im **privaten** Bucket `media`, Auslieferung im Browser nur über
  **signierte URLs** (7 Tage Gültigkeit).
- Signierte Antworten enthalten **kein** `Cache-Control` – unabhängig davon, was beim
  Upload gesetzt wurde. Der Browser cacht daher nur heuristisch und revalidiert per `ETag`.
- Signierte URLs wurden ausschließlich in `sessionStorage` gemerkt: **jeder neue Tab**
  erzeugte neue Signaturen und damit **vollständige Neu-Downloads**.
- Feed-Erstaufruf: ~850–950 KB Medien; neuer Tab: erneut ~900 KB.

## Umsetzung

1. **Stabile URLs geräteweit vorhalten** (`src/lib/media.ts`): signierte URLs werden
   zusätzlich in `localStorage` gehalten, **pro Konto getrennt** (`yd.signed.v1.u<userId>`).
   Gleiche URL ⇒ der Browser bedient sich aus seinem eigenen Cache.
2. **Sensible Medien ausgenommen**: `originals/` (unverpixelte Originale) werden
   **nie** geräteweit gespeichert, nur im Tab.
3. **Abmelde-Hygiene**: `clearDeviceMediaCache()` löscht Tokens bei Abmeldung
   (Profil, Konto-Bereich, Admin, Passwort-Reset).
4. **Cache-Klassen beim Upload** (`cacheControlFor`): unveränderliche Medien
   (UUID-Pfade: Bilder, Varianten, Videos, Audio, Avatare, Titelbilder)
   `max-age=1 Jahr, immutable`; `originals/` `no-store`.
   Hinweis: Der Speicher stellt jedem Wert `public, ` voran, `private` ist nicht
   ausdrückbar – der Schutz privater Medien liegt unverändert bei Zugriffsregeln
   und Signatur-Token, nicht am Cache-Header.
5. Serverseitig erzeugte Bildvarianten (`media-variants.server.ts`) nutzen dieselbe
   unveränderliche Vorgabe.

## Vorher / Nachher (Feed + Profil + Rückkehr + Neuladen, angemeldete Sitzung)

| Szenario | vorher | nachher |
|---|---|---|
| Feed Erstaufruf | ~850–950 KB | ~848 KB (unverändert, erster Abruf) |
| Profil danach | 0 KB | 0 KB |
| Zurück zum Feed | ~50 KB | ~2–52 KB |
| Neuladen (F5) | 0 KB (aber Revalidierung) | 0 KB |
| **Neuer Tab / neue Sitzung** | **~900 KB erneut** | **0 KB** |

Ergebnis: Der wiederholte Abruf identischer Medien kostet praktisch **keine Bytes**
mehr; nur noch schlanke Revalidierungen (304 / 0 KB) laufen zur Origin. Das ist die
untere Grenze für private, signierte Auslieferung.

## Sicherheit

- Keine Bucket-Freigabe, keine öffentlichen URLs, keine Änderung an Zugriffsregeln.
- Messenger-Medien bleiben privat und signiert; Tokens sind pro Konto getrennt
  abgelegt und werden bei Abmeldung entfernt.
- Originale werden weder geräteweit gespeichert noch cachefähig ausgeliefert.

## Prüfung

Build OK · Typecheck OK · Lint 0 Errors · 465/465 Unit-Tests (4 neu) · 10/10 E2E ·
Browsercheck Desktop + Mobil (Feed, Market, Arena, Profil): korrekte Bildvarianten
(`__m`/`__t`), keine defekten Bilder, keine Konsolenfehler.
