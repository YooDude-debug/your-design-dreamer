# Y-Dude – Phase 1: Automatisierte Tests (Abschlussbericht)

Stand: 2026-08-26 · Testlauf: `bunx vitest run` · **323 Tests, 9 Dateien, alle grün**
Keine Produktfunktion geändert, keine Datenbankänderung ausgeführt.

## 1. Master-Backup (Schritt 1)

`.lovable/backup/master-2026-08-26-before-professionalization/`
– Manifest: 111 Tabellen, 277 RLS-Richtlinien, 160 Datenbankfunktionen
– Prüfsummen: 437 Quelldateien, 220 Migrationen
– Kopien der zentralen Konfigurationsdateien

## 2. Testabdeckung nach Bereich

| Bereich                     | Datei                                                        | Tests | Inhalt                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anmeldung & Zugriffsschutz  | `tests/auth-guard-contract.test.ts`                          | 26    | Bearer-Token-Prüfung, Routen-Gate, Anmeldepflicht je Server-Funktion, Absicherung aller öffentlichen HTTP-Endpunkte, kein Dienst-Schlüssel im Browser-Code, Konto/DSGVO-Schutz                                                |
| Datenbank-Absicherung (RLS) | `tests/rls-policy-contract.test.ts`                          | 226   | Für jede angelegte Tabelle: RLS aktiv + explizite Rechtevergabe; Rollen in eigener Tabelle; Rechteprüfung über `has_role`; keine Schreibrechte für die Rolle `public`; Zahlungsereignisse und Abholcodes für Clients gesperrt |
| Market / Zahlungen          | `tests/market-transaction-flow.test.ts`                      | 22    | Rollenrechte (Versand nur Verkäufer, Empfang nur Käufer), Abholcode-Prüfung inkl. Einmalverwendung, Storno- und Rückerstattungsregeln, Zustandsübergänge                                                                      |
| Zahlungs-Webhook            | `payments-webhook-signature`, `payments-webhook-idempotency` | 15    | Signaturprüfung, Wiederholungsschutz, keine Doppelverbuchung                                                                                                                                                                  |
| Messenger / Push            | `tests/push-texts.test.ts`                                   | 14    | Sprachwahl DE/EN/EL, keine Chat-Inhalte in Benachrichtigungen                                                                                                                                                                 |
| Feed                        | `tests/feed-ranking.test.ts`                                 | 8     | Determinismus der Vielfaltsschicht, Wertegrenzen der Bewertung                                                                                                                                                                |
| Medien                      | `tests/media-variants.test.ts`                               | 6     | Variantenkette und Rückfallebene                                                                                                                                                                                              |
| Betriebsprotokolle          | `tests/observability.test.ts`                                | 6     | Maskierung personenbezogener Daten und Geheimnisse                                                                                                                                                                            |

## 3. Prüfwerkzeuge

- `tests/helpers/fake-supabase.ts` – Nachbildung der Datenbank-Schnittstelle (Ketten, Filter, RPC), damit Serverlogik ohne Produktionsdaten geprüft wird.
- Vertragstests lesen `supabase/migrations/` und `src/` statisch. Dadurch werden neue Tabellen oder Server-Funktionen ohne Absicherung sofort auffällig – auch ohne separate Testdatenbank.

## 4. Bei der Prüfung bestätigte Sachverhalte

- Absicherungsschleifen (`DO $$ … ARRAY[...]`) sichern die Interaktionstabellen; sie werden vom Vertragstest als gleichwertig erkannt.
- `account.functions.ts` enthält zwei bewusst offene Prüfungen der Namensverfügbarkeit vor der Registrierung; alle Vorgänge mit Personenbezug sind anmeldepflichtig.
- Alle Endpunkte unter `src/routes/api/public/` prüfen den Aufrufer über `isAuthorizedWorkerRequest` bzw. die Zahlungssignatur.

## 5. Nicht abgedeckt (bewusst offen)

- Echte RLS-Laufzeittests gegen eine getrennte Datenbank (setzt Phase 2 „Staging“ voraus).
- Oberflächentests (Browserabläufe) – Kandidat für eine spätere Phase.

Phase 2 wurde nicht begonnen.
