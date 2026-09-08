# Diagnose 2026-09-08 – Registrierungs-Button ohne Hinweis & Audit-Befund „Market bleibt reserved“

Read-only-Analyse. Nichts geändert, nichts veröffentlicht.

## Problem 1 – Sign-up-Button deaktiviert ohne Erklärung

**Root Cause:** In `src/routes/auth.tsx` (RegisterForm) prüft `formReady`
(Zeilen 503–512) E-Mail-Muster, `USERNAME_RE`, Passwortlänge ≥ 8,
`password === password2`, Geburtsdatum/Mindestalter, Zustimmung und (bei
aktivem Turnstile) Token. Der Button ist `disabled={loading || !formReady}`
(Zeile 903). Die verständlichen Fehlermeldungen existieren jedoch
ausschließlich in `onSubmit` → `failValidation()` (Zeilen 522–564) und werden
per `toast.error` und `validationError` ausgegeben. Weil der Button gesperrt
ist, wird `onSubmit` nie aufgerufen – die Meldungen können nicht erscheinen.

**Bereits vorhandene Bausteine (keine neue Logik nötig):**

- Texte in `src/lib/i18n-auth.ts`: `errEmailInvalid`, `errUsernameInvalid`,
  `errUsernameTaken`, `errUsernameBlocked`, `errPasswordTooShort`,
  `errPasswordsMismatch`, `errBirthdateRequired`, `errUnderage(...)`,
  `errConsentRequired` – in DE/EN/EL.
- Feldbezogenes Hinweis-Muster existiert schon beim Username
  (Zeilen 782–793: `text-[11px]`, grün/`text-destructive`, ✓/✕) inkl.
  Live-Prüfung `useUsernameCheck` mit Status `available | taken | reserved |
  invalid`.

**Empfehlung (rein Darstellung):** Dieselbe Hinweiszeile unter E-Mail,
Passwort, Passwortbestätigung und Geburtsdatum rendern, gespeist aus den
vorhandenen Prüfungen und Texten – erst anzeigen, wenn das Feld berührt
wurde bzw. nicht leer ist. Zusätzlich optional eine kurze Zeile über dem
Button („Bitte noch korrigieren: …“). `formReady` und der Button-Zustand
bleiben unverändert.

Betroffene Datei: `src/routes/auth.tsx` (nur Darstellung).

## Problem 2 – Audit-Befund „Sold Items bleiben reserved“

1. **Ist der Fix vorhanden?** Ja. `src/lib/market-tx.server.ts` `markSold()`
   (ab Zeile 427) ruft `db.rpc("market_complete_transaction", …)`, prüft
   Fehler, prüft `item_status === "sold"` und wirft sonst `complete_failed`.
2. **Welche Funktion verarbeitet den Abschluss?** `markMarketSold`
   (`src/lib/market-tx.functions.ts:80`) → `markSold()`. Aufrufer:
   `src/routes/_authenticated/market.tx.$txId.tsx:129`. **Pickup-Codes
   existieren nicht mehr** (mit Migration 0036 entfernt); der Abschluss ist
   die Verkäuferbestätigung.
3. **Wird der Listing-Status gesetzt?** Ja, innerhalb der DB-Funktion.
4. **Atomar?** Ja: `drizzle/migrations/0037_market_complete_transaction_atomic.sql`,
   `SECURITY DEFINER`, `search_path = public`, `FOR UPDATE` auf Vorgang und
   Artikel, beide Statuswechsel in einer Transaktion, zweiter Handover wird
   mit `already_sold` abgewiesen. In der Datenbank verifiziert: Funktion
   existiert, `prosecdef = true`.
5. **Anderer Pfad mit dem alten Fehler?** Nein.
   „Listing direkt auf verkauft setzen“ (`src/lib/market.functions.ts:119-124`
   → `completeOpenTransactionsForItem`) nutzt dieselbe DB-Funktion.
   Der frühere Zahlungs-Webhook-Pfad ist entfernt.
6. **Warum meldet der Audit weiter?** Der Befund verweist auf
   `confirmPickup()` und `src/routes/api/public/payments/webhook.ts` – beides
   existiert im aktuellen Code nicht mehr. Der Befund wurde gegen
   `head_commit_sha e8e84e4d…` erzeugt, also **vor** dem Fix (0037 +
   `markSold`-Umbau). Es ist ein veralteter statischer Befund.
7. **Veraltet?** Ja, siehe 6.
8. **Reproduzierbarer Fehler?** Nein. Die Unit-Tests
   (`tests/market-transaction-flow.test.ts`) deckten Erfolg, fehlenden
   `sold`-Status und doppelten Handover ab; ein Live-Verkauf wurde bewusst
   nicht ausgelöst.

**Änderung notwendig?** Nein am Abschlusspfad. Der Befund kann als veraltet
markiert werden.

**Ein separater Hinweis (nicht Teil des gemeldeten Bugs):** Die
Rechte-Auflistung der neuen Funktion zeigt aktuell
`anon`, `authenticated`, `service_role`, `postgres` mit EXECUTE, obwohl die
Migration nur `service_role` vergibt – offenbar durch projektweite
Standardrechte nachträglich erweitert. Die Funktion prüft intern
`seller_id`, ist also nicht frei missbrauchbar, aber ein erneutes
`REVOKE EXECUTE … FROM anon, authenticated` wäre die saubere Härtung.
Empfohlen als eigener, freizugebender Schritt.
