# SlangTags als persönliche Varianten — Architektur-Änderungsplan

Nur Analyse und Planung. Keine Migration, kein Code, keine Policy-Änderung in diesem Schritt.

## 1. Aktuelle Struktur (Ist)

- `slang_tags`: `id` (UUID, PK), `name`, `owner_id`, `creator_id`, `owner_type` (user/creator/company), `kind` (community/creator), `audio_url`, Zähler, Moderation, Business-Felder.
- **Zwei globale Unique-Indizes auf `lower(name)`**: `slang_tags_name_key` und `slang_tags_name_unique_ci`. Damit ist `$moin` heute weltweit nur einmal möglich.
- Client lädt **alle** sichtbaren Tags (`data.tsx`, `SLANG_TAG_COLUMNS`, Snapshot-Cache über `count + max(updated_at)`), `searchTags()` filtert nur clientseitig über diesen globalen Bestand → Vorschläge sind global.
- `checkSlangTagName(raw, tags)` lehnt Namen ab, die in der geladenen (globalen) Liste existieren.
- `getTag(idOrName)` löst **auch über den Namen** auf → bei Varianten mehrdeutig.
- Route `/slangtag/$name` identifiziert Tags ausschließlich über den Namen.
- Verknüpfungen laufen sonst überall korrekt über die ID: `posts.slang_tag_ids[]` + `placements[].tagId`, `comments.slang_tag_ids`, `messages.slang_tag_id(s)`, `slang_tag_likes/saves/shares/plays/votes/grants/share_requests`, `arena_submissions.tag_id`.
- RLS `slang_tags`: SELECT für alle authentifizierten Nutzer, wenn `approved` und nicht gelöscht; Schreiben/Löschen nur Owner/Creator/Admin. `can_use_slang_tag()` regelt Nutzungsrecht, `can_read_media()` den Audio-Zugriff (u. a. über Post-Sichtbarkeit).
- Voting (`slangtag-votes.ts`) gruppiert bereits nach `name.toLowerCase()`, kann aber real nie mehrere Varianten sehen.
- Owner-Modell: `owner_id`/`creator_id` sind beide `auth.users`-IDs; `owner_type`/`kind` beschreiben nur die Rolle. **Das genügt** für User/Creator/Business, da jede dieser Identitäten ein eigener Account ist. Empfehlung: `owner_id` als einzige Eigentums-Wahrheit festlegen, `creator_id` als „ursprünglicher Ersteller" beibehalten.

## 2. Zielstruktur (Soll)

- Ein SlangTag = **persönliche Variante eines Namens**, eindeutig über `id`.
- Eindeutigkeit nur pro Owner: `UNIQUE (owner_id, normalized_name)` — gilt identisch für User, Creator und Business.
- Neue generierte Spalte `normalized_name` (lower + trim, immutable) mit Index für Gruppierung und Suche.
- Neues Feld `community_shared` (bool) bzw. Nutzung der bestehenden Freigabe-Tabellen, um „persönlich" von „für Community/Arena eingereicht" zu trennen.
- Drei getrennte Rechte-Ebenen:
  - **Vorschlag/Verwendung neu**: nur eigene Tags (+ explizite Grants).
  - **Abspielen in fremdem Post**: über Post-Sichtbarkeit und `can_read_media()`.
  - **Community/Arena/Globe**: freiwillige Einreichung der konkreten `id`.

## 3. Datenbank-Änderungen (später, in eigenen Migrationsschritten)

| Bereich                | Änderung                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slang_tags`           | Spalte `normalized_name` (generated), `community_shared boolean default false`                                                                                                                                                                                                                              |
| Constraints            | `slang_tags_name_key` und `slang_tags_name_unique_ci` **entfernen**; `UNIQUE (owner_id, normalized_name)` anlegen                                                                                                                                                                                           |
| Indizes                | `(normalized_name)` für Gruppierung, `(owner_id, normalized_name)` unique                                                                                                                                                                                                                                   |
| Neue Tabelle (Stufe 7) | `slang_globe_entries` mit `source_slang_tag_id` → `slang_tags(id)` (RESTRICT), `normalized_name`, `region`, `selected_at`, Status; Globe ersetzt niemals den persönlichen Tag                                                                                                                               |
| Funktionen             | `can_use_slang_tag()` verschärfen: eigener Tag **oder** aktiver Grant; Community-Kind gibt kein Pauschalrecht mehr. Neue Funktion `suggestable_slang_tags()` (owner-scoped Liste). `owns_slang_tag`, `has_slang_tag_grant`, `delete_slang_tag`, `enforce_slang_tag_kind/duration` bleiben inhaltlich gleich |
| Trigger                | `enforce_slang_tag_kind` zusätzlich: `owner_id` niemals NULL, Namensnormalisierung beibehalten                                                                                                                                                                                                              |

### RLS-Anpassungen

- `slang_tags` SELECT bleibt lesbar (nötig für Anzeige fremder Tags in Posts), wird aber **nicht** als Vorschlagsquelle genutzt; alternativ zweistufig: volle Zeile für Owner/Admin, Lesezugriff auf fremde Tags nur, wenn sie in einem sichtbaren Post/Comment/Message vorkommen, community-freigegeben oder Arena-Kandidat sind.
- INSERT/UPDATE/DELETE unverändert owner-gebunden.
- `slang_tag_votes/grants/share_requests`: unverändert, arbeiten schon per `tag_id`.
- Audio: `can_read_media()` bleibt maßgeblich; kein Wildcard-Zugriff.

## 4. Frontend-Änderungen

- `src/lib/data.tsx`
  - Laden trennen: **eigene Tags** (owner-scoped, vollständig) und **referenzierte Tags** (nur IDs aus geladenen Posts/Comments/Messages/Arena, per `in("id", …)` nachgeladen).
  - `searchTags()` nur über eigene Tags + Grants + Draft-Tags.
  - `getTag()` primär per ID; Namensauflösung nur noch als Fallback im eigenen Bestand.
  - Snapshot-/Version-Cache auf owner-scoped Bestand umstellen.
- `src/lib/slangtag-rules.ts`: Duplikatprüfung gegen **eigene** Tags statt globale Liste; Fehlertext anpassen.
- `src/components/SlangTagInput.tsx`, `TagComboField.tsx`, `SlangBox.tsx`, `CreatePostDialog.tsx`, `PostEditDialog.tsx`: Vorschlagsquelle = eigene Tags; fremde Tags nur read-only anzeigbar.
- `src/components/SlangTagCanvas.tsx`, `PostDetailOverlay.tsx`, `Messenger.tsx`, `dev.tsx`, `slangtag-ui.ts`: Auflösung strikt über `tagId` (bereits größtenteils der Fall) — Namensauflösung entfernen.
- `src/routes/_authenticated/slangtag.$name.tsx`: Namensroute wird **Gruppenseite** (alle Varianten des Namens, Voting, Community Pick); zusätzlich ID-basierte Variantenansicht (`?v=<id>` oder neue Route) für Deeplinks.
- `slangtag-votes.ts`: Gruppierung auf `normalized_name` umstellen, alle Owner-Typen einbeziehen (nicht nur `kind === "community"`), Primary-Auswahl bleibt score-basiert.
- `SlangTagManager.tsx`, `slangtag-grants.ts`: Einreichung/Freigabe explizit pro `slang_tag.id`, Owner-Anzeige zur Verwechslungsvermeidung.
- Admin (`admin.slangtags.tsx`, `admin.server.ts`): Owner-Spalte + Gruppen-Ansicht, Namensuche liefert mehrere Treffer.

## 5. Backend-Dateien

`src/lib/moderation.server.ts`, `moderation.functions.ts`, `post-moderation.server.ts`, `admin.server.ts`, `account.server.ts` (DSGVO-Export/-Löschung), `testbots.server.ts` — alle arbeiten bereits ID-basiert; zu prüfen sind nur Stellen, die Namen als Schlüssel annehmen, sowie Testbot-Erzeugung (Namenskollision wird künftig legal).

## 6. Datenmigration

Keine Löschungen, keine ID-Änderungen, keine Storage-Pfad-Änderungen.

1. Vorprüfung: Zeilen mit `owner_id IS NULL` (dann aus `creator_id` füllen) und Duplikate je `(owner_id, lower(name))` zählen.
2. `normalized_name` als generierte Spalte hinzufügen (rein additiv).
3. Neuen Unique-Index `(owner_id, normalized_name)` anlegen, erst danach die zwei globalen Namensindizes entfernen.
4. Bestehende Zeilen bleiben unverändert → Posts, Placements, Likes, Saves, Shares, Plays, Votes, Grants, Share-Requests, Arena-Verknüpfungen und Audio-Referenzen bleiben intakt.
5. Frontend-Umstellung erst nach erfolgreicher Migration ausrollen.

## 7. Risiken / Breaking Changes

- **Namensbasierte Auflösung** (`getTag(name)`, `/slangtag/$name`, `SlangText`-Rendering von `$name`) wird mehrdeutig → höchstes Risiko, muss vor dem Entfernen der Unique-Indizes umgestellt sein.
- Fremde Tags dürfen nicht mehr in Vorschlägen erscheinen → Nutzer, die bisher globale Tags verwendet haben, verlieren diese Auswahl (gewollt); bestehende Posts bleiben unberührt.
- Duplikat-Fehlermeldung „Name existiert bereits" muss owner-scoped werden, sonst blockiert der Client legale Namen.
- Zwei Unique-Indizes auf demselben Ausdruck: beide müssen entfernt werden, sonst wirkt die Sperre weiter.
- Owner-Wechsel/Account-Löschung: Unique-Index kann kollidieren, wenn Tags jemals umgehängt werden → Owner-Transfer nicht vorsehen.

## 8. Empfohlene Umsetzungsreihenfolge

1. Client-Auflösung ID-first machen (Namensfallback entfernen), Gruppenseite für `/slangtag/$name`.
2. Vorschlagsquelle auf owner-scoped umstellen (data.tsx, Rules, Input-Komponenten) — noch mit globaler Unique-Regel lauffähig.
3. Migration A: `normalized_name`, `community_shared`, neuer Unique-Index `(owner_id, normalized_name)`.
4. Migration B: globale Namensindizes entfernen.
5. `can_use_slang_tag()` verschärfen + Grant-Pfad prüfen.
6. Voting/Manager/Arena auf Namensgruppen mit Varianten umstellen.
7. Admin- und DSGVO-Pfade nachziehen.
8. Später separat: `slang_globe_entries` und Globe-Anbindung.

## 9. Testplan (Akzeptanztests 1–20)

- Namensduplikate: A, B, C erstellen je `$moin` (Test 1–3), zusätzlich User/Creator/Business-Kombinationen (Test 13–16).
- Vorschläge: jeder Owner sieht beim Erstellen ausschließlich eigene Tags (Test 4, 5, 17–19).
- Fremdnutzung: Post von A mit `UUID_A` ist für B sichtbar und abspielbar (Test 6), aber `UUID_A` erscheint nicht in B's Auswahl und ein Insert mit fremder ID wird serverseitig abgelehnt (Test 7).
- Manager/Voting: unabhängige Einreichung aller Varianten, korrekte Gruppierung bei erhaltenen IDs (Test 8, 9, 20).
- Globe: Gewinnervariante referenziert genau ihre `slang_tag.id` (Test 10).
- Regression: bestehende Posts, Placements, Zähler, Likes/Saves/Shares/Plays/Votes/Grants/Arena, Audio-Upload, 5s/10s-Limits, Moderation, Notifications, Messenger, Admin, DSGVO-Export und -Löschung (Test 11, 12).

## 10. Bewertung

- **ARCHITEKTUR ÄNDERBAR OHNE DATENVERLUST: JA**
- **KRITISCHE MIGRATIONSRISIKEN**: namensbasierte Auflösung (`getTag(name)`, Route `/slangtag/$name`, `$name`-Textrendering); zwei redundante globale Unique-Indizes; clientseitige Duplikatprüfung gegen globale Liste; Vorschlagsquelle = kompletter Tag-Bestand; `can_use_slang_tag()` erlaubt aktuell jeden Community-Tag.
- **EMPFOHLENE UMSETZUNGSREIHENFOLGE**: siehe Abschnitt 8 (erst Client ID-first + owner-scoped Vorschläge, dann additive Migration, dann Entfernen der globalen Eindeutigkeit, danach Rechte, Voting, Admin, zuletzt Globe).
