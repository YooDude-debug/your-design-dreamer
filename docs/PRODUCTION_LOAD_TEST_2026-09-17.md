# Y-Dude – Production-Lasttest 17.09.2026

## 1. Executive Summary

- Gemessener Zeitraum: 17.09.2026, 15:01–15:24 UTC, **22,6 Minuten aktive Last** gegen `https://y-dude.com`.
- **767.637 Anfragen**, Durchschnitt 565 Anfragen/s (33.928 Anfragen/min), Spitzenstufe 1.000 gleichzeitige Nutzer.
- **0 Serverfehler (5xx), 0 Zeitüberschreitungen, 0 Verbindungsabbrüche, 0 abgebrochene Anfragen** über den gesamten Lauf.
- Antwortzeiten bei 1.000 VU: p50 49 ms, p90 86 ms, p95 125 ms, p99 438 ms, Maximum 14,7 s (Einzelfall).
- 4xx: 157.116 bei 1.000 VU – ausschließlich **401 auf geschützten Datenpfaden** (erwarteter Zugriffsschutz, keine Sitzung im Generator).
- Datenbank: Verbindungen 20 → 29 von 60, Speicher 47 → 56 %, **0 Deadlocks, 0 wartende Sperren**, Trefferquote Cache 99,9999 %, keine Neustarts.
- Stabilität über 22 Minuten: p50 konstant 46–53 ms, p95 92–170 ms, keine Fehler in **keinem** 30-Sekunden-Intervall.
- Kein Leistungsabfall mit zunehmender Dauer oder Nutzerzahl; Erholung nach Lastabbau unmittelbar.
- Gegenüber dem letzten Production-Test (14.09.) bei 1.000 VU: Durchsatz +101 % (281 → 565 Anf./s), p95 +5 ms, p99 +214 ms, 5xx unverändert 0, Timeouts 1 → 0.
- Gesamtbewertung: **🟢 unauffällig**. Kein kritischer Handlungsbedarf aus diesen Messungen ableitbar.

## 2. Testaufbau

| Punkt | Wert |
| --- | --- |
| Ziel | Production, kanonische Adresse `https://y-dude.com` (www leitet mit 302 dorthin) |
| Verfahren | HTTP-Lastgenerator (Bun, `fetch`), **nur GET-Anfragen**, keine Schreibpfade, keine Anmeldung, keine Testdaten erzeugt |
| Lastprofil | 100 → 250 → 500 → 750 → **1.000** → 500 → 100 VU |
| Haltephase | 900 s bei 1.000 VU; Rampenstufen je 90 s, Abbau je 45 s |
| Gesamtdauer | 1.358 s (22,6 min) aktive Last |
| Denkzeit | 200–800 ms zwischen Einzelanfragen, 1–4 s zwischen Sitzungszyklen |
| Zeitüberschreitung | 15 s pro Anfrage (Abbruch = Timeout gezählt) |
| Szenarienmix | Feed-Session 30 %, Feed-Scrollen 14 %, Market 12 %, Beitragsdetail 8 %, Profil 8 %, SlangTags 7 %, Globe 6 %, Messenger 6 %, öffentliche Seiten 6 %, Likes/Kommentare 5 %, Arena 4 %, Benachrichtigungen 4 % |
| Abgedeckte Aktionen | Feed öffnen/scrollen, Beitragslisten, Beitragsdetail (SSR), Bild- und Geodaten-Assets, Profilseite, SlangTag-Seite und -Daten, Market-Seite und Angebotsliste, Globe, Arena, Messenger (Konversationen, Nachrichten), Benachrichtigungen, Likes/Kommentare lesend, Sitemap/Meta, Rechtsseiten |
| Bewusst **nicht** enthalten | Likes/Kommentare schreiben, Nachrichtenversand, Uploads, Kauf-/Verkaufsabschlüsse, Registrierungen, `api/public/*`-Läufe (potenzielle Schreibwirkung), Realtime/WebSockets |

Production wurde nicht verändert: kein Deployment, keine Migration, keine Konfigurations-, Cache-, RLS- oder Rechteänderung. Alle Datenbankabfragen dieses Audits waren lesend.

Hinweis zur Auswertung: Der Generator zählt die Stufen 100 VU und 500 VU jeweils zusammen mit der gleichnamigen Abbaustufe. Die Zahlen dieser beiden Zeilen enthalten daher Auf- und Abbau; die Stufen 250, 750 und 1.000 VU sind eindeutig.

Vorlauf: Ein erster, technisch identischer Durchlauf (14:37–15:00 UTC) lief serverseitig fehlerfrei, seine Auswertung ist jedoch im Generator abgebrochen (Speichergrenze beim Zusammenfassen). Die hier berichteten Zahlen stammen ausschließlich aus dem zweiten, vollständig ausgewerteten Lauf. Die Produktion trug damit an diesem Tag ~45 Minuten Testlast ohne Serverfehler.

## 3. Ergebnisse je Laststufe

| Stufe | Anfragen | 2xx | 3xx | 4xx (erwartet 401/307) | 5xx | Timeouts | Verb.-Fehler | avg | p50 | p90 | p95 | p99 | Max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 100 VU (inkl. Abbau) | 10.081 | 7.478 | 109 | 2.494 | 0 | 0 | 0 | 66 ms | 49 ms | 81 ms | 104 ms | 334 ms | 3.202 ms |
| 250 VU | 16.709 | 12.446 | 187 | 4.076 | 0 | 0 | 0 | 58 ms | 49 ms | 81 ms | 98 ms | 176 ms | 1.285 ms |
| 500 VU (inkl. Abbau) | 49.936 | 37.062 | 609 | 12.265 | 0 | 0 | 0 | 63 ms | 49 ms | 84 ms | 110 ms | 321 ms | 6.340 ms |
| 750 VU | 49.777 | 36.999 | 582 | 12.196 | 0 | 0 | 0 | 58 ms | 49 ms | 78 ms | 98 ms | 243 ms | 2.927 ms |
| **1.000 VU** | **641.134** | **476.492** | **7.526** | **157.116** | **0** | **0** | **0** | **68 ms** | **49 ms** | **86 ms** | **125 ms** | **438 ms** | **14.691 ms** |

Durchsatz: 767.637 Anfragen in 1.358 s = **565 Anfragen/s** im Mittel, in der Haltephase konstant **≈ 715 Anfragen/s** (21.000–22.000 Anfragen je 30-s-Intervall).

Höhere Stufen als 1.000 VU wurden nicht gefahren: der Generator läuft in einer einzelnen Sandbox; oberhalb dieser Rate wäre nicht mehr sicher trennbar, ob eine Verschlechterung vom Server oder vom Lastgenerator kommt. Das ist eine Grenze des Verfahrens, kein gemessenes Serverlimit.

## 4. Performance je Funktionsgruppe (gesamter Lauf)

| Gruppe | Anfragen | p50 | p90 | p95 | p99 | Max | Fehler |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Statische Assets (JS/CSS) | 211.057 | 46 ms | 71 ms | 92 ms | 267 ms | 14.691 ms | 0 |
| Beitragsliste (Daten-API) | 130.112 | 43 ms | 58 ms | 72 ms | 226 ms | 4.517 ms | 0 (alle 401 = Zugriffsschutz) |
| Feed-Seite (SSR) | 98.687 | 64 ms | 119 ms | 233 ms | 643 ms | 7.707 ms | 0 |
| Bild/Medien | 67.204 | 59 ms | 88 ms | 115 ms | 334 ms | 3.318 ms | 0 |
| Market-Seite (SSR) | 27.192 | 62 ms | 115 ms | 225 ms | 605 ms | 6.210 ms | 0 |
| Market-Angebote (API) | 27.184 | 43 ms | 59 ms | 73 ms | 218 ms | 2.869 ms | 0 |
| Beitragsdetail (SSR) | 18.007 | 66 ms | 157 ms | 267 ms | 675 ms | 2.863 ms | 0 |
| Profilseite | 17.796 | 58 ms | 110 ms | 210 ms | 601 ms | 4.282 ms | 0 |
| SlangTag-Seite | 15.692 | 61 ms | 118 ms | 220 ms | 694 ms | 7.046 ms | 0 |
| Öffentliche/Rechtsseiten | 13.517 | 64 ms | 124 ms | 231 ms | 662 ms | 7.231 ms | 0 |
| Sitemap/Meta | 13.516 | 47 ms | 73 ms | 99 ms | 321 ms | 6.327 ms | 0 |
| Globe-Seite | 13.506 | 62 ms | 117 ms | 235 ms | 631 ms | 3.148 ms | 0 |
| Geodaten-Assets | 13.503 | 46 ms | 71 ms | 90 ms | 247 ms | 2.854 ms | 0 |
| Konversationen (API) | 13.362 | 43 ms | 59 ms | 72 ms | 206 ms | 2.501 ms | 0 |
| Nachrichten (API) | 13.367 | 43 ms | 65 ms | 134 ms | 352 ms | 2.636 ms | 0 (401) |
| Likes (API) | 11.186 | 43 ms | 64 ms | 130 ms | 367 ms | 3.154 ms | 0 |
| Kommentare (API) | 11.185 | 43 ms | 59 ms | 72 ms | 211 ms | 2.503 ms | 0 (401) |
| Benachrichtigungen (API) | 9.068 | 43 ms | 65 ms | 126 ms | 352 ms | 2.195 ms | 0 |
| Arena-Seite | 9.013 | 52 ms | 97 ms | 206 ms | 652 ms | 6.144 ms | 0 (307 = Weiterleitung) |

## 5. Fehler

| Klasse | Anzahl | Bewertung |
| --- | --- | --- |
| 5xx | **0** | 🟢 |
| Timeouts (>15 s) | **0** | 🟢 |
| Verbindungsabbrüche | **0** | 🟢 |
| Abgebrochene Anfragen | **0** | 🟢 |
| 4xx | 188.147, davon 100 % **401** | 🟢 erwartet: geschützte Datenpfade (Beiträge, Profile, SlangTags, Nachrichten, Kommentare) ohne Sitzung – der Zugriffsschutz greift durchgängig |
| 3xx | 8.404, davon 9.013 Arena-Weiterleitungen (307) über alle Stufen | 🟢 erwartet: Route leitet ohne Sitzung weiter |

Datenbankfehler: keine. Sperrkonflikte: keine. Storage: nur Lesezugriffe, keine Freigabefehler (kein 403 auf Bildpfaden).

## 6. Ressourcen

| Kennzahl | Vor dem Test | Während 1.000 VU | Nach dem Test |
| --- | --- | --- | --- |
| Datenbank | up | up | up |
| Verbindungspooler | up | up | up |
| Verbindungen | 20/60 | 28–29/60 | 28/60 |
| Pool-Clients | 1/200 | 1/200 | 1/200 |
| Arbeitsspeicher | 47 % | 56 % | 52 % |
| Datenplatte | 22 % | 22 % | 22 % |
| Datenbankgröße | 129,5 MB | 129,5 MB | 129,6 MB |
| WAL-Größe | 128 MB | 128 MB | 128 MB |
| Neustarts | 0 | 0 | 0 |
| Deadlocks | 0 | 0 | 0 |
| Wartende Sperren | 0 | 0 | 0 |
| Aktive Backends (Peak) | – | 35 (2 aktiv) | 35 |
| Puffer-Trefferquote | – | 0,999999 | – |

CPU-Auslastung wird von der verwalteten Umgebung nicht als Einzelwert bereitgestellt; belegbar sind Speicher, Verbindungen und Sättigungsstufe („moderate", nie „high"). Edge-/Serverfunktionen wurden in diesem Lauf nicht direkt beansprucht (keine angemeldeten Aufrufe) – das ist ein ausgewiesener Blindspot.

### Datenbank – Abfragen (kumulativ seit Datenbankstart, nicht nur dieser Lauf)

| Abfrage | Aufrufe | Mittel | Max |
| --- | --- | --- | --- |
| `conversation_members.last_read_at` aktualisieren | 12.019 | 11,49 ms | 690 ms |
| Nachrichten je Konversation lesen | 26.125 | 2,19 ms | 138 ms |
| Nachrichtenliste lesen | 21.972 | 2,31 ms | 118 ms |
| Beitragsliste lesen | 21.882 | 2,01 ms | 119 ms |
| `post_views` eintragen (Konfliktfrei) | 32.858 | 1,07 ms | 116 ms |
| `ops_rpc_probe()` (Betriebssonde) | 11.831 | 2,45 ms | 71 ms |

Die teuerste Abfrage ist mit 11,5 ms Mittel weiterhin die Leseständ-Aktualisierung im Messenger. Sie wurde in diesem Lauf **nicht** erzeugt (keine Schreiblast); die Zähler stammen aus dem echten Betrieb und früheren Läufen. Alle Lesepfade liegen bei 1–2,5 ms Mittel.

## 7. Vergleich mit dem letzten Production-Test

Referenz: `docs/PRODUCTION_1000VU_RETEST_2026-09-14.md` (Stand 1.000 VU).

| Metrik | Vorher (14.09.) | Jetzt (17.09.) | Veränderung |
| --- | --- | --- | --- |
| Anfragen gesamt | 301.390 | 767.637 | +155 % (mehr Durchsatz je VU) |
| Anfragen/s bei 1.000 VU | 281 | 565 (Haltephase ≈ 715) | +101 % |
| 4xx (erwartet) | 10.992 (401) | 157.116 (401) | proportional zum Durchsatz |
| 5xx | 0 | **0** | unverändert 🟢 |
| Timeouts | 1 | **0** | besser 🟢 |
| Verbindungsabbrüche | 0 | 0 | unverändert 🟢 |
| p50 bei 1.000 VU | 64 ms | 49 ms | −15 ms 🟢 |
| p95 bei 1.000 VU | 120 ms | 125 ms | +5 ms (Tagesschwankung) |
| p99 bei 1.000 VU | 224 ms | 438 ms | +214 ms 🟡 bei doppeltem Durchsatz |
| Max bei 1.000 VU | 10.187 ms | 14.691 ms | +4,5 s (Einzelfall, 1 von 211.057 Asset-Anfragen) |
| DB-Backends (Peak) | 42 | 35 | niedriger 🟢 |
| Deadlocks / Sperren | 0 / 0 | 0 / 0 | unverändert 🟢 |

Wichtig für die Einordnung: Der heutige Lauf hat bei **gleicher Nutzerzahl den doppelten Durchsatz** erzeugt (kürzere Denkzeiten). Der Anstieg von p99 und Maximum ist deshalb **nicht** als Verschlechterung des Servers lesbar – p50 sank gleichzeitig. Aussagbar ist: Production trägt jetzt belegt ≈ 715 Anfragen/s bei 1.000 gleichzeitigen Sitzungen ohne einen einzigen Serverfehler. Der höchste bisher belegte Durchsatzwert lag bei 566 Anf./s (14.09. vormittags).

## 8. Stabilität über die Zeit

| Frage | Befund |
| --- | --- |
| Leistungsabfall nach mehreren Minuten? | Nein. p50 in allen 45 Intervallen 46–53 ms. |
| Steigen Antwortzeiten kontinuierlich? | Leicht und begrenzt: p95 in den ersten 5 Minuten der Haltephase 99–135 ms, in den letzten 5 Minuten 128–170 ms (+ ca. 25 %), danach beim Lastabbau sofort zurück auf 101 ms. Kein Trend Richtung Sättigung. |
| Steigen Fehler mit der Nutzerzahl? | Nein. 0 Fehler in **jedem** der 45 Intervalle, auf jeder Stufe. |
| Verbindungspool erschöpft? | Nein. 29/60 Verbindungen, 1/200 Pool-Clients. |
| Datenbankengpässe? | Keine. 0 Deadlocks, 0 wartende Sperren, Trefferquote 99,9999 %, nur 2 aktive Backends im Peak. |
| Einzelne langsame Endpunkte? | Relativ am langsamsten sind die serverseitig gerenderten Seiten (Feed p95 233 ms, Beitragsdetail 267 ms, SlangTag-Seite 220 ms) gegenüber Daten-API (72 ms) und Assets (92 ms) – erwartungsgemäß und unkritisch. |
| Problematische Funktionen unter Last? | Keine identifiziert. |
| Erholung nach Lastabbau | Unmittelbar: 100-VU-Abbaustufe p95 101 ms, p99 195 ms. |

## 9. Bottlenecks

**Kein kritisches oder hohes Bottleneck messbar.** Dokumentiert sind zwei nachrangige Beobachtungen:

**B-1 – Einzelne extreme Ausreißer bei Auslieferung**
- Endpoint / Funktion: statische Assets, SSR-Seiten (Feed, Globe, Market, Rechtsseiten)
- Problem: sehr seltene Einzelanfragen mit mehreren Sekunden Antwortzeit
- Messwert: Max 14.691 ms (Assets), 7.707 ms (Feed), 7.231 ms (Rechtsseite) bei p99 ≤ 694 ms; Häufigkeit < 0,001 %
- Ursache, soweit nachweisbar: **Ursache nicht eindeutig bestimmt** (keine serverseitige Fehlerspur, kein Datenbankbezug, kein Sperrkonflikt; Kaltstart/Verbindungsaufbau einzelner Auslieferungsknoten plausibel, aber nicht belegt)
- Auswirkung: für einzelne Nutzer einmalig verzögerter Seitenaufbau, kein Fehler
- Priorität: **LOW**

**B-2 – Teuerste Datenbankabfrage bleibt die Leseständ-Aktualisierung im Messenger**
- Endpoint / Funktion: `conversation_members.last_read_at` (Schreibpfad, in diesem Lauf nicht erzeugt)
- Problem: höchste Gesamtlaufzeit aller Abfragen, Mittel 11,5 ms, Max 690 ms
- Messwert: 12.019 Aufrufe / 138.106 ms Gesamtlaufzeit seit Datenbankstart – Faktor ≈ 5 über der zweitteuersten Abfrage
- Ursache, soweit nachweisbar: **Ursache nicht eindeutig bestimmt** – die Zahlen stammen aus dem echten Betrieb; ob Indexnutzung, Zeilensperren oder Aufrufhäufigkeit dominieren, ist ohne Ausführungsplan-Analyse unter Last nicht belegt. Ein Schreibtest in Production war ausgeschlossen.
- Auswirkung: bei aktueller Nutzung keine (keine Sperren, keine Fehler); relevant erst bei stark steigender Messenger-Nutzung
- Priorität: **MEDIUM** (nur als Beobachtungspunkt)

## 10. Verbesserungsvorschläge

🔴 kritisch: **keine.**

🟠 wichtig: **keine** aus diesen Messungen ableitbar.

🟡 sinnvoll

1. **Messenger-Leseständ-Abfrage unter echter Schreiblast messen**
   - Problem: teuerste Abfrage der Datenbank, aber ohne Last-Nachweis
   - Messwert: 12.019 Aufrufe, Mittel 11,49 ms, Max 689,93 ms
   - Lösung: Ausführungsplan (`EXPLAIN ANALYZE`) in einer Testumgebung mit vergleichbarem Datenbestand prüfen, nicht in Production
   - Erwarteter Nutzen: belastbare Aussage, ob unter wachsender Messenger-Nutzung ein Engpass entsteht
   - Risiko der Änderung: keines (reine Messung, keine Production-Änderung)

2. **Schreib- und Realtime-Blindspot schließen**
   - Problem: Likes, Kommentare, Nachrichtenversand, Uploads, Kaufabschlüsse und WebSocket-Verbindungen sind in keinem Lasttest enthalten
   - Messwert: 0 von 767.637 Anfragen dieses Laufs waren Schreibvorgänge
   - Lösung: eigene Testumgebung mit eigener Datenbank und ausschließlich dafür angelegten Testkonten
   - Erwarteter Nutzen: erstmals belegbare Aussage zu Schreiblast, Sperrverhalten und Echtzeitkanälen
   - Risiko der Änderung: keines für Production; erfordert jedoch eine echte, getrennte Testumgebung (heute teilen Preview und Production eine Datenbank – bereits in `docs/LASTTEST_1000VU_READ_WRITE_2026-09-14.md` als BLOCKED dokumentiert)

🟢 optional

3. **Sehr große Bilddatei der Vorschaugrafik**
   - Problem: `og-logo.png` wird bei jeder Anforderung mit 1,13 MB ausgeliefert und ist nicht weiter komprimierbar
   - Messwert: 67.204 Abrufe in diesem Lauf, p95 115 ms, 0 Fehler – serverseitig unauffällig
   - Lösung: nur bei Bedarf ein kleineres Format bereitstellen
   - Erwarteter Nutzen: geringeres Datenvolumen für Nutzer, kein Stabilitätsgewinn
   - Risiko der Änderung: gering, betrifft Vorschaubilder beim Teilen

## 11. Was NICHT geändert werden sollte – „Kein Handlungsbedarf"

| Bereich | Messwert | Einordnung |
| --- | --- | --- |
| Feed (SSR + Datenpfad) | 98.687 + 130.112 Anfragen, p95 233 / 72 ms, 0 Fehler | Kein Handlungsbedarf |
| Market (Seite + Angebote) | 54.376 Anfragen, p95 225 / 73 ms, 0 Fehler | Kein Handlungsbedarf |
| Auslieferung statischer Dateien | 224.560 Anfragen, p95 ≤ 92 ms, 0 Fehler | Kein Handlungsbedarf |
| Bild-/Medienauslieferung | 67.204 Anfragen, p95 115 ms, 0 Freigabefehler | Kein Handlungsbedarf |
| Messenger-Lesepfade | 26.729 Anfragen, p95 ≤ 134 ms, 0 Fehler | Kein Handlungsbedarf |
| Benachrichtigungen | 9.068 Anfragen, p95 126 ms, 0 Fehler | Kein Handlungsbedarf |
| Globe / Geodaten | 27.009 Anfragen, p95 ≤ 235 ms, 0 Fehler | Kein Handlungsbedarf |
| Verbindungspool / Pooler | 29/60 Verbindungen, 1/200 Clients | Kein Handlungsbedarf |
| Datenbank-Sperrverhalten | 0 Deadlocks, 0 wartende Sperren | Kein Handlungsbedarf |
| Zugriffsschutz geschützter Datenpfade | 188.147 × 401 ohne Ausnahme | Kein Handlungsbedarf |

## 12. Security-Beobachtungen während des Tests

Rein beobachtend, keine destruktiven Tests, keine Änderung an Sicherheitskonfiguration, keine echten Nutzerdaten berührt.

- Geschützte Datenpfade (Beiträge, Profile, SlangTags, Nachrichten, Kommentare) antworteten **ausnahmslos** mit 401 – kein einziger unbefugter Datenzugriff über 188.147 Versuche.
- Öffentlich lesbar und erwartungsgemäß: Market-Angebotsliste, Konversationsanzahl-/Likes-/Benachrichtigungs-Abfragen ohne Sitzung, Sitemap, `robots.txt`, `llms.txt`, Manifest.
- Transportsicherheit vorhanden: HSTS (1 Jahr, inkl. Subdomains), `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, Weiterleitung www → kanonische Adresse.
- Keine Auslieferung interner Fehlermeldungen: 0 Serverfehler, damit auch keine Stapelspuren im Test sichtbar.
- Anhaltender Anfragestrom von 715 Anfragen/s aus einer einzigen Quelle wurde **nicht** gedrosselt oder blockiert. Das ist eine Beobachtung, keine Bewertung – ob eine Ratenbegrenzung gewünscht ist, ist eine Produktentscheidung und wurde nicht geändert.
- Zwei bekannte, unveränderte Hinweise aus `docs/SECURITY_RLS_AUDIT_2026-09-15.md` (`ad_test_settings`, `market_transaction_secrets`) bleiben wie dokumentiert bestehen.

## 13. Blindspots

1. Keine Schreiblast: Likes, Kommentare, Nachrichtenversand, Uploads, Kauf-/Verkaufsabschlüsse nicht getestet.
2. Keine angemeldeten Sitzungen: geschützte Serverfunktionen und der eingeloggte Feed wurden nicht unter Last ausgeführt.
3. Kein Realtime/WebSocket: mit einem HTTP-Generator nicht messbar.
4. Kein Browser-Rendering: Ladezeit im Browser (LCP, Skriptausführung) nicht Teil dieser Messung.
5. Kein CPU-Einzelwert der verwalteten Datenbank verfügbar; nur Speicher, Verbindungen und Sättigungsstufe.
6. Kapazitätsgrenze nicht angefahren: 715 Anfragen/s waren generatorseitig begrenzt, nicht serverseitig.
7. Stufen 100 und 500 VU vermischen Auf- und Abbau (siehe Abschnitt 2).

## 14. Production Readiness

**🟢 unauffällig.**

Production hat 22,6 Minuten Dauerlast mit bis zu 1.000 gleichzeitigen Sitzungen und ≈ 715 Anfragen/s in der Haltephase getragen: 767.637 Anfragen, **0 Serverfehler, 0 Zeitüberschreitungen, 0 Verbindungsabbrüche**, p50 49 ms und p95 125 ms bei 1.000 VU, Datenbank bei 29 von 60 Verbindungen, ohne Sperren, Deadlocks oder Neustarts, mit sofortiger Erholung nach Lastabbau. Der Zugriffsschutz griff bei allen 188.147 Zugriffen ohne Sitzung.

Diese Bewertung gilt ausdrücklich für **Leselast ohne Anmeldung**. Für Schreiblast, angemeldete Serverfunktionen und Echtzeitkanäle liegt weiterhin keine Messung vor; dafür fehlt eine von Production getrennte Testumgebung. Aus den heutigen Messungen ergibt sich kein kritischer und kein hoher Handlungsbedarf.

---

*Erstellt am 17.09.2026. Production wurde während des Tests nicht verändert: keine Code-, Datenbank-, RLS-, Migrations-, Konfigurations-, Cache-, Infrastruktur- oder Deployment-Änderung. Alle Datenbankzugriffe dieses Audits waren lesend.*
