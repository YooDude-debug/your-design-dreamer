# market_transaction_secrets – Recheck (18.09.2026)

Warning: „Pickup codes lack seller/admin scoping consistency" (market_transaction_secrets)
Vorgehen: rein lesende Bestandsaufnahme. Keine Code-, RLS-, DB- oder Production-Änderung.

## Befunde

1. **Payment im Market inaktiv.** Der Kaufstart (`src/lib/market-tx.server.ts:246-275`)
   ruft `market_start_transaction` und setzt den Vorgang direkt auf
   `ready_for_pickup` / `shipping_status = not_required`; es existiert kein
   Checkout-, Zahlungs- oder Versandschritt. Kommentar im Code: „Vereinfachter
   Market (Stand 09/2026): ausschließlich Abholung. Y-Dude wickelt weder Zahlung
   noch Versand ab." Stripe-Code existiert im Projekt nur für Abos,
   Creator-SlangTags, Business/Promotion – nicht für Market-Kauftransaktionen.
   `market_payment_records`: 0 Zeilen.

2. **Aktive Market-Funktionen:** Inserate anlegen/bearbeiten, Suche/Feed,
   Favoriten, Preisangebote (`market_accept_offer`), Messenger-Kontakt,
   Abholvorgang mit Statusverlauf, Abschluss über `market_complete_transaction`,
   Promotion/Anzeigen. Kein Checkout, keine Zahlungsabwicklung, kein Versand.

3. **`market_transaction_secrets` wird von keinem aktiven Workflow genutzt.**
   Kein Treffer für `market_transaction_secrets` oder `pickup_code` im gesamten
   Anwendungscode (nur in der historischen Migration und in den generierten
   Typen). Die aktuelle Datenbankfunktion `market_start_transaction` schreibt
   **keinen** Datensatz in die Tabelle mehr (geprüft: `prosrc` enthält die
   Tabelle nicht). Tabelle: 0 Zeilen, `market_transactions`: 0 Zeilen.

4. **`pickup_code`:** wird derzeit nicht erzeugt, nicht angezeigt, nicht
   validiert, von keinem Seller- und keinem Admin-Pfad benötigt.

5. Es gibt aktuell keinen aktiven Checkout-, Payment-, Order- oder
   Pickup-Code-Workflow, der diese Daten benötigt. Die Übergabe wird ohne Code
   bestätigt (`market_complete_transaction`, seller-seitig).

6. **Buyer-only-SELECT ist bewusstes restriktives Design.** Einzige Policy:
   `buyer reads pickup code` (`EXISTS (… t.buyer_id = auth.uid())`), plus
   `GRANT SELECT` an `authenticated` und `ALL` an `service_role`. Sie ist der
   engste sinnvolle Zuschnitt für einen Workflow, der momentan nicht aktiv ist.

## Bewertung

- STRIPE ACTIVE (Market-Kauf): **NO** (Stripe nur für Abos/Promotion)
- MARKET TRANSACTION WORKFLOW ACTIVE: **NO** (Payment/Pickup-Code-Teil inaktiv; nur Abholanfrage/Abschluss ohne Code)
- market_transaction_secrets CURRENTLY USED: **NO**
- SELLER ACCESS REQUIRED: **NO**
- ADMIN ACCESS REQUIRED: **NO**
- BUYER-ONLY ACCESS INTENTIONAL: **YES**
- SECURITY RISK: **NONE** (RLS aktiv, kein anon-Zugriff, 0 Zeilen, keine Exposition)
- ACTION REQUIRED: **NO** – Warning als „no action required / intentional restrictive access" dokumentiert
- PRODUCTION: **UNCHANGED**

Hinweis für später: Sollte ein Pickup-Code-Workflow reaktiviert werden, wäre der
minimale Weg eine serverseitige Validierung (service_role/RPC, die nur
„Code korrekt ja/nein" zurückgibt) statt einer Seller-/Admin-SELECT-Policy.
