# Production – Konflikt-Auflösung Migrationspaket Hardening #1–#5

- Datum: 2026-09-07
- Paket: `2026-09-07-hardening-01-05` (Archiv-SHA-256 `d219e5b3…c492e`, in Preflight V2 verifiziert)
- Paketquelle (read-only entpackt): `/tmp/pf2/2026-09-07-hardening-01-05`
- Production-Baseline: unveränderter Stand vom Preflight V2 (Drizzle bis `0031_age_status_functions.sql`, 231 Supabase-Migrationsdateien, Build OK)
- Status: **🟢 MERGE PREPARATION COMPLETE**
- Anwendung: **NICHT ANGEWENDET** (Patch vorbereitet, Validierung in isolierter Kopie)

## 0. Methode

Grundregel eingehalten: Es wurde **keine** Paketdatei nach Production kopiert.
Der tatsächliche `#1–#5`-Diff wurde aus dem Paket herausgelöst als
`rollback-baseline/<datei>` → `target-files/<datei>` und **nur dieser Anteil**
auf den aktuellen Production-Stand angewandt. Alle Production-eigenen Änderungen
(Diff `rollback-baseline` → Production) bleiben unberührt.

Validierung fand in einer Arbeitskopie (`/tmp/mc`) statt, nicht im Production-Baum.

---

## 1. `src/lib/data.tsx`

| Feld | Inhalt |
|---|---|
| Ursache | Paket- und Production-Stand sind unabhängig weitergelaufen |
| Production-Änderung | Prettier-Umformatierung des `moderationStatus`-Typs; Rollen-Zustände direkt als `isAdmin/isModerator/isCreator/isBusiness` (ohne `…Raw`-Wrapper); der clientseitige Block `libraryTagIds` (`slang_tag_library`-Abfrage) ist in Production **nicht** vorhanden |
| Staging/Package-Änderung | Paketstand enthält `…Raw`-Wrapper **und** den clientseitigen `libraryTagIds`-Block; zusätzlich P-05 |
| #1–#5-relevanter Teil | Ausschließlich **P-05 (Netzwerk-Performance #5)**: `loadedProfileIdsRef`, Anheben von `inFlightRef` an den Provider-Anfang, Warten auf laufenden Sitzungsstart in `ensureProfiles`, Filter gegen bereits geladene IDs, Merken geladener IDs in `ensureProfiles` und `loadAllRaw` |
| Zu erhaltender Production-Teil | Formatierung, direkte Rollen-Zustände, **das Nicht-Vorhandensein** des clientseitigen `libraryTagIds`-Blocks |
| Geplante Zusammenführung | Nur die sechs P-05-Hunks auf die Production-Datei anwenden; `…Raw`-Wrapper und `libraryTagIds` werden **nicht** eingeführt |
| Risiko | Niedrig. Fachliche Korrektur: `inFlightRef` wird nun vor `loadAll` deklariert; Verhalten von `loadAll` unverändert (dieselbe Ref, dieselbe Semantik). Typecheck und Tests bestätigen dies. |

**Faktenkorrektur zur Auftragsannahme:** Die dauerhaften Bibliotheksrechte
(`libraryTagIds` im Client) liegen **im Paket**, nicht in Production – Production
hat diesen Client-Block nicht (mehr). Es besteht daher kein Verlustrisiko; der
Merge fügt ihn ausdrücklich **nicht** hinzu (kein Feature, kein Scope-Zuwachs).
Server-/RLS-seitig bleibt `can_use_slang_tag` unberührt.

---

## 2. `src/components/AdSlider.tsx`

| Feld | Inhalt |
|---|---|
| Ursache | Production hat nach der Paket-Baseline SEO-CTAs ergänzt |
| Production-Änderung | `moreFor(company)` in `de`/`en`/`el`, Typ `AdCopy`, zwei CTA-Stellen nutzen `moreFor(ad.company)` („Mehr über … erfahren“) |
| Staging/Package-Änderung | Entfernt den ungenutzten Import `Pause` (Quality #2) |
| #1–#5-relevanter Teil | Nur die Import-Zeile |
| Zu erhaltender Production-Teil | Alle SEO-Texte und CTA-Aufrufe |
| Geplante Zusammenführung | Nur `Pause` aus dem `lucide-react`-Import entfernen |
| Risiko | Sehr niedrig. `Pause` wird in Production nirgends im JSX verwendet (geprüft); Build und Typecheck bestätigen dies. |

---

## 3. `src/routes/_authenticated/dev.tsx`

| Feld | Inhalt |
|---|---|
| Ursache | Production hat das Feed-Auswahlmenü bereits entfernt |
| Production-Änderung | Entfernung von Menü-State (`feedMenuOpen`, `feedMenuRef`), Outside-Click-Effekt, Toggle-Zeile, zugehörige Imports (`Link`, `RadioTower`, `ChevronDown`, `Swords`, `Globe2`), `toggleLiveFeed` |
| Staging/Package-Änderung | Entfernt den ungenutzten Typimport `SlangTag` (Quality #2); das Menü ist im Paketstand noch enthalten |
| #1–#5-relevanter Teil | Nur die Typimport-Zeile |
| Zu erhaltender Production-Teil | Der komplette Rückbau des Feed-Auswahlmenüs |
| Geplante Zusammenführung | Nur `type SlangTag` aus dem `@/lib/types`-Import entfernen |
| Risiko | Sehr niedrig. `SlangTag` erscheint in Production nur noch in Kommentartexten; Typecheck bestätigt. |

---

## 4. `eslint.config.js`

| Feld | Inhalt |
|---|---|
| Ursache | Gegenläufige Ignore-Listen plus Regeländerung aus #2 |
| Production-Änderung | Der Ignore-Eintrag `release` ist in Production **nicht** vorhanden (Paket-Baseline hatte ihn) |
| Staging/Package-Änderung | Ignore `migration` ergänzt **und** `@typescript-eslint/no-unused-vars` von `off` auf `warn` mit `^_`-Ausnahmen |
| #1–#5-relevanter Teil | Die Aktivierung von `no-unused-vars` (Quality #2) |
| Zu erhaltender Production-Teil | Die Production-Ignore-Liste unverändert |
| Geplante Zusammenführung | Nur die Regel `@typescript-eslint/no-unused-vars: ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "all", caughtErrorsIgnorePattern: "^_" }]`. Der Ignore-Eintrag `migration` wird **nicht** übernommen (kein `migration/`-Verzeichnis in Production → unnötige neue Ausnahme). Der Eintrag `release` wird **nicht** neu eingeführt (Production ist führend). |
| Risiko | Niedrig. Keine Regel wird abgeschwächt, keine Prüfung deaktiviert, keine globale Ausnahme ergänzt. Warnungen werden sichtbar, nicht versteckt. |

**Messung statt Annahme:** In der Arbeitskopie (ohne `release/`-Archivkopien)
ergibt die aktivierte Regel **35** `no-unused-vars`-Warnungen, nicht 40. Die im
Paket genannte Zahl 40 ist auf dem Production-Stand nicht reproduzierbar; sie
wird hier ausdrücklich nicht übernommen.

---

## 5. Patch

- Datei: `docs/patches/2026-09-07-hardening-01-05-conflict-merge.patch`
- Grundlage: ausschließlich aktueller Production-Stand
- Umfang: 4 Dateien, 122 Diff-Zeilen, ausschließlich #1–#5-Anteile
- Enthält keine Production-Rücknahme, keine neuen Funktionen, keine DB-Änderung
- `patch -p1 --dry-run` in der Arbeitskopie: **sauber anwendbar** (keine Fuzz-/Reject-Meldung)
- **Nicht auf Production angewendet**

## 6. Validierung (Arbeitskopie `/tmp/mc`, Patch angewendet)

| Prüfung | Ergebnis |
|---|---|
| Typecheck (`tsgo --noEmit`) | **PASS** (0 Fehler) |
| Tests (`vitest run`) | **PASS** – 35 Dateien, 607/607 |
| Build (`npm run build`) | **PASS** |
| Lint der 4 Konfliktdateien | unverändert gegenüber Production: 1 vorbestehender Prettier-Fehler in `dev.tsx` (Zeile 583) und 1 vorbestehende `exhaustive-deps`-Warnung in `data.tsx`; **keine** neue Meldung durch den Merge, **keine** `no-unused-vars`-Meldung in diesen Dateien |
| Lint gesamt (Arbeitskopie) | 134 Meldungen (63 Fehler = vorbestehende Prettier-Formatierung, 71 Warnungen, davon 35 neu sichtbare `no-unused-vars`) |
| DB-Migration | **NICHT ausgeführt** |
| Deployment | **NICHT durchgeführt** |

Hinweis zur bekannten Production-Lintlage: Der große Meldungsbestand
(zuletzt 9.982) stammt überwiegend aus den Archivkopien unter `release/`, die in
Production nicht ignoriert werden. Das ist ein **vorbestehender** Zustand und
nicht Teil dieser Zusammenführung; er wird hier bewusst nicht durch eine neue
Ignore-Regel verdeckt.

## 7. DB-Rollback / Voraussetzung für den späteren DB-Schritt

Unverändert offen (aus Preflight V2): Die vier Paket-Migrationen enthalten keine
vollständigen Vorher-Definitionen. Vor einer späteren, kontrollierten Ausführung
ist mindestens zu sichern und zu dokumentieren:

1. `pg_get_functiondef` der betroffenen Funktionen
   (`promote_exclusive_drops`, `market_start_transaction`, `mark_conversation_read`
   sowie die in #1 adressierten Funktionen),
2. aktuelle Grants (`information_schema.role_routine_grants`, `table_privileges`)
   für die betroffenen Objekte und Rollen,
3. Funktionseigenschaften (`prosecdef`, `provolatile`, `proconfig`/`search_path`),
4. aktueller Migrationsstand (Drizzle-Journal + Supabase-Migrationsliste).

Erst danach DB-Migration – in dieser Aufgabe **nicht** ausgeführt.

## 8. Verbleibende Risiken

| Risiko | Bewertung |
|---|---|
| P-05 verändert Ladeverhalten der Profile | Niedrig; abgedeckt durch 607 Tests + Build, aber ohne echten eingeloggten Live-Lauf verifiziert |
| Paket-Anteile, die Production absichtlich nicht hat (`…Raw`-Wrapper, Client-`libraryTagIds`, `release`/`migration`-Ignores) | Bewusst ausgeschlossen; falls sie fachlich gewünscht sind, wäre das ein eigenes Arbeitspaket |
| Vier DB-Migrationen | Offen, ohne gesicherten Rollback nicht ausführen |
| Vorbestehender Prettier-Fehler in `dev.tsx` | Nicht Teil dieses Scopes, bleibt bestehen |
| Zahl „40 akzeptierte Warnungen“ aus dem Paket | Auf Production nicht reproduzierbar (gemessen: 35) |

## 9. Abschlussbestätigung

- Code tatsächlich geändert: **NEIN** (nur neuer Bericht + Patchdatei; kein Anwendungscode berührt)
- DB geändert: **NEIN**
- Production-Daten verändert: **NEIN**
- Deployment: **NEIN**

**Status: 🟢 MERGE PREPARATION COMPLETE**
