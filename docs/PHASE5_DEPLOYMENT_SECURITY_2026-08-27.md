# Y-Dude – Phase 5: Freigabe-Gate und Sicherheitsaudit der Datenbankfunktionen

Stand: 2026-08-27

## 1. Freigabe-Gate vor Veröffentlichungen

Neu: ein einziger Befehl, der den Stand vor einer Veröffentlichung prüft.

```bash
bun run verify   # Typprüfung -> Lint -> Testsuite, bricht beim ersten Fehler ab
```

- `scripts/verify.sh` führt `tsc --noEmit`, `eslint .` und `vitest run` hintereinander aus.
- `.github/workflows/ci.yml` führt dasselbe Gate bei jedem Push und jedem Pull Request aus.
- Zusätzlich verfügbar: `bun run typecheck` für die reine Typprüfung.

Bewusst **nicht** an `vite build` gekoppelt: der Build der Plattform bleibt dadurch
schnell und wird nicht durch Testlaufzeiten blockiert. Das Gate ist die verbindliche
Freigabestufe, der Build bleibt der Auslieferungsschritt.

## 2. Sicherheitsaudit: SECURITY DEFINER-Funktionen

Geprüft wurden alle Funktionen im Schema `public` mit `SECURITY DEFINER`.

| Kriterium                               | Ergebnis                     |
| --------------------------------------- | ---------------------------- |
| Funktionen mit `SECURITY DEFINER`       | 111                          |
| ohne festen `search_path`               | **0**                        |
| mit Standardrechten (implizit `PUBLIC`) | **0**                        |
| ausführbar für `PUBLIC`-Pseudorolle     | **0**                        |
| ausführbar für `anon`                   | 5 (bewusst, siehe unten)     |
| mit dynamischem SQL                     | 5 (nur Trigger, siehe unten) |

### 2.1 Für `anon` ausführbar – bewusst und unkritisch

`are_connected`, `has_role`, `is_following`, `market_event_refs_valid`,
`test_user_visible`. Alle sind `STABLE`, geben ausschließlich einen booleschen
Wert zurück und werden von RLS-Regeln öffentlicher Leseansichten benötigt.
Ohne diese Rechte erhalten nicht angemeldete Besucher „permission denied“.
Es werden keine Inhalte, sondern nur Ja/Nein-Entscheidungen offengelegt.

### 2.2 Dynamisches SQL – kein Einschleusungsrisiko

`enforce_write_rate_limit`, `queue_counter_event`, `sync_arena_counter`,
`sync_post_counter`, `sync_tag_counter`. Alle sind Trigger-Funktionen,
nur für `service_role`/`postgres` ausführbar und setzen Bezeichner
ausschließlich über `format(... %I ...)` aus `TG_ARGV`/`TG_TABLE_NAME` ein –
also aus der Triggerdefinition, nie aus Nutzereingaben.

### 2.3 Client-aufrufbare, schreibende Funktionen – Rechteprüfung vorhanden

Alle zehn für `authenticated` freigegebenen schreibenden Funktionen prüfen
die Berechtigung selbst und leiten die Identität aus `auth.uid()` ab, nie aus
einem Aufrufparameter:

- `activate_ad_pause`, `touch_last_seen`, `refresh_connection_suggestions`,
  `mark_conversation_read`, `globe_vote_current_round` – Abbruch ohne Sitzung,
  Wirkung strikt auf die eigene Kennung begrenzt.
- `channel_moderate_post` – `is_channel_moderator`.
- `delete_slang_tag` – Eigentum oder Adminrolle.
- `upsert_slang_definition`, `upsert_slang_geo` – `owns_slang_name` oder Adminrolle.
- `market_accept_offer` – nur der Verkäufer des Angebots.

`market_start_transaction` nimmt eine Käuferkennung als Parameter und ist
deshalb **nicht** für Clients freigegeben (nur `service_role`); die Käuferidentität
wird in der Serverfunktion vor dem Aufruf geprüft.

## 3. Ergebnis

Kein Handlungsbedarf auf Datenbankebene: keine Funktion ohne `search_path`,
keine offenen Standardrechte, keine ungeprüfte schreibende Funktion für Clients.
Neu abgesichert ist der Freigabeweg: Typprüfung, Lint und Tests sind ab jetzt
ein verbindliches Gate vor jeder Veröffentlichung.
