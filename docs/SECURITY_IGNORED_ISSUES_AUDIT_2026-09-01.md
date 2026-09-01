# Y-Dude – Audit der als „ignored" markierten Security-Issues

Datum: 2026-09-01, 20:20 UTC
Modus: rein analytisch – **0 Code-Änderungen, 0 Migrationen, 0 Statuswechsel**

## Ausgangslage / Werkzeuggrenze

Die Security-Persistenz gibt mir programmatisch nur **aktive** Befunde zurück.
Ignorierte Befunde erscheinen in der Ergebnis-API ohne Titel/Beschreibung – nur
mit dem Zustand `ignored_by_user`, wenn ein frischer Scan dasselbe Muster noch
findet. Die vollständige Liste der 17 Titel ist ausschließlich im Security-Tab
der Oberfläche sichtbar.

Statt zu raten wurde daher **jede Befundklasse, die diese Ignores erzeugt hat,
direkt gegen die laufende Datenbank und den aktuellen Code neu geprüft** – also
alle 64 aktuellen Linter-Issues (4 Typen) plus die drei `supabase_lov`-Befunde.

## Frischer Scan (2026-09-01 20:16 UTC)

| Scanner | Ergebnis |
| --- | --- |
| agent_security (Code) | 0 Findings (Turnstile- und Transcribe-Befund verifiziert behoben) |
| app_mcp / app_mcp_deep / wiz / supply_chain | 0 Findings |
| supabase (Linter) | 2 Finding-Typen, beide `ignored_by_user`, Level `warn` |
| supabase_lov | 2 aktive `warn`-Findings (+1 weiterer aktiv in der Persistenz) |
| Kritisch (`error`) | **0** |

## Befundklassen im Detail

### 1. „Public Can Execute SECURITY DEFINER Function" (7 Funktionen) – 🔵 bewusstes Design

`are_connected`, `can_view_post`, `has_role`, `is_following`,
`market_event_refs_valid`, `owns_moderation_action`, `test_user_visible`.

Diese Funktionen werden **innerhalb von RLS-Policies** ausgewertet. Policies
laufen mit den Rechten des aufrufenden Rollen-Kontexts, d. h. ohne
`EXECUTE`-Recht für `anon` scheitern öffentliche Leseanfragen mit
„permission denied for function …" (genau der Produktionsfehler vom 28.08.).
Alle sieben geben ausschließlich `boolean` zurück, leiten Identität aus
`auth.uid()` ab und geben keine Datensätze heraus. Restrisiko: ein Angreifer mit
bereits bekannter UUID kann Beziehungsstatus/Rollenzugehörigkeit als Ja/Nein
abfragen – kein Datenabfluss, kein Schreibpfad. Ignore weiterhin korrekt.

### 2. „Signed-In Users Can Execute SECURITY DEFINER Function" (52 Funktionen) – 🔵 bewusstes Design

Stichprobe der schreibenden Kandidaten: `activate_ad_pause` und
`channel_moderate_post` prüfen intern `auth.uid() IS NULL → Exception` bzw.
`is_channel_moderator()` und validieren Eingaben (Timezone-Allowlist).
Reine Wartungsfunktionen (`cleanup_push_data`, `flush_counter_events`,
`globe_vote_close_round`, `market_expire_promotions`) sind für
`authenticated` **nicht** ausführbar – verifiziert per
`has_function_privilege`. Das Muster ist notwendig, weil RLS-Helfer und
kontrollierte Schreibpfade sonst nicht funktionieren. Ignore korrekt.

### 3. „RLS Enabled No Policy" (3 Tabellen) – 🔵 bewusstes Design (Default Deny)

`ad_campaign_event_guard`, `market_payment_webhook_events`,
`slang_tag_track_dedup`. Prüfung der Grants: **keine einzige Berechtigung** für
`anon` oder `authenticated`. Die Tabellen sind reine interne Dedup-/Guard-
Tabellen, die nur von Triggern und `SECURITY DEFINER`-Pfaden geschrieben werden.
Härter als jede Policy. Ignore korrekt.

### 4. „Extension in Public" (2 Extensions) – 🟢 False Positive im Risikoteil

`pg_trgm` und `pg_net`. Die für SSRF relevanten `pg_net`-Funktionen
(`http_get`, `http_post`, `http_delete`, `worker_restart`) liegen in Schema
`net`, **nicht** im über die Data-API exponierten Schema – per Query bestätigt.
Damit sind sie über PostgREST nicht aufrufbar. Die `pg_trgm`-Funktionen im
Public-Schema sind Vergleichs-/Index-Funktionen ohne Datenzugriff. Kein
praktisches Risiko; ein Verschieben von `pg_trgm` würde alle
Trigram-Suchindizes brechen.

### 5. Die drei `supabase_lov`-RLS-Warnungen – 🟢/🔵 (Details siehe SECURITY_WARNING_REVIEW_2026-09-01.md)

- `can_view_profile` / Pending-Requests: False Positive, die Pending-Klausel
  greift nur für **eingehende** Anfragen (`addressee_id = auth.uid()`).
- `market_transaction_secrets`: bewusst kein Seller-Read; Verifikation
  serverseitig in `confirmPickup()`.
- `arena_awards` mit `submission_id IS NULL`: Challenge-Gate ist AND-verknüpft,
  Tabelle aktuell 0 Zeilen.

### 6. Frühere Code-Befunde (Turnstile, Public Transcription) – ✅ behoben

`turnstile.server.ts` ist durchgängig fail-closed; `transcribeTestRecording`
verlangt Pflicht-Captcha + IP-Rate-Limit + Größen-/Dauerlimits. Im frischen
Scan nicht mehr enthalten, als „fixed" abgeschlossen (mit Nachweis).

## Gesamtbewertung

| Kategorie | Anzahl Befundklassen |
| --- | --- |
| ✅ behoben | 2 (Turnstile, Public Transcription) |
| 🟢 False Positive | 2 (Extension in Public, can_view_profile) |
| 🔵 bewusstes Design | 4 (anon-Definer, auth-Definer, No-Policy-Tabellen, Pickup-Codes/Arena-Awards) |
| 🟡 noch relevant | 0 |
| 🔴 kritisch | **0** |
| ⚪ veralteter Befund | 0 (alle Codestellen existieren, nur die Bewertung war veraltet) |

Kein Issue aus den ignorierten Klassen ist ein Authentifizierungs-, Secret-,
Injection-, Upload- oder Kostenabuse-Risiko. Keine Änderung notwendig, kein
Ignore wurde aufgehoben oder neu gesetzt.
