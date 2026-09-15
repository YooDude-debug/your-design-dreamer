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
