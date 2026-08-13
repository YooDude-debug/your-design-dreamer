# Y-Dude – Analyse Datenbank-, Daten- und Medienarchitektur (Aug 2026)

## A. Was bereits gut ist

- **SlangTag ist eine eigenständige Entität** (`slang_tags`): Audio (`audio_url`), Ersteller (`creator_id`),
  Eigentümer (`owner_id`), Region, Sprache, Bedeutung, Moderation. Unique-Index `(owner_id, normalized_name)`.
  Beiträge referenzieren nur IDs → **keine Audio-Duplikate**, ein SlangTag ist beliebig oft wiederverwendbar.
- **Darstellung getrennt von Entität**: Position/Größe/Rotation/Variante liegen pro Beitrag in `posts.placements`
  (jsonb, `{tagId,x,y,scale,rotation,variant}`). Derselbe SlangTag kann in vielen Beiträgen unterschiedlich
  platziert sein, ohne Kopie.
- **Medien klar getrennt**: `posts.image_url` (Foto/GIF, verpixelte Publikationsversion), `posts.video_url`
  (stummes 5-s-Short), `posts.video_duration_ms`, privates Original in `post_originals`. Audio kommt
  ausschließlich vom SlangTag.
- **Storage** (Bucket `media`, privat, signierte URLs): `{userId}/images/…`, `{userId}/videos/…`,
  `{userId}/audio/…` plus abgeleitete Varianten (`__thumb`, `__medium`, `__s` Share-Preview).
  Struktur ist bereits nachvollziehbar → **keine Migration nötig**.
- **Events statt Doppelbuchung** bei teuren Zählern: `post_views` und `slang_tag_plays` schreiben in
  `counter_events` und werden gebatcht per `flush_counter_events()` aggregiert.
- **Beziehungen sauber per FK + ON DELETE CASCADE** (Likes, Kommentare, Views, Video-Views, Saves, Shares,
  Hashtag-Verknüpfungen, Nutzungen). Löschen eines Beitrags/SlangTags hinterlässt keine Waisen.
- **Fall A/B der Video-SlangTags** war bereits korrekt: neu aufgenommene SlangTags werden einmalig in
  `slang_tags` angelegt, das Video referenziert nur die ID.

## B. Was redundant war

- `posts.hashtags` (text[]) neben `post_hashtags` – bewusste Denormalisierung, per Trigger synchron gehalten.
  Belassen (Feed-Rendering ohne Join).
- `posts.slang_tag_ids` neben `posts.placements` – wird für Rechteprüfung/Filter gebraucht. Belassen.
- `posts.audio_url` – Legacy-Feld für Beitrags-Audio, kein SlangTag-Duplikat. Belassen.

## C. Was optimiert wurde

1. **Jahres-/Regionszuordnung galt nur für Videos.** `slang_tag_video_uses` erfasste ausschließlich
   Video-Nutzungen → Foto-Beiträge fehlten im Slang Globe. Ergänzt: Spalte `media_type ('image'|'video')`,
   die Tabelle ist jetzt das einheitliche **Nutzungsjournal** (tag_id, post_id, user_id, region, **year**,
   media_type). Keine neue Tabelle.
2. **Pflege war anwendungsseitig und lückenhaft** (nur beim Erstellen von Videos, nicht beim Bearbeiten/
   Entfernen von SlangTags). Neu: DB-Trigger `posts_sync_slang_tag_uses` pflegt die Nutzungen bei
   INSERT/UPDATE/DELETE. Das `year` einer bestehenden Nutzung wird **nie** überschrieben → Archiv vergangener
   Jahrgänge bleibt unveränderlich.
3. **Widersprüchliche Zähler beseitigt.** `uses_count` wurde vom alten Trigger `posts_tag_uses` nur beim
   Erstellen/Löschen eines Beitrags verändert, nicht beim Bearbeiten. Jetzt sind `uses_count` und
   `video_uses_count` **ausschließlich** aus dem Nutzungsjournal abgeleitet
   (`slang_tag_uses_counters`), Bestand wurde einmalig exakt neu berechnet.
4. **Indizes ergänzt**: `posts` GIN auf `slang_tag_ids`, `(moderation_status, created_at DESC)` für den Feed,
   Partial-Index für Video-Beiträge, `slang_definitions (country, region_name, city)` für die kaskadierenden
   Standortfilter, `slang_tag_video_uses (user_id, year)` und `(media_type, year)` für Globe-/Jahresabfragen.
5. **Sicherheit**: die beiden neuen SECURITY-DEFINER-Trigger-Funktionen sind für `anon`/`authenticated`
   nicht direkt aufrufbar (EXECUTE entzogen). Bestehende RLS/Storage-Regeln unverändert.

## D. Bewusst nicht geändert

- Keine Umbenennung von `slang_tag_video_uses` (bestehende Typen/Policies/Indizes bleiben gültig).
- Keine Auflösung der Denormalisierungen aus B (Feed-Performance).
- Keine Storage-Migration, keine Datenlöschung, keine RLS-Lockerung.

## E. Ergebnis

Foto → Storage + User + SlangTag-Referenz. Video → ≤5 s, stumm, SlangTag-Referenz, Position separat in
`placements`. Neuer SlangTag aus Video → einmaliger Datensatz. Slang Globe → Region + Jahr über das
Nutzungsjournal je Beitrag/SlangTag eindeutig nachvollziehbar. Statistiken → eine Quelle je Kennzahl.
