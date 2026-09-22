# ORB Core – Developer / Repair Environment · Phase 2: Persistenz, Freigabe, Audit

Datum: 2026-09-22 · Status: **READY FOR MANUAL REVIEW** · Nicht deployt · Phase 3 nicht begonnen
Vorgänger: `docs/ORB_DEVELOPER_REPAIR_ENVIRONMENT_2026-09-22.md` (Phase 1)

Phase 2 ist ausschliesslich die Persistenz- und Audit-Ebene. Ausführung, Selbst-
veränderung, Git-Operationen und Deployment bleiben hart deaktiviert.

## 1. Datenmodell

Drei Entitäten, bewusst nicht weiter normalisiert:

1. **Fix-Vorschlag** – unveränderlicher Inhalt (Root Cause, Dateien, Diff, Operationen,
   Testplan, Risiken, Rollback) + veränderlicher Status + Version/Vorgänger + Fingerprint.
2. **Freigabe** – an Fix-ID **und** Fingerprint **und** genehmigte Operationsmenge gebunden;
   Status `APPROVED | INVALIDATED | REVOKED`.
3. **Audit-Ereignis** – nur anfügen, nie ändern.

Begründung für drei statt zwei Tabellen: Freigabe und Vorschlag haben unterschiedliche
Lebensdauer (ein Vorschlag kann mehrere entwertete Freigaben haben), und das Audit muss
auch Ereignisse ohne Fix-ID aufnehmen (Code-Analyse, Diagnose, abgelehnte Ausführung).

## 2. Tabellen

`public.orb_dev_fix_proposals`
`id`, `fix_id` (UNIQUE, `^ORB-FIX-[0-9]{4}$`), `version`, `supersedes_fix_id`, `status`,
`root_cause`, `root_cause_confidence`, `files[]`, `diff`, `operations` (JSONB),
`test_plan[]`, `expected_effects[]`, `risks[]`, `rollback_plan[]`, `fingerprint`
(`^[0-9a-f]{16}$`), `created_source`, `created_by`, `created_at`, `updated_at`.
CHECK auf Statusraum (DRAFT … COMPLETED) und Confidence (PROVEN/PLAUSIBLE/UNKNOWN).

`public.orb_dev_fix_approvals`
`id`, `fix_id` → proposals (ON DELETE RESTRICT), `fingerprint`, `operations` (JSONB),
`status`, `approved_by`, `approved_at`, `source` (CHECK `= 'admin_ui'`), `comment`,
`invalidated_at`, `invalidated_reason`.
Partieller Unique-Index `orb_dev_one_active_approval_per_fix` WHERE `status='APPROVED'`.

`public.orb_dev_audit_log`
`id`, `at`, `actor`, `action`, `fix_id`, `previous_status`, `new_status`, `files[]`,
`result`, `metadata` (JSONB). Keine UPDATE-/DELETE-Rechte, keine UPDATE-/DELETE-Policy.

## 3. Migration

`drizzle/migrations/0048_orb_dev_repair_persistence.sql` (angewandt).
Minimal, rein additiv: keine bestehende Tabelle verändert, kein `DROP`, kein `DELETE`,
keine Datenänderung. Vorher geprüft: bestehende Namenskonventionen, RLS-Muster,
vorhandene `public.has_role`-RPC, bestehende Trigger. Typen wurden neu erzeugt.

## 4. RLS

Alle drei Tabellen: `ENABLE ROW LEVEL SECURITY`. Jede Policy (SELECT/INSERT/UPDATE)
bindet `public.has_role(auth.uid(), 'admin')`; keine Policy für `anon`, keine offene
Policy, keine DELETE-Policy. `service_role` behält Zugriff für Wartung.
Zusätzlich zwei Trigger:
`orb_dev_guard_proposal_immutability` (jede Inhaltsänderung an einem Vorschlag wird
abgewiesen: „neue Fix-Version anlegen“) und `orb_dev_guard_approval_immutability`
(Fix-ID, Fingerprint, Operationen, Freigeber, Zeitpunkt, Quelle unveränderlich;
Reaktivierung einer entwerteten Freigabe verboten).

## 5. Admin-Autorisierung

Bestehende Struktur weiterverwendet, keine parallele Rollenlogik:
jede Server-Funktion in `src/lib/orb-dev.functions.ts` nutzt
`.middleware([requireSupabaseAuth])` und danach `assertAdmin(context)`; alle
Datenbankzugriffe laufen über `context.supabase` (RLS als aufrufender Benutzer),
nie über den privilegierten Client. Die Oberfläche ist nur zusätzliche Anzeige.
Formal ungültige Fix-IDs werden vor jedem Zugriff abgewiesen.

## 6. Fix-Versionierung

Ein Vorschlag wird nie inhaltlich überschrieben. `orbDevReviseFix` entwertet aktive
Freigaben und den alten Vorschlag (`INVALIDATED`, Endzustand) und legt eine neue
Fix-ID mit `version + 1` und `supersedes_fix_id` an. Historie bleibt vollständig:
was vorgeschlagen, was freigegeben, was geändert wurde und warum die alte Freigabe
ungültig ist, steht in Vorschlag, Freigabe und Audit.

## 7. Approval-Fingerprint

Fingerprint = stabiler Hash über Fix-ID, Root Cause, Confidence, Dateien, Diff,
Operationen, Testplan, Effekte, Risiken, Rollback. Eine Freigabe gilt nur, wenn
Fix-ID, Fingerprint und Operationsmenge exakt übereinstimmen, Quelle `admin_ui` ist,
der Status `WAITING_FOR_ADMIN_APPROVAL` war und die Ursache `ROOT_CAUSE_PROVEN` ist.
Jede Änderung am Inhalt macht die Freigabe ungültig – sie wird niemals übertragen.

## 8. Audit-Log

Jede Aktion schreibt Zeit, Actor, Aktion, Fix-ID, vorherigen und neuen Status,
Dateien, Ergebnis und Metadaten. Vor dem Speichern läuft jede Textausgabe durch
`redactAuditText` (maskiert `sb_secret_*`, `sk-*`, JWT-artige Werte, `SERVICE_ROLE_KEY`,
`*API*KEY*`/`*TOKEN*`/`*PASSWORD*`-Zuweisungen). Audit-Einträge erzeugen keine Rechte.

## 9. Tests (Logik)

`tests/orb-dev-persistence.test.ts` (26) und `tests/orb-dev-environment.test.ts` (20):
Statusmodell inkl. DRAFT/INVALIDATED, kein Weg um die Freigabe herum, Fingerprint-
Bindung, Diff-Änderung entwertet, Operationsänderung entwertet, Datei-/Testplan-
Änderung entwertet, neue Version braucht neue Freigabe, nicht gedeckte Operation
abgewiesen, fehlende Freigabe = nicht freigegeben, Memory erzeugt keine Rechte und
keine Ausführung, Quelle serverseitig fest, Audit-Aktionen vorhanden, Secret-Redaktion,
jede Server-Funktion mit Anmeldung + Adminprüfung, keine privilegierte Umgehung.
Gesamtsuite: **1216 Logiktests grün**.

## 10. Sicherheitstests (Datenbank)

`tests/integration/db-orb-dev-security.test.ts` (13): Tabellen vorhanden, RLS aktiv,
jede Policy an Administratorrolle gebunden, keine Rechte für nicht angemeldete
Besucher, keine Policy ausserhalb der Adminrolle, Protokoll nicht änder-/löschbar,
Unveränderlichkeits-Trigger vorhanden, manipulierte Fix-ID scheitert an CHECK,
Freigabequelle auf `admin_ui` beschränkt, Fremdschlüssel auf den Vorschlag,
höchstens eine gültige Freigabe je Fix, Statusraum in der Datenbank begrenzt,
Versionsfelder und Eindeutigkeit vorhanden. Gesamt: **90 Datenbank-/Sicherheitstests grün**.

## 11. Noch deaktivierte Funktionen

`PHASE2_EXECUTION_ENABLED = false`: kein Patchen von Code, kein Git-Commit/Merge,
kein Deployment, kein Neustart, keine weiteren Migrationen, keine automatische
Reparatur, keine Selbstveränderung. `APPROVED` bedeutet ausdrücklich **keine**
Codeausführung. `orbDevRequestExecution` lehnt jede Anfrage ab und protokolliert sie.
Testausführung innerhalb der Umgebung: nicht vorhanden (Phase 3).

## 12. Voraussetzungen für Phase 3

1. Getrennte Arbeitsumgebung (Sandbox), die den laufenden ORB niemals überschreibt.
2. Ausführung ausschliesslich auf Basis einer gültigen, nicht entwerteten Freigabe
   mit erneuter Fingerprint-Prüfung unmittelbar vor jeder Operation.
3. Operationsweisse Autorisierung (Datei- und Befehlsliste) plus harte Ablehnung
   aller nicht genehmigten Operationen.
4. Testlauf-Persistenz je Fix-ID mit Ergebnis, Ausgabe und Zeitbedarf.
5. Rollback-Nachweis vor der ersten echten Anwendung.
6. Zweites Freigabe-Tor für Produktionsübernahme, weiterhin menschlich.

**READY FOR MANUAL REVIEW** – nichts deployt, Phase 3 nicht begonnen.
