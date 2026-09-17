# Y-Dude – RLS-Audit der zwei verbleibenden Security-Warnings (15.09.2026)

Prüfung ohne Änderung an Policies, Grants, Tabellen oder Funktionen.
Keine Testdaten erzeugt, keine Production-Schreibvorgänge.

## 1. `ad_test_settings` (MISSING_RLS_PROTECTION / warn)

**Ursache:** Der Scanner weist darauf hin, dass `enabled` / `ad_frequency` nur für
Admins lesbar sind, und fragt, ob Clients diese Werte direkt brauchen.

**Befund im Code:** Kein Client-Code liest die Tabelle. Nur zwei serverseitige
Dateien greifen zu, beide über den privilegierten Serverzugang:

- `src/lib/ads/demo-inventory.server.ts` (`select("enabled")`)
- `src/lib/live-test.server.ts` (`select("enabled, ad_frequency")`, Admin-Funktionen)

Die RLS ist für diesen Pfad irrelevant, weil er nicht als normaler Nutzer läuft.

**Änderung notwendig:** Nein. Admin-only-RLS bleibt unverändert.
Ein Lesezugriff für alle Nutzer würde die Rechte ohne Bedarf ausweiten.

**Status:** funktionaler Hinweis, keine Schwachstelle.

## 2. `market_transaction_secrets` (MISSING_RLS_PROTECTION / warn)

**Ursache:** Es existiert nur die SELECT-Policy `buyer reads pickup code`
(`market_transactions.buyer_id = auth.uid()`), keine Verkäufer-/Admin-Policy.

**Befund im Workflow:** Der Market kennt keinen Abholcode mehr. Der aktive
Ablauf ist Listing → Kaufanfrage/Reservierung → Kommunikation →
„Als verkauft markieren“ (`market_complete_transaction`). Kein Code liest,
schreibt oder validiert `pickup_code`; das ist durch
`tests/market-no-pickup-code.test.ts` festgeschrieben. In der Live-Datenbank:
`market_transaction_secrets` = 0 Zeilen, `market_transactions` = 0 Zeilen.

Also muss **niemand** den Code lesen – weder Verkäufer noch Admin.

**Änderung notwendig:** Nein. Die Buyer-only-Policy bleibt als bewusstes
Least-Privilege-Design bestehen (historische Tabelle ohne aktive Nutzung).

## Indirekte Zugriffswege

- Keine Datenbankfunktion referenziert eine der beiden Tabellen
  (`pg_get_functiondef`-Suche: 0 Treffer) – also kein `security definer`-Umweg.
- Keine View im Schema `public` enthält `pickup_code`.
- Tabellenrechte (`relacl`): `anon` hat auf beiden Tabellen **keine** Rechte;
  `market_transaction_secrets` gibt `authenticated` nur `SELECT`.
- RLS ist auf beiden Tabellen aktiv.

## Testergebnis

| Rolle | `ad_test_settings` | `market_transaction_secrets` | Methode |
| --- | --- | --- | --- |
| nicht eingeloggt (anon) | 401 permission denied | 401 permission denied | REST mit publishable Key |
| normaler Nutzer (kein Admin, googleplay.tester) | 200, 0 Zeilen | 200, 0 Zeilen | echte Session |
| Admin | 200, 1 Zeile | 200, 0 Zeilen | echte Session |
| anderer Käufer / Verkäufer / anderer Verkäufer | zeilenbasiert NICHT gemessen | zeilenbasiert NICHT gemessen | BLOCKED |

**BLOCKED-Begründung:** Für zeilenbasierte Käufer-/Verkäufer-Tests wären
Transaktions- und Secret-Zeilen in Production nötig. Es wurden bewusst keine
Testdaten angelegt. Die Buyer-Bindung ist daher nur über die Policy-Definition
belegt (`buyer_id = auth.uid()`), nicht durch einen Datenzeilentest.
Verkäufer und fremde Nutzer erfüllen diese Bedingung definitionsgemäß nicht.

## Verbleibende Security-Warnings

Beide Warnungen bleiben unverändert aktiv und wurden nicht als „behoben“ oder
„ignoriert“ markiert:

1. `ad_test_settings_no_public_read` (warn) – funktionaler Hinweis, kein Bedarf.
2. `market_transaction_secrets_pickup_code` (warn) – bewusstes Least-Privilege-Design.

Keine kritischen Befunde.

## Nachprüfung 17.09.2026 – beide Warnungen erneut geprüft, keine Änderung

Rein lesende Prüfung von Code und Live-Datenbank. Keine Policy, Tabelle, Funktion oder Daten verändert.

### 1. ad_test_settings – Status: intentional / no action required

- **Lesepfade:** ausschliesslich serverseitig mit erhöhten Rechten (`supabaseAdmin`):
  `src/lib/live-test.server.ts` (`loadLiveSettings`/`saveLiveSettings`) und
  `src/lib/ads/demo-inventory.server.ts` (`isDemoInventoryAllowedFor`).
- **Client:** kein direkter Tabellenzugriff im Browser (Treffer nur in generierten Typen und in
  einem Protokoll-Label).
- **Werteweitergabe an den Client:** ja, bereits vorhanden – `getLiveTestSettings`
  (`src/lib/live-test.functions.ts`) gibt `liveTest`/`adFrequency` an jedes ANGEMELDETE Konto zurück;
  Änderungen bleiben Admin-only (`assertAdmin`). Der Feed erhält die Frequenz also über diese
  Serverfunktion, nicht über die Tabelle.
- **Live-Stand:** RLS aktiv; SELECT/UPDATE/DELETE nur `authenticated` MIT `has_role(...,'admin')`;
  `anon` hat auf der Tabelle keine Grants. 1 Zeile.
- **Root Cause der Warnung:** Der Prüfer erkennt eine Feature-Flag-Tabelle ohne Leserechte für
  normale Nutzer und weist rein funktional darauf hin (`level: warn`, „No action required unless
  client relies on direct table reads“).
- **Notwendige Änderung:** keine. Kein reproduzierbarer Funktionsfehler für normale Nutzer, weil der
  benötigte Wert über die Serverfunktion kommt.
- **Sicherheitsauswirkung / Regressionsrisiko einer Öffnung:** eine SELECT-Policy für alle Nutzer
  würde einen internen Admin-Schalter offenlegen, ohne Nutzen – abgelehnt.

### 2. market_transaction_secrets – Status: intentional / no action required (bewusstes Sicherheitsdesign)

- **Ablauf heute:** Der vereinfachte Market kennt KEINEN Abholcode. Ablauf ist Anzeige →
  Kaufanfrage/Reservierung → Chat → „Als verkauft markieren“ (`markSold` →
  `market_complete_transaction`). Es gibt keine Codeeingabe und keine Codeprüfung.
- **Beleg:** `tests/market-no-pickup-code.test.ts` stellt sicher, dass `market-tx.server.ts`,
  `market-tx.functions.ts` und die beiden Market-Routen keine Abholcode-Logik enthalten und
  `confirmPickup` nicht mehr existiert. Im gesamten Anwendungscode kommt `pickup_code` nur noch in
  den generierten Datenbanktypen vor.
- **Wer muss lesen?** Niemand: kein Verkäufer, kein Admin, keine Serverfunktion liest den Wert.
  Der Käufer-Lesepfad ist der einzige historische Rest.
- **Live-Stand:** RLS aktiv; genau eine Policy („buyer reads pickup code“, SELECT, `authenticated`,
  eingeschränkt auf `t.buyer_id = auth.uid()`); `authenticated` hat nur SELECT, `anon` keine Grants.
  Tabelle enthält **0 Zeilen** (0 Transaktionen).
- **Root Cause der Warnung:** Der Prüfer vergleicht das Schema mit anderen Market-Tabellen, die
  Käufer, Verkäufer und Admin lesen lassen, und meldet fehlende „Konsistenz“ – nicht eine
  nachgewiesene Fehlfunktion.
- **Notwendige Änderung:** keine. Eine zusätzliche Verkäufer-/Admin-Policy würde ein Geheimnis für
  Personen öffnen, die es im aktuellen Ablauf nicht brauchen. Sicherheit vor Schema-Konsistenz.
- **Regressionsrisiko:** durch Nichtändern keines; eine Öffnung wäre eine echte Verschlechterung.

**Beide Warnungen bleiben unverändert aktiv** – nicht ignoriert, nicht als behoben markiert.
