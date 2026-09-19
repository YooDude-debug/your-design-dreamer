# ORB Core – Deployment-Protokoll (Finalrunde)

Datum: 19.09.2026
Umgebung: Production
Status: **angehalten vor der Veröffentlichung** (siehe
`ORB_CORE_PRODUCTION_FINAL_AUDIT_2026-09-19.md`, Abschnitt 14)

---

## Ausgangszustand

ORB Core `0041`–`0043` war aktiv. Es fehlten eigene Fragen, Gedankenfäden und
Stilprofil. Vergleichsstand: Staging `90e8a129`.

## Ausgeführte Änderungen

Datenbank (additiv, je Schritt einzeln geprüft):

1. `0044_orb_core_questions` – `orb_questions` mit RLS, Grants, Indexen.
2. `0045_orb_core_threads_style` – `orb_threads` (Statusprüfung,
   `updated_at`-Trigger) und `orb_style`, ebenfalls mit RLS und Grants.

Nicht übernommen: Staging-Migration `20260919075426` (Löschbefehl für
Testdaten).

Code (ausschließlich ORB):

- neu: `orb-continuity.server.ts`, `orb-continuity.ts`, `orb-curiosity.ts`,
  `orb-presence.ts`, `use-orb-presence.ts`
- geändert: `orb-core.ts`, `orb.server.ts`, `orb.functions.ts`, `OrbChat.tsx`,
  `OrbDevPanel.tsx`, `OrbVoice.tsx`, `channels.orb.tsx`
- Tests: `orb-continuity.test.ts`, `orb-curiosity.test.ts`,
  `orb-presence.test.ts`, `db-orb-security.test.ts` (um Fragen, Fäden, Stil
  erweitert)
- Beschriftungen „nur Staging“ → „experimenteller Bereich“
- `src/integrations/supabase/types.ts` automatisch neu erzeugt

Unberührt: Feed, Messenger, Market, SlangTags, Globe, Arena, Channels, Auth,
Moderation, Payments, alle Tabellen außerhalb ORB.

Backup: `.lovable/backup/pre_orb_curiosity_2026-09-19/`

## Prüfungen nach jedem Schritt

Schema, RLS, Grants und Indexe wurden nach jeder Migration einzeln abgefragt
und stimmen mit dem Zielbild überein. `anon` hat auf keiner ORB-Tabelle Rechte.

## Ergebnis

Typprüfung, Build, ESLint (ORB), 809 Unit-Tests und 77
Datenbank-Sicherheitstests sind grün. Der Browsertest zeigt einen
funktionierenden Chat mit Gedächtnis, beständigen Avatar, keine Polling-Schleife
und keine Konsolenfehler.

Ein Gate ist rot: die Energie im Innenzustand erholt sich nie, wodurch ORB nach
einigen Dutzend Nachrichten dauerhaft keine eigene Frage mehr stellt und in
`stay_silent` verbleibt. Deshalb wurde **nicht veröffentlicht**.

## Rollback

Nicht erforderlich. Die beiden neuen Tabellen sind leer und additiv; ORB bleibt
in Production auf dem bereits vorher veröffentlichten Stand `0041`–`0043`.
Falls eine Abschaltung gewünscht ist: ORB-Route und Einstiegspunkt deaktivieren.
Keine destruktiven Rollback-Migrationen.

## Offene Punkte

- Energie-Erholung beheben (Freigabe nötig, Verhaltensänderung innerhalb ORB).
- Multi-User-Isolation mit zwei echten Konten.
- Spracherkennung im Browser nicht messbar.
- Frischer projektweiter Sicherheitsscan empfohlen.

---

## Nachtrag: Staging-Korrektur „vorgetäuschte Pause“

Ein frischer Staging-Abzug (`1258e89b`) enthielt die getestete Korrektur. Sie
fehlte in Production vollständig und wurde vollständig übernommen:
`orb-core.ts`, `orb-presence.ts`, `orb.server.ts`, `OrbChat.tsx` und
`tests/orb-presence-wait-fix.test.ts`. Keine neue Migration, keine Änderung an
Curiosity- oder Continuity-Architektur, keine Änderung außerhalb ORB.

Sicherung: `.lovable/backup/pre_orb_waitfix_2026-09-19/`

Ergebnis: Typprüfung, ESLint, Build grün; 820 Unit-Tests, 77
Datenbank-Sicherheitstests grün; Abnahmetest im Browser in allen fünf Fällen
bestanden; keine Konsolenfehler.

Status: **bereit zur Veröffentlichung, wartet auf ausdrückliche Freigabe.**
Es wurde noch nichts veröffentlicht.
