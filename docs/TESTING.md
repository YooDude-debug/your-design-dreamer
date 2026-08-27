# Y-Dude – Teststrategie

Drei Ebenen, bewusst getrennt. Ziel ist nicht die höchste Testanzahl, sondern
Absicherung der wichtigsten echten Nutzerabläufe gegen Rückschritte.

## Ebene 1 – Logik- und Vertragstests (Vitest)

- Befehl: `bun run test`
- Umfang: bestehende Suite (unverändert, weiterhin vollständig grün)
- Laufzeit: wenige Sekunden, keine externe Abhängigkeit
- Zweck: Rechenlogik, Feed-Bewertung, Rechte-Verträge, Market-Regeln

Diese Ebene wurde nicht ersetzt und nicht umgeschrieben.

## Ebene 2 – Datenbank-Integration (Vitest, echte Datenbank, nur lesend)

- Befehl: `bun run test:db`
- Konfiguration: `vitest.integration.config.ts`
- Dateien: `tests/integration/`
  - `db-client.ts` – schmaler Zugang über `psql`. Eine Schutzschicht erlaubt
    ausschließlich `select`/`with`, verbietet mehrere Anweisungen und jede
    schreibende Anweisung.
  - `db-security.test.ts` – Zeilensicherheit auf allen öffentlichen Tabellen,
    Rechtevergabe, Rollenmodell in eigener Tabelle, fester Suchpfad bei
    Funktionen mit erhöhten Rechten, Schutz sensibler Bereiche.
  - `db-anon-access.test.ts` – prüft über die öffentliche Schnittstelle, dass
    nicht angemeldete Besucher weder Nachrichten, Zahlungsdaten noch Rollen
    lesen oder schreiben können.

Wichtig: Vorschau und Produktion teilen derzeit eine Datenbank. Deshalb ist
diese Ebene strikt lesend – es werden keine Datensätze erzeugt, verändert oder
gelöscht und keine Testkonten angelegt.

## Ebene 3 – Browser-/E2E-Tests (Playwright)

- Befehl: `bun run test:e2e`
- Konfiguration: `playwright.config.ts` (ein Browser, Chromium, ein Worker)
- Schutzschranke: `tests/e2e/base-url.ts` bricht ab, wenn die Zieladresse eine
  Produktionsadresse ist. Getestet wird nur der lokale Entwicklungsserver.
- Anmeldung: `tests/e2e/global-setup.ts` übernimmt die bereitgestellte
  Testsitzung in einen Anmeldezustand (`tests/e2e/.artifacts`, nicht versioniert).
  Ohne Sitzung werden die angemeldeten Abläufe übersprungen statt rot.

Abgedeckte Kernabläufe (alle lesend/navigierend):

| Datei | Abgesicherter Ablauf |
| --- | --- |
| `public-and-auth.spec.ts` | Landingpage, rechtliche Seiten, Schutz geschützter Routen, Sitzung übersteht Neuladen |
| `feed.spec.ts` | Feed lädt, scrollt, Beitragsdetail und Rückweg |
| `messenger.spec.ts` | Chatliste öffnet; Rückschritt-Test: Market-Liste bleibt nach Navigation nicht hängen |
| `market.spec.ts` | Market, Kategorien, Artikeldetail, eigene Artikel |
| `navigation-serverfn.spec.ts` | Durchlauf aller Kernrouten ohne Serverfehler |

### Rückschritt-Erkennung

`tests/e2e/helpers.ts` beobachtet in jedem Ablauf Konsole, Seitenfehler und
Antwortcodes. Als schwerer Fehler gelten unter anderem:

- „server function info not found“ / „invalid server function id“
- „useSocial must be used within …“
- HTTP 500 auf beliebiger Adresse

Damit sind genau die Fehlerklassen abgedeckt, die in der Vergangenheit zu
Ausfällen geführt haben.

### Stabilität

- Auswahl über Rollen, Beschriftungen und Adressen – keine CSS-Klassen.
- Kein Warten auf feste Zeiten als Ersatz für Zustandsprüfungen; Netzwerkruhe
  wird nur kurz und optional abgewartet (Live-Verbindungen bleiben aktiv).
- Fehlen Inhalte (z. B. keine Beiträge vorhanden), wird der betroffene Schritt
  übersprungen statt falsch-rot zu melden.

## Freigabe-Gate

`bash scripts/verify.sh` führt aus: Typprüfung, Lint, Logiktests, danach
Datenbank-Integration (wenn Datenbankzugang vorhanden) und Browsertests (wenn
der Entwicklungsserver antwortet). Beides lässt sich mit `VERIFY_SKIP_DB=1`
bzw. `VERIFY_SKIP_E2E=1` abschalten.

## Sicherheit

- Keine Zugangsdaten oder Geheimnisse in Testdateien; die Sitzung kommt
  ausschließlich aus der Umgebung und landet nur in einem nicht versionierten
  Artefaktverzeichnis.
- Keine Ausgabe von Tokens, Schlüsseln oder personenbezogenen Daten in
  Testausgaben.
- Keine Tests gegen Produktionsadressen.
