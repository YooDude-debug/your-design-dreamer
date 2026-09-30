# Roadmap – ORB Scope-Trennung + Kontext 16

- [ ] Phase 1 DB: orb_scope, scope-Spalten (7 Tabellen), Unique-Indizes je Scope, Arbeitsindizes, Connection-Scope-Trigger
- [ ] Phase 2 Server-Eingang: Zod-Scope in allen ORB-Serverfunktionen, ORB-Dev fest orb_core
- [ ] Phase 3/4/6 Scoped Datenzugang (alle orb_*-Tabellen mit Scope) in SDK, Feed = unassigned
- [ ] Phase 5 Kontext 16 (proaktiv bleibt 8)
- [ ] Provenance: message_id bei user_stated
- [ ] Phase 7 Routing /channels/orb → /channels/orb/normal, /channels/orb/$scope
- [ ] Phase 8 Tests + Regression
- [ ] Phase 9 Forensik: DB-Isolation live, Browser drei Kanäle
- Deployment: NUR nach ausdrücklicher Freigabe
