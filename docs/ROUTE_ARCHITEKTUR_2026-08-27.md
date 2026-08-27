# Y-Dude – Route- und Modulanalyse (Phase 3)

Stand: 2026-08-27. Bewertung der großen Dateien und der bereits durchgeführten
Modularisierung. Leitlinie: **keine künstliche Aufteilung** – nur dort trennen,
wo eine Datei mehrere klar unterschiedliche Aufgaben mischt.

---

## 1. Größte Dateien

| Datei                                 | Zeilen | Bewertung                                                          |
| ------------------------------------- | -----: | ------------------------------------------------------------------ |
| `src/lib/data.tsx`                    |   2301 | Aufteilen sinnvoll (Feed, Posts, Profile, Medien in einem Kontext) |
| `src/lib/globe/slangtag-catalog.ts`   |   1831 | Datentabelle – bleibt (keine Logik)                                |
| `src/lib/i18n-dict.ts`                |   1654 | Wörterbuch – bleibt                                                |
| `src/lib/social.tsx`                  |   1539 | Aufteilen sinnvoll (Connections, Messenger, Notifications)         |
| `src/components/Messenger.tsx`        |   1428 | Aufteilen sinnvoll (Liste, Chat, Market-Chat, Eingabe)             |
| `src/components/CreatePostDialog.tsx` |   1241 | Grenzfall – eine zusammenhängende Aufgabe, hohe Kopplung           |
| `src/lib/admin.server.ts`             |   1209 | Bleibt: Sammlung gleichartiger Adminfunktionen, serverseitig       |
| `src/lib/globe/globe-engine.ts`       |   1072 | Bleibt: eine geschlossene 3D-Engine                                |
| `src/routes/_authenticated/dev.tsx`   |   1031 | **modularisiert** (vorher 1681)                                    |
| `src/components/SlangTagCanvas.tsx`   |    998 | Bleibt: ein Interaktionsmodell (Drag/Zoom/Rotate)                  |

---

## 1a. Einzelbewertung der Kernrouten

Bewertungsmaßstab (nicht die Zeilenzahl allein): Anzahl unterschiedlicher
Verantwortlichkeiten, Zustandsdichte (`useState`/`useEffect`), Menge fachlicher
Regeln in der Datei, Auslagerungsgrad an Komponenten und `src/lib`.

| Route / Datei                                     | Zeilen | Zustand (useState/useEffect) | Verantwortlichkeiten                                                                                                        | Modularisierung nötig? | Status                                                             |
| ------------------------------------------------- | -----: | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| **Feed** `_authenticated/dev.tsx`                 |   1031 | 9 / 13                       | Seitenaufbau, Reiterzustand, Scrollverwaltung, Overlay-Steuerung, Werbeeinbindung                                           | war ja                 | **modularisiert** (1681 → 1031, s. §2)                             |
| **Profil** `_authenticated/profile.$username.tsx` |    569 | 10 / 3                       | Kopfbereich, Beitragsraster, Dialoge – Fachlogik liegt in `ProfilePanel`, `ProfileAbout`, `FollowersDialog`, `src/lib/data` | nein                   | bewusst nicht: dünne Route, alles delegiert                        |
| **Messenger** `components/Messenger.tsx`          |   1428 | 22 / 13                      | Connections-Liste, Market-Liste, Chatfenster, Eingabe, Realtime, Lesestatus, Übersetzung                                    | ja (höchste Dichte)    | bewusst zurückgestellt – Risiko, s. §3                             |
| **Market Übersicht** `market.index.tsx`           |    534 | 16 / 4                       | Filter/Suche/Kategorien-UI; Karten, Sponsored, Sprachsuche, „Meine Artikel“ ausgelagert                                     | nein                   | bewusst nicht: Zustand ist reiner Filter-UI-Zustand                |
| **Market Detail** `market.$itemId.tsx`            |    493 | 7 / 3                        | Artikelanzeige, Kauf-/Angebotsaktionen (Server-Funktionen), Dialoge                                                         | nein                   | bewusst nicht: eine Seite, klare Abschnitte                        |
| **Market Anlegen** `market.new.tsx`               |    462 | 15 / 2                       | Ein Formular (Felder, Bilder, Kategorie, Versand)                                                                           | nein                   | bewusst nicht: zusammenhängendes Formular                          |
| `auth.tsx`                                        |    858 | 28 / –                       | Login, Registrierung, Reset, Turnstile, AGB – drei Formulare in einer Datei                                                 | wäre sinnvoll (gering) | offen, geringe Priorität (s. §3.4)                                 |
| `channels.$channelId.tsx`                         |    778 | 12 / 2                       | Channel-Kopf, Beitragsliste, Moderation, Einstellungen                                                                      | Grenzfall              | bewusst nicht: klar getrennte Abschnitte, 6 lokale Teilkomponenten |
| `arena.tsx`                                       |    689 | 11 / –                       | Navigationsgitter + Abschnitte, alle Inhalte in `components/arena/*`                                                        | nein                   | bewusst nicht: reine Kompositionsseite                             |
| `admin.users.tsx`                                 |    443 | –                            | Adminliste mit Aktionen                                                                                                     | nein                   | bewusst nicht                                                      |

Ergebnis: Von den vier ausdrücklich genannten Bereichen war **nur der Feed**
tatsächlich zu komplex und wurde aufgeteilt. Profil-, Market- und
Channel-Routen sind Kompositionsseiten, deren Fachlogik bereits in
`src/components/*` und `src/lib/*` liegt – sie werden nicht allein wegen ihrer
Zeilenzahl angefasst. Der Messenger ist der einzige verbleibende echte
Komplexitätsfall; er ist bewusst zurückgestellt, weil Realtime, Lesestatus und
Übersetzung daran hängen und ein Umbau ohne zusätzliche Tests ein
Regressionsrisiko im wichtigsten Kommunikationspfad wäre.

---

## 2. Durchgeführt: Feed-Route

Vorher: `src/routes/_authenticated/dev.tsx` mit 1681 Zeilen – Reiterlogik,
Filterregeln, Ranking-Anbindung, Beitragsdarstellung und Seitenzustand in einer
Datei.

Nachher (1031 Zeilen) plus zwei neue Module:

| Neu                                         | Inhalt                                                                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/feed-tabs.ts` (95 Z.)              | Reine Auswahl-Logik: Reiter, Filter (lokal/global/folge ich/Channels), Trending-Sortierung, Ortsnormalisierung. Kein React, kein Datenzugriff. |
| `src/components/feed/FeedPost.tsx` (603 Z.) | Darstellung eines Beitrags inkl. `SeenWatcher`; wiederverwendbar außerhalb der Route.                                                          |
| `tests/feed-tabs.test.ts`                   | 7 Tests für die Filterregeln (Ort, Folge-Liste, Channels, Trending).                                                                           |

Nutzen: Die Feed-Regeln sind jetzt ohne Browser testbar, und die Route
beschreibt nur noch Seitenaufbau und Zustand.

Prüfung: 404/404 Tests grün, Typprüfung und Lint grün. Feed als angemeldeter
Testnutzer geladen: 22 Beiträge gerendert, keine Konsolenfehler (nur bekannte
`[media] sign skipped`-Hinweise für fehlende Altobjekte).

---

## 3. Empfohlene nächste Schritte (nicht durchgeführt)

Bewusst offen gelassen, um Feed- und Messenger-Verhalten nicht in einem Schritt
zu gefährden. Reihenfolge nach Nutzen und Risiko:

1. **`src/lib/data.tsx` (2301 Z.)** – Schnitt entlang der Datenbereiche:
   Feedladen/Pagination, Beitragsaktionen (Like/Save/Share), Profil- und
   Medienauflösung. Der Kontext-Provider bleibt eine Datei, die Bereiche werden
   zu Hooks/Modulen. Risiko: mittel, viele Aufrufstellen.
2. **`src/components/Messenger.tsx` (1428 Z.)** – Schnitt entlang der Ansichten:
   Connections-Liste, Market-Liste, Chatfenster, Eingabezeile. Risiko: mittel,
   Lesestatus und Realtime hängen daran.
3. **`src/lib/social.tsx` (1539 Z.)** – Trennung Connections / Messenger /
   Benachrichtigungen. Voraussetzung für Schritt 2.
4. **`src/routes/auth.tsx` (858 Z.)** – Formulare (Login, Registrierung, Reset)
   als Teilkomponenten. Risiko: gering.

Für jeden Schritt gilt: erst reine Logik herausziehen und mit Tests absichern,
dann Darstellung trennen, dann `bun run verify` und Rauchtest
(`docs/RUNBOOK_CRITICAL_OPS.md` §6).

## 4. Nicht aufteilen

- Daten- und Übersetzungstabellen (`slangtag-catalog.ts`, `i18n-dict.ts`).
- Geschlossene Engines (`globe-engine.ts`, `SlangTagCanvas.tsx`).
- Generierte Dateien (`src/routeTree.gen.ts`, `src/integrations/supabase/*`).
- `admin.server.ts`: gleichartige, serverseitige Einzelfunktionen – eine
  Aufteilung würde nur Importwege verlängern.
