# Roadmap: Y-Dude Vollständiger Systemaudit (Read-only)

## Freigegebene Leerlaufoptimierung / Tiny – 2026-11-17
- [ ] Sichere Scheduler-Ablösung: QStash-Zugang nicht vorhanden; Konto und sichere Bereitstellung durch Auftraggeber erforderlich.
- [ ] Tiny: Mini bestätigt; ruhige 35%-RAM-Momentaufnahme reicht nicht; tatsächlicher Tiny-Dialogtarif und repräsentative Last fehlen.
- [ ] Drei Arbeitsqueues: blockiert durch Migrationsverbot; transaktionaler Moderations-Enqueue und dauerhafter Wake/Recovery fehlen im Bestand.
- [ ] Browser-/Vorschlagsoptimierungen: bis sichere Gesamtverarbeitung und Praxistests möglich sind zurückgestellt, bestehende Push-/Realtimewege erhalten.
- [x] Pflichtintervalle/Live-Code unangetastet; 66 lokale Vertrag-/Mocktests bestanden; vollständige Praxis-/Lasttests weiterhin blockiert.
- [x] Separate Testversion erstellt und eigene Test-DB bestätigt; read-only Vorbereitungsprüfung dort, keine Übernahme/Veröffentlichung.
- [x] Statusbericht in Files erstellt; keine Einsparung oder erfolgreiche Tiny-Umstellung behauptet; Produktionsänderungen zurückgestellt.

## Gezielte Leerlauf-Optimierungsanalyse – 2026-11-17
- [x] Automatische Pause/Wake-up, kleinere Instanz und Datenintegrität read-only geprüft; Besucher-Wake nicht unterstützt, Tiny-Kapazität unbewiesen.
- [x] Alle sieben aktiven Zeitpläne mit realen Funktionen und sicheren Laufnachweisen abgeglichen; 6.–9.11. 19.108 Scheduler-Starts, nicht Handler-Erfolgsnachweis.
- [x] Browserquellen und öffentliche Messung dokumentiert; angemeldeter Zugang fehlt, headless Tabwechsel blieb sichtbar (kein Background-Nachweis).
- [x] Szenarien A/B/C mit belegter Basis, bedingten Schätzungen und priorisierter Empfehlung in Files erstellt.
- [x] Keine Umsetzung; alle Jobs/Instanz/Daten/Secrets unverändert; spätere Maßnahmen erfordern ausdrückliche Freigabe.

## Reaktivierung und Credit-Kostenforensik – 2026-11-17
- [x] Bestehende Cloud reaktivieren; Datenbank/Auth erreichbar, Website/Desktop/Mobil öffentlich geprüft; ORB nicht reaktiviert.
- [x] Historische Credit-Aufzeichnungen 21.07.–17.11. sowie konkrete Tagesvergleiche erfasst; Buchungszeit von Ressourcenzeit getrennt.
- [x] Code, sieben aktive Jobs, Datenbank/Pool, Warteschlangen, KI und Storage read-only untersucht; keine Optimierungen/Veröffentlichung.
- [x] Aktive Nutzung gegen Tage ohne erfasste Besuche verglichen; 6.–9.11.: 10,019222096 Credits, davon 9,9072 DB.
- [x] Forensischen Bericht und zwei CSV-Belegtabellen in Files erstellt.
- [ ] Angemeldete Lesefunktionsprüfung und Hintergrundtab-Messung: blockiert bis Auftraggeber in Vorschau angemeldet ist (automatische Konto-Zuordnung fehlt).
- [ ] Historische Zuordnung jeder Serveranfrage und Kapazitätsspitzen: Handler-Historie/Lastzeitreihen fehlen; Scheduler-Startzuordnung am 17.11. nachträglich read-only belegt.

Regeln: keine Fixes, keine Features, keine DB-/Datenänderungen. Nur prüfen + dokumentieren. Befunde P0–P3. Abschluss: PDF in /mnt/documents.

## Aufgaben
- [x] 1. Architektur (Subagent): Struktur sauber; Fundstellen: große Provider (data.tsx 2482 Z., social.tsx 1705 Z.), ~10 ungenutzte Module, 2 öffentliche Demo-Routen (/demo/messenger, /flyer-konzepte), Env-/Payment-Trennung inkonsistent (APP_ENV vs. Hostname), backups/ im Repo
- [x] 2. Build & Tests: tsgo 0 Fehler; eslint 0 Fehler / 56 Warnungen; vitest 688/688 (48 Dateien); Harness-Build OK
- [x] 3. E2E Desktop: 12 Routen alle 200, korrekte Titel, Weiterleitungen korrekt; nur Turnstile-400 (Sandbox) + abgebrochene Preloads
- [x] 4. DB: RLS auf allen public-Tabellen aktiv; 3 interne Tabellen ohne Policies = ohne Grants (korrekt); keine Waisen in posts/comments/messages/follows; Bestandszahlen erfasst
- [~] 5. Sicherheit: Schnellscan 11 Befunde, alle vom Nutzer ignoriert (RLS-Tautologien auf geteilten Inhalten); Dependency-Scan: 11 Advisories (zod high, seroval moderate, source-map-js high, js-yaml moderate); Tiefenscan LÄUFT (Benachrichtigung ausstehend)
- [x] 6. Performance: kein manueller Build (Harness regelt); Bundle-Größe nicht messbar → als „nicht geprüft" dokumentiert; keine Lasttests (keine isolierte Umgebung)
- [x] 7. UI/UX mobil (393×852): kein horizontales Overflow, keine Konsolenfehler; P3: Globe-Filter „ALLE KATEGORIEN" mobil abgeschnitten
- [x] 8. Betrieb: 8 Worker-Endpunkte unter /api/public mit Shared-Secret (timing-safe); Moderation mit eigener Auth-Implementierung (Drift-Risiko); Storage: 1 Bucket „media", privat, ohne Größen-/MIME-Limit
- [ ] 9. Fehlerklassifizierung P0–P3 finalisieren (nach Tiefenscan)
- [ ] 10. PDF-Abschlussbericht + Chat-Zusammenfassung (nach Tiefenscan)
