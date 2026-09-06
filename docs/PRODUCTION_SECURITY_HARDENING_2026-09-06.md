# Y-Dude – Production Security Hardening (2026-09-06)

Umfang: ausschließlich Entzug des `anon`-EXECUTE-Rechts auf zwei
SECURITY-DEFINER-Funktionen. Keine weitere Änderung.

## 1. Ausgangszustand (gelesen, vor der Änderung)

| Merkmal | market_event_refs_valid(uuid,uuid,uuid) | owns_moderation_action(uuid,uuid) |
|---|---|---|
| existiert | JA | JA |
| SECURITY DEFINER | JA | JA |
| search_path | `public` | `public` |
| anon EXECUTE | JA (explizites Recht `anon=X/postgres`) | JA (explizites Recht `anon=X/postgres`) |
| authenticated EXECUTE | JA | JA |
| service_role EXECUTE | JA | JA |
| Prüfsumme Funktionsdefinition | `8bb1ee93a9d20bff6aaed4005563db01` | `fcec34ff23eefdb6da5770ca555ca2a8` |

Kein PUBLIC-Recht vorhanden, daher wirkt `REVOKE … FROM anon` vollständig.

## 2. Exakt durchgeführte Änderung

Migration `drizzle/migrations/0028_revoke_anon_execute_two_functions.sql`:

```sql
REVOKE EXECUTE ON FUNCTION public.market_event_refs_valid(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owns_moderation_action(uuid, uuid) FROM anon;
```

Keine weiteren Anweisungen. Keine Funktionsdefinition, keine Policy, keine
Tabelle, kein Trigger, kein Index, keine Server-Funktion, keine UI-Datei und kein
Test wurden geändert. (Nebenwirkung des Migrationswerkzeugs: die generierte
Datei `src/integrations/supabase/types.ts` wurde automatisch neu erzeugt.)

## 3. EXECUTE-Rechte nach der Änderung (gelesen)

| Rolle | market_event_refs_valid | owns_moderation_action |
|---|---|---|
| anon | **NEIN** | **NEIN** |
| authenticated | JA (unverändert) | JA (unverändert) |
| service_role | JA (unverändert) | JA (unverändert) |

Unverändert bestätigt: SECURITY DEFINER = JA, `search_path=public`, Signaturen
identisch, Prüfsummen der Funktionsdefinitionen identisch zum Ausgangszustand
(`8bb1ee93…`, `fcec34ff…`).

## 4. Anonymous-RPC-Test (über die Datenschnittstelle, publishable key)

| Funktion | HTTP | PostgreSQL-Code | Ergebnis |
|---|---|---|---|
| `market_event_refs_valid` | 401 | 42501 `permission denied for function market_event_refs_valid` | kein erfolgreicher Aufruf |
| `owns_moderation_action` | 401 | 42501 `permission denied for function owns_moderation_action` | kein erfolgreicher Aufruf |

Es wurde nicht versucht, die Funktionen öffentlich zugänglich zu machen oder RLS
zu umgehen.

## 5. Regressionslauf

| Prüfung | Ergebnis |
|---|---|
| Typprüfung (`tsc --noEmit`) | ✅ 0 Fehler |
| Lint (`bun run lint`) | ⚠️ fehlgeschlagen: 9.978 Meldungen – **vorbestehend**, überwiegend Formatmeldungen im Release-Archiv, identisch zum Audit vom 2026-09-06; keine Datei dieses Vorgangs betroffen, nichts bereinigt |
| Unit-/Logiktests | ✅ 32 Dateien / 591 Tests |
| Datenbank-Integrationstests | ✅ 8 Dateien / 68 Tests |
| E2E/Browser (Playwright) | ✅ 10 bestanden, 1 übersprungen (bestehender Skip unverändert) |
| Production-Build | ✅ erfolgreich |

## 6. Scope-Bestätigung

| Aussage | Status |
|---|---|
| Nur diese zwei EXECUTE-Rechte entfernt | JA |
| Funktionslogik/-signatur geändert | NEIN |
| RLS oder Policies geändert | NEIN |
| Tabellen, Trigger, Indizes geändert | NEIN |
| Server-Funktionen, UI, Tests geändert | NEIN |
| Daten geändert | NEIN |
| FuE-Themen berührt (Ranking, Kampagnen, Attribution, QR, Moderationslogik, Messenger, Marketplace, Performance/Architektur) | NEIN |
| Sonstige Production-Funktion geändert | NEIN |

## 7. Ergebnis

**PRODUCTION SECURITY HARDENING: PASS**
