# Y-Dude – Projekt- und Produktivitätsanalyse

**Solo-Founder + KI: Entwicklungsgeschwindigkeit, Produktreife und Marktvergleich**

Auftragszeitraum: 01.08.2026 – 09.09.2026 · Analysezeitpunkt: 07.09.2026, 07:30 UTC · Modus: read-only Analyse (kein Code, kein Schema, keine Policy, kein Deployment verändert)

## 0. Bewertungsgrundlage und Datenlage

Jede Aussage ist als **FAKT** (im Projekt direkt messbar), **MESSUNG** (in diesem oder einem dokumentierten Lauf erhoben), **VERGLEICH** (externe, verlinkte Quelle) oder **EINSCHÄTZUNG** (qualitatives Urteil) gekennzeichnet.

| Punkt | Status |
| --- | --- |
| Vollständig verfügbar | Änderungshistorie (Commits mit Datum), Datenbankstand live, Migrationsdateien, Quellcode, Testsuite, 93 interne Berichte in `docs/`, 13 archivierte Planungen, Lasttest-Rohdaten |
| Teilweise verfügbar | Release-/Deployment-Historie nur über interne Berichte, nicht über eine Deployment-API; Commit-Nachrichten der Verlaufsdaten sind größtenteils generische Editor-Einträge |
| Nicht verfügbar | Arbeitszeiten in Stunden, Aufteilung „menschliche Tastatureingabe vs. KI-generierte Zeilen“, Nutzerzahlen/Retention, Umsatz, Fehler-Telemetrie vor dem 06.09.2026 |
| Zeitraum-Einschränkung | Der Auftrag nennt 01.08.–09.09.2026. Heute ist der **07.09.2026**. Der 08.09. und 09.09. liegen in der Zukunft und werden nicht bewertet – hier steht ausdrücklich „noch nicht eingetreten“ statt einer Schätzung. |

Der Zeitraum vor dem 01.08.2026 (24.07.–31.07.2026, 363 Änderungsschritte) ist nachweisbar, gehört aber nicht zum Auftragsfenster; er wird nur als Vorlaufkontext genannt.

## 1. Executive Summary

**MESSUNG.** Im Auftragsfenster 01.08.–07.09.2026 (38 Kalendertage) sind **5.286 Änderungsschritte** an 38 von 38 Tagen nachweisbar, dazu **213 Datenbank-Migrationen im August**, **4 weitere im September**, **76 datierte Fachberichte**, **35 Testdateien mit 607 automatisierten Tests** und ein live gemessener Lasttest bis 750 gleichzeitige Nutzer ohne Serverfehler.

**FAKT.** Der Stand ist ein live erreichbares, öffentlich registrierbares Produkt (`https://y-dude.com`) mit 124 Datenbanktabellen, 301 Zugriffsregeln, 178 Datenbankfunktionen (davon 127 mit erhöhten Rechten), 136 Triggern, 349 Indizes, 40 Aufzählungstypen, 70 Routendateien, 135 Oberflächenkomponenten, 45 serverseitigen Funktionsmodulen und 12 Übersetzungsmodulen bei ca. 110.000 Zeilen Anwendungscode.

**EINSCHÄTZUNG.** Der Umfang entspricht nicht einem Prototyp, sondern einem betriebsfähigen Produkt mit mehreren eigenständigen Teilprodukten (Social-Feed, Messenger, Marktplatz, SlangTag-System, Werbe-/Creator-Ökonomie, Admin- und Moderationsapparat, Globe-Visualisierung). Das ist für eine Einzelperson in 38 Tagen ungewöhnlich viel – die entscheidende Leistung liegt aber weniger im Erzeugen von Code als in **Entscheidungsdisziplin**: dokumentierte Audits vor Änderungen, konsequentes Zurückschneiden von Funktionsumfang (Stripe/Zahlungen, Ticket- und Abholcode-System entfernt) und ein durchgehend serverseitig abgesichertes Berechtigungsmodell.

**VERGLEICH (wichtig, gegen die naheliegende Übertreibung).** Es gibt **keine belastbaren öffentlichen Vergleichsdaten**, die eine Aussage wie „x-mal schneller als ein Team“ tragen würden. Die rigorose Forschungslage zu KI-Programmierhilfen ist widersprüchlich: eine kontrollierte Studie von Microsoft/GitHub misst 55,8 % schnellere Erledigung einer engen Programmieraufgabe (arXiv:2302.06590), eine randomisierte METR-Studie 2025 misst bei erfahrenen Entwicklern in echten Repositorien **19 % Verlangsamung** (metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/), und der DORA-Report 2025 verzichtet ausdrücklich auf einen einheitlichen Produktivitätsfaktor (dora.dev/dora-report-2025/). Jede Zahl der Art „KI machte es N-fach schneller“ wäre in diesem Bericht unbelegt.

**Gesamtbewertung: 8,0/10 · Reifegrad: BETA / frühe Production** (Begründung in Abschnitt 20).

## 2. Y-Dude Projektumfang (FAKT, im Projekt gezählt)

| Bereich | Nachweisbarer Umfang | Komplexitätsurteil |
| --- | --- | --- |
| Authentifizierung / Registrierung | Eigene Auth-Route, serverseitige Registrierung mit Captcha-Pflicht, verzögertes Laden der Sicherheitsprüfung, Passwort-Reset, Login mit Server-Validierung | hoch |
| Alterslogik | Geburtsdatumsprüfung ab 14, Datenbankfunktionen `age_status_of(date)` / `my_age_status()`, Minderjährigenschutz an Werbung und Sichtbarkeit gekoppelt | hoch (rechtlich relevant) |
| Turnstile / Missbrauchsschutz | Serverseitige Prüfung fail-closed (`turnstile.server.ts`), Widget nur nach Zustimmung, IP-Rate-Limits für öffentliche Transkription | hoch |
| Rollen / Rechte | Eigene `user_roles`-Tabelle, `has_role()` als Funktion mit erhöhten Rechten, Owner-Ebene, Owner-Vergabefunktion, Audit-Log | hoch |
| Datenbank / Security | 124 Tabellen, 301 Policies, 127 Funktionen mit erhöhten Rechten, 136 Trigger, 349 Indizes, 231 Migrationsdateien | sehr hoch |
| Feed / Social | Beiträge, Likes, Kommentare, Speichern, Teilen, Views, Video-Views, Hashtags, Kanäle, Follows, Verbindungen, Feed-Signale, Interessen-Scores, Diversitätslogik | sehr hoch |
| Messenger | Konversationen, Mitglieder, Nachrichten, Lesestatus, Übersetzungen, Vorlesefunktion, Demo-Modus | hoch |
| Market | Artikel, Bilder, Kategorien, Favoriten, Angebote, Reservierung, Verkauf, Promotionen, Verkäuferprofile, Streitfälle, Analytics | hoch |
| SlangTag | Eigene Tag-Objekte (56 Spalten), Rechtevergabe, Drops, Likes/Saves/Shares/Plays, Definitionen mit Übersetzungen, Moderationsereignisse, öffentlicher Tester | sehr hoch |
| Moderation | Reports, Moderationsaktionen, Einsprüche, Kanalbans, Nutzerbans, Verwarnungen, Moderationsprotokoll, Job-Warteschlange | hoch |
| Werbe-/Creator-Ökonomie | Kampagnen, Testevents, Pausen, Präferenzen, Kampagnenlimits pro Tarif, Creator-Abos und -Preise | hoch |
| Analytics / Observability | Interaktionsereignisse, Zählwerk-Events, Registrierungs-Telemetrie (10 Ereignistypen), Health-Checks, Ops-Ereignisse und -Vorfälle | mittel bis hoch |
| Internationalisierung | 12 Übersetzungsmodule, Nachrichten-/Beitrags-/Kommentar-/Definitions-Übersetzungstabellen | mittel bis hoch |
| Performance / Mobile | Öffentlicher Antwort-Cache, Medien-Varianten/CDN, Code-Splitting, 390-px-Prüfungen, Lasttest bis 750 Nutzer | mittel bis hoch |
| Tests / Qualität | 35 Testdateien / 607 Tests, DB-Integrationstests, Playwright-E2E-Suiten, Regressionstests zu Turnstile, Rollen, RLS, Zahlungs-Webhooks | hoch |
| Deployment / Betrieb | Live-Domain plus Custom-Domain, Runbooks für Vorfall und kritische Abläufe, Rollback-Pakete, Release-Berichte | mittel bis hoch |

**EINSCHÄTZUNG.** Nicht die Anzahl der Bildschirme ist bemerkenswert, sondern die **Querschnittsanforderungen**: Alterslogik, Rollen, Sichtbarkeiten und Werbeschutz greifen quer über Feed, Market, SlangTag und Messenger. Diese Art Kopplung ist der übliche Punkt, an dem Ein-Personen-Projekte kippen; hier ist sie stattdessen in Datenbankfunktionen und Policies zentralisiert.

## 3. Entwicklung August 2026 (MESSUNG)

**5.128 Änderungsschritte an 31 von 31 Tagen, 213 Datenbank-Migrationen, 44 datierte Fachberichte, 13 archivierte Planungen (11 davon am 08.08.).**

Tagesspitzen: 13.08. (488), 08.08. (444), 03.08. (473), 06.08. (377), 22.08. (335), 27.08. (290). Ruhigste Tage: 09.08. (9), 16.08. (5).

Nachweisbare Arbeitsschwerpunkte (aus den datierten Berichten):

| Phase | Datum | Inhalt |
| --- | --- | --- |
| Feature-Aufbau | 01.–13.08. | Feed/Social/Werbekernel-Audit, Arena, Globe-Entkopplung, SlangTag als persönliche Varianten, Testdaten, Navigation/Gesten |
| Backend-Optimierung | 14.–15.08. | Backend-Optimierung Stufe 1 und 2, Caching-Layer-Messung, Lasttest |
| Marktplatz-Architektur | 22.–24.08. | Bildvarianten, Y-Dude-Market-Architekturplan |
| Stabilisierung | 26.–27.08. | Sicherungsnetz, Phasen 1–6: Testbericht, Umgebungstrennung, Observability, Betrieb/Recovery, Deployment-Security, Ausfallsicherheit; Rechts-Audit, Realtime-Sicherheit, Route-Architektur, Werbesystem-Audit, Gesamtanalyse |
| Umgebungstrennung | 28.08. | Staging-Optionen/-Prüfung/-Trennung, Zahlungsoptionen, technischer Auszug |
| Production-Absicherung | 29.–31.08. | RLS-Audit öffentlicher Policies, Checkpoints nach Migration 7/8/9, Performance-Release, Root-Cause-Audit, Creator-Eligibility, Business-Kampagnen V1, Creator-Abo V1, Registrierungs-UX, Stripe-Laufzeittest, Lasttest 750 Nutzer, iPhone-Responsive-Fix |

**EINSCHÄTZUNG.** Der August hat zwei klar unterscheidbare Hälften: bis ca. 13.08. Funktionsaufbau, ab 26.08. systematische Härtung. Der Wechsel von „bauen“ zu „belegen“ ist der wichtigste Reifeschritt des Monats – ab da existieren zu praktisch jeder Änderung ein Auditbericht, ein Testnachweis und ein Rollback-Pfad.

## 4. Entwicklung 01.–07. September 2026 (MESSUNG)

**158 Änderungsschritte, 4 Datenbank-Migrationen (0028–0031), 22 Fachberichte in 7 Tagen.** Der 08.–09.09. ist noch nicht eingetreten.

| Datum | Nachweisbarer Inhalt |
| --- | --- |
| 01.09. | Video-Business V1 (Preflight, Rebase, Release), Sicherheitsprüfung öffentlicher Transkription, Review ignorierter Sicherheitswarnungen |
| 02.09. | Production→Staging-Abgleich, Staging-Schema-Audit |
| 03.09. | Benennung der Umgebungen vereinheitlicht |
| 04.09. | Release R2 final |
| 05.09. | FuE-Analyse (Förder-Ankerprojekt), read-only |
| 06.09. | Vollständiger Production-Audit (42 Befunde), Datenbank-Verifikationsgate, Security-Gate anon-EXECUTE, gezielte Härtung (2 Rechte entzogen), Registrierungs-Telemetrie, Staging→Production-Übernahme, Admin-/Owner-Rechte für zweite Person |
| 07.09. | Market-/SlangTag-Übernahme (Ticket-/Abholcode-System und Tester-Captcha entfernt), verzögerter Turnstile-Mount, vollständiger Production-Gesamtaudit inkl. PDF |

**EINSCHÄTZUNG.** Die Septemberwoche ist fast vollständig Qualitäts-, Sicherheits- und Reduktionsarbeit – nur ein neues Funktionsthema (Video-Business V1) am 01.09. Das ist das Verhaltensmuster kurz vor bzw. nach einem Produktivstart, nicht das einer Aufbauphase. Die Änderungsdichte fällt von 165/Tag im August auf 23/Tag – das ist keine Verlangsamung im negativen Sinn, sondern der Wechsel zu größeren, geprüften Einzelschritten.

## 5. Mensch-KI-Arbeitsmodell (EINSCHÄTZUNG mit belegten Indizien)

Klar trennbar an den Artefakten:

| Rolle | Belegbarer Anteil |
| --- | --- |
| Mensch (Auftraggeber) | Produkt- und Architekturentscheidungen, Scope-Grenzen („nur diese Änderung“, „keine neuen Features“), Ablehnung von Bequemlichkeitslösungen (Security nicht aufweichen), Priorisierung, Freigabe/Sperre von Deployments, echte Geräteprüfung auf Android, Bereitstellung der Staging-Pakete, Entscheidung zum Entfernen von Stripe/Zahlung und Ticketsystem |
| KI (Lovable-Agent) | Codeerzeugung, Migrationsentwürfe, Testerzeugung, Audits/Messläufe, Debugging-Hypothesen, Dokumentation und Berichte, Browser-Prüfläufe, PDF-Erstellung |
| Automatisierte Werkzeuge | Typprüfung, 607 Tests, Playwright, Build, Datenbank-Linter, Sicherheitsscanner, `pg_stat_statements`, Lasttest-Skripte |
| Lovable-Plattform | Projektgerüst (TanStack Start, Vite, Tailwind), Backend-Bereitstellung, Auth-/Client-Integration, Deployment, Secrets |
| Manuelle Prüfung | Sichtprüfung auf echtem Gerät (der Turnstile-Erfolgsfall ist automatisiert nachweislich nicht auslösbar), Prüfung der Berichte, Abbruch bei Fehlbefund |

Indizien für Qualität der Zusammenarbeit (FAKT): 93 Berichte in `docs/`, davon 76 datiert; 13 archivierte Planungen mit vorheriger Freigabe; wiederkehrende Auftragsformel „erst analysieren, nicht blind überschreiben, bei FAIL nicht erfolgreich melden“; mehrere Läufe, die ausdrücklich als **NICHT VERIFIZIERBAR** oder **NICHT FREIGEGEBEN** endeten statt als Erfolg.

**EINSCHÄTZUNG.** Die KI war nicht nur Code-Generator, sondern auch in Architektur, Debugging, Tests, Sicherheit, Analyse, Dokumentation und Migration im Einsatz. Der Ertrag hängt jedoch nachweisbar an drei menschlichen Leistungen, die kein Modell übernimmt: **Scope-Grenzen setzen**, **Belege verlangen** und **Freigaben verweigern**. Genau an diesen drei Punkten scheitern KI-gestützte Projekte typischerweise; dass sie hier dokumentiert eingehalten wurden, erklärt den Reifegrad besser als jede Tippgeschwindigkeit.

## 6. Technische Komplexität (EINSCHÄTZUNG, 0–10)

| Dimension | Wert | Begründung |
| --- | --- | --- |
| Datenmodell | 9 | 124 Tabellen, 40 Aufzählungstypen, 136 Trigger, stark verschränkte Sichtbarkeitslogik |
| Berechtigungsmodell | 9 | 301 Policies, Rollen in eigener Tabelle, 127 Funktionen mit erhöhten Rechten, Owner-Ebene, Audit |
| Serverlogik | 8 | 45 serverseitige Funktionsmodule, fail-closed Prüfungen, Webhook-Signaturprüfung, Idempotenz |
| Frontend | 8 | 70 Routen, 135 Komponenten, Medien, Video, Globe, Gesten, Übersetzungen |
| Betrieb | 7 | Runbooks, Rollback-Pakete, Observability, Lasttest; ein gemeinsames Backend für Vorschau und Produktion bleibt offener Punkt |
| Qualitätssicherung | 8 | 607 Tests, DB-Integrationstests, E2E; Codeprüfung (Lint) noch nicht grün |

## 7. Produktreife (EINSCHÄTZUNG, gestützt auf den Gesamtaudit vom 07.09.)

| Kriterium | Wert | Kurzbegründung |
| --- | --- | --- |
| Technische Reife | 8 | Typprüfung, Tests, Build fehlerfrei; Architektur konsistent; Codeprüfung mit 9.982 Meldungen offen |
| Funktionale Reife | 9 | Alle Hauptbereiche vorhanden und bedienbar, klare Leerzustände |
| UX | 7,5 | Durchgängig deutsch, verständlich, aber viele Tippziele unter 40 × 32 px, Sprachauszeichnung der Seite falsch |
| Mobile | 8 | Kein horizontaler Überlauf bei 390 px, mobil schnellere Ladezeiten als Desktop |
| Performance | 7 | Startseite Desktop 3,2 s bis erster Inhalt, 99–176 Anfragen je eingeloggte Seite, Globe-Daten 1,6 MB |
| Security | 8 | Serverseitige Validierung, fail-closed Captcha, RLS überall; 3 Tabellen ohne Policy, 5 anonym ausführbare Funktionen mit erhöhten Rechten offen |
| Stabilität | 9 | 0 JavaScript-Fehler über 10 Routen; Lasttest 750 Nutzer, 49.952 Anfragen, 0 Serverfehler |
| Production Readiness | 8 | Live erreichbar, Registrierung funktioniert technisch, Rollback und Runbooks vorhanden; echter Anmeldedurchlauf inkl. E-Mail-Bestätigung noch nicht end-to-end belegt |
| Produktklarheit | 7 | Kernversprechen (Sprache/Slang lokal, global verbinden) klar; die Breite aus Feed + Market + Messenger + Arena + Globe erschwert die Vermittlung in einem Satz |
| **Gesamt** | **8,0** | betriebsfähiges Beta-Produkt mit offener Nutzervalidierung |

## 8. Produktivitätsbewertung (MESSUNG)

38 nachweisbare Arbeitstage (01.08.–07.09.2026), keine Lücke.

| Kennzahl | Wert |
| --- | --- |
| Änderungsschritte | 5.286 (August 5.128 · September 158) |
| Datenbank-Migrationen | 217 im Fenster (213 August, 4 September) von 231 + 31 gesamt |
| Größere Arbeitspakete (aus datierten Berichten ableitbar) | 66 |
| Dokumentierte Release-/Übernahmevorgänge | 16 (u. a. R2 final, Video-Business V1, Business-Kampagnen V1, Creator-Abo V1, Market/SlangTag, Turnstile-Mount, Staging-Übernahme) |
| Dokumentierte Audit-/Prüfläufe | 21 |
| Dokumentierte Sicherheits-/Stabilitätsmaßnahmen | 9 (RLS-Audit, anon-EXECUTE-Härtung, Transkriptionsschutz, Realtime-Scoping, Umgebungstrennung, Rechts-Audit, Recovery, Observability, Verifikationsgate) |
| Automatisierte Tests | 607 in 35 Dateien plus Playwright-Suiten |
| Produktive Bereiche | 10 (Registrierung/Auth, Feed/Social, Messenger, Market, SlangTag, Arena, Globe, Kanäle, Profile, Admin/Moderation) |
| Bugfix-/Fehlerbehebungsberichte | 8 (u. a. lange Beiträge, Produktionsfehler, iPhone-Responsive, Turnstile-Zustand, Werbeschalter) |
| Lasttest | 5 Stufen bis 750 Nutzer, 94.720 Anfragen gesamt, 1 Zeitüberschreitung, 0 Serverfehler |

**EINSCHÄTZUNG.** Pro Arbeitstag entstehen im Schnitt 1,7 dokumentierte Arbeitspakete, 5,7 Migrationen und rund 2.900 Codezeilen Zuwachs (grob, ohne Löschungen). Das ist deutlich mehr Volumen als ein einzelner Mensch ohne Werkzeuge erzeugt – und es ist genau die Zahl, die man nicht überinterpretieren darf: Volumen ist kein Qualitätsmaß. Belastbarer ist, dass diesem Volumen 607 Tests, 21 Prüfläufe und ein Lasttest gegenüberstehen.

## 9. Vergleich A: Solo ohne KI (VERGLEICH + EINSCHÄTZUNG)

Belastbare, wissenschaftlich sauber erhobene Zahlen zur Bauzeit vergleichbarer Systeme existieren **nicht**. Verfügbar sind ausschließlich Agentur- und Anbieterschätzungen, die kommerzielle Werbeinhalte sind: 6–15 Monate und 35.000–80.000 USD für eine Social-MVP (projecto-calculator.com/cost-to-build/social-network-app), 3 Monate bis 2 Jahre und 25.000–300.000 USD für ein individuelles Social Network (in Lovables eigener Anleitung zitiert, lovable.dev/guides/how-to-build-social-network-without-coding).

**Einordnung:** Ein Umfang wie Y-Dude – 124 Tabellen, 301 Policies, Marktplatz, Messenger, Moderation, Werbe- und Creator-Ökonomie – ist für eine Einzelperson ohne KI-Unterstützung in 38 Tagen realistisch **nicht** erreichbar; auch ohne exakte Vergleichsstatistik ist das eine sichere Aussage, weil allein die 231 Migrationen und 607 Tests handgeschrieben mehr Zeit binden. Als grobe Größenordnung wären mehrere Monate bis über ein Jahr anzunehmen – ausdrücklich als Einschätzung, nicht als Messung.

## 10. Vergleich B: Solo mit modernen KI-Werkzeugen (VERGLEICH)

Rigorose Datenlage, bewusst gegenläufig dargestellt:

| Quelle | Befund | Charakter |
| --- | --- | --- |
| Microsoft/GitHub Copilot-RCT (arXiv:2302.06590) | 55,8 % schneller bei einer engen Programmieraufgabe (HTTP-Server) | randomisierte Studie, aber sehr schmaler Aufgabenzuschnitt |
| METR 2025 (metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/, arXiv:2507.09089) | erfahrene Entwickler waren mit KI-Werkzeugen **19 % langsamer**, hielten sich aber für 20 % schneller | randomisierte Studie in echten Repositorien |
| DORA-Report 2025 (dora.dev/dora-report-2025/) | KI wirkt als „Verstärker“ bestehender Stärken/Schwächen; kein einheitlicher Faktor | große Branchenumfrage, Selbstauskunft |
| Stack Overflow Survey 2024 (survey.stackoverflow.co/2024/ai) | 76 % nutzen KI oder planen es, Vertrauen wächst langsamer als Nutzung | große Umfrage, Selbstauskunft |
| GitHub/Accenture (github.blog) | ca. 30 % Annahmequote von Vorschlägen, positive Effekte | anbieterfinanziert |

**EINSCHÄTZUNG.** Y-Dude liegt in der oberen Spanne dessen, was mit KI-Unterstützung solo erreichbar scheint – aber der Vorsprung stammt nach der Aktenlage weniger aus Codegeschwindigkeit als aus **Prüf- und Dokumentationsdurchsatz**: Audits, Testerzeugung, Migrationsprüfungen und Berichte sind die Arbeiten, die ein Mensch allein üblicherweise auslässt. Die METR-Studie warnt zugleich davor, gefühlte Beschleunigung mit echter zu verwechseln; darum ist hier ausschließlich das dokumentierte Ergebnis bewertet.

## 11. Vergleich C: kleines Entwicklerteam (2–5 Personen) (EINSCHÄTZUNG)

Keine belastbaren Vergleichsdaten für ein identisches Funktionsbündel verfügbar. Qualitative Einordnung:

- **Volumen/Tempo:** Y-Dude erreicht in 38 Tagen einen Umfang, für den ein 3–4-köpfiges Team üblicherweise mehrere Monate ansetzt.
- **Wo ein Team besser wäre:** unabhängiges Review durch eine zweite Person, Lasttests unter echten Nutzern, Design-/UX-Spezialisierung (die vielen kleinen Tippziele sind ein typischer Solo-Befund), Bereitschaftsdienst im Betrieb.
- **Wo Y-Dude gleichwertig oder besser ist:** Dokumentationsdichte (93 Berichte), Testabdeckung sicherheitskritischer Pfade, Entscheidungsgeschwindigkeit ohne Abstimmungsaufwand.
- **Struktureller Nachteil bleibt:** ein einziger Kopf hält das Gesamtsystem; ein Ausfall dieser Person hat unmittelbare Betriebswirkung („Bus-Faktor 1“).

## 12. Vergleich D: klassisches Startup-Team mit Finanzierung (EINSCHÄTZUNG)

Ein finanziertes Team hätte im gleichen Zeitraum voraussichtlich weniger Funktionsfläche, aber mehr Nutzervalidierung, Design-Qualität und Betriebssicherheit erreicht. Y-Dude ist damit **überdurchschnittlich in Bau- und Härtungsleistung, unterdurchschnittlich in Marktvalidierung** – letzteres ist der eigentliche Rückstand, nicht die Technik.

## 13. Lovable-Referenzen (VERGLEICH)

- Lovable veröffentlicht Kundengeschichten und einen Community-Showcase, z. B. eXp Realty (lovable.dev/blog/exprealty), eine KI-Recruiting-Plattform (lovable.dev/blog/customer-stories/ai-hiring-platform-recruiter), ein VC-Datenportal (lovable.dev/blog/customer-stories/2025-01-23-how-a-venture-capitalist-rebuilt-his-website-and-internal-data-platform-with-lovable) und ein internes Werkzeug für eine 150-Personen-Organisation (lovable.dev/blog/how-one-data-scientist-enabled-a-150-person-org-with-a-single-lovable-app).
- **„Lovable veröffentlicht keine belastbare Gesamtzahl vergleichbarer Projekte."** Es gibt kein Verzeichnis mit standardisierten Angaben zu Umfang, Teamgröße und Entwicklungsdauer; jede Geschichte ist eigenständige, selbst berichtete Marketingkommunikation.
- Nächstliegender dokumentierter Solo-Fall: **Plinq** (Sabrine Matos), nach Anbieterangabe in **45 Tagen** von einer nicht technischen Einzelperson gebaut, 10.000+ Nutzer in 3 Monaten, ca. 456 k USD ARR – Zahlen selbst berichtet, nicht unabhängig geprüft; funktional deutlich schmaler als Y-Dude (Sicherheits-/Auskunftsdienst, kein Feed/Messenger/Marktplatz-Verbund).
- Kein öffentlich dokumentierter Lovable-Fall deckt die Kombination Feed + Konten + Messenger + Marktplatz + nutzergenerierte Inhalte + Moderation + Admin + KI-Funktionen nachweislich ab.

## 14. Externe Referenzprojekte (VERGLEICH)

Ergebnis der Suche über Product Hunt, Indie Hackers, Hacker News, GitHub, TechCrunch und Y Combinator: **kein einzelnes öffentlich dokumentiertes Projekt mit belegbarer ~40-Tage-Bauzeit deckt das vollständige Funktionsbündel von Y-Dude ab.** Teilweise vergleichbar:

| Projekt | Quelle | Zeitraum / Dauer | Team | Gemeinsamkeiten | Unterschiede | Ergebnis (soweit bekannt) |
| --- | --- | --- | --- | --- | --- | --- |
| Plinq | lovable.dev/blog/how-sabrine-matos-built-plinq; aieatingtheworld.com | 2025, 45 Tage | 1 (nicht technisch) | Solo + KI, Konten, mobile Nutzung, Produktivstart | kein Feed/Messenger/Marktplatz-Verbund, keine Moderation | 10.000+ Nutzer in 3 Monaten, ~456 k USD ARR (selbst berichtet) |
| Aneta (KI-HR-Agent) | lovable.dev/blog/2025-01-21-from-idea-to-reality-how-bilal-built-aneta-an-ai-powered-hr-agent-with-lovable | 2025, Dauer nicht angegeben | 1 | Solo + KI, KI-Funktion, Konten | ein Fachbereich, kein Social/Market | keine belastbaren Nutzerdaten |
| Magican | lovable.dev/blog/zohar-vanunu-magican-ai-maker | 2025, Dauer nicht angegeben | 1 | Solo + KI, vollständige SaaS-Plattform | kein Social/Marketplace-Verbund | keine belastbaren Nutzerdaten |
| 14 SaaS-Produkte in 6 Monaten | dev.to/jakub_inithouse | 2025, 6 Monate | 1 | Solo + KI, hohe Ausgabemenge | viele kleine Produkte statt eines großen Systems | selbst veröffentlicht, nicht geprüft |

**Methodischer Hinweis:** Alle vier Referenzen sind selbst berichtet. Sie belegen, dass Solo-Bauzeiten von Wochen vorkommen, taugen aber **nicht** als Beweis, dass Y-Dudes Umfang üblich oder unüblich sei.

## 15. Vergleichstabelle

| Projekt | Teamgröße | Entwicklungszeit | Funktionen | Gemeinsamkeiten mit Y-Dude | Ergebnis | Quelle |
| --- | --- | --- | --- | --- | --- | --- |
| Y-Dude | 1 Mensch + KI | 38 belegte Tage im Fenster (Vorlauf ab 24.07.) | 10 produktive Bereiche, 124 Tabellen, 607 Tests | – | live, Beta, 8,0/10 | eigene Messung 07.09.2026 |
| Plinq | 1 | 45 Tage | Auskunft/Sicherheit, Konten | Solo + KI, schnelle Live-Stellung | 10 k+ Nutzer (selbst berichtet) | lovable.dev, aieatingtheworld.com |
| Aneta | 1 | nicht öffentlich | KI-HR-Agent | Solo + KI | nicht öffentlich | lovable.dev |
| Magican | 1 | nicht öffentlich | SaaS-Plattform | Solo + KI | nicht öffentlich | lovable.dev |
| Social-MVP (Agenturschätzung) | Team | 6–15 Monate | Profile, Feed, Messaging | Funktionsumfang teilweise | Kostenrahmen 35–80 k USD | projecto-calculator.com |
| Social Network individuell (Agenturschätzung) | Team | 3 Monate – 2 Jahre | Feed, Chat, Moderation | Funktionsumfang näher | 25–300 k USD | in lovable.dev/guides zitiert |

Nicht öffentlich verfügbar: Teamgrößen und Dauer der meisten Referenzen, Nutzerzahlen von Y-Dude, geprüfte Umsatzzahlen aller Referenzen.

## 16. Stärken

- Serverseitig durchgesetztes Sicherheitsmodell (fail-closed Captcha, RLS überall, Rollen in eigener Tabelle) – nicht nachträglich aufgesetzt, sondern Bestandteil der Struktur.
- Belegkultur: 93 Berichte, 21 Prüfläufe, Rollback-Pakete, Runbooks; Aussagen sind reproduzierbar statt behauptet.
- Testabdeckung sicherheitskritischer Pfade (Captcha, Rollen, RLS, Webhook-Signatur, Idempotenz).
- Nachgewiesene Lastfestigkeit: 750 gleichzeitige Nutzer, 49.952 Anfragen, 0 Serverfehler.
- Konsequente Scope-Kontrolle statt Funktionssammeln (siehe Abschnitt 17).
- Sehr hohe Iterationsgeschwindigkeit ohne Verlust der Systemkonsistenz.
- Mehrsprachigkeit und Übersetzungslogik von Anfang an mitgedacht (12 Module, Übersetzungstabellen).

## 17. Bewusst nicht gebaut / entfernt (zählt als Produktivität)

| Entscheidung | Datum | Wirkung |
| --- | --- | --- |
| Stripe/integrierte Zahlung aus Market entfernt | 07.09. | Wegfall von Zahlungs-, Auszahlungs-, Streit- und Steuerpflichten in der Startphase |
| Ticket-/Abholcode-System entfernt (Vergabe, Erzeugung, Validierung, Scanner) | 07.09. | Weniger Zustände, weniger Missbrauchsfläche, keine Codeverwaltung |
| Captcha aus dem öffentlichen SlangTag-Tester entfernt, Serverschutz behalten | 07.09. | Niedrigere Einstiegshürde ohne Schutzverlust |
| Registrierung verkürzt, Sicherheitsprüfung erst nach Zustimmung geladen | 06.–07.09. | Weniger Abbrüche, kein Fremdaufruf beim Seitenaufruf |
| Sicherheitswarnungen nicht einfach ausgeblendet, sondern geprüft und dokumentiert | 01.–06.09. | Reale Risikoreduktion statt kosmetischer Bereinigung |
| Anonyme Ausführungsrechte gezielt entzogen statt Policies gelockert | 06.09. | Minimalinvasive Härtung |
| Releases bei fehlendem Nachweis nicht freigegeben („NICHT FREIGEGEBEN“, „NICHT VERIFIZIERBAR“) | mehrfach | Vermeidung stiller Fehlaussagen |

**EINSCHÄTZUNG.** Diese Weglassungen sind der stärkste Reifeindikator des Projekts. Ein Solo-Projekt scheitert selten an zu wenig Funktionen, sondern an zu vielen halbfertigen.

## 18. Schwächen

- Codeprüfung (Lint) mit 9.982 Meldungen rot; überwiegend Archiv-/Release-Ordner, aber auch 27 aktive Quelldateien.
- Kein unabhängiges Vier-Augen-Review: dieselbe Person entscheidet, prüft und gibt frei.
- Performance-Schulden: Startseite Desktop 3,2 s bis erster Inhalt, 99–176 Anfragen je eingeloggte Seite, Globe-Daten 1,6 MB + 1,2 MB.
- UX-Feinschliff: 138–141 Bedienelemente unter 40 × 32 px im Feed, Sprachauszeichnung der Seite bleibt „en“.
- Zentrale Nutzerpfade nicht end-to-end belegt: echte Registrierung mit E-Mail-Bestätigung, Nachrichtenaustausch und Marktvorgang mit zwei echten Konten.
- Ein gemeinsames Backend für Vorschau und Produktion.
- Produktbreite erschwert die Positionierung; keine Nutzungs- oder Bindungsdaten vorhanden.
- Bus-Faktor 1.

## 19. Risiken

| Risiko | Schwere | Anmerkung |
| --- | --- | --- |
| Personenabhängigkeit (Bus-Faktor 1) | hoch | größtes nichttechnisches Risiko |
| Berechtigungsfläche: 3 Tabellen ohne Policy, 5 anonym ausführbare Funktionen mit erhöhten Rechten, 53 für angemeldete Nutzer | mittel bis hoch | größte technische Risikofläche |
| Ungeprüfte Nutzerannahme (0 Registrierungen aus der bisherigen Videokampagne) | hoch | Produktrisiko, nicht Technikrisiko |
| Skalierungslast der Datenbank (Lesestatus-Update bis 690 ms, 32.738 Ansichts-Einträge) | mittel | wächst überproportional mit Nutzerzahl |
| Ladezeit/Datenmenge auf schwachen Mobilnetzen | mittel | Abbruchrisiko beim Erstbesuch |
| Vermischung von Vorschau- und Produktionsdaten | mittel | ein Fehlgriff wirkt sofort produktiv |
| Rechtliche Pflichten (Minderjährige, Moderation, DSGVO) bei Nutzerwachstum | mittel | Grundlagen vorhanden, Betriebsaufwand steigt |

## 20. Gesamtbewertung

**Y-DUDE CURRENT PROJECT SCORE: 8,0/10**

**PROJECT MATURITY: BETA (mit produktionsreifer Basis), noch nicht Early Commercial Product.**

Begründung: Live erreichbar, öffentliche Registrierung funktionsfähig, Zugriffsschutz und Serverprüfungen greifen, Lastverhalten nachgewiesen, Rollback und Betriebsanleitungen vorhanden – das trägt die Einordnung „Production-Basis“. Gegen „Early Commercial Product“ sprechen: keine Einnahmemechanik im Produkt (Zahlung bewusst entfernt), keine belegten Nutzer-/Bindungsdaten, zentrale Nutzerpfade nicht end-to-end verifiziert, Codeprüfung rot.

## 21. Scorecard

| Dimension | Wert |
| --- | --- |
| TECHNIK | 8/10 |
| PRODUKT | 7,5/10 |
| UX | 7,5/10 |
| SECURITY | 8/10 |
| PERFORMANCE | 7/10 |
| STABILITÄT | 9/10 |
| PRODUCTION READINESS | 8/10 |
| ENTWICKLUNGSGESCHWINDIGKEIT | 9,5/10 |
| MENSCH-KI-ZUSAMMENARBEIT | 9/10 |
| **GESAMT** | **8,0/10** |

## 22. Was in 40 Tagen erreicht wurde (faktenbasiert)

In 38 belegten Arbeitstagen (01.08.–07.09.2026; 08./09.09. noch nicht eingetreten) entstanden ein live erreichbares Sozial- und Marktplatzprodukt mit 10 produktiven Bereichen, 124 Datenbanktabellen, 301 Zugriffsregeln, 178 Datenbankfunktionen, 349 Indizes, 217 angewandten Migrationen, ca. 110.000 Zeilen Anwendungscode, 607 automatisierten Tests, 76 datierten Prüf- und Releaseberichten, 16 dokumentierten Auslieferungen, 21 Auditläufen und einem Lasttest über 750 gleichzeitige Nutzer ohne Serverfehler. Gleichzeitig wurden Zahlungsabwicklung und ein vollständiges Ticket-/Abholcodesystem bewusst wieder entfernt und mehrere Freigaben wegen fehlender Nachweise verweigert.

## 23. Antworten auf die Abschlussfragen

1. **Außergewöhnlich?** Ja – im Verhältnis von Umfang, Nachweisdichte und Zeit. Kein öffentlich dokumentierter Einzelfall mit vergleichbarem Funktionsbündel und belegter ~40-Tage-Bauzeit war auffindbar.
2. **Wie außergewöhnlich?** Deutlich über dem, was solo ohne Werkzeuge erreichbar ist, und im oberen Bereich KI-gestützter Solo-Projekte. Eine Zahl wie „N-fach schneller“ ist nicht belegbar; die rigorose Forschungslage widerspricht solchen Pauschalfaktoren.
3. **Wie weit ist Y-Dude heute?** Technisch Beta mit produktionsreifer Basis (8,0/10); produktseitig fehlt der Nutzernachweis.
4. **Vergleich zu ähnlichen KI-/No-Code-Projekten?** Umfangreicher und stärker abgesichert als die auffindbaren dokumentierten Fälle; bei Nutzerzahlen unterlegen (z. B. Plinq mit selbst berichteten 10.000+ Nutzern).
5. **Vergleich zu kleinen Startup-Teams?** Bau- und Härtungsleistung überdurchschnittlich, Design-/UX-Feinschliff, unabhängiges Review und Marktvalidierung unterdurchschnittlich.
6. **Die nächsten 10 Verbesserungen:** (1) Fehlerseite statt leerer Seite bei unbekannter Marktvorgangs-ID, (2) Lesestatus im Messenger bündeln, (3) Darstellungskonflikt (Hydration) auf vier öffentlichen Seiten beheben, (4) Anfragen je Seite unter 80 senken, (5) Globe-Daten nachladen/verkleinern, (6) Tippflächen im Feed vergrößern, (7) Seitensprache korrekt setzen, (8) Codeprüfung grün bekommen (Archivpfade ausschließen, 27 aktive Dateien bereinigen), (9) drei Tabellen ohne Policy und anonyme Ausführungsrechte abschließend klären, (10) echten Registrierungs-, Nachrichten- und Marktdurchlauf mit zwei Konten belegen.
7. **Größter technischer Risikofaktor:** die Berechtigungsfläche der Datenbank – 3 Tabellen ohne Policy und 5 anonym ausführbare Funktionen mit erhöhten Rechten; ein Fehler dort wirkt sofort auf alle Nutzerdaten.
8. **Größte Produktchance:** die Sprach-/Slang-Ebene (SlangTag mit Übersetzung, Vorlesen, lokalem Bezug) – das ist der Teil, den vergleichbare Netzwerke nicht haben, und der einzige Bereich, der Y-Dude als eigene Kategorie beschreiben kann.
9. **Was nicht mehr gebaut werden sollte:** keine Zahlungsabwicklung, kein Ticket-/Code-System, keine weiteren Nebenwelten (zusätzliche Arena-/Globe-/Kampagnenmechaniken), keine neuen Rollen-/Tarifstufen, keine eigene Mobil-App, keine weiteren KI-Endpunkte – bis Nutzung messbar ist.
10. **Beschreibung für Investor/Experte/Accelerator:** „Ein von einer Person mit KI-Unterstützung in rund sechs Wochen gebautes, live laufendes Sozialnetzwerk mit Sprach- und Slang-Ebene, Marktplatz und Messenger; technisch belegbar auditiert (607 Tests, RLS überall, Lasttest 750 Nutzer ohne Serverfehler), bewusst ohne Zahlungsabwicklung, Reifegrad Beta. Der offene Punkt ist nicht die Technik, sondern der Nachweis, dass Menschen es benutzen.“

## 24. Methodische Einschränkungen

- Änderungsschritte („Commits“) sind Editor-Speicherpunkte der Plattform, kein Maß für Arbeitsqualität; die Zahl darf nicht mit klassischen Team-Commits verglichen werden.
- Aufteilung zwischen menschlicher und KI-Autorenschaft je Codezeile: **nicht belastbar feststellbar**.
- Nutzer-, Bindungs- und Umsatzdaten: **nicht vorhanden**.
- Deployment-Zeitpunkte der live ausgelieferten Version: **nicht abrufbar**, nur über interne Berichte rekonstruiert.
- Alle externen Vergleichszahlen sind entweder selbst berichtet oder Agenturmarketing; als rigoros gelten nur die genannten randomisierten Studien, und die widersprechen sich.
