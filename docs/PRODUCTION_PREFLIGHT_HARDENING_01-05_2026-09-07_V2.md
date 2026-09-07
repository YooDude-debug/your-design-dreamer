# Y-DUDE PRODUCTION – PREFLIGHT #2: MIGRATIONSPAKET HARDENING #1–#5

Datum: 2026-09-07 · Modus: read-only Vorprüfung · Keine Änderung an Code, DB, Rechten, Daten, Deployment.

## ERGEBNIS

🔴 **PREFLIGHT STOPP**

Grund: **4 der 29 Codedateien sind in Production abweichend** vom Paket-Baseline-Stand `a1c4a66`.
Ein Übernehmen der Soll-Dateien würde eigenständige Production-Arbeit überschreiben bzw. Änderungen
außerhalb des Scopes #1–#5 einbringen. Paket, Prüfsumme und alle vier DB-Migrationen sind dagegen
sauber und kompatibel.

## 1. Paketprüfung

| Artefakt | Status |
| --- | --- |
| MANIFEST.md, FILES.md, CHANGELOG.md, README.md | vorhanden, lesbar |
| RUNBOOK.md, ROLLBACK.md | vorhanden |
| SECURITY_/E2E_/PERFORMANCE_CHECKLIST.md | vorhanden |
| PATCH/changes.patch | vorhanden |
| target-files/ (29 Dateien) | vollständig |
| rollback-baseline/ (27 Dateien + 2 × `.MISSING`) | vollständig, konsistent mit „2 neue Dateien“ |
| migrations/ (4 SQL) | vollständig |
| CHECKSUMS.txt | alle Einträge verifiziert, **0 Abweichungen** |
| `.git`-Metadaten im Archiv | keine |

## 2. SHA-256

Erwartet: `d219e5b30628f78b61cfb65e81141ee0a410e2a2bfea72cddf71666d2c1c492e`
Gemessen: `d219e5b30628f78b61cfb65e81141ee0a410e2a2bfea72cddf71666d2c1c492e` → **IDENTISCH**.

## 3. Production-Baseline (erneut geprüft)

| Punkt | Stand | Abweichung zu Preflight #1 |
| --- | --- | --- |
| Revision | `b24d1123` | keine |
| Drizzle-Migrationsstand | `0031_age_status_functions.sql` | keine |
| Supabase-Migrationsdateien | 231 | keine |
| Build | `build OK` (10:06 UTC) | keine |
| Arbeitsbaum | keine offenen Änderungen | keine |
| Staging-Revisionen `ebdf3bd` / `a1c4a66` | in Production-Historie nicht auflösbar | unverändert |

## 4. Codevergleich – alle 29 Dateien

Legende: **BASELINE OK** = Production entspricht exakt dem Paket-Ausgangsstand, Patch sauber
anwendbar · **NEU** = Datei existiert in Production nicht (erwartet) · **KONFLIKT** = Production
weicht von Baseline und Soll ab.

| Datei | Paket | Production-Zustand | Konflikt | Aktion |
| --- | --- | --- | --- | --- |
| `remotion/src/DefendCityVideo.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `remotion/src/RonjaVideo.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `remotion/src/WasIstYdudeVideo.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `remotion/src/scenes/SceneBirthday.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/components/GdprPublicPage.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/components/LegalPage.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/components/admin/AdminUI.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/lib/ads/use-ad-targeting.ts` | #2 | BASELINE OK | nein | migrierbar |
| `src/routes/_authenticated/creator.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/routes/_authenticated/globe.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/routes/_authenticated/hashtag.$name.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/routes/_authenticated/market.$itemId.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/routes/_authenticated/market.new.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/routes/_authenticated/market.orders.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/routes/_authenticated/market.tx.$txId.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/routes/_authenticated/posts.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/routes/_authenticated/profile.$username.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/routes/_authenticated/slangtag.$name.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/routes/reset-password.tsx` | #2 | BASELINE OK | nein | migrierbar |
| `src/lib/market-tx.server.ts` | #3 | BASELINE OK | nein | migrierbar |
| `src/lib/social.tsx` | #4 | BASELINE OK | nein | migrierbar |
| `src/lib/stripe.ts` | #5 | BASELINE OK | nein | migrierbar |
| `src/components/SocialLayer.tsx` | #5 | BASELINE OK | nein | migrierbar |
| `src/components/lazy/LazySocialPanels.tsx` | #5 | NEU (in Production nicht vorhanden) | nein | anlegbar |
| `tests/network-optimization.test.ts` | #5 | NEU (in Production nicht vorhanden) | nein | anlegbar |
| `eslint.config.js` | #2 | **KONFLIKT** – Production hat `"release"` aus den Ausnahmen entfernt; Paket ergänzt `"release"` + `"migration"` und aktiviert `no-unused-vars` | ja (gering) | zusammenführen, nicht überschreiben |
| `src/components/AdSlider.tsx` | #2 | **KONFLIKT** – Production enthält die SEO-CTA-Erweiterung (`moreFor` in de/en/el); Paketstand kennt sie nicht | ja (mittel) | STOPP – Überschreiben würde SEO-Arbeit zurücknehmen |
| `src/lib/data.tsx` | #5 | **KONFLIKT** – Paketstand enthält zusätzlich Rollen-Wrapper und den `libraryTagIds`-Block (dauerhafte Bibliotheksrechte), die Production nicht hat | ja (hoch) | STOPP – Übernahme wäre Scope-Erweiterung außerhalb #5 |
| `src/routes/_authenticated/dev.tsx` | #2 | **KONFLIKT** – Production hat Feed-Auswahlmenü und zugehörige Zustände/Imports bereits entfernt; Paketstand enthält sie noch | ja (mittel) | STOPP – Überschreiben würde Production-UI-Stand zurückdrehen |

Summe: 25 konfliktfrei (23 vorhandene + 2 neue), **4 Konflikte**.

## 5. DB-Preflight – alle 4 Migrationen

Alle vier SQL-Dateien enthalten ausschließlich `CREATE OR REPLACE FUNCTION`, `GRANT` und `REVOKE`.
**Keine** Tabellenänderung, **keine** Datenänderung, **keine** Policy-Änderung. Nichts ausgeführt.

### M1 `20260907075857_…9aa2e6a3….sql` (#1)

| Prüfpunkt | Ergebnis |
| --- | --- |
| Zweck | Least privilege: anon-Rechte auf `slang_tag_track_dedup`, `comments`, `messages` entfernen; anon-EXECUTE auf 11 Prüf-/Trigger-Funktionen entfernen |
| Ist-Zustand Production | `slang_tag_track_dedup`: anon+authenticated SELECT/INSERT/UPDATE/DELETE vorhanden; `comments`/`messages`: `anon:SELECT` vorhanden; alle genannten Funktionen haben aktuell `anon:EXECUTE` |
| Bereits vorhanden | nein |
| Abhängigkeiten | `track_slang_tag_click/reach` müssen SECURITY DEFINER bleiben (sind es) |
| Konflikt | keiner |
| Sicher ausführbar | ja; einzelne REVOKEs (z. B. `messages` UPDATE) sind wirkungslose No-ops |

### M2 `20260907080749_…5a399190….sql` (#1)

| Prüfpunkt | Ergebnis |
| --- | --- |
| Zweck | `promote_exclusive_drops(uuid)`: angemeldete Aufrufer nur für eigenes Konto (`auth.uid()`), Serverläufe unverändert |
| Ist-Zustand | SECURITY DEFINER ✔, `search_path=public` ✔, EXECUTE: authenticated, service_role, postgres; **anon bereits gesperrt**; Eigentümerprüfung im Code **fehlt bisher** |
| Erwarteter Zustand | identische Attribute + Ownership-Prüfung; Grants unverändert |
| Bereits vorhanden | teilweise (Grants ja, Prüfung nein) |
| Aufrufer | `src/lib/creator-slangtags.functions.ts` ruft mit der eigenen Nutzer-ID → kompatibel |
| Konflikt | keiner |
| Sicher ausführbar | ja |

### M3 `20260907084122_…57362285….sql` (#3)

| Prüfpunkt | Ergebnis |
| --- | --- |
| Zweck | veraltetes Checkout-Gate (`buy_now_enabled` → `checkout_disabled`) aus `market_start_transaction` entfernen |
| Ist-Zustand | Gate ist in Production noch aktiv; EXECUTE nur `service_role`/`postgres` |
| Nach Migration | Gate entfällt, alle übrigen Prüfungen (eigenes Angebot, Status, Fulfillment, Angebotsgültigkeit, Gebühren) unverändert; die REVOKEs für anon/authenticated sind No-ops |
| Stripe/Checkout/Tickets | nicht wieder eingeführt; Pickup-Code-Zeile ist Bestandsverhalten, keine Neuerung |
| Konflikt | keiner |
| Sicher ausführbar | ja (Aufruf erfolgt serverseitig in `market-tx.server.ts`) |

### M4 `20260907085235_…c0e81394….sql` (#4)

| Prüfpunkt | Ergebnis |
| --- | --- |
| Zweck | `mark_conversation_read`: ein UPDATE statt COUNT + UPDATE |
| Ist-Zustand | Production nutzt noch `SELECT count(*)`; EXECUTE: authenticated, service_role, postgres (anon bereits gesperrt) |
| Nach Migration | Mitgliedschaftsprüfung, Fehlerfälle und Rückgabeformat (`conversation_id`, `last_read_at`, `messages_marked`, `wrote`) unverändert |
| Konflikt | keiner |
| Sicher ausführbar | ja |

## 6. Security-Vergleich

- anon-EXECUTE ist auf `promote_exclusive_drops`, `mark_conversation_read` und
  `market_start_transaction` in Production **bereits** entfernt; das Paket bestätigt diesen Zustand.
- Die von M1 adressierten anon-Grants und anon-EXECUTE-Rechte bestehen in Production noch – der
  Härtungsbedarf ist damit belegt, nicht behauptet.
- RLS bleibt in allen vier Migrationen unberührt; keine Policy wird angelegt, geändert oder gelöscht.
- Alle betroffenen SECURITY-DEFINER-Funktionen behalten `SET search_path = public`.
- Fremde Profile/Nachrichten/Conversations/Rollen/Market-Daten: Schutz beruht weiterhin auf
  bestehenden Policies; das Paket entfernt nur überflüssige Rechte. Ein zusätzlicher Live-Nachweis
  gegen die laufende Schnittstelle wurde in diesem Lauf **nicht** erbracht (read-only Vorprüfung).

## 7. Konflikte

1. `src/lib/data.tsx` – hoch: Paketstand enthält Funktionalität (Bibliotheksrechte, Rollen-Wrapper),
   die Production nicht hat. Übernahme wäre eine Scope-Erweiterung.
2. `src/components/AdSlider.tsx` – mittel: Production-SEO-Arbeit würde verloren gehen.
3. `src/routes/_authenticated/dev.tsx` – mittel: Production hat den Feed-Menü-Code schon entfernt;
   Paketstand würde ihn zurückbringen.
4. `eslint.config.js` – gering: gegenläufige Ausnahmelisten, inhaltlich zusammenführbar.

Keine dieser Dateien wurde angefasst.

## 8. Rollback-Prüfung

- `rollback-baseline/` liefert für 27 Dateien den Ausgangsstand, für 2 neue Dateien `.MISSING`
  (Rücknahme = Löschen). Für die 25 konfliktfreien Dateien ist der Datei-Rollback sauber möglich.
- Für die 4 Konfliktdateien ist der Paket-Rollback **nicht gültig**, weil er den Production-Stand
  nicht abbildet – ein Rücksetzen würde erneut Production-Arbeit zerstören.
- DB-Rollback: Das Paket liefert **keine** Vorher-Definitionen der vier Funktionen. Ein Rücksetzen
  ist nur möglich, wenn vor der Ausführung die aktuellen Definitionen und Grant-Zustände gesichert
  werden. Ohne diese Sicherung ist der DB-Rollback **nicht automatisierbar** – ausdrücklich
  gekennzeichnet. Datenverlust entsteht dabei nicht (keine Datenänderung).

## 9. Scope-Prüfung

- Enthalten: #1 Security, #2 Quality, #3 E2E-Market-Fix, #4 Messenger-Read-Status, #5 Netzwerk.
- Nicht enthalten: #6 Globe, Stripe/Checkout, integrierte Zahlung, Versandintegration, Tickets,
  Pickup-Code-Neuerungen, neue Market-Funktionen, neue DB-Struktur, Turnstile-Arbeitspaket.
- Scope-Abweichung: nur über `src/lib/data.tsx` (siehe Konflikt 1) – dokumentiert, nicht gelöst.

## 10. Erwarteter Migrationsablauf (noch nicht ausgeführt)

1. Vor-Sicherung der vier Funktionsdefinitionen und der betroffenen Grants aus Production.
2. Übernahme der 25 konfliktfreien Dateien (inkl. 2 Neuanlagen).
3. Für die 4 Konfliktdateien: gezielte Zusammenführung, ausschließlich der #1–#5-Anteile,
   Production-eigene Änderungen bleiben erhalten – oder Rückstellung.
4. Anwendung der vier DB-Migrationen einzeln, mit Zustandsprüfung nach jeder.

## 11. Tests nach der Migration (bestätigt durchführbar)

Typecheck · vollständige Testsuite · DB-Tests · Lint (Referenz: Gesamtlauf bekannt rot; Vergleich auf
geänderten Dateien) · Build · Security-Smoke (anon-Grants/EXECUTE, RLS unverändert) ·
Registration/Turnstile-Regression · Messenger A ↔ B inkl. Read Status · Market-E2E · Network-Smoke.

## Bestätigung

- Code geändert: **NEIN**
- Datenbank geändert: **NEIN** (nur lesende Abfragen)
- Rechte geändert: **NEIN**
- Production-Daten verändert: **NEIN**
- Deployment: **NEIN**

**STATUS: 🔴 PREFLIGHT STOPP** – Paket und DB-Teil sind freigabefähig, die 4 Codekonflikte müssen
vorher entschieden werden.
