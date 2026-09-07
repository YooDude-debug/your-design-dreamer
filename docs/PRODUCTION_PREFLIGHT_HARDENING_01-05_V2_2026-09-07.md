# Y-DUDE PRODUCTION – PREFLIGHT V3: MIGRATIONSPAKET HARDENING #1–#5 **V2**

Datum: 2026-09-07 · Modus: read-only Vorprüfung · Keine Änderung an Code, DB, Rechten, Policies, Daten, Deployment.

## ERGEBNIS

🔴 **PREFLIGHT STOPP**

Gründe (beide belegt, keiner davon fatal für das Paket selbst):

1. **Die vier bekannten Codekonflikte bestehen in v2 unverändert.** Das v2-Paket enthält *nicht* die
   konfliktbereinigten Fassungen von `src/lib/data.tsx`, `src/components/AdSlider.tsx`,
   `src/routes/_authenticated/dev.tsx`, `eslint.config.js`. Ein Übernehmen der `target-files/`
   würde Production-Arbeit überschreiben.
2. **Die vorhandene DB-Rollback-Baseline reicht für v2 nicht aus.** Sie enthält keine
   `GRANT EXECUTE … TO PUBLIC`-Wiederherstellung für die sechs Guard-Funktionen, die die neue
   fünfte Migration entzieht.

Paket, Prüfsumme und alle fünf Migrationen sind ansonsten sauber und inhaltlich schlüssig.

## 1. Paketprüfung

Archiv: `/mnt/user-uploads/2026-09-07-hardening-01-05-v2.tar.gz`, entpackt read-only nach `/tmp/pf3`.
Hinweis: Ein Ordner `migration/production/2026-09-07-hardening-01-05-v2/` existiert im
Production-Repository **nicht**; geprüft wurde ausschließlich das Upload-Archiv. Das
Vorgängerpaket `2026-09-07-hardening-01-05/` liegt unverändert im Repository.

| Artefakt | Status |
| --- | --- |
| README, MANIFEST, FILES, CHANGELOG | vorhanden, lesbar |
| RUNBOOK, ROLLBACK | vorhanden |
| SECURITY_/E2E_/PERFORMANCE_CHECKLIST | vorhanden |
| PATCH/changes.patch | vorhanden |
| target-files/ (30 Dateien) | vollständig |
| rollback-baseline/ (28 Dateien + 2 × `.MISSING`) | vollständig bis auf einen Dokumentationsfehler: das Paket nennt **3** neue Dateien, `rollback-baseline` markiert nur **2** (`tests/market-no-pickup-code.test.ts` ohne `.MISSING`-Marker) |
| migrations/ (5 SQL) | vollständig |
| CHECKSUMS.txt (74 Einträge) | **alle verifiziert, 0 Abweichungen** |
| `.git`-Metadaten im Archiv | keine |

## 2. SHA-256

Erwartet: `1a96f7dc…67ef3f`
Gemessen: `1a96f7dc9452efce8fee4a514fb89557c663923ed328b4754ea746cc0267ef3f` → **IDENTISCH**.
Eine Paket-interne Volldeklaration der Archiv-Prüfsumme existiert nicht (CHECKSUMS.txt deckt die
Dateien im Archiv ab, nicht das Archiv selbst) – alle Datei-Prüfsummen stimmen.

## 3. Aktuelle Production-Baseline (neu erhoben, nicht vorausgesetzt)

| Punkt | Stand | Abweichung zum letzten Preflight |
| --- | --- | --- |
| Revision | `65738f7a` | **geändert** (vorher `bc71e2b0`); die Zwischenschritte enthalten ausschließlich Berichte und die inaktive Rollback-Baseline |
| Drizzle-Migrationsstand | 32 Dateien, letzte `0031_age_status_functions.sql` | keine |
| Supabase-Migrationsdateien | 231 | keine |
| Build | `build OK` (10:39 UTC) | keine |
| Anwendungscode | unverändert (`loadedProfileIdsRef` nicht vorhanden, `no-unused-vars` weiterhin `off`) | keine |

## 4. Codevergleich – alle 30 Dateien

Verglichen wurde byteweise `rollback-baseline/<datei>` ↔ Production und `target-files/<datei>` ↔ Production.

- **23 Dateien BASELINE OK** – Production entspricht exakt dem Paket-Ausgangsstand, Übernahme wäre verlustfrei.
- **3 Dateien NEU** – in Production nicht vorhanden, anlegbar:
  `src/components/lazy/LazySocialPanels.tsx`, `tests/network-optimization.test.ts`,
  `tests/market-no-pickup-code.test.ts`.
- **4 Dateien KONFLIKT** (unverändert gegenüber Preflight V2).

## 5. Die vier früheren Konflikte – Status in v2

| Datei | Production-Stand | v2-`target-files` | Bewertung |
| --- | --- | --- | --- |
| `src/lib/data.tsx` | keine Bibliotheksrechte-Abfrage (`libraryTagIds` 0×), kein `loadedProfileIdsRef` | enthält `libraryTagIds` 3× **und** `loadedProfileIdsRef` 5× | **KONFLIKT** – Paket bringt Funktionalität außerhalb #5 mit. Nur der #5-Performance-Anteil ist zulässig. |
| `src/components/AdSlider.tsx` | SEO-CTA `moreFor` 6× („Mehr über … erfahren“, de/en/el) | `moreFor` 0× | **KONFLIKT** – Übernahme würde die SEO-Texte löschen. Zulässig ist nur das Entfernen der ungenutzten `Pause`-Bindung. |
| `src/routes/_authenticated/dev.tsx` | Feed-Auswahlmenü entfernt (0 Treffer) | Feed-Menü-Code 11× enthalten | **KONFLIKT** – Übernahme würde entfernte UI zurückbringen. Zulässig ist nur das Entfernen des ungenutzten Typimports. |
| `eslint.config.js` | `no-unused-vars: "off"`, ohne `release`/`migration`-Ausnahmen | aktiviert `no-unused-vars: warn` (`^_`-Ausnahmen) **und** ergänzt die Ignore-Einträge `release` + `migration` | **KONFLIKT (gering)** – der Regel-Anteil ist erwünscht, die zwei zusätzlichen Ignore-Einträge sind eine Scope-Erweiterung und wurden in der vorbereiteten Zusammenführung bewusst nicht übernommen. |

Vorbereitete, verlustfreie Auflösung liegt bereits vor:
`docs/patches/2026-09-07-hardening-01-05-conflict-merge.patch` – erneut geprüft mit
`patch -p1 --dry-run` in einer isolierten Kopie: **anwendbar, 4 Dateien, ohne Konflikt**.
Nicht angewendet.

## 6. Die fünf DB-Migrationen (nichts ausgeführt)

Alle fünf Dateien enthalten ausschließlich `CREATE OR REPLACE FUNCTION`, `GRANT`, `REVOKE`.
**Keine** Tabellen-, Struktur-, Policy- oder Datenänderung. Kein `DELETE`/`DROP`.

### M1 `20260907075857_…9aa2e6a3….sql` (#1)
Entzieht anon/authenticated alle Rechte auf `public.slang_tag_track_dedup` (service_role behält
alles), entzieht `anon` SELECT/INSERT/UPDATE/DELETE auf `comments` und `messages`, entzieht
`anon`-EXECUTE auf `has_role`, `are_connected`, `is_following`, `can_view_post`,
`test_user_visible` und die sechs Guard-Funktionen.
Ist-Zustand Production: alle genannten anon-Rechte sind noch vorhanden → Bedarf belegt.
`track_slang_tag_click/reach` sind SECURITY DEFINER und schreiben die Dedup-Tabelle weiter. Konflikt: keiner.

### M2 `20260907080749_…5a399190….sql` (#1)
`promote_exclusive_drops(uuid)`: Ownership-Prüfung `auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() → 'not_allowed'`.
Ist-Zustand: SECURITY DEFINER ✔, `search_path=public` ✔, EXECUTE: postgres/authenticated/service_role,
**kein anon, kein PUBLIC** ✔, Ownership-Prüfung fehlt noch.
Soll nach Migration: identische Attribute, zusätzlich `REVOKE … FROM PUBLIC/anon` (No-ops) und
EXECUTE für authenticated + service_role. Aufrufer `src/lib/creator-slangtags.functions.ts` übergibt
die eigene Nutzer-ID → kompatibel. Erfüllt damit alle vier geforderten Punkte (DEFINER,
`search_path=public`, keine anon/PUBLIC-Ausführung, auf eigenes Konto begrenzt).

### M3 `20260907084122_…57362285….sql` (#3)
`market_start_transaction` ohne `buy_now_enabled`-Gate. Diese Fassung **schreibt noch einen
Abholcode** in `market_transaction_secrets`; sie wird von M5 ersetzt.
→ **Reihenfolge-Abhängigkeit: M3 muss vor M5 laufen**, sonst bleibt der Abholcode aktiv.

### M4 `20260907085235_…c0e81394….sql` (#4)
`mark_conversation_read`: ein `UPDATE` + `GET DIAGNOSTICS` statt `COUNT` + `UPDATE`.
Mitgliedschaftsprüfung, Fehlerfälle und Rückgabeformat (`conversation_id`, `last_read_at`,
`messages_marked`, `wrote`) unverändert. Grants: `REVOKE … FROM PUBLIC, anon` (No-op),
EXECUTE für authenticated + service_role (entspricht dem Ist-Zustand). Konflikt: keiner.

### M5 `20260907103102_…a6bf3d72….sql` (v2-Korrekturen A + B)
**A) Sechs Guard-Funktionen:** `REVOKE EXECUTE … FROM PUBLIC` **und** `FROM anon`, danach
explizit `GRANT EXECUTE … TO authenticated, service_role`.
Ist-Zustand Production (`pg_proc.proacl`): alle sechs haben `=X/postgres` (PUBLIC-EXECUTE) **und**
`anon=X` → der in Preflight V2 gemeldete Mangel ist mit dieser Migration behoben.
Wichtige Tatsachenkorrektur: diese sechs Funktionen sind in Production **SECURITY INVOKER**
(`prosecdef = false`), nicht DEFINER. Die Migration ändert `prosecdef` und `search_path`
(`search_path=public` bei allen sechs) nicht – die Forderung „unverändert“ ist erfüllt, die
Annahme „SECURITY DEFINER“ trifft für diese sechs Funktionen jedoch nicht zu.
Trigger-Ausführung prüft kein EXECUTE-Recht des aufrufenden Rollennamens → kein Funktionsverlust.

**B) Market ohne Abholcode:** `market_start_transaction` ohne `v_code` und ohne
`INSERT INTO public.market_transaction_secrets`. Kein `DELETE`, kein `DROP` – historische Zeilen
bleiben unangetastet. Grants: unverändert nur `service_role` (+postgres).

## 7. Security-Vergleich (read-only, nichts geändert)

| Punkt | Production Ist | v2-Soll | Bewertung |
| --- | --- | --- | --- |
| RLS | auf allen betroffenen Tabellen aktiv | unverändert | keine Änderung durch das Paket |
| Policies | `comments` 3, `messages` 5, `slang_tag_track_dedup` 0 | unverändert | keine Policy wird angelegt/geändert/gelöscht |
| anon-Tabellenrechte | noch vorhanden auf `slang_tag_track_dedup`, `comments`, `messages` | entzogen | Härtung, Bedarf belegt |
| anon-EXECUTE Prüf-Funktionen | vorhanden | entzogen | Härtung |
| PUBLIC-EXECUTE der 6 Guards | vorhanden | entzogen | v2 schließt die V2-Lücke |
| SECURITY DEFINER / `search_path` | 3 ersetzte Funktionen DEFINER + `search_path=public`; 6 Guards INVOKER + `search_path=public` | unverändert | erfüllt |
| authenticated / service_role | siehe M1–M5 | erhalten bzw. explizit neu gesetzt | keine Funktionsverluste erkennbar |

Offen zu bestätigen vor Ausführung: dass kein öffentlicher, nicht angemeldeter Lesepfad direkt auf
`comments`/`messages` zugreift (RLS lässt anon dort ohnehin keine Zeilen sehen; ein Live-Nachweis
wurde in diesem read-only-Lauf nicht erbracht).

## 8. Market-Scope (#3 + v2-B)

Nach M3 + M5 gilt: Kaufanfrage ohne Checkout-Flag möglich, Reservierung (`status = 'reserved'`),
Ereignisprotokoll, Gebühren-Snapshot, Versandzeile nur bei `shipping`. **Kein** Checkout, **keine**
Zahlung, **kein** integrierter Versand, **kein** Ticket, **kein** Abholcode mehr bei einer
Kaufanfrage. Historische Abholcodes werden nicht gelöscht. Production-Code enthält keine
`pickup_code`-Verwendung; `src/lib/market-tx.server.ts` unterscheidet sich vom Soll-Stand nur um
zwei Leerzeilen. Keine Scope-Überschreitung festgestellt.

## 9. Messenger (#4)

Übertragen wird ausschließlich: gebündelte Realtime-Aktualisierung (400 ms) in `src/lib/social.tsx`,
keine Unread-Abfrage für eigene gesendete Nachrichten, Timer-Cleanup – zusammen mit dem einen
`UPDATE` in `mark_conversation_read`. Rückgabeformat und Mitgliedschaftsprüfung unverändert →
kein sichtbares Verhaltensänderung. Production entspricht hier exakt dem Paket-Ausgangsstand.

## 10. Network Performance (#5)

- `src/lib/stripe.ts` lädt über `@stripe/stripe-js/pure` erst in `getStripe()` → Bezahlskript nicht
  beim Profilaufruf. Checkout/Zahlung wird dadurch **nicht** reaktiviert (nur Ladezeitpunkt).
- `src/components/SocialLayer.tsx` + neuer `LazySocialPanels.tsx`: Messenger-/Kontakt-/
  Benachrichtigungsbereiche werden erst beim ersten Öffnen gemountet, Deep-Link-Logik unverändert.
- `src/lib/data.tsx` (nur der #5-Anteil): Dedupe geladener Profil-IDs, Warten auf laufenden
  Session-Load → keine doppelten `profiles`/`profile_locations`-Abfragen.

## 11. Rollback

- **Code:** `rollback-baseline/` deckt 23 vorhandene Dateien exakt ab; für neue Dateien gilt Löschen.
  Für die 4 Konfliktdateien ist der Paket-Rollback **nicht gültig**, weil er den Production-Stand
  nicht abbildet.
- **DB:** `migration/production/2026-09-07-hardening-01-05/rollback-production-db-baseline.sql`
  enthält die Vorher-Definitionen der drei ersetzten Funktionen, deren EXECUTE-Rechte, die
  anon-Tabellenrechte und die anon-EXECUTE-Rechte der Guards.
  **Fehlend für v2:** `GRANT EXECUTE ON FUNCTION public.<guard>() TO PUBLIC;` für alle sechs
  Guard-Funktionen (aktuell `=X/postgres` im `proacl`). Ohne diese sechs Zeilen ist die von M5
  entzogene PUBLIC-Berechtigung nicht wiederherstellbar → Rollback **unvollständig**.
- Reihenfolge-Anforderung: **M3 vor M5** (sonst bleibt der Abholcode aktiv). Empfohlene Gesamtfolge:
  M2 → M4 → M3 → M5 → M1, jeweils einzeln mit Zustandsprüfung.

## 12. Scope

Enthalten: #1 Security, #2 Quality, #3 Market-E2E, #4 Messenger-Read-Status, #5 Netzwerk.
Nicht enthalten: #6 Globe, Stripe/Checkout, Zahlung, Versandintegration, Tickets, Pickup-Codes,
neue Features, UX-Änderungen, sonstige Refactorings.
Scope-Abweichungen ausschließlich in den Paketfassungen von `src/lib/data.tsx` (Bibliotheksrechte)
und `eslint.config.js` (zwei zusätzliche Ignore-Einträge) – beide in der vorbereiteten
Zusammenführung ausgeschlossen.

## 13. Finale Entscheidung

🔴 **PREFLIGHT STOPP**

Zwei Punkte müssen vor einer kontrollierten Migration entschieden werden:

1. Für die vier Konfliktdateien den bereits vorbereiteten, geprüften Merge-Patch verwenden statt
   der Paket-`target-files` (Patch liegt vor und ist anwendbar).
2. Die DB-Rollback-Baseline um die sechs `GRANT EXECUTE … TO PUBLIC`-Zeilen ergänzen.

Danach sind alle übrigen 26 Dateien und alle fünf Migrationen freigabefähig.

## Bestätigung

- Code geändert: **NEIN**
- DB geändert: **NEIN**
- Grants geändert: **NEIN**
- Policies geändert: **NEIN**
- Daten geändert: **NEIN**
- Deployment: **NEIN**
