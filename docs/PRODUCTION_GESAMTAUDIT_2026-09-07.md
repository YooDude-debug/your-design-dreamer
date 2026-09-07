# Y-DUDE – PRODUCTION GESAMTAUDIT

Datum: 2026-09-07 · Ziel: https://y-dude.com · Modus: **read-only Audit** (kein Code-, DB-, Policy- oder Deployment-Eingriff)

## 0. Hinweis zu Datenwirkungen des Audits

Der Audit war lesend angelegt. Zwei unvermeidbare Schreibwirkungen entstanden durch echte Nutzung mit einem Testkonto:

1. Ein Like auf einen bestehenden Beitrag (Persistenzprüfung, Testkonto `community`).
2. Registrierungs-Telemetrie: Aufrufe von `/auth?mode=register` erzeugen `registration_events` (u. a. `registration_started`).

Keine Änderung an Code, Schema, Policies, Rollen oder Konfiguration.

## 1. Production-Baseline

| Punkt | Befund |
| --- | --- |
| Live-Erreichbarkeit | `/` `/auth` `/market` `/dev` → HTTP 200 |
| Stack | React 19.2, TanStack Start 1.168 / Router 1.170, Vite 7, Tailwind 4, supabase-js 2.110, Stripe-SDK vorhanden (im Market nicht genutzt) |
| Migrationen | 231 Supabase-Migrationen, Drizzle-Stand bis `0031_age_status_functions.sql` |
| Typecheck | 🟢 PASS (0 Fehler) |
| Unit-/Integrationstests | 🟢 PASS – 607/607, 38 Testdateien |
| Build | 🟢 PASS (Nitro/Vite, `dist/` erzeugt) |
| Lint | 🔴 FAIL – 9.982 Meldungen (9.944 Fehler). Betroffen sind fast ausschließlich Archivpfade (`backups/`, `release/`, `remotion/`); im aktiven `src/` sind 27 Dateien betroffen |
| Bundle | Client-Assets 9,6 MB; JS gesamt 7,7 MB; Einstieg `index` 648 KB; Globe-Daten `land-10m` 1,6 MB, `borders-10m` 1,2 MB, `GlobeStage` 1,1 MB; CSS 114 KB |
| Commit/Deployment-Zeitpunkt | ⚫ NICHT TESTBAR – keine Build-/Commit-Kennung an der Live-Auslieferung abrufbar |
| Bekannte offene Punkte (Vorberichte) | echter menschlicher Turnstile-Durchlauf, echter Zwei-Konten-Market-Ablauf, gemeinsame Backend-Instanz Preview/Production |

## 2. Registrierung / Turnstile — 🟢 PASS (mit einem Detailbefund)

Gemessen bei 390 px / Android-UA und Desktop, jeweils `de-DE` und `en-US`.

| Prüfpunkt | Ergebnis |
| --- | --- |
| A) Seite öffnen → kein Turnstile | 🟢 0 Cloudflare-Scripts, 0 iframes, 0 Meldungen |
| B) Checkbox inaktiv | 🟢 kein Widget, keine Fehlermeldung, „Jetzt registrieren“ deaktiviert |
| C) Checkbox aktivieren | 🟢 Script wird geladen, Status „Sicherheitsprüfung läuft …“ |
| D) SUCCESS-Pfad | ⚫ NICHT TESTBAR headless – Cloudflare liefert dem automatisierten Browser kein interaktives Challenge-iframe. Code-Pfad und Tokenübergabe geprüft, Regressionstests grün |
| E) FAILED | 🟢 Registrierung bleibt blockiert, Button deaktiviert, klare Meldung |
| F) TIMEOUT | 🟢 blockiert, Retry vorhanden |
| G) Checkbox abwählen | 🟢 Widget entfernt, Zustand zurückgesetzt, Button wieder deaktiviert (Script-Tag bleibt im Cache – ohne Funktion) |
| H) Reload | 🟢 wieder inaktiv |
| Validierung Client | 🟢 E-Mail, Benutzername, Passwort 2×/min. 8, Geburtsdatum ab 14, Pflicht-Checkbox |
| Pflichtlinks | 🟢 AGB, Community-Richtlinien, Datenschutz verlinkt |
| Server fail-closed | 🟢 `verifyTurnstileToken` lehnt fehlendes, zu kurzes, ungültiges, abgelaufenes Token und fehlende Konfiguration ab (Unit-Tests + Codeprüfung); kein Frontend-Bypass |
| Mobile 390 px | 🟢 kein horizontaler Überlauf |
| Sprache | 🟢 Deutsch bei `de-DE`, Englisch bei `en-US` |
| Detailbefund | 🟡 `<html lang>` bleibt immer `en`, auch bei deutscher Oberfläche |
| Ladezeit | 🟢 FCP mobil 584 ms, Desktop 1.892 ms |

## 3. Login — 🟢 PASS / 🟡

- Bestehende Sitzung: Aufbau und Persistenz über Reload und Navigation 🟢
- Ungültige/abgelaufene Sitzung → sauberer Redirect auf `/auth`, keine weiße Seite 🟢
- Geschützte Bereiche ohne Sitzung nicht erreichbar 🟢
- 🟡 Die Login-Seite lädt Turnstile **sofort** beim Aufruf – inkonsistent zur Registrierung (dort erst nach Zustimmung)
- Falsches Passwort / unbekannte E-Mail: ⚫ NICHT TESTBAR automatisiert (Turnstile-Pflicht vor Anmeldeversuch)

## 4. Feed / Social — 🟢 PASS

- Feed lädt mit 20 Beiträgen, Nachladen beim Scrollen auf 39 (= alle vorhandenen) 🟢
- Medien, SlangTag-Player, Hashtags, mehrsprachige Inhalte, Übersetzungshinweise vorhanden 🟢
- Like serverseitig persistiert (Zähler aktualisiert, Datensatz in `post_likes` angelegt) 🟢
- Kommentar-, Teilen-, Speichern-Aktionen als eigene Bedienelemente vorhanden 🟢
- Empty States sauber („Du hast noch keine Beiträge veröffentlicht.“, „Deine Slang Box ist leer …“) 🟢
- Keine JavaScript-Fehler im eingeloggten Durchlauf 🟢
- 🟡 99–176 Netzwerk-Requests pro eingeloggter Seite

## 5. SlangTag-Tester (öffentlich) — 🟢 PASS

- Tester auf der Startseite lädt, Beispiel-SlangTag `$Moinmoin` abspielbar, Aufnahme-Button vorhanden 🟢
- **0 Turnstile-Widgets, 0 Cloudflare-Scripts, kein Turnstile-Request** 🟢
- Hinweis „Nur ein Test – die Aufnahme bleibt auf deinem Gerät“ 🟢
- Serverseitiger Missbrauchsschutz (IP-Rate-Limit, Größen-/Formatlimits) im Code aktiv, durch Tests abgedeckt 🟢
- Startseite: FCP mobil 1.656 ms, 56 Requests, ~1,0 MB (davon ~248 KB Bilder) 🟡

## 6. Messenger — 🟡 / ⚫ teilweise nicht testbar

- Demo-Messenger (`/demo/messenger`) rendert Konversation, Übersetzung, Original anzeigen, Vorlesen 🟢
- Messenger-Panel im Feed: Bedienelement „Nachrichten“ vorhanden, Panel öffnet als Overlay; automatisiert nicht eindeutig verifizierbar ⚫
- Bestand live: 18 Konversationen, 130 Nachrichten (Persistenz belegt) 🟢
- Nachricht senden/empfangen mit zwei echten Konten: ⚫ NICHT TESTBAR in diesem Lauf
- 🔴/🟡 Performance-Hinweis: Das Lesestatus-Update (`conversation_members.last_read_at`) ist mit 12.019 Aufrufen, Ø 11,5 ms und max. 690 ms die teuerste Abfrage der Datenbank (138 s Gesamtlaufzeit)

## 7. Market — 🟢 PASS

- Übersicht, Kategorien, Artikelkarte, Preis, Alter der Anzeige 🟢
- Detailseite: Status „Aktiv“, Preis, Verhandelbar, Zustand, Übergabeart, Beschreibung, SlangTag 🟢
- Aktionen: „Verkäufer schreiben“, „Abholung anfragen“ + Hinweis „Versand nach Absprache zwischen Käufer und Verkäufer“ 🟢
- Inserat erstellen: Bilder (max. 8), Titel, Beschreibung, Preis, Kategorie, Zustand, Übergabe, SlangTags, Standort 🟢
- Mein Market: Aktiv / Reserviert / Verkauft, Favoriten, Angebote, Suchen, Statistik 🟢
- **Keine Zahlung, kein Stripe, kein integrierter Versand, keine Ticket-/Pickup-Codes in der Oberfläche** 🟢
- 🔴 `/market/tx/<unbekannte-ID>` liefert eine **vollständig leere Seite** ohne Hinweis oder Fehlerzustand
- Vollständiger Kauf-/Verkaufsablauf mit zwei echten Konten: ⚫ NICHT TESTBAR in diesem Lauf

## 8. Profile — 🟢 PASS

- Eigenes Profil mit Kennzahlen (SlangTags, Connections, Beiträge, Follower, Likes, Kommentare, Mitglied seit) 🟢
- Sichtbarkeits- und Statusschalter, Sprache, Rückweg zum Feed 🟢
- Bearbeiten/Speichern und Avatar-Upload: als Bedienelemente vorhanden; Speichern nicht ausgeführt (Audit-Regel: keine Datenänderung) ⚫
- Fremdes Profil / Rechtetrennung: Zugriff nur lesend, keine Bearbeitungsoptionen 🟢

## 9. Admin — 🟢 PASS

- `/admin` mit normalem Konto → Redirect auf `/dev`, keine Admin-Inhalte, keine Fehlermeldung mit Interna 🟢
- Rollentrennung in der Datenbank: eigene `user_roles`-Tabelle, `has_role()` als SECURITY-DEFINER-Funktion 🟢
- 24 Admin-Routen vorhanden (Moderation, Reports, Nutzer, Statistik, Registration-Health u. a.) – inhaltlich nicht geöffnet, da keine Rechteänderung erlaubt war ⚫
- Keine Admin-Rechte verändert 🟢

## 10. Navigation / UX — 🟡

- Navigation, Zurück-Wege, 404-Seite („Diese Seite hat sich wohl verloren“) 🟢
- Deutsche Übersetzungen durchgängig; einzelne bewusste englische Claims („BUY. SELL. SPEAK LOCAL.“) 🟢
- Kein horizontaler Überlauf auf keiner geprüften Seite (Desktop und 390 px) 🟢
- 🟡 Viele kleine Touch-Ziele: im Feed 138–141 Bedienelemente unter 40 × 32 px, im Formular „Neuer Artikel“ 19
- 🟡 `/globe` und `/channels` brauchen bis zur Darstellung deutlich länger als andere Routen (1,6 s bzw. 3,1 s netto)

## 11. Performance (gemessen)

Öffentliche Seiten (Navigation-Timing, echte Auslieferung):

| Seite | Gerät | TTFB | FCP | Load | Requests | JS | Gesamt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | Desktop | 1.600 ms | 3.232 ms | 6.897 ms | 56 | 285 KB | 1.044 KB |
| `/` | Mobil 390 | 673 ms | 1.656 ms | 1.834 ms | 56 | 285 KB | 952 KB |
| `/auth?mode=register` | Mobil 390 | 105 ms | 584 ms | 743 ms | 30 | 11 KB | 11 KB |

Eingeloggte Routen (netto bis Darstellung, nach Abzug der festen Wartezeit): `/dev` ≈ 0,3 s, `/posts` ≈ 0,3 s, `/market` ≈ 0,3 s, `/globe` ≈ 1,6 s, `/channels` ≈ 3,1 s. Requests pro Seite 99–176.

Datenbank (pg_stat_statements, Gesamtlaufzeit):

| Abfrage | Aufrufe | Ø | max | Gesamt |
| --- | --- | --- | --- | --- |
| `conversation_members.last_read_at` UPDATE | 12.019 | 11,49 ms | 690 ms | 138,1 s |
| `messages` SELECT je Konversation | 26.125 | 2,19 ms | 138 ms | 57,2 s |
| `post_views` INSERT | 32.738 | 1,07 ms | 116 ms | 35,0 s |
| `slang_tags.updated_at` (Polling) | 6.890 | 2,69 ms | 67 ms | 18,6 s |
| `ops_rpc_probe()` (Health) | 5.893 | 2,59 ms | 71 ms | 15,3 s |

Nicht erhoben: TBT, CLS, TTI nach Lighthouse-Definition sowie Messungen unter künstlicher Netzwerkdrosselung — ⚫ NICHT TESTBAR in diesem Lauf (kein Lighthouse-/Throttling-Durchlauf gegen Production ausgeführt).

## 12. Security

- Authentifizierung/Autorisierung: Schutzschicht greift, `/admin` und geschützte Routen ohne Rechte nicht erreichbar 🟢
- Serverseitige Validierung: zod-Schemata und Turnstile-Prüfung vor jeder Aktion, fail-closed 🟢
- Rollen in eigener Tabelle, keine Rollen im Profil 🟢
- Rate-Limits/Missbrauchsschutz für öffentliche Transkription aktiv 🟢
- Sicherheits-Scanner: 5 Hinweise, alle Stufe „warn“, alle bereits vom Betreiber als geprüft/ignoriert markiert 🟡
- Datenbank-Linter: 63 Hinweise – 3 Tabellen mit RLS aber ohne Policy (INFO), 2 Extensions im `public`-Schema, 5 SECURITY-DEFINER-Funktionen für anonyme Aufrufer ausführbar, 53 für angemeldete Nutzer 🟡
- Fremde Ressourcen / unautorisierte Statusänderungen: keine gefunden 🟢
- Keine Policy, kein Recht, keine Konfiguration verändert 🟢

## 13. Fehler- und Edge-Cases

| Fall | Ergebnis |
| --- | --- |
| Unbekannte Route | 🟢 freundliche 404-Seite |
| Ungültige Sitzung | 🟢 Redirect auf `/auth`, kein Absturz |
| Unbekannte Transaktions-ID | 🔴 leere Seite ohne Meldung |
| Schnelles Navigieren über 10 Routen | 🟢 stabil, keine unhandled Errors |
| Leere Datenbestände | 🟢 klare Empty States |
| Doppelte Klicks auf Like | 🟢 Zustand bleibt konsistent |
| Sehr lange Eingaben | ⚫ nicht abgeschlossen (Feld im Formular nicht automatisiert erreichbar) |
| Netzwerkfehler / langsame Verbindung | ⚫ nicht getestet |

## 14. Mobile (390 px, Android-UA)

- Alle geprüften Seiten ohne horizontalen Überlauf 🟢
- Registrierung, Market, Feed, Profil, Globe, Arena, Channels vollständig bedienbar 🟢
- Ladezeiten mobil durchweg besser als Desktop bei der Startseite 🟢
- 🟡 sehr viele kleine Touch-Ziele (siehe 10.)
- Tastatur-/Fokusverhalten auf echten Geräten: ⚫ NICHT TESTBAR headless

## 15. Console / Runtime

- Eingeloggter Durchlauf über 10 Routen: **0 JavaScript-Fehler, 0 unhandled Rejections, 0 HTTP 4xx/5xx** (außer Cloudflare-Bot-Prüfung) 🟢
- 🟡 Öffentlich, nicht angemeldet: React-Fehler #418 (Hydration-Mismatch) auf `/market`, `/posts`, `/arena`, `/globe` – Seiten funktionieren, die Meldung deutet auf abweichendes Server-/Client-Markup beim Auth-Redirect
- 401-Antworten von `challenges.cloudflare.com` sind Bot-Erkennung des automatisierten Browsers, kein App-Fehler

## 16. Gesamtbewertung

| Bereich | Status |
| --- | --- |
| Baseline / Build | 🟡 (Lint) |
| Registrierung / Turnstile | 🟢 |
| Login | 🟡 |
| Feed / Social | 🟢 |
| SlangTag | 🟢 |
| Messenger | 🟡 |
| Market | 🟡 (leere Transaktionsseite) |
| Profile | 🟢 |
| Admin | 🟢 |
| Navigation / UX | 🟡 |
| Performance | 🟡 |
| Security | 🟡 |
| Edge Cases | 🟡 |
| Mobile | 🟢 |
| Console / Runtime | 🟡 |

Bewertung: Funktionalität 9/10 · Performance 7/10 · UX 8/10 · Mobile 8/10 · Security 8/10 · Stabilität 9/10 → **Gesamt 8,2/10**

## 17. Priorisierte Verbesserungsliste

| ID | Bereich | Problem | Auswirkung | Prio | Empfehlung | Aufwand | Risiko | Test danach |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-01 | Market | `/market/tx/<unbekannt>` zeigt leere Seite | Nutzer sieht nichts, wirkt wie Absturz | P1 | Nicht-gefunden-/Fehlerzustand für die Route ergänzen | klein | gering | Aufruf unbekannter ID zeigt Meldung |
| A-02 | Messenger/DB | Lesestatus-Update teuerste Abfrage (max. 690 ms) | Verzögerung beim Öffnen von Chats | P1 | Aufrufe bündeln/entprellen, nur bei echter Änderung schreiben | mittel | mittel | Abfragezeit erneut messen |
| A-03 | Runtime | Hydration-Fehler #418 auf 4 öffentlichen Routen | Doppeltes Rendern, unnötige Arbeit | P1 | Auth-Redirect-Markup server-/clientseitig gleich rendern | mittel | mittel | Konsole ohne #418 |
| A-04 | Performance | 99–176 Requests je eingeloggter Seite | Langsamer Start, mobile Datenlast | P1 | Anfragen zusammenfassen, Caching-Fenster erhöhen | mittel | mittel | Requestzahl < 80 |
| A-05 | Performance | Globe-Daten 1,6 MB + 1,2 MB + 1,1 MB | `/globe` und `/channels` langsam | P2 | Geodaten nachladen/vereinfachen, kleinere Auflösung als Standard | mittel | mittel | `/globe` netto < 1 s |
| A-06 | UX/Mobile | 138+ Bedienelemente unter 40 × 32 px | Fehlgriffe auf dem Handy | P2 | Trefferflächen der Feed-Aktionen vergrößern | klein | gering | Prüfung: 0 Ziele < 40 × 32 px |
| A-07 | Login | Turnstile lädt sofort | Unnötige Fremdanfrage, Inkonsistenz | P2 | Verzögertes Laden wie in der Registrierung | klein | gering | Login: 0 Cloudflare-Scripts vor Interaktion |
| A-08 | Qualität | Lint scheitert (9.982 Meldungen) | Echte Fehler gehen unter, CI unbrauchbar | P2 | Archivordner ausschließen, 27 `src`-Dateien bereinigen | klein | gering | `lint` grün |
| A-09 | SEO/A11y | `<html lang>` immer `en` | Vorlesehilfen/Suchmaschinen falsch informiert | P2 | Sprache aus Oberflächensprache setzen | klein | gering | `lang="de"` bei deutscher Ansicht |
| A-10 | Performance | `post_views` 32.738 Inserts | Dauerhafte Schreiblast | P2 | Ansichten clientseitig bündeln, in Intervallen senden | mittel | mittel | Aufrufzahl sinkt messbar |
| A-11 | Performance | SlangTag-Polling 6.890 Abfragen | Vermeidbare Last | P3 | Intervall erhöhen oder auf Realtime umstellen | klein | gering | Aufrufzahl sinkt |
| A-12 | Security | 63 Datenbank-Hinweise, 3 Tabellen ohne Policy | Unklare Absicht, Prüfaufwand | P3 | Hinweise einzeln bewerten und dokumentieren | mittel | mittel | dokumentierte Bewertung je Fall |
| A-13 | Startseite | ~1 MB Startlast, FCP Desktop 3,2 s | Absprünge bei Erstbesuch | P3 | Bilder weiter verkleinern, Startpfad entlasten | mittel | gering | FCP Desktop < 2 s |

## 18. Kritische Befunde

- **P0: keine.** Kein Sicherheitsleck, kein Datenverlust, kein Totalausfall gefunden.
- P1: A-01 leere Transaktionsseite · A-02 teuerstes Datenbank-Update · A-03 Hydration-Fehler · A-04 Requestmenge.

## 19. Empfohlene Reihenfolge

1. A-01 (kleiner, sichtbarer Fehler)
2. A-03 (Hydration, betrifft vier öffentliche Seiten)
3. A-02 und A-10 (Datenbanklast)
4. A-04 und A-05 (Ladeverhalten)
5. A-06, A-07, A-09 (UX/Konsistenz)
6. A-08 (Lint/CI), danach A-11 bis A-13

## 20. Nicht testbar (mit Begründung)

| Punkt | Grund |
| --- | --- |
| Turnstile-SUCCESS-Pfad | Cloudflare liefert automatisierten Browsern kein interaktives Prüffenster |
| E-Mail-Bestätigung, echte Neuregistrierung | benötigt echtes Postfach und menschliche Prüfung |
| Login mit falschem Passwort | Turnstile-Pflicht vor Anmeldeversuch |
| Nachricht senden/empfangen, Market-Ablauf mit 2 Konten | zwei echte Sitzungen und Schreibaktionen nötig – im Audit ausgeschlossen |
| Profil speichern, Avatar-Upload | Schreibaktion – im Audit ausgeschlossen |
| Admin-Innenansicht | Rechteänderung ausgeschlossen |
| Lighthouse-Werte (TBT/CLS/TTI), Netzwerkdrosselung | in diesem Lauf nicht ausgeführt |
| Commit-/Deployment-Zeitpunkt | an der Auslieferung nicht abrufbar |
