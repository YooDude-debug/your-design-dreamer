# Roadmap: Y-Dude Vollständiger Systemaudit (Read-only)

Regeln: keine Fixes, keine Features, keine DB-/Datenänderungen, keine Production-Änderungen. Nur prüfen + dokumentieren. Befunde P0–P3 klassifizieren. Abschluss: PDF-Bericht in /mnt/documents.

## Aufgaben
- [ ] 1. Projekt-/Architekturprüfung (Struktur, Deps, tote Dateien/Routen, Env-Trennung)
- [ ] 2. Build & Tests: tsgo, lint, production build, vitest (Zahlen dokumentieren)
- [ ] 3. Funktionaler E2E-Test (Auth, Feed, SlangTags, Channels, Globe, Suche, Admin, Uploads) via Playwright
- [ ] 4. Datenbank & Datenintegrität (read-only Queries: Constraints, RLS, Policies, Konsistenz)
- [ ] 5. Sicherheit (Scan-Ergebnisse zusammenfassen, RLS/Storage/Secrets prüfen)
- [ ] 6. Performance (Bundle-Größe, Abfragen; keine Lasttests)
- [ ] 7. UI/UX & Gerätekompatibilität (Screenshots mobil + Desktop)
- [ ] 8. Logging & Betrieb (Fehlerbehandlung, Jobs, Deployment)
- [ ] 9. Fehlerklassifizierung P0–P3 mit Nachweisen
- [ ] 10. PDF-Abschlussbericht + Chat-Zusammenfassung
