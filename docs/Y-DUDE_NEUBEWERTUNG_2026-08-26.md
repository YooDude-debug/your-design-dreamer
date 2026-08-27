# Y-Dude – Unabhängige Neubewertung (Stand 26.08.2026)

Ersetzt inhaltlich `docs/Y-DUDE_TECHNICAL_ASSESSMENT_2026-08-26.md` (frühere Zahlen sind veraltet).
Alle Werte wurden am 26.08.2026 direkt aus Code und Datenbank ermittelt.

---

## 1. Zentrale Frage

**Y-Dude ist nach aktueller technischer Betrachtung kein Hobbyprojekt mehr.**

Hauptklassifizierung: **professionelles Solo-Startup-Produkt** (Software-Reife nahe
Early-Stage-Startup, Business-/Betriebsreife noch darunter).

Begründung in Fakten: 108.500 Zeilen aktiver Anwendungscode, 113 Tabellen mit
durchgängig aktiver RLS und 280 Policies, 160 DB-Funktionen (111 SECURITY DEFINER),
124 Trigger, 221 Migrationen, 218 typisierte Server-Funktionen, echte
Stripe-Zahlungsstrecke mit signaturgeprüftem Webhook und Idempotenz, 371
automatisierte Tests inkl. RLS- und Auth-Vertragstests, eigene Observability-Schicht
mit Alert-Regeln und Admin-Dashboard, 5 Cron-Jobs, dokumentierter Incident- und
Recovery-Prozess. Nichts davon ist typisch für ein Hobbyprojekt.

---

## 2. Aktueller Codebase-Umfang (gemessen)

| Bereich                        | Wert                                              |
| ------------------------------ | ------------------------------------------------- |
| TypeScript (.ts)               | 52.520 Zeilen                                     |
| React (.tsx)                   | 43.866 Zeilen                                     |
| SQL (Migrationen)              | 11.527 Zeilen                                     |
| CSS                            | 628 Zeilen                                        |
| **Aktiver Code gesamt**        | **108.541 Zeilen**                                |
| Generiert (`routeTree.gen.ts`) | 1.397 Zeilen (nicht gezählt)                      |
| Geo-/Kartendaten (JSON)        | 329.427 Zeilen (nicht gezählt)                    |
| Routen                         | 64 (davon 8 API-Routen)                           |
| Komponenten                    | 119 Dateien                                       |
| lib-Module                     | 251 Dateien                                       |
| Server-Funktionen              | 218 in 28 Modulen                                 |
| Migrationen                    | 221                                               |
| DB-Tabellen (public)           | 113, **alle mit RLS**                             |
| RLS-Policies                   | 280                                               |
| DB-Funktionen                  | 160 (111 SECURITY DEFINER)                        |
| Trigger                        | 124                                               |
| Cron-Jobs                      | 5                                                 |
| Storage                        | 1 Bucket, 144 Objekte                             |
| Supabase Edge Functions        | 0 (bewusst: alles über TanStack Server Functions) |
| Tests                          | 11 Dateien, **371 Tests, alle grün**              |

Hinweis: Die frühere Angabe „118.839 Zeilen / 110 Tabellen“ zählte anders
(inkl. `js` und Backup-Pfade). Der reale aktive Code liegt bei ~108.500 Zeilen,
bei gleichzeitig gewachsener Datenbank (113 Tabellen) und Testabdeckung.

---

## 3. Architekturbewertung

| Bereich               | Bewertung | Begründung                                                                                                                                                                           |
| --------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend-Architektur  | 🟡        | TanStack Start, dateibasiertes Routing, klare Trennung `_authenticated/`, Design-Tokens. Aber: einzelne sehr große Route-Dateien (Feed/Profil) mit vermischter Logik und UI.         |
| Backend-Architektur   | 🟢        | 218 typisierte Server-Funktionen, konsequente `.server.ts`-Trennung, Auth-Middleware, CSRF-Middleware, Public-API nur unter `/api/public/*` mit eigener Authentifizierung.           |
| Datenbankarchitektur  | 🟡        | 113 Tabellen mit sauberen FKs, Indizes und Zählertriggern. Risiko: 113 Tabellen für ein Solo-Projekt sind hohe Pflegelast; Domänen (Social/Market/Arena/Ops) teilen ein Schema.      |
| RLS                   | 🟢        | 100 % der Tabellen mit RLS, 280 Policies, rollenbasierte Prüfung ausschließlich über `has_role`, Vertragstests (230) sichern das ab.                                                 |
| Rollen/Berechtigungen | 🟢        | Separate `user_roles`-Tabelle + `app_role`-Enum + SECURITY-DEFINER-`has_role`, keine Rollen im Profil. Genau das empfohlene Muster.                                                  |
| RPC-Struktur          | 🟡        | 160 Funktionen, gehärtet (`search_path`, gezielte GRANTs). Aber 111 SECURITY DEFINER sind viel Angriffsfläche und schwer vollständig zu überblicken.                                 |
| Authentifizierung     | 🟢        | Supabase Auth, Route-Gate, Bearer-Attacher, Audit-Log, Turnstile, DSGVO-Löschung/Export.                                                                                             |
| Storage               | 🟡        | Ein Bucket mit Policies und Cache-Headern, Bereinigung erfolgte. Aber: kein getrennter Staging-Bucket, Aufräumen teils manuell.                                                      |
| Medienpipeline        | 🟡        | Variantenkette, `decode()`-Rendering, Audio-Trimming, Backstop bei fehlenden Varianten – funktioniert, ist aber eigenentwickelt und hat historisch die meisten Regressionen erzeugt. |
| API-Struktur          | 🟢        | Webhooks/Cron klar getrennt, Signatur- bzw. Token-Prüfung vor Verarbeitung, Zod-Validierung.                                                                                         |
| Migrationen           | 🟢        | 221 chronologische Migrationen, im Clean-Room-Replay getestet (219/221).                                                                                                             |
| Externe Services      | 🟡        | Stripe, Lovable AI (Moderation/Übersetzung), Web Push, Turnstile – jeweils mit Fehlerbehandlung, aber ohne Fallback bei Ausfall eines Anbieters.                                     |
| Deployment            | 🟠        | Ein Cloudflare-Worker-Deployment pro Umgebung, aber kein CI-Gate: Tests laufen nicht automatisch vor Veröffentlichung, Rollback ist manuell.                                         |

---

## 4. Produkttiefe

**Social** 🟢 – Feed mit Keyset-Pagination, Ranking mit Diversity-Layer, Interest
Engine als eigenes Modul, Likes/Kommentare/Saves/Views inkl. Zähler-Trigger,
KI-Moderation mit Freigabe-Workflow. Deutlich mehr als ein CRUD-Feed.

**SlangTags** 🟢 – Eigenständige Kernidee: 1–5 s Audio, Trimming-Dialog,
freie Positionierung/Skalierung/Rotation in relativen 0..1-Koordinaten,
Owner-scoped Varianten, Typen `$` Community / `$$` Creator mit Freigabelogik,
Detailseiten mit Region/Bedeutung/Beispielen. Das ist der differenzierende Teil.

**Messenger** 🟢 – Konversationen mit Membership-Checks, getrennte Market-Chats,
lokalisierte Web-Push mit Bündelung/Throttling und Unterdrückung bei aktivem Chat,
Presence, atomarer Lesestatus über RPC, Bildversand mit SlangTag-Overlay,
Beitragsübersetzung. Auf dem Niveau kleiner kommerzieller Messenger-Module.

**Market** 🟡 – Artikel, Kategorien, Sprachsuche, Stripe-Checkout, signierter
Webhook mit Idempotenz, Transaktions-Zustandsmaschine, Abholcode (einmalig),
Versand, Refunds, Promotions, Abos. Fehlt: echtes Dispute-Handling und
belastbare Treuhand-Logik – Auszahlungen/Streitfälle bleiben manuell. Zudem
0 reale Transaktionen, d. h. produktiv unerprobt.

**Gamification** 🟡 – Arena mit Voting-Runden und RPC-gestützter Rundenlogik,
Slang Globe mit Three.js, eigener Physik/Inertia und LOD. Technisch stark,
aber ohne Nutzerbasis unbewiesen und mit hohem Pflegeanteil.

**Administration** 🟢 – 20 Admin-Routen (Moderation, Medien, Market, Statistik,
Livetest, Systemzustand, Feedback, Reports, Bans), KI-Moderation, Audit-Log,
Rollenprüfung serverseitig. Für ein Solo-Projekt ungewöhnlich vollständig.

---

## 5. Professioneller Sicherheitsrahmen – tatsächlicher Umsetzungsstand

**Phase 1 – Tests: umgesetzt** 🟢/🟡
371 Tests in 11 Dateien, alle grün: RLS-Vertragstests (230), Auth-Guards (27),
Environment-Trennung (27), Market-Transaktionen (22), Webhook-Signatur/Idempotenz (16),
Push-Texte (14), Feed-Ranking (8), Medienvarianten (6), Observability (12).
Charakter: Logik- und Vertragstests gegen Quelltext/Mocks. **Ungetestet:** UI/E2E
(kein Playwright in CI), echte DB-Integration gegen laufende Policies, Realtime,
Globe/Arena-Interaktion, Storage-Uploads, echte Stripe-Flows. Reale Zeilenabdeckung
grob 15–25 % – aber gezielt auf den riskanten Pfaden.

**Phase 2 – Staging: nur teilweise umgesetzt** 🟠
Umgesetzt: Umgebungserkennung (`environment.shared.ts`), serverseitige Guards,
Blockade von Live-Zahlungen außerhalb Production, 27 Tests.
Nicht getrennt: **Datenbank, Storage und Auth sind geteilt** (eine Supabase-Instanz),
Secrets sind geteilt, Stripe läuft insgesamt im Sandbox-Modus, Webhook-Endpunkte
unterscheiden sich nur per Hostname. Das ist Isolationslogik, keine echte
Umgebungstrennung.

**Phase 3 – Observability: umgesetzt** 🟢/🟡
`ops_events` + `ops_incidents` mit Admin-RLS, Severity/Area-Modell, Fingerprint-
Gruppierung, Schwellenwertregeln, Housekeeping, Health-Checks, Dashboard
`/admin/health`, Cron-Endpunkt, zentrale Fehlererfassung in `start.ts`,
Payment-/Push-/Auth-Instrumentierung, Performance-p95.
Einschränkungen: Alerting nur per optionalem Webhook (kein bestätigter Kanal),
`ops_events`/`ops_incidents` aktuell 0 Zeilen – die Pipeline ist im Produktivbetrieb
noch nicht durch echte Vorfälle bestätigt, und ein Test zeigt einen
Insert-Fehlerpfad im Mock. Kein externer Uptime-Check.

**Phase 4 – Betrieb/Recovery: dokumentiert, teils verifiziert** 🟡
Umgesetzt/verifiziert: Restore-Replay-Test (`scripts/restore-test.sh`, 219/221),
Runbook mit Severity-Modell, Incident-, Security- und Datenschutzprozess,
Smoke-Test-Liste, Supportkanäle (Feedback, Reports, Impressum-E-Mail,
`/request-data`, `/delete-account`).
Nicht umgesetzt: RPO/RTO unbelegt, Backup-Aufbewahrung der Plattform nicht
nachgewiesen, Secrets nicht im Backup, keine öffentliche Statusseite,
kein durchgeführter echter Ausfalltest (weil Staging die Production-DB teilt).

---

## 6. Vergleich mit einem typischen Hobbyprojekt

| Bereich       | Typisches Hobbyprojekt | Y-Dude                                                         |
| ------------- | ---------------------- | -------------------------------------------------------------- |
| Codeumfang    | 2.000–15.000 Zeilen    | 108.500 Zeilen aktiv                                           |
| Datenbank     | 5–15 Tabellen          | 113 Tabellen, 124 Trigger                                      |
| Auth          | Bibliotheks-Default    | Auth + Gate + Audit + Turnstile + DSGVO-Pfade                  |
| RLS           | keine oder „true“      | 280 Policies, 100 % Abdeckung, vertraglich getestet            |
| Rollen        | Boolean im Profil      | eigene `user_roles` + `has_role` (SECURITY DEFINER)            |
| API/RPC       | direkte Client-Queries | 218 Server-Funktionen, 160 DB-Funktionen, getrennte Public-API |
| Social-System | Liste + Like           | Ranking, Diversity, Interest Engine, Pagination                |
| Messenger     | oft keiner             | Presence, Push-Bündelung, Übersetzung, atomarer Lesestatus     |
| Payments      | keine                  | Stripe, Signatur, Idempotenz, Zustandsmaschine, Abos           |
| Moderation    | manuell/keine          | KI-Moderation + Freigabe-Workflow + Reports                    |
| Admin         | keins                  | 20 Admin-Routen inkl. Systemzustand                            |
| Tests         | 0                      | 371 grün                                                       |
| Monitoring    | console.log            | eigene Ops-Schicht mit Alert-Regeln                            |
| Staging       | keins                  | Isolationslogik, DB/Storage/Auth aber geteilt                  |
| Deployment    | manuell                | Ein-Klick, aber ohne CI-Gate                                   |
| DSGVO         | ignoriert              | Verarbeitungsverzeichnis, Export, Löschung, Retention          |
| Recovery      | keins                  | Runbook + getesteter Restore-Replay                            |

**Deutlich über Hobbyniveau:** Sicherheitsmodell (RLS/Rollen/Server-Boundaries),
Testverträge auf der Datenbank, Zahlungsstrecke, Moderation, Admin-Cockpit,
DSGVO-Umsetzung, Observability.

**Was die Einstufung „vollständig professionell betrieben“ noch verhindert:**
geteilte Datenbank zwischen Staging und Production, kein CI-Gate vor Deployments,
kein bestätigter Alarmkanal und kein externer Uptime-Check, unbelegte RPO/RTO,
keine E2E-Tests, sehr breite Feature-Fläche für eine Person, praktisch keine
reale Nutzung (13 Konten, 26 Beiträge, 0 Transaktionen, 1 Push-Abo).

---

## 7. Vergleich mit einem Early-Stage-Startup-Produkt

**Software-Reife: nah dran, teilweise darüber.** Architektur, Sicherheitsmodell,
Zahlungsintegration und Feature-Tiefe entsprechen dem, was seed-finanzierte Teams
nach 12–18 Monaten ausliefern. In RLS-Disziplin und Dokumentation liegt Y-Dude
über dem Durchschnitt solcher Produkte; in CI/CD, E2E-Tests und Umgebungstrennung
darunter.

**Business-Reife: klar darunter.** Keine belegte Nutzung, keine Umsätze (0
Transaktionen, Stripe im Sandbox-Modus), kein geschärfter Produktfokus – fünf
Domänen (Feed, SlangTags, Messenger, Market, Globe/Arena) konkurrieren um
dieselbe knappe Entwicklungszeit. Betriebserfahrung existiert für Regressionen
und Sicherheitsfindings, nicht für Last, Ausfälle oder Support-Volumen.

Fazit: technisch Early-Stage-Startup-Produkt, wirtschaftlich Pre-Launch.

---

## 8. Solo-Entwicklung (Näherung)

Die Werte unten sind grobe Erfahrungswerte, keine Messung.

- Typisches Solo-Projekt: 5.000–30.000 Zeilen, 1–2 Domänen.
- Kleines Team (2–4 Personen, 1 Jahr): 60.000–120.000 Zeilen.
- Startup-Team (5–8 Personen, 12–18 Monate): 150.000–400.000 Zeilen.

Y-Dude liegt mit 108.500 Zeilen aktivem Code, 113 Tabellen und fünf Produktdomänen
im Bereich eines kleinen Teams. Für einen einzelnen Entwickler ist das
ungewöhnlich groß – und genau das ist gleichzeitig das größte Betriebsrisiko:
die Wartungslast eines Teamprojekts liegt auf einer Person (Bus-Faktor 1).

---

## 9. Reife-Einschätzung (0–100, gerundet in 5er-Schritten)

| Dimension        | Wert | Begründung                                                                                                                                |
| ---------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Technische Reife | 80   | Saubere Server-Boundaries, typisierte RPC, getestete Migrationen; Abzug für sehr große Route-Dateien und 111 SECURITY-DEFINER-Funktionen. |
| Feature-Reife    | 85   | Fünf tief ausgebaute Domänen, eigenständige Kernidee; Abzug für unfertiges Dispute/Treuhand-Handling.                                     |
| Security-Reife   | 80   | 100 % RLS, korrektes Rollenmuster, Webhook-Signaturen, Vertragstests; Abzug für geteilte Secrets/Umgebungen und große Definer-Fläche.     |
| Test-Reife       | 55   | 371 grüne Tests auf den Risikopfaden, aber keine E2E-, DB-Integrations- oder UI-Tests und kein CI-Gate.                                   |
| Betriebs-Reife   | 50   | Monitoring und Runbook existieren, aber ohne echte Umgebungstrennung, ohne bestätigtes Alerting, ohne belegte RPO/RTO.                    |
| Produkt-Reife    | 45   | Funktional bereit, aber ohne reale Nutzung, ohne Umsatz und ohne fokussiertes Kernversprechen.                                            |

**Gesamt: 68/100** (Software stark, Betrieb und Produktvalidierung ziehen ab).

---

## 10. Größte Stärken

1. Durchgängige RLS auf allen 113 Tabellen – inklusive maschineller Vertragstests.
2. Korrektes Rollenmodell (`user_roles` + `has_role`), nicht im Profil.
3. Eigenständige Produktidee (SlangTag) mit echter technischer Tiefe statt Klon.
4. Zahlungsstrecke mit Signaturprüfung, Idempotenz und Zustandsmaschine.
5. Selbst gebaute Observability-Schicht mit Severity, Gruppierung und Dashboard.
6. 371 grüne Tests genau auf Geld-, Auth- und Datenschutzpfaden.
7. Vollwertiges Admin-/Moderations-Cockpit inkl. KI-Moderation und Audit-Log.
8. DSGVO-Umsetzung als Code (Export, Löschung, Retention, Verarbeitungsverzeichnis).
9. 221 Migrationen, im Clean-Room reproduzierbar eingespielt.
10. Konsequente Server-/Client-Trennung ohne Secrets im Browser-Bundle.

---

## 11. Größte Schwächen (nach Risiko)

1. **Staging teilt Datenbank, Storage und Auth mit Production** – jeder Test kann
   Produktionsdaten berühren; ein echter Ausfalltest ist unmöglich.
2. **Kein CI-Gate**: Deployments können ohne Testlauf veröffentlicht werden; die
   371 Tests schützen nur, wenn jemand daran denkt.
3. **Alerting ohne bestätigten Empfänger** und ohne externen Uptime-Check – ein
   Ausfall wird ggf. erst durch Nutzer bemerkt (`ops_events` ist noch leer).
4. **Bus-Faktor 1** bei Teamgröße-Codebasis: Wissen und Betrieb hängen an einer Person.
5. **111 SECURITY-DEFINER-Funktionen** sind eine große, dauerhaft prüfbedürftige
   Angriffsfläche; jede Änderung braucht bewusste Grant-/`search_path`-Disziplin.
6. **RPO/RTO unbelegt**, Secrets nicht Teil eines Backups – Wiederherstellung im
   Ernstfall zeitlich nicht kalkulierbar.
7. **Keine E2E-/Integrationstests**: die historisch häufigsten Fehler (Feed-Render,
   Medienvarianten, Scrollverhalten) sind gerade die untestbaren Bereiche.
8. **Feature-Breite vs. Kapazität**: fünf Domänen erzeugen mehr Wartung als eine
   Person dauerhaft tragen kann.
9. **Market wirtschaftlich unerprobt** (0 Transaktionen, Sandbox), Disputes/Treuhand
   nur manuell.
10. **Sehr große Route-Dateien** (Feed/Profil) erhöhen Regressionsrisiko bei
    UI-Änderungen.

---

## 12. Was fehlt bis „professionell betreibbar“?

**Bereits professionell genug**

- RLS, Rollen, Server-Boundaries, Auth-Gates
- Webhook-Sicherheit und Idempotenz
- Migrationsverwaltung und Restore-Replay
- Admin-/Moderationswerkzeuge, Audit-Log
- DSGVO-Pfade und Dokumentationslage

**Noch solide, aber ausbaufähig**

- Testabdeckung (Logik gut, Integration/E2E fehlt)
- Observability (vorhanden, aber im Ernstfall unbestätigt)
- Medienpipeline (funktioniert, hohe Eigenentwicklungsquote)
- Storage-Lebenszyklus (Bereinigung teilweise manuell)

**Noch kritisch**

- Echte Staging-Umgebung mit eigener Datenbank, eigenem Storage und eigenen Secrets
- CI-Gate: Tests + Security-Scan verpflichtend vor jeder Veröffentlichung
- Bestätigter Alarmkanal + externer Uptime-Check
- RPO/RTO belegen, Secret-Inventar mit Wiederherstellungsweg

**Für später**

- Öffentliche Statusseite
- E2E-Testsuite für Feed/Messenger/Checkout
- Lastprofil regelmäßig statt einmalig messen
- Aufteilung sehr großer Route-Dateien
- Reduktion der SECURITY-DEFINER-Fläche

---

## 13. Gesamturteil

- **Projektklassifizierung: professionelles Solo-Produkt** (technisch auf
  Early-Stage-Startup-Niveau, wirtschaftlich Pre-Launch). Kein Hobbyprojekt.
- **Technische Reife: 80 / 100**
- **Produktreife: 45 / 100**
- **Betriebsreife: 50 / 100**
- **Gesamt: 68 / 100**

---

## 14. Abschließende Frage

Ein externer Entwickler mit Einblick in den gesamten Code würde nicht
„Hobbyprojekt“ sagen. Er würde eine ernsthafte, umfangreiche Produktplattform
sehen: 108.500 Zeilen aktiver Code, 113 Tabellen mit 280 RLS-Policies, 218
Server-Funktionen, eine signaturgeprüfte Stripe-Strecke, 371 grüne Tests und eine
eigene Observability-Schicht. Auffallen würde ihm allerdings sofort dreierlei:
dass Staging und Production dieselbe Datenbank benutzen, dass keine CI die Tests
erzwingt und dass es bislang praktisch keine reale Nutzung gibt. Sein Urteil wäre
daher am ehesten: „technisch beeindruckend für eine Person, betrieblich noch nicht
abgesichert, produktseitig noch unvalidiert.“
