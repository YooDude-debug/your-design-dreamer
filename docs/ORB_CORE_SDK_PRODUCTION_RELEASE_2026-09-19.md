# ORB Core SDK – Production Release (19.09.2026)

Übernahme der geprüften ORB-Core-/SDK-Architektur aus Staging nach Production.
Keine neuen ORB-Funktionen, keine Datenbankmigration, keine Änderung an
Feed, Messenger, Market, SlangTags, Arena, Auth, Moderation, Payments, Ads.

## 1. Production-Baseline (vor dem Release, read-only geprüft)

- ORB-Code lag flach unter `src/lib/`: `orb-core.ts`, `orb-memory.ts`,
  `orb-presence.ts`, `orb-curiosity.ts`, `orb-continuity.ts`,
  `orb-continuity.server.ts`, `orb.server.ts`, `orb-feed.server.ts`,
  `orb-voice.server.ts`, `orb-avatar.ts`, `orb.functions.ts`,
  `use-orb-presence.ts`, `use-orb-avatar-mode.ts`.
- Kein `src/orb-core/`, kein `src/orb-sdk/`, kein `src/integrations/y-dude-orb/`.
- Y-Dude-Oberfläche importierte ORB-Logik direkt aus `@/lib/orb-*`.
- Datenbank: 10 ORB-Tabellen (Migrationen 0041–0045) mit RLS, anon ohne
  Rechte, authenticated nur eigene `user_id`.
- Status vor dem Release: Typecheck grün, 820 Unit-Tests grün, 77 DB-Security-
  Tests grün, Build OK.

## 2. Übernommener Staging-Stand

Read-only Snapshot des Staging-Projekts, Commit `0dde9cf1`.
Übernommen wurde ausschliesslich der ORB-Anteil.

## 3. Changeset

Neu (1:1 aus Staging, nur Kopfzeilen-Wortlaut „nur Staging“ → „experimenteller
Bereich“ entsprechend Production-Konvention):

- `src/orb-core/`: `core.ts`, `memory.ts`, `presence.ts`, `curiosity.ts`,
  `continuity.ts`, `continuity-store.server.ts`, `engine.server.ts`,
  `feed.server.ts`, `voice.server.ts`, **`context.ts` (neu)**
- `src/orb-sdk/`: `index.ts`, `orb-core.server.ts`
- `src/integrations/y-dude-orb/`: `orb.functions.ts`, `avatar.ts`,
  `use-orb-presence.ts`, `use-orb-avatar-mode.ts`
- `tests/orb-context.test.ts`, `tests/orb-sdk-contract.test.ts`

Entfernt (vollständig in die neue Struktur überführt): die 13 oben genannten
`src/lib/orb-*` / `use-orb-*`-Dateien.

Nur Importpfade geändert: `src/components/orb/OrbDevPanel.tsx`,
`OrbAvatarPicker.tsx`, `OrbFace.tsx`, `OrbRealFace.tsx`, `OrbGraph.tsx`,
`OrbInterests.tsx`, `OrbSuggestions.tsx`,
`src/routes/_authenticated/channels.orb.tsx`, sowie die bestehenden
ORB-Tests (`orb-core`, `orb-memory`, `orb-presence`, `orb-curiosity`,
`orb-continuity`, `orb-avatar`, `orb-presence-wait-fix`).

Bewusst **nicht** übernommen (nicht Teil dieses Releases):

- `src/server.ts` / `vite.config.ts` Static-Asset-Cache aus Staging
- `eslint.config.js`-Ignores, `package.json`-Abhängigkeiten
- Staging-Fassung von `tests/integration/db-orb-security.test.ts` (die
  Production-Fassung ist strenger: prüft auch `orb_threads` und `orb_style`)
- Staging-Migration `20260919075426` (Testdaten-Löschung)
- Staging-Wortlaut „nur Staging“ in Texten der Oberfläche

## 4. SDK-Architektur nach dem Release

```text
Y-Dude UI/Routen
   -> src/integrations/y-dude-orb (Adapter)
   -> src/orb-sdk (öffentliche Grenze)
   -> src/orb-core (privat)
   -> bestehende ORB-Tabellen
```

Geprüft: keine Datei außerhalb `src/orb-core/` und `src/orb-sdk/` importiert
`@/orb-core/*`; keine Referenz auf `@/lib/orb*` mehr vorhanden; keine doppelte
ORB-Implementierung (die alten Dateien sind entfernt, nicht kopiert).

## 5. Conversation-Context-Fix

Übernommen wie in Staging getestet:

- `CONTEXT_WINDOW_MESSAGES` begrenzt den Kontext auf die letzten 8
  Gesprächszeilen aus der bereits bestehenden Ablage `orb_messages`
  (eine zusätzliche Abfrage, festes Fenster, keine zweite Verlaufshaltung).
- Der Kontext geht als flüchtiger Hinweis in die Sprachschicht und ist
  ausdrücklich kein Langzeitgedächtnis.
- Bei einer ausdrücklichen Merk-Aufforderung wird die Aussage aus dem Kontext
  aufgelöst und über die **bestehende** Lern-/Speicherlogik verarbeitet
  (`shouldPersist`, Wichtigkeit, Konfidenz, Quelle, Dedup unverändert).
- Unverändert: Wichtigkeitsberechnung, Speicherschwelle, Relevanz, Decay,
  Reactivation, Confidence, Curiosity, Continuity, Presence.

## 6. Datenbank- und RLS-Status

- Keine Migration ausgeführt. Migrationsstand unverändert (0041–0045).
- Tabellen unverändert: `orb_nodes`, `orb_connections`, `orb_state`,
  `orb_messages`, `orb_metrics`, `orb_interests`, `orb_suggestions`,
  `orb_questions`, `orb_threads`, `orb_style`.
- RLS und Grants unverändert; durch die DB-Security-Tests bestätigt
  (RLS aktiv, jede Regel bindet `auth.uid()`, anon ohne Rechte).

## 7. Verifikation nach dem Release

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck (`tsc --noEmit`) | 0 Fehler |
| ESLint (ORB-Umfang) | 0 Fehler, 0 Warnungen |
| Build (`bun run build`) | erfolgreich, `build OK` im Build-Log |
| Unit-Tests gesamt | 845 Tests / 56 Dateien grün |
| ORB- und SDK-Tests | 167 Tests / 9 Dateien grün (inkl. 16 Conversation-Context-Regressionstests und SDK-Vertragstests) |
| DB-/Security-Tests | 77 Tests / 9 Dateien grün |
| Browser-Smoke (angemeldet) | erfolgreich, keine Konsolenfehler |

Projektweiter `bun run lint` meldet weiterhin Fehler in `backups/`,
`release/`, `remotion/` und `src/routes/flyer-konzepte.tsx`. Diese Meldungen
sind vorbestehend und nicht Teil dieses Releases (Staging ignoriert `release/`
und `migration/` per ESLint-Konfiguration; diese Konfigurationsänderung wurde
bewusst nicht übernommen).

## 8. Production-Smoke-Test (echtes Konto, `/channels/orb`)

- **Test A** – „Ich esse am liebsten Schnitzel und Brokkoli“, danach
  „Was esse ich gerne?“ → Antwort: „Du isst am liebsten Schnitzel und
  Brokkoli.“ **bestanden**
- **Test B** – danach „Merke dir mein Lieblingsessen“ → Antwort: „Ich merke
  mir: Dein Lieblingsessen ist Schnitzel und Brokkoli.“ Die Aussage wurde aus
  dem Gesprächskontext aufgelöst und über den bestehenden Lernpfad
  verarbeitet. **bestanden** (mit Einschränkung, siehe 10.)
- **Test C** – „Merke dir mein Lieblingsessen“ ohne passenden Vorkontext:
  **nicht sauber reproduzierbar**, da das Testkonto bereits Verlauf mit der
  Angabe besitzt und das 8-Zeilen-Fenster sie enthält. Belegt ist das
  Nachfragen aus einem früheren Lauf desselben Kontos ohne Kontext
  (09:22 UTC: „Merke dir mein Lieblingsessen“ → „Was ist dein
  Lieblingsessen?“). Ein sauberer Nachweis braucht ein Konto ohne ORB-Verlauf.

Keine Konsolenfehler. Keine autonome soziale Aktion. Regression geprüft: Feed,
Messenger-Overlay, Market, SlangTags, Globe, Arena, Auth, Moderation und
Payments wurden nicht angefasst; Typecheck, Tests und Build bestätigen den
unveränderten Rest.

## 9. Rollback

- Vorzustand vollständig gesichert unter
  `.lovable/backup/pre_orb_sdk_2026-09-19/` (alte `src/lib/orb-*`-Dateien,
  ORB-Komponenten, Channels-Routen, ORB-Tests).
- Rollback = diese Dateien zurückkopieren, `src/orb-core/`, `src/orb-sdk/`,
  `src/integrations/y-dude-orb/` entfernen, Importe zurücksetzen.
- Keine destruktive Rollback-Migration nötig, da keine Migration ausgeführt
  wurde. Kein Rollback durchgeführt.

## 10. Verbleibende Risiken und offene Punkte (nicht behoben)

1. **Beobachtung aus dem Smoke-Test (Verhalten des geprüften Changesets,
   nicht während des Releases geändert):** Existiert für den Satz „Merke dir
   mein Lieblingsessen“ bereits ein Gedächtnisknoten aus der Zeit vor dem Fix,
   greift zuerst die bestehende Exact-Match-Verstärkung (`norm_key`
   `lieblingsess-merke`, `activation_count` 4). Die aufgelöste Aussage wird
   dann nicht als neuer Knoten angelegt; die Antwort bezieht sich korrekt auf
   den Gesprächskontext. Neue Konten sind nicht betroffen. Separat zu
   entscheiden, nicht Teil dieses Releases.
2. Test C benötigt ein Production-Konto ohne ORB-Verlauf.
3. Multi-User-Isolation ist regelseitig vollständig geprüft (RLS/Grants,
   77 Tests), ein Lauf mit zwei echten Production-Konten fehlt weiterhin.
4. Spracheingabe (STT) im Sandbox-Browser nicht messbar (kein Mikrofon).
5. `orb_threads` und `orb_style` haben wie in Staging keinen Fremdschlüssel
   auf `auth.users` – bekannte, dokumentierte Einschränkung.
