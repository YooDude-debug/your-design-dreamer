# Realistische KI-Testdaten für Bots (Bilder + Audios)

## Ergebnis der Infrastruktur-Prüfung

Vorhanden und ausreichend – keine neue kostenpflichtige API nötig:

- **KI-Bilder**: Lovable AI Gateway (`/v1/images/generations`, `openai/gpt-image-2`), Key `LOVABLE_API_KEY` ist im Projekt vorhanden.
- **KI-Audio (TTS)**: Lovable AI Gateway (`/v1/audio/speech`) mit mehreren Stimmen; für griechische/englische Aussprache eignen sich die Gemini-TTS-Stimmen bzw. `openai/gpt-4o-mini-tts` mit expliziter Sprach-Instruktion.
- **Speicher**: Supabase-Bucket `media` mit Pfadstruktur `<user_id>/images/...` und `<user_id>/audio/...` (wie in `src/lib/media.ts`).
- **Datenmodell**: `slang_tags` (owner_id, normalized_name, language, region, audio_url, community_shared), `posts` (image_url, slang_tag_ids, placements, region).

Fehlt nichts. Keine Strukturänderung notwendig.

## Aktueller Testdaten-Zustand (geprüft)

- 20 Bot-Profile (`profiles.is_test_bot = true`), davon nur 5 mit SlangTag, 5 mit Post.
- **Kein einziger Bot-Post hat ein Bild** (`image_url` leer).
- Die 5 Bot-SlangTags verweisen auf **Audio-Dateien von @Mario** (Pfad `9ce1d1b0-.../audio/...`) – teils dieselbe Datei doppelt. Das ist für Tests unbrauchbar und vermischt echte mit Testdaten.
- @Mario: 17 echte SlangTags, alle owner-scoped – bleiben unangetastet.

## Geplante Umsetzung

### Phase 1 – Bot-Casting (Sprache/Region getrennt)

12 aktive Bots, Rest bleibt passiv:

- Deutsch: Berlin, Hamburg, Köln, München, Leipzig
- Griechisch: Athen, Thessaloniki (+ Katerini als Region)
- Englisch: London, Manchester, New York
- 1 Business-Bot (Produkt/Laden), 1 Creator-Bot
  Sprache in `profiles.language`, Ort in `profiles.location`, im Tag getrennt `language` + `region`.

### Phase 2 – SlangTags (owner-scoped, sprachlich korrekt)

Nur real existierende Ausdrücke, je Bot 1–3 Tags:

- DE: `$moin`, `$digga`, `$läuft`, `$krass`, `$geil`
- GR: `$re`, `$ela`, `$opa`, `$malaka`
- EN: `$bro`, `$yo`, `$nah`
  Bewusste Dubletten für den Owner-Test: `$moin` bei 3 verschiedenen Bots (Berlin/Hamburg/Köln), `$re` bei 2 griechischen Bots, `$bro` bei 2 englischsprachigen Bots – jeweils eigene `slang_tag.id`, eigenes Audio, eigener Owner.

### Phase 3 – Audio-Generierung

Pro Tag ein eigener TTS-Clip (1–3 s), Stimme und Aussprache passend zur Sprache des Bots (deutsche, griechische, englische Stimmführung; regionale Varianten leicht unterschiedlich in Tempo/Betonung). Upload nach `media/<bot_id>/audio/<uuid>.mp3`, `audio_url` auf die jeweilige `slang_tag.id` gesetzt. Die geliehenen Mario-Audios werden aus den Bot-Tags entfernt.

### Phase 4 – Bild-Generierung

~24 Bilder, thematisch gestreut: Alltag, Essen, Reisen, Stadtleben, Natur, Freizeit, lustige Szene, lokale/kulturelle Szene, Creator-Content, Business/Produkt. Unterschiedliche Perspektiven, Lichtstimmungen, Formate (u. a. 1024×1024, 1024×1536, 1536×1024), realistische Dateigrößen (ca. 150–600 KB nach Optimierung) – kein Platzhalter, keine Riesenfiles. Upload nach `media/<bot_id>/images/<uuid>.jpg`.

### Phase 5 – Posts verknüpfen

Pro aktivem Bot 2–3 Posts: Bild + Beschreibung in Bot-Sprache + `slang_tag_ids` (nur eigene Tags) + `placements` mit relativen %-Positionen + `region`. Jeder Post gehört dem Bot (`user_id`).

### Phase 6 – Interaktionen (ungleich verteilt)

Likes, Kommentare (sprachlich passend), Shares (anonym wie bisher), Views/Plays, Saves, SlangTag-Plays – gestreut, nicht jeder Bot auf jedem Post; einzelne Posts deutlich stärker.

### Phase 7 – Arena / Globe

- `community_shared = true` nur für einen Teil, z. B. `$moin` (Berlin) und `$moin` (Hamburg) → Globe-Kandidaten; `$moin` (Köln) bleibt privat.
- Arena-Challenge mit Einreichungen und Votes, immer über die konkrete `slang_tag.id`.

### Phase 8 – Abschlussprüfung

SQL-Checks: Bild ↔ Post, Owner-IDs bei Posts und Tags, Audio ↔ korrekte `slang_tag.id`, kein Bot-Tag zeigt auf eine Mario-Datei, Sprache/Region gesetzt, mehrere Owner mit gleichem `normalized_name`, Vorschläge liefern nur eigene Tags, Arena/Globe-Referenzen auf konkrete IDs. Plus visueller Check in Feed, Manager, Arena und Globe.

## Schutzmaßnahmen

- Alle Schreibvorgänge ausschließlich gefiltert auf `profiles.is_test_bot = true`.
- @Mario und dessen 17 SlangTags, Medien und Posts bleiben unverändert.
- Keine Migration, keine Schema-Änderung, keine RLS-Änderung.

## Technische Hinweise

- Generierung erfolgt einmalig über ein Skript im Sandbox-Kontext (Gateway-Calls + Storage-Upload), nicht als App-Feature – es entsteht kein neuer Laufzeitcode in der App.
- Kosten: ~24 Bilder (quality `low`) + ~20 kurze TTS-Clips über Lovable-Credits.
