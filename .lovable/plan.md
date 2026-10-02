# ORB Core – Visuelles Langzeitgedächtnis (Plan nach Bestandsaufnahme)

Die Bestandsaufnahme lief nur lesend. Nichts wurde geändert, nichts veröffentlicht.

## Befund (Phase 0)

- **Bilder heute:** Hochgeladene Bilder werden geprüft (PNG/JPEG/WEBP/GIF, max. 3 × 5 MB), als Data-URL an das Modell geschickt und nur für die Sitzung angezeigt. ORB-generierte Bilder sind ebenfalls nur für die Sitzung da. In `orb_visual_generations` steht nur der Prompt-Hash, nie das Bild.
- **Speicher:** Es gibt genau einen privaten Speicherbereich namens `media`. Regeln: Schreiben und Löschen nur im eigenen Ordner `<user_id>/…`. Signierte URLs mit kurzer Laufzeit werden schon an mehreren Stellen genutzt.
- **WebP:** Die Umwandlung gibt es nur im Browser (Canvas in `src/lib/media.ts`). Auf dem Server laufen keine Bildbibliotheken wie sharp.
- **Erinnerungen:** `orb_nodes` (id, scope, user_id, lifecycle …). „Vergessen“ löscht nichts, sondern stuft nur `lifecycle` herab. Gelöscht wird nur beim Löschen des Kontos (`account.server.ts`).
- **Scopes:** Laufen über `scopedDb`/`createOrbCore`. Ein Trigger prüft den Scope bei Verbindungen.

## Entscheidung, die Ihre Freigabe braucht: Wer ordnet ein Bild einer Erinnerung zu?

Vorschlag **A (konservativ, empfohlen):** Die Zuordnung entsteht nur, wenn in **derselben Nachricht** ein Bild hängt **und** die vorhandene Hintergrund-Auswertung (ohne zusätzlichen Modellaufruf) daraus eine Erinnerung erzeugt oder verstärkt. Das Modell muss im vorhandenen Antwortschema ausdrücklich `image_refs` je Kandidat angeben. Der Server akzeptiert nur Bild-IDs, die zu genau dieser Nachricht gehören. Fehlt die Angabe, bleibt das Bild unzugeordnet.
Option **B:** Zusätzlich kann der Nutzer in der Erinnerungs-Detailansicht ein Bild verknüpfen oder lösen.
Zeitliche Nähe allein führt nie zu einer Zuordnung.

## Umsetzung

### Phase 1 – Assets
- Neue Tabelle `orb_visual_assets` mit: id, user_id, scope, storage_path, mime_type, file_size, sha256, source_type (`user_upload|orb_generated|unknown`), source_message_id, origin_status, created_at.
  - Eindeutig über (user_id, scope, sha256) – so werden Duplikate erkannt, aber nie über Nutzer oder Scopes hinweg zusammengelegt.
- Speicherort: im bestehenden privaten Bereich `media`, Pfad `<user_id>/orb/<scope>/<sha256>.webp`.
- **WebP:** Der Browser wandelt das Bild vor dem Hochladen um. Der Server prüft dann Format (Magic Bytes), Größe und den sha256-Hash neu. Geht die Umwandlung nicht, wird das geprüfte Original gespeichert, mit dem echten mime_type. Zusätzliche Originale werden nicht aufbewahrt.
- Generierte Bilder: Der Server speichert sie direkt als `orb_generated` (vom Modell kommt PNG; eine serverseitige WebP-Umwandlung ist im Worker nicht sicher möglich, deshalb bleibt es PNG).
- Reihenfolge: zuerst in den Speicher hochladen, dann die Zeile anlegen. Schlägt der Upload fehl, gibt es keine Zeile und keine Verknüpfung (Test 14).

### Phase 2 – Verknüpfung
- Neue Tabelle `orb_memory_images` (memory_id → orb_nodes ON DELETE CASCADE, image_id → orb_visual_assets ON DELETE CASCADE, user_id, scope, created_at, basis). Primärschlüssel ist (memory_id, image_id).
- Ein Trigger prüft, dass Erinnerung und Asset denselben Nutzer und denselben Scope haben.
- Der Erinnerungsinhalt bleibt unverändert, `metadata` wird nicht angefasst.

### Phase 3 – Abruf
- `retrieveCandidates` liefert für die tatsächlich genutzten Erinnerungen deren verknüpfte Bild-IDs (eine zusätzliche Abfrage, über scopedDb).
- Der Server erstellt dafür signierte URLs mit 10 Minuten Laufzeit. Der Chat zeigt sie als „Bild aus Erinnerung vom …“ mit Herkunftsangabe.
- Der Prompt bekommt nur den Hinweis „zu dieser Erinnerung existieren N Bilder“. Bildbytes gehen nicht automatisch an das Modell, damit keine Mehrkosten entstehen.
- Unzugeordnete Bilder werden nie als Beleg ausgegeben.

### Phase 4 – Wissensgraph
- In der Detailansicht einer Erinnerung erscheinen Vorschaubilder mit Herkunft (Nutzer/ORB-generiert) und Status.
- Am Knoten gibt es nur ein kleines Bild-Symbol. Es entstehen keine neuen Verbindungen oder Animationen.

### Phase 5 – Sicherheit und Löschen
- RLS: Nur der Eigentümer darf lesen, einfügen und löschen, jeweils mit Scope-Prüfung in jeder Serverfunktion.
- Öffentliche URLs gibt es nicht. In den Logs stehen nur IDs.
- Löschen eines Bildes: Verknüpfungen werden mitgelöscht (Cascade), das Speicherobjekt entfernt der Server.
- Löschen einer Erinnerung entfernt nur die Verknüpfung, das Bild bleibt erhalten.
- Neue Liste „Nicht zugeordnete Bilder“ mit Löschen-Knopf. Das Löschen des Kontos räumt den Ordner `orb/` mit ab.

### Phase 6 – Tests
Neue Datei `tests/orb-visual-memory.test.ts` mit allen 14 geforderten Fällen. Die bestehenden ~2.333 Tests müssen grün bleiben. Für RLS gibt es zusätzlich eine echte Datenbankprüfung mit zwei Testnutzern über read_query/Policies.

## Betroffene Dateien
- Neu: `src/orb-core/visual/assets.server.ts`, `src/orb-core/visual/memory-images.ts`, `src/integrations/y-dude-orb/visual-memory.functions.ts`, `src/components/orb/OrbMemoryImages.tsx`, Testdatei
- Geändert: `OrbChat.tsx` (Hochladen nach dem Senden), `orb-chat-bridge.functions.ts`, `analysis/analyze.server.ts` + `apply.server.ts` (image_refs), `engine.server.ts` (Abruf), `visual/generate.server.ts` (speichern), die Detailansicht im Graphen, `account.server.ts`, `AGENTS.md`
- Eine Migration mit 2 Tabellen, Grants, RLS und dem Scope-Trigger. Keine Änderung an bestehenden Tabellen oder alten Daten.

## Risiken und Kosten
- Die Tabellen landen in der gemeinsamen Datenbank, also auch in der Live-App (leer, bis veröffentlicht wird).
- Das Modell setzt `image_refs` womöglich selten. Dann bleiben Bilder unzugeordnet, das ist sicher, aber weniger nützlich.
- Speicher: ca. 100–400 KB pro Bild in WebP. Abruf: nur signierte URLs, keine Modellkosten.
- Das Antwortschema der Auswertung wird etwas länger (wenige zusätzliche Eingabe-Token).

Keine Veröffentlichung. Am Ende kommt ein Bericht mit der Trennung implementiert / getestet / lokal / Runtime / deployed.
