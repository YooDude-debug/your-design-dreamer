# Testdaten-Reset + owner-scoped SlangTag-Struktur

## Analyse-Ergebnis (Ist-Stand, nichts geändert)

28 Profile insgesamt. Genau **ein** echtes Konto: **@Mario** (Admin). Alle anderen 27 Profile sind eindeutig als Test-/Bot-Konten registriert (in der Testkonten-Liste hinterlegt):

- 20 Bot-Konten (`bot_amelie` … `bot_zeynep`), als Testbot markiert
- 7 weitere Testkonten: `business_test`, `creator_test`, `deniz_b`, `lina_hh`, `mia_koeln`, `sam_ldn`, `yannis_ath`

Datenbestand:

| Bereich                                                  | Menge               | Zuordnung                             |
| -------------------------------------------------------- | ------------------- | ------------------------------------- |
| Beiträge                                                 | 20                  | **alle** von 10 Bots (je 2)           |
| Kommentare                                               | 10                  | 9 von Bots, 1 von @Mario              |
| Likes / Shares / Saves / Aufrufe                         | 131 / 54 / 41 / 251 | ausschließlich rund um Bot-Beiträge   |
| SlangTag-Plays                                           | 223                 | auf Mario-Tags + Testkonten           |
| SlangTags                                                | 18                  | 17 @Mario, 1 `yannis_ath` (Testkonto) |
| Arena-Challenge                                          | 1                   | von @Mario, 0 Einreichungen, 0 Votes  |
| Werbepausen                                              | 4                   | 3 @Mario, 1 `yannis_ath`              |
| Unterhaltung                                             | 1                   | von @Mario, 0 Nachrichten             |
| Freigaben / Anfragen / Tag-Likes / Tag-Votes / Kampagnen | 0                   | —                                     |

Struktur-Check der 17 Mario-SlangTags: alle haben `owner_id = creator_id = @Mario`, korrekten `normalized_name`, gültige Audio-Referenz, passenden `owner_type` (16× `user`/community, 1× `creator`). **Keine Migration nötig** — die owner-scoped Struktur ist bereits sauber. Ein Tag (`Looll`) ist bereits gelöscht markiert.

Nicht eindeutig zuordenbar → wird **nicht** angetastet:

- Zähler `plays_count` in Mario-Tags (Mischung aus eigenen Tests und Bot-Plays)
- Die 4 Mario-eigenen SlangTags mit Namen wie `test3`, `jaj`, `jajaj` sehen nach Wegwerf-Tags aus, gehören aber dem echten Konto → **Rückfrage** statt Löschung.

## Was gelöscht wird (Phase 2)

Nur Daten, deren Urheber ein Test-/Bot-Konto ist, in dieser Reihenfolge (Abhängigkeiten von innen nach außen):

1. Interaktionen zu Bot-Beiträgen: Likes, Shares, Saves, Aufrufe, Kommentare (inkl. Antworten)
2. Beitrags-Hashtag-Verknüpfungen, Moderations-Jobs, Originale
3. Die 20 Bot-Beiträge
4. SlangTag-Interaktionen von Testkonten: Plays, Likes, Saves, Shares, Votes, Freigaben
5. Der SlangTag von `yannis_ath`
6. Arena: Einreichungen/Votes/Kommentare/Awards (aktuell leer), Test-Challenge von @Mario nur nach Freigabe
7. Feed-/Interessen-Lernsignale und Vorschläge der Testkonten
8. Benachrichtigungen der Testkonten
9. Werbepause von `yannis_ath`
10. Leere Test-Unterhaltung

## Was erhalten bleibt

- Konto @Mario komplett (Profil, Rollen, Einstellungen)
- Alle 17 SlangTags von @Mario inkl. Audio, Bedeutung, Region, Sichtbarkeit
- Der eine Kommentar von @Mario nur, falls sein Beitrag bleibt — er hängt an einem Bot-Beitrag und wird daher mit gelöscht (Hinweis: unvermeidbar, referenziell)
- Alle Test-/Bot-Konten selbst bleiben bestehen (werden in Phase 4+ wiederverwendet)
- Rechtliche Daten, Newsletter, Audit-Protokoll

## Phase 3 – Admin-SlangTags

Kein Migrationsbedarf. Es wird lediglich eine Prüfung protokolliert: `owner_id`, `owner_type`, `normalized_name`, `creator_id`, Audio-Referenz, Freigaben. Gleiche Owner-Logik wie für User/Creator/Business — keine Sonderbehandlung.

Zähler-Bereinigung (`plays_count` etc.) der Mario-Tags: **nur auf ausdrücklichen Wunsch**, da nicht trennbar.

## Phase 4–9 – neue Testdaten

- Je Bot ein eigener SlangTag über die reguläre Struktur; bewusst dreimal `$moin` (Bot A/B/C) plus `$yolo`, `$digga` → prüft owner-scoped Eindeutigkeit und dass es keine globale Namenssperre gibt
- Je Bot ein Beitrag mit **eigenem** Tag; Vorschlagslogik gegenprüfen (eigene ja, fremde nein, fremde Variante in veröffentlichtem Beitrag weiterhin abspielbar)
- Kommentare inkl. Antworten, Likes/Shares/Plays/Saves (Shares bleiben anonym)
- Arena: Challenge → Einreichung mit **konkreter Tag-ID** (nicht Name) → Voting; Kontrolle, dass ID A ≠ ID B bei gleichnamigen Tags
- Globe-Vote: gleiche Prüfung auf Variantentrennung

## Phase 10 – Werbepause @Mario

Die 3 Werbepausen-Einträge von @Mario werden entfernt → volles Monatskontingent (3 von 3), keine aktive Pause. Sonst wird am Konto nichts verändert.

## Phase 11 – Abschlussprüfung

Kontrollabfragen zu: owner-scoped Gleichnamigkeit über User/Creator/Business, Arena-Einreichung mit konkreter ID, Vorschlagsverhalten, Mario-Tag-Bestand, Werbepausen-Zustand. Ergebnis als kurzer Bericht.

## Rückfragen vor Ausführung

1. Mario-eigene Wegwerf-Tags (`test3`, `jaj`, `jajaj`, `lalalal`, `noraa`) — behalten oder löschen?
2. Test-Arena-Challenge von @Mario — löschen und neu erzeugen, oder behalten?
3. Zähler (`plays_count`) der Mario-Tags auf 0 zurücksetzen oder unverändert lassen?

## Technische Details

Löschungen laufen als Datenoperationen (kein Schema-Eingriff), gefiltert über `profiles.is_test_bot` bzw. Zugehörigkeit zur Testkonten-Tabelle, nie über Namensmuster. Neue Testdaten werden über dieselben Pfade erzeugt, die die App nutzt, damit Trigger (Zähler, Hashtags, Moderationsstatus, Owner-Zwang) exakt greifen.
