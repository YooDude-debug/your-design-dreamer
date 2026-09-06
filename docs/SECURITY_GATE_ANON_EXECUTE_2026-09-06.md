# Y-Dude – Production vs Staging Security Gate (2026-09-06)

Umfang: ausschließlich `public.market_event_refs_valid(uuid,uuid,uuid)` und
`public.owns_moderation_action(uuid,uuid)`. Nur lesende Analyse.

## 1. Production-Zustand (gelesene DB der verbundenen Instanz)

| Merkmal | market_event_refs_valid | owns_moderation_action |
|---|---|---|
| existiert | JA (`_item_id, _seller_id, _category_id`) | JA (`_action_id, _user_id`) |
| SECURITY DEFINER | JA | JA |
| Volatilität | STABLE, LANGUAGE sql | STABLE, LANGUAGE sql |
| search_path | `public` (gesetzt) | `public` (gesetzt) |
| anon EXECUTE | **JA** | **JA** |
| authenticated EXECUTE | JA | JA |
| service_role EXECUTE | JA | JA |

Logik (aus `pg_get_functiondef`):
- `market_event_refs_valid`: prüft, ob zu `_item_id` eine Zeile in `market_items`
  mit genau diesem `seller_id` und `category_id` existiert; ohne `_item_id` müssen
  Verkäufer und Kategorie NULL sein. Rückgabe: boolean.
- `owns_moderation_action`: prüft, ob `moderation_actions.id = _action_id` mit
  `target_user_id = _user_id` existiert. Rückgabe: boolean.

## 2. Verwendung in der Datenbank (Policies)

| Funktion | verwendet in |
|---|---|
| `market_event_refs_valid` | `public.market_analytics_events`, Policy `analytics insert own`, **INSERT, Rolle `authenticated`**, WITH CHECK `actor_id = auth.uid() AND market_event_refs_valid(...)` |
| `owns_moderation_action` | `public.moderation_appeals`, Policy `moderation_appeals_insert_own`, **INSERT, Rolle `authenticated`**, WITH CHECK `user_id = auth.uid() AND owns_moderation_action(action_id, auth.uid()) AND status='submitted' …` |

Keine weiteren Verwendungen: keine Constraints (`pg_constraint`) und keine andere
Datenbankfunktion (`pg_proc.prosrc`) referenziert die beiden Funktionen.

Policies beider betroffenen Tabellen (vollständig):
- `market_analytics_events`: `analytics insert own` (INSERT, authenticated),
  `analytics read own scope` (SELECT, authenticated) – **keine anon-Policy**.
- `moderation_appeals`: `moderation_appeals_insert_own` (INSERT, authenticated),
  `moderation_appeals_select_own` (SELECT, authenticated),
  `moderation_appeals_admin_update` (UPDATE, authenticated) – **keine anon-Policy**.

Folge: selbst mit Tabellen-GRANTs kann `anon` in keine der beiden Tabellen
schreiben oder lesen, weil keine Policy für `anon` existiert. Die Funktionen
werden damit auf keinem anon-Pfad als Policy-Prädikat ausgewertet.

## 3. Verwendungsanalyse im Code

Suche über das Repository nach beiden Funktionsnamen: Treffer ausschließlich in
Migrationsdateien, generierten `types.ts` und Auditdokumenten. **Kein** direkter
Aufruf: kein `supabase.rpc('market_event_refs_valid')`, kein
`rpc('owns_moderation_action')`, kein SQL-Aufruf in Server- oder Clientcode.

Aufrufer der betroffenen Tabellen:
- `market_analytics_events`: `src/lib/market-analytics.server.ts`
  (`trackMarketEvent`, `marketEventTotals`), aufgerufen aus
  `src/lib/market.functions.ts`. Jede dortige Serverfunktion trägt
  `.middleware([requireSupabaseAuth])` – ohne Sitzung 401, kein anon-Pfad.
- `moderation_appeals`: `src/lib/moderation-appeals.server.ts` arbeitet mit
  `supabaseAdmin` (service_role, RLS wird umgangen, Policy-Prädikat entfällt);
  aufgerufen aus `src/lib/moderation-dsa.functions.ts`, ebenfalls durchgehend
  `requireSupabaseAuth`.

Tatsächliche Aufruferrollen:

| Funktion | anon | authenticated | service_role |
|---|---|---|---|
| `market_event_refs_valid` | kein Pfad gefunden | ja, implizit über INSERT-Policy | ja (RLS umgangen, Prädikat entfällt) |
| `owns_moderation_action` | kein Pfad gefunden | ja, implizit über INSERT-Policy | ja (Admin-Client, Prädikat entfällt) |

## 4. Flow-Analyse

`market_event_refs_valid`: Flow = Markt-Statistikereignis beim Ansehen,
Favorisieren, Kontaktieren, Angebot, Suche. Ausschließlich authentifiziert
(Serverfunktion mit Auth-Middleware, Policy nur für `authenticated`). Ein Entzug
von `anon` EXECUTE bricht diesen Flow nicht, weil das Prädikat nie als `anon`
ausgewertet wird.

`owns_moderation_action`: Flow = Einlegen eines Widerspruchs gegen eine
Moderationsmaßnahme (DSA-Beschwerde). Ausschließlich authentifiziert; die
schreibende Umsetzung läuft zusätzlich über service_role. Ein Entzug von `anon`
EXECUTE bricht diesen Flow nicht.

Öffentliche Routen unter `src/routes/api/public/*` referenzieren keine der beiden
Funktionen und keine der beiden Tabellen.

## 5. Staging-Zustand

**⚪ NICHT VERIFIZIERBAR.** Aus dieser Umgebung besteht Lesezugriff nur auf die
mit dem Projekt verbundene Datenbank; ein getrennter Staging-Datenbankzugang
liegt nicht vor. Aufgabengemäß wird der Migrationstext **nicht** als Nachweis für
einen Staging-Laufzeitzustand gewertet. Ergänzend, nur als Aktenlage: das
Arbeits-Repository enthält keine Migration `20260906050749…`; die jüngste
vorhandene Migration ist `20260828092512…`. Der in früheren Berichten genannte
REVOKE-Stand ist hier also weder als Datei noch als DB-Zustand belegbar.

## 6. Security-Bewertung

`market_event_refs_valid` – 🔴 **ANON BERECHTIGUNG NICHT ERFORDERLICH**.
Kein öffentlicher Flow ruft sie auf. Sicherheitswirkung des bestehenden Rechts:
Als SECURITY DEFINER liest sie unter Umgehung der RLS von `market_items`. Ein
nicht angemeldeter Aufrufer kann damit gezielt raten, ob ein bestimmter Artikel
einem bestimmten Verkäufer und einer bestimmten Kategorie zugeordnet ist – ein
Bestätigungs-Orakel über eine per RLS geschützte Zuordnung, nicht „nur ein
Boolean“. Kein Massenabfluss (drei UUIDs müssen bereits bekannt sein), aber
belegbar unnötige Angriffsfläche.

`owns_moderation_action` – 🔴 **ANON BERECHTIGUNG NICHT ERFORDERLICH**.
Kein öffentlicher Flow ruft sie auf. Sicherheitswirkung: bestätigt anonym, dass
eine bestimmte Moderationsmaßnahme gegen eine bestimmte Nutzerkennung existiert.
Das ist inhaltlich sensibler als der Marktfall (Verknüpfung Person ↔
Moderationsmaßnahme), auch wenn eine gültige Maßnahmen-UUID vorausgesetzt wird.

## 7. Vergleichstabelle

| Funktion | Production anon | Staging anon | Tatsächlicher Public Flow | anon notwendig? | Security-Bewertung |
|---|---|---|---|---|---|
| `market_event_refs_valid` | JA (EXECUTE) | ⚪ nicht verifizierbar | keiner | NEIN | 🔴 nicht erforderlich |
| `owns_moderation_action` | JA (EXECUTE) | ⚪ nicht verifizierbar | keiner | NEIN | 🔴 nicht erforderlich |

## 8. Entscheidung

- `market_event_refs_valid`: **PRODUCTION-RECHT KANN SICHER ENTFERNT WERDEN.**
- `owns_moderation_action`: **PRODUCTION-RECHT KANN SICHER ENTFERNT WERDEN.**

Beide Prädikate werden ausschließlich in Policies für `authenticated` ausgewertet;
ein `REVOKE EXECUTE … FROM anon` (bei erhaltenem EXECUTE für `authenticated` und
`service_role`) hat auf die belegten Flows keine Wirkung. Der Staging-Vergleich
bleibt offen, war für diese Entscheidung aber nicht ausschlaggebend – maßgeblich
war die tatsächliche Verwendung. **Nichts entfernt.**

## 9. Änderungskontrolle

| Aktion | Ergebnis |
|---|---|
| Änderungen durchgeführt | NEIN |
| GRANT / REVOKE ausgeführt | NEIN |
| Migration erstellt oder ausgeführt | NEIN |
| Code oder Tests geändert | NEIN |
| Daten geändert | NEIN |
| Deployment durchgeführt | NEIN |
| Production verändert | NEIN |
| Staging verändert | NEIN |
| FuE-Themen berührt (Ranking, Learning, Attribution, QR, Pacing, Capping, Skalierung, Moderations-FuE) | NEIN |
