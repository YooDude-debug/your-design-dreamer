# Y-Dude – Route- und Modulanalyse (Phase 3)

Stand: 2026-08-27. Bewertung der großen Dateien und der bereits durchgeführten
Modularisierung. Leitlinie: **keine künstliche Aufteilung** – nur dort trennen,
wo eine Datei mehrere klar unterschiedliche Aufgaben mischt.

---

## 1. Größte Dateien

| Datei                                    | Zeilen | Bewertung                                                        |
| ---------------------------------------- | -----: | ---------------------------------------------------------------- |
| `src/lib/data.tsx`                       |   2301 | Aufteilen sinnvoll (Feed, Posts, Profile, Medien in einem Kontext) |
| `src/lib/globe/slangtag-catalog.ts`      |   1831 | Datentabelle – bleibt (keine Logik)                              |
| `src/lib/i18n-dict.ts`                   |   1654 | Wörterbuch – bleibt                                              |
| `src/lib/social.tsx`                     |   1539 | Aufteilen sinnvoll (Connections, Messenger, Notifications)       |
| `src/components/Messenger.tsx`           |   1428 | Aufteilen sinnvoll (Liste, Chat, Market-Chat, Eingabe)           |
| `src/components/CreatePostDialog.tsx`    |   1241 | Grenzfall – eine zusammenhängende Aufgabe, hohe Kopplung         |
| `src/lib/admin.server.ts`                |   1209 | Bleibt: Sammlung gleichartiger Adminfunktionen, serverseitig     |
| `src/lib/globe/globe-engine.ts`          |   1072 | Bleibt: eine geschlossene 3D-Engine                              |
| `src/routes/_authenticated/dev.tsx`      |   1031 | **modularisiert** (vorher 1681)                                  |
| `src/components/SlangTagCanvas.tsx`      |    998 | Bleibt: ein Interaktionsmodell (Drag/Zoom/Rotate)                |

---

## 2. Durchgeführt: Feed-Route

Vorher: `src/routes/_authenticated/dev.tsx` mit 1681 Zeilen – Reiterlogik,
Filterregeln, Ranking-Anbindung, Beitragsdarstellung und Seitenzustand in einer
Datei.

Nachher (1031 Zeilen) plus zwei neue Module:

| Neu                                 | Inhalt                                                              |
| ----------------------------------- | ------------------------------------------------------------------- |
| `src/lib/feed-tabs.ts` (95 Z.)      | Reine Auswahl-Logik: Reiter, Filter (lokal/global/folge ich/Channels), Trending-Sortierung, Ortsnormalisierung. Kein React, kein Datenzugriff. |
| `src/components/feed/FeedPost.tsx` (603 Z.) | Darstellung eines Beitrags inkl. `SeenWatcher`; wiederverwendbar außerhalb der Route. |
| `tests/feed-tabs.test.ts`           | 7 Tests für die Filterregeln (Ort, Folge-Liste, Channels, Trending). |

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
