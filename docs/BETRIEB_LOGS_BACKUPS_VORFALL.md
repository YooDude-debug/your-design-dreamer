# Y-Dude – Betrieb: Protokolle, Backups, Sicherheitsvorfälle

Stand: 2026-08-10. Technische Bestandsaufnahme ohne rechtliche Bewertung.
Alles, was eine rechtliche Festlegung braucht, ist als
**OFFEN (rechtlich)** bzw. **EXTERN** markiert. Es werden keine Fristen,
Zuständigkeiten oder Anbieterzusagen erfunden.

---

## 1. Protokolle in der Anwendungsdatenbank

| Tabelle | Inhalt (kann Nutzerbezug haben) | Zugriff | Bereinigung |
| --- | --- | --- | --- |
| `content_moderation_log` | Moderationsentscheidungen, Labels, Begründung, KI-Rohantwort | Administration; Nutzer nur eigene Zeilen | Löschlauf, Frist offen |
| `slang_tag_moderation_events` | Statuswechsel von SlangTags, handelnde Person | Administration/Eigentümer | Löschlauf, Frist offen |
| `admin_audit_log` | administrative Eingriffe inkl. Ziel-Nutzer | nur Administration | Löschlauf, Frist offen |
| `account_security_events` | Export-/Löschversuche, Passwortfehler | Nutzer eigene Zeilen, Administration | Löschlauf, Frist offen |
| `post_moderation_jobs` | Warteschlange der Inhaltsprüfung | nur Server/Administration | Löschlauf, Frist offen |
| `notification_jobs` | Push-Warteschlange | nur Server | `cleanup_push_data()` (7 Tage für erledigte Jobs) |
| `push_subscriptions` | Zustelladressen der Browser | Nutzer eigene Zeilen | `cleanup_push_data()` (inaktiv > 90 Tage oder 5 Fehlversuche) |
| `feed_signals`, `interaction_events` | Nutzungssignale | Nutzer eigene Zeilen | Löschlauf, Frist offen; Reset durch Nutzer |
| `ad_test_events` | Ereignisse des Werbe-Testmodus | Administration | Löschlauf, Frist offen |
| `counter_events` | kurzlebige Zählerdeltas | nur Server | wird beim Aggregieren geleert |

**Automatisierte Bereinigung:** `src/lib/retention.server.ts` definiert je
Tabelle eine Regel mit Umgebungswert (z. B.
`RETENTION_DAYS_ADMIN_AUDIT_LOG`). Ohne gesetzten Wert wird **nichts**
gelöscht. Ausführung nächtlich über `POST /api/public/retention-run`
(nur mit Server-Secret; Zeitplan als Cron-Job eingerichtet).

**OFFEN (rechtlich):** die konkreten Werte je Tabelle.

---

## 2. Plattform-/Serverlogs (ausserhalb der Anwendungsdatenbank)

Technisch vorhanden, aber nicht von der Anwendung verwaltet:

- **Auslieferungs-/Netzwerkprotokolle (Cloudflare):** können IP-Adresse,
  Zeitpunkt, angefragte Adresse, Browserkennung enthalten.
- **Anwendungs-/Funktionsprotokolle der Hosting-Plattform (Lovable):**
  Serverfehler und Konsolenausgaben der Serverfunktionen; enthalten
  bewusst keine Passwörter oder Secrets, können aber Kennungen enthalten.
- **Datenbank- und Auth-Protokolle (Supabase):** Verbindungs-, Fehler- und
  Auth-Ereignisse.

Zugriff: Betreiber des Projekts über die jeweilige Plattformoberfläche.
Aufbewahrung und Löschung richten sich nach den Vorgaben der Plattformen und
sind **nicht** über den Anwendungscode steuerbar.

**EXTERN zu klären:** Speicherdauer und Löschmechanismen dieser
Plattformprotokolle sowie deren Einordnung in die Auftragsverarbeitung.

Im Anwendungscode umgesetzte Vorsorge: Serverfehler werden ohne Inhalte und
ohne Secrets protokolliert (`console.error` mit Fehlercode/Kontext), Secrets
werden nie ausgegeben.

---

## 3. Backups

- Datenbank- und Speicher-Backups werden von der Plattform
  (Lovable Cloud / Supabase) erstellt und verwaltet; die Anwendung erzeugt
  keine eigenen Backups und hat keinen eigenen Backup-Speicher.
- Umfang: der Datenbankinhalt und die Objekte des Medienspeichers, also auch
  personenbezogene Daten.
- Zugriff: Betreiber des Projekts über die Plattform.
- **Zusammenhang mit Löschungen:** eine Kontolöschung wirkt sofort im
  Produktivbestand. In bereits erstellten Backups können die Daten bis zum
  Ablauf des jeweiligen Backups technisch noch enthalten sein; eine gezielte
  Einzellöschung innerhalb bestehender Backups ist nicht vorgesehen.
- **EXTERN zu klären:** Aufbewahrungsdauer der Backups, Speicherort/Region,
  Zugriffsberechtigungen, Vorgehen bei Wiederherstellung nach einer Löschung.
- **OFFEN (rechtlich):** ob und wie die Backup-Aufbewahrung in der
  Datenschutzerklärung zu benennen ist. Kein Wert wird hier erfunden.

---

## 4. Umgang mit Sicherheitsvorfällen / Datenschutzverletzungen

Technisch vorhandene Bausteine:

**Erkennung**
- Sicherheits- und Abhängigkeitsprüfungen der Plattform (Security-/
  Dependency-Scan) sowie der Datenbank-Linter (RLS-/Policy-Prüfung).
- Protokolle nach Abschnitt 1, insbesondere `account_security_events`
  (fehlgeschlagene Passwortprüfungen, Export-/Löschversuche) und
  `admin_audit_log`.
- Ratenlimits bei Export, Löschung und Meldungen.
- Autorisierung aller Job-Endpunkte unter `/api/public/*` mit Server-Secret;
  fehlgeschlagene Aufrufe erscheinen als 401 in den Plattformprotokollen.
- Meldewege durch Nutzer: `reports` (Inhalte/Profile) und die im Impressum
  genannte Kontaktadresse.

**Protokollierung und Sicherung relevanter Informationen**
- Betroffene Zeitpunkte, Kennungen und administrative Eingriffe sind in den
  Tabellen aus Abschnitt 1 nachvollziehbar.
- Wichtig für die Beweissicherung: Löschläufe für die betroffenen Protokolle
  vor der Aufarbeitung **nicht** aktivieren bzw. den Umgebungswert für die
  betroffene Tabelle vorübergehend entfernen (dann wird für diese Tabelle
  nichts gelöscht).
- Zusätzlich sollten die Plattformprotokolle (Abschnitt 2) zeitnah gesichert
  werden, da sie kürzer verfügbar sein können als die Anwendungsprotokolle.

**Sofortmaßnahmen, technisch verfügbar**
- Betroffene Konten sperren (`user_bans`), Inhalte verbergen
  (`posts.hidden_at`, `moderation_status = blocked`).
- API-Schlüssel und Server-Secrets rotieren (Plattformfunktionen für
  Schlüsselrotation und Secrets).
- Sitzungen beenden bzw. Passwort-Reset für betroffene Konten anstossen.
- Zugriff über RLS-Policies weiter einschränken.

**Eskalation und Zuständigkeit**
- **OFFEN (Konfiguration):** verantwortliche Person, Erreichbarkeit,
  Meldekette und Reihenfolge der Benachrichtigung sind noch festzulegen und
  hier einzutragen. Es wird ausdrücklich keine Zuständigkeit unterstellt.
- **EXTERN/rechtlich:** Bewertung der Meldepflicht sowie Inhalte und Fristen
  einer Meldung nach Art. 33/34 DSGVO. Hier werden bewusst keine Fristen oder
  Pflichten genannt.

**Vorbereitung einer späteren Meldung – technisch beschaffbare Angaben**
- Art des Vorfalls und betroffene Tabellen/Speicherobjekte.
- Zeitraum (erste und letzte betroffene Zeile über die Zeitstempel).
- Anzahl betroffener Konten (Abfrage über die betroffenen Tabellen).
- Datenkategorien gemäss `docs/VERARBEITUNGSVERZEICHNIS_TECHNISCH.md`.
- Bereits getroffene technische Maßnahmen (siehe Sofortmaßnahmen).

---

## 5. Verweise

- Datenfluss und Drittdienste: `docs/DATENSCHUTZ_TECHNIK.md`
- Verarbeitungsvorgänge und DSFA-Vorbereitung:
  `docs/VERARBEITUNGSVERZEICHNIS_TECHNISCH.md`
- Löschregeln: `src/lib/retention.server.ts`
- Autorisierung der Job-Endpunkte: `src/lib/worker-auth.server.ts`
