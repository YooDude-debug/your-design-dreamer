# Y-Dude – PRODUCTION DATABASE VERIFICATION GATE (2026-09-06)

Nur lesende Prüfung. Keine Reparatur, keine Migration, kein Deployment.

## 0. Prüfumfang und Zugriffsgrenzen

| Punkt | Ergebnis |
|---|---|
| Geprüfte Datenbank | Die mit diesem Projekt verbundene Lovable-Cloud-Datenbank (eine Instanz bedient Vorschau und veröffentlichte App) |
| PostgreSQL-Version | PostgreSQL 17.6 (aarch64) |
| Datenbankname | `postgres`, Schema `public` |
| Migrationshistorie in der DB (`supabase_migrations.schema_migrations`) | **NICHT VERIFIZIERBAR – fehlende Leseberechtigung** (`permission denied for schema supabase_migrations`) |
| Getrennte Staging-Datenbank | Kein Lesezugriff vorhanden → **NICHT VERIFIZIERBAR** |
| Production-Git-Commit / Deployment-Referenz | Aus dieser Umgebung nicht lesbar → **NICHT VERIFIZIERBAR** |
| Migrationsdateien im Arbeits-Repository | 231 Dateien, jüngste `20260828092512_…`; **keine Datei** mit Präfix `202609…` vorhanden |

Konsequenz: Aussagen über Dateistände zweier getrennter Repositories (Staging vs. Production) sind hier nicht belegbar. Belegbar ist ausschließlich die **tatsächliche DB-Wirkung** in der geprüften Datenbank.

## 1. RC2-Medienstruktur (`public.ad_campaigns`)

| Spalte | Vorhanden | Datentyp | Nullable | Default |
|---|---|---|---|---|
| `media_image_path` | JA | text | YES | – |
| `media_video_path` | JA | text | YES | – |
| `media_video_thumb_path` | JA | text | YES | – |

## 2. RC2-Constraint

| Feld | Wert |
|---|---|
| Name | `ad_campaigns_media_single_chk` |
| Vorhanden | JA |
| Tabelle | `public.ad_campaigns` |
| Definition | `CHECK (((media_image_path IS NULL) OR (media_video_path IS NULL)))` |
| Spalten | `media_image_path`, `media_video_path` |
| Entspricht RC2-Erwartung | JA – identisch mit der im Release-Bericht RC2 Final dokumentierten Definition (Bild und Video nicht gleichzeitig) |

## 3. RC2-Trigger

| Feld | Wert |
|---|---|
| Name | `enforce_campaign_media_owner_trg` |
| Vorhanden | JA |
| Tabelle | `public.ad_campaigns` |
| Zeitpunkt | BEFORE |
| Operationen | INSERT und UPDATE (`tgtype = 23`) |
| Granularität | FOR EACH ROW |
| Funktion | `public.enforce_campaign_media_owner()` |

Weitere vorhandene Trigger auf der Tabelle: `ad_campaigns_notify_status`, `ad_campaigns_touch`, `enforce_business_campaign_limit_trg`, `enforce_campaign_slang_tag_owner_trg`.

## 4. Trigger-Funktion

| Feld | Wert |
|---|---|
| Existiert | JA (`public.enforce_campaign_media_owner`) |
| Vom Trigger aufgerufen | ja, genau diese Funktion |
| SECURITY DEFINER | JA |
| search_path | `public` (gesetzt) |
| EXECUTE-Recht `anon` | NEIN |
| EXECUTE-Recht `authenticated` | NEIN |
| EXECUTE-Recht `service_role` | JA |

Logik (gelesen aus `pg_get_functiondef`): ohne `owner_id` oder ohne gesetzte Medienpfade wird durchgelassen; Admins (`has_role(owner_id,'admin')`) werden durchgelassen; andernfalls muss jeder gesetzte Medienpfad mit `<owner_id>/` beginnen, sonst `RAISE EXCEPTION 'campaign_media_not_owned'` mit ERRCODE `42501`.

## 5. Die beiden RC2-Migrationen

| Migration | Zweck | Datei im geprüften Repository | DB-Wirkung in der geprüften DB | Ausführung erforderlich |
|---|---|---|---|---|
| `20260904085725` | 3 Medienspalten + CHECK `ad_campaigns_media_single_chk` | NEIN | **vorhanden** (3/3 Spalten, CHECK korrekt) | NEIN |
| `20260904085759` | Eigentums-Trigger + Funktion `enforce_campaign_media_owner` | NEIN | **vorhanden** (Trigger BEFORE INSERT/UPDATE, Funktion SECURITY DEFINER, EXECUTE für anon/authenticated entzogen) | NEIN |

Regel aus Auftrag Punkt 12 angewandt: fehlende Datei bei vorhandener DB-Wirkung = **DB-Wirkung vorhanden**, kein Nachziehen.

## 6. Rechte-Migration `20260906050749_…` (REVOKE EXECUTE)

| Funktion | Vorhanden | SECURITY DEFINER | search_path | anon EXECUTE | authenticated EXECUTE |
|---|---|---|---|---|---|
| `public.market_event_refs_valid` | JA | JA | public | **JA** | **JA** |
| `public.owns_moderation_action` | JA | JA | public | **JA** | **JA** |

Der von dieser Migration angestrebte Zielzustand (kein EXECUTE für `anon`/`authenticated`) ist in der geprüften Datenbank **nicht** hergestellt.

**SECURITY DELTA – KEINE ÄNDERUNG DURCHGEFÜHRT.**

Dieses Delta deckt sich mit den Befunden des Audits vom 2026-09-06 (anonym ausführbare SECURITY-DEFINER-Helfer).

## 7. Abgleich der „31 Staging-Migrationen“

Eine Klassifizierung aller 31 Migrationen ist **NICHT VERIFIZIERBAR – fehlende Leseberechtigung / kein Zugriff**:
- die DB-Migrationshistorie ist nicht lesbar,
- ein getrennter Staging-Migrationsstand liegt hier nicht vor,
- das Arbeits-Repository enthält keine Datei nach `20260828092512`.

Verifizierbar klassifiziert sind ausschließlich die drei namentlich genannten Migrationen:

| Migration | Zweck | DB-Wirkung in Production | Status | Nachziehen? |
|---|---|---|---|---|
| `20260904085725` | Medienspalten + CHECK | vorhanden | **B** (Datei fehlt, Wirkung vorhanden) | NEIN |
| `20260904085759` | Eigentums-Trigger + Funktion | vorhanden | **B** | NEIN |
| `20260906050749` | REVOKE EXECUTE auf 2 Funktionen | **nicht vorhanden** | **A** (Wirkung fehlt) | Entscheidung offen – nicht RC2-relevant, Security-Thema |
| übrige 28 Migrationen | unbekannt | unbekannt | **E** (nicht eindeutig verifizierbar) | unbestimmt |

## 8. Schemabild `ad_campaigns` (nur relevante Metadaten)

- RLS aktiviert: JA
- Policies: 8 (`select/insert/update/delete` je `_own` und `_admin`), alle für Rolle `authenticated`
- Tabellenrechte: `anon` = nur SELECT; `authenticated` = SELECT/INSERT/UPDATE/DELETE; `service_role` = alle. Hinweis: `information_schema.role_table_grants` zeigt nur die Rechte der eigenen Prüfrolle, die Werte stammen aus `has_table_privilege` (belastbar).
- Weitere Constraints: `ad_campaigns_cta_chk`, `ad_campaigns_time_window_chk`, PK, 2 Fremdschlüssel.
- Anmerkung (nur Dokumentation, kein Befundwechsel): `anon` besitzt SELECT auf `ad_campaigns`, es existiert jedoch keine SELECT-Policy für `anon` – Leserechte greifen dadurch nicht.

Ein Schema-Diff gegen Staging ist **NICHT VERIFIZIERBAR** (kein Staging-Zugriff).

## 9. RC2-Finalentscheidung

**🟢 RC2 DATABASE VERIFIED** – für den RC2-Umfang (3 Medienspalten, CHECK-Constraint, Eigentums-Trigger, Trigger-Funktion mit SECURITY DEFINER und entzogenen EXECUTE-Rechten) ist alles in der geprüften Production-Datenbank nachweislich vorhanden und inhaltlich korrekt.

Einschränkung ausserhalb des RC2-Umfangs: die vollständige Klassifizierung aller 31 Staging-Migrationen bleibt **⚪ NOT VERIFIABLE**.

## 10. Deployment-Folgerung

Muss bezüglich der **RC2-Datenbank** noch etwas aus Staging nach Production ausgerollt werden?

**NEIN.**

Nicht RC2-bezogen und getrennt zu entscheiden: die Rechte-Migration `20260906050749` (REVOKE EXECUTE auf `market_event_refs_valid`, `owns_moderation_action`) ist in Production nicht wirksam. Für die restlichen unbekannten Migrationen: **NICHT VERIFIZIERBAR**.

## 11. Risiken (nur festgestellt)

1. `market_event_refs_valid` und `owns_moderation_action` sind für `anon` ausführbar – Informationsrisiko, unverändert dokumentiert.
2. Die DB-Migrationshistorie ist nicht lesbar; künftige Abgleiche Repository ↔ Datenbank bleiben ohne diesen Zugriff unvollständig.
3. Das Arbeits-Repository enthält die beiden RC2-Migrationsdateien nicht, obwohl ihre Wirkung in der Datenbank aktiv ist – Nachvollziehbarkeitslücke in der Migrationsablage.

## 12. Änderungskontrolle

| Aktion | Ergebnis |
|---|---|
| Production-Daten verändert | NEIN |
| Production-Schema verändert | NEIN |
| Migration ausgeführt | NEIN |
| Migration erstellt | NEIN |
| GRANT ausgeführt | NEIN |
| REVOKE ausgeführt | NEIN |
| Code verändert | NEIN |
| Deployment durchgeführt | NEIN |
| Staging verändert | NEIN |
| Nutzerinhalte ausgelesen | NEIN (nur Schema-/Rechte-Metadaten) |
