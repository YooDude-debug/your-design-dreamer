# Roadmap: ORB Core vollständiger Cut

- [x] Phase 1: Bestandsaufnahme — Bericht: /mnt/documents/ORB_Cut_Phase1_Bestandsaufnahme_2026-10-31.md
- [x] Nebenbefund: Preview-Absturz (lazyRouteComponent ".component" von undefined) durch erweiterte Stale-Bundle-Erkennung in src/lib/recover-stale-bundle.ts behoben
- [x] Phase 2: ORB in Production deaktiviert (Code entfernt; Staging: kein Zugriff aus dieser Session — separat zu erledigen)
- [x] Phase 3: Y-Dude bereinigt (Fehlerhelfer nach src/lib/internal-error.ts verschoben, Navigation/Build/Tests ORB-frei)
- [x] Phase 4: Daten unverändert (20 Tabellen, Migrationen 0041–0056, Storage unberührt); Code-Backup über Lovable-Versionshistorie (Sandbox-Git enthielt ORB nicht)
- [x] Phase 5: Verifikation — tsgo OK, 688/688 Tests, Lint 0 Fehler, Build OK, Browser-Rundgang (Feed/Channels/Admin/alte ORB-Route) sauber; Abschlussbericht: /mnt/documents/ORB_Cut_Abschlussbericht_2026-10-31.md

Offen (Nutzerentscheidungen):
- Publish nach y-dude.com (Production-Rollout) — liegt beim Nutzer
- OPENAI_API_KEY-Secret löschen (ORB-OpenAI-Pfad war unverdrahtet) — Nutzerentscheidung
- Staging-2.0-Cut — kein Zugriff aus dieser Session
- Späterer DB-Abbau (Tabellen-Drops) — separater Auftrag, nur nach Abhängigkeitsprüfung
