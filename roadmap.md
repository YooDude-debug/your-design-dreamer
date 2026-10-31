# Roadmap: ORB Core vollständiger Cut

- [ ] Phase 1: Bestandsaufnahme aller ORB-Komponenten (read-only) — IN ARBEIT
- [ ] Phase 2: ORB deaktivieren (Production: Code; Staging: kein Zugriff aus dieser Session — manuell melden)
- [ ] Phase 3: Y-Dude bereinigen (ORB aus aktiver App entfernen, Kernfunktionen unverändert)
- [ ] Phase 4: Daten/Code sichern (keine unwiderruflichen Löschungen, keine Tabellen-Drops ohne Abhängigkeitsprüfung)
- [ ] Phase 5: Verifikation (Build, Lint, Tests, Funktionsprüfung) + Abschlussbericht

Regeln: Keine neuen Features, keine Refactorings, kein Design-Change. Unklare Zuordnung → anhalten und melden. Production-Code wird erst nach Befund-Freigabe verändert.
