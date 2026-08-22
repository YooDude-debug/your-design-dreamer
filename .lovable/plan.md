# Plan: Bildvarianten zuverlässig sicherstellen (`__t` / `__m`)

Bestätigte Ursache: Die Varianten werden ausschließlich im Browser des Uploaders erzeugt (`createVariants` → `renderVariant`, Canvas + `toBlob("image/webp")`) und schlagen dort **still** fehl (`console.warn` und weiter). Fehlen `__t`/`__m`, lädt der Feed das Original – im Messfall ein 2,0-MB-JPEG – daher leere/schwarze Flächen, spätes Erscheinen, Ruckeln beim Decode.

Ziel: Varianten werden garantiert vorhanden sein, ohne Feed-, Upload-UX-, SlangTag-, Like-, Kommentar- oder Scrollverhalten zu verändern.

---

## 1. Serverseitiger Backstop

Neuer Server-Function-Pfad, der nach jedem erfolgreichen Bild-Upload greift:

- `src/lib/media-variants.functions.ts` – `ensureImageVariants({ path })`, authentifiziert über `requireSupabaseAuth`.
  - Prüft, dass `path` mit `<auth.uid()>/` beginnt (kein Fremdzugriff).
  - Listet die vorhandenen Objekte im Ordner und prüft `__t.webp` / `__m.webp`.
  - Fehlt eine Variante: Original herunterladen, verkleinern, unter dem konventionellen Namen hochladen (`upsert: false`).
  - Antwort: `{ thumb: "ok"|"created"|"failed", medium: ..., reason? }`.
- `src/lib/media-variants.server.ts` – reine Bildarbeit, getrennt vom RPC-Wrapper.
  - **Wichtig für die Laufzeit:** `sharp`/`canvas` sind im Worker-Runtime nicht verfügbar. Verwendet wird ein WASM-Decoder/Encoder-Paar (`@jsquash/jpeg`, `@jsquash/png`, `@jsquash/webp`, `@jsquash/resize`), das build-time gebündelt wird. Vorab-Check: Bundle-Größe und Worker-Startzeit messen; falls das WASM zu schwer ist, Fallback-Variante B (unten).
  - Speicherschutz: Originale > ~12 MP bzw. > 8 MB werden nicht dekodiert, sondern als „zu groß“ gemeldet (kein Worker-OOM).
- Aufrufstelle: `createVariants()` in `src/lib/media.ts` ruft nach seinem eigenen Versuch (Erfolg *oder* Fehler) `ensureImageVariants({ path })` „fire and forget“ auf. Die clientseitige Erzeugung bleibt unverändert erhalten und bleibt der schnelle Normalweg.

**Fallback-Variante B (falls WASM im Worker nicht tragfähig ist):** Backstop erzeugt keine Pixel, sondern schreibt den Pfad in eine Reparaturtabelle (Punkt 2) und der Client versucht die Erzeugung beim nächsten Anzeigen des eigenen Beitrags erneut (einmalig, mit Deckelung). Entscheidung fällt im ersten Implementierungsschritt anhand einer Messung, nicht als Vermutung.

## 2. Fehlerbehandlung statt stillem Fehlschlag

- Neue Tabelle `public.media_variant_jobs`: `path` (PK), `owner_id`, `needs_thumb`, `needs_medium`, `attempts`, `last_error`, `status` (`pending` | `done` | `failed`), `created_at`, `updated_at`. RLS: Besitzer darf eigene Zeilen lesen; Insert/Update nur über `SECURITY DEFINER`-RPC bzw. Service-Role. Grants für `authenticated` (SELECT) und `service_role` (ALL).
- Client: `renderVariant`-Fehler werden nicht mehr nur geloggt, sondern melden den Pfad an den Backstop (der die Zeile anlegt). Logs erhalten eine Ursache: `webp-unsupported`, `canvas-null`, `decode-failed`, `toblob-null`, `upload-failed`, `too-large`.
- Retry: maximal **3** Versuche pro Pfad, exponentieller Abstand (sofort / nächster Aufruf nach ≥ 1 min / ≥ 10 min). Danach `status = failed` – **kein Endlos-Retry**, kein Retry-Loop im Render-Pfad.
- Endgültiger Fehlschlag: Datensatz bleibt gültig, Feed nutzt den Fallback (Punkt 4), Admin sieht die Zeile. Der Nutzer bekommt keinen Fehler zu sehen – der Beitrag bleibt sichtbar.
- Sichtbarkeit: kleine Liste „Medien ohne Varianten“ im bestehenden Admin-Cockpit (nur lesend, keine Änderung bestehender Admin-Logik).

## 3. Bestehende Daten (Bestandsreparatur)

Reihenfolge strikt: **erst zählen, dann reparieren.**

1. Read-only Inventur (nur Abfragen, keine Schreibvorgänge) über `posts.image_url`, `profiles.avatar_url`, `profiles.cover_url`: Anzahl Datensätze gesamt, fehlende `__t`, fehlende `__m`, vollständige, Summe der Originalgrößen, geschätzter Zusatzspeicher (`__t` ≈ 20–40 KB, `__m` ≈ 80–250 KB pro Bild). Aktueller Stand der Voranalyse: 22 Bild-Beiträge, 1 ohne `__t`/`__m`, 2/2 Avatare ohne `__t`.
2. Reparatur läuft **nicht** als SQL-Migration (SQL kann keine Bilder rendern), sondern über eine admin-geschützte Server-Function `repairMissingVariants({ limit })`, die den Backstop batchweise (z. B. 20 Pfade) anwendet und das Ergebnis zurückgibt. Idempotent, abbrechbar, wiederholbar.
3. Originale werden **niemals** gelöscht oder überschrieben; Uploads ausschließlich unter neuen `__t`/`__m`-Namen mit `upsert: false`.
4. Migration umfasst nur die Tabelle aus Punkt 2 (Schema + Grants + RLS), keine Datenveränderung an Beiträgen.

## 4. Feed-Fallback verbessern (ohne Feed-Komponenten anzufassen)

Änderungen bleiben in `src/lib/media.ts` (`postPreviewImage`, `postFullImage`) und in `src/lib/data.tsx` (Signier-Listen) – die Feed-Komponenten selbst bleiben unverändert, weil sie diese Helfer schon benutzen.

- Vorschau-Reihenfolge: `__t` → `__m` → `__s` (nur wenn getaggt und vorhanden) → Original. Beiträge mit Placements behalten aus Geometriegründen weiterhin `__m` vor `__t`.
- Neu: Bevor auf ein **Original** zurückgefallen wird, wird der Backstop einmal (pro Sitzung und Pfad) angestoßen, damit der nächste Aufruf eine kleine Variante bekommt.
- Signierhygiene: Der bestehende `missingCache` bleibt; zusätzlich werden Pfade, die als „endgültig fehlend“ bekannt sind, gar nicht mehr in die Signier-Batches aufgenommen. Damit verschwinden die wiederholten `sign skipped`-Warnungen.

## 5. `__s` Share-Vorschau

- `sharePreviewPath()` wird in `src/lib/data.tsx` (Zeilen 615, 742, 1548, 1627) nur noch aufgerufen, wenn der Beitrag `placements.length > 0` hat.
- Ergebnis: Für die 15 Beiträge ohne SlangTags entfällt jede `__s`-Signieranfrage; `postShareImage` fällt wie bisher sauber auf `postFullImage` zurück. Kein Verhalten für getaggte Beiträge verändert.

## 6. Warum die Client-Erzeugung auf dem betroffenen Gerät ausfällt

Untersuchungsraster für die Implementierung – jede Ursache erhält einen eigenen Fehlercode aus Punkt 2:

- **WebP-Encoding:** `canEncodeWebp()` prüft `toDataURL`. Manche Android-WebViews melden WebP-Support, liefern aber bei `toBlob("image/webp")` `null` → aktuell stiller Abbruch. Gegenmaßnahme: Fallback auf `image/jpeg` für `__t`/`__m`-Inhalt ist **nicht** vorgesehen (Namenskonvention `.webp`), stattdessen greift der Backstop.
- **Canvas-Speicherlimits:** iOS/Safari begrenzt Canvas-Fläche (ca. 16,7 MP) und iOS-WebViews leeren Canvas-Backing-Stores unter Speicherdruck – Ergebnis: leerer/`null`-Blob. Große Handy-Fotos (12–50 MP) treffen genau das.
- **Decode-Fehler:** `loadImage()` scheitert bei HEIC-artigen oder CMYK-JPEGs sowie bei sehr großen Data-URLs → `reject("decode failed")` landet im `catch` von `createVariants`.
- **Speicherverbrauch:** Der Upload läuft über Data-URLs (Base64, ~33 % Overhead). Ein 2-MB-Foto belegt so mehrfach Speicher; auf schwachen Androids beendet der Browser den Tab-Renderer oder verwirft den Canvas.
- **Tab-/App-Wechsel:** Wird die App während der Variantenerzeugung in den Hintergrund geschickt, drosselt der Browser `toBlob` bzw. bricht ab; der Upload des Originals ist dann bereits durch.
- **Upload-Erfolgsdefinition:** Der Upload gilt künftig erst als abgeschlossen, wenn entweder die Varianten geschrieben sind **oder** der Backstop den Pfad quittiert hat (`created` oder `pending` in der Jobtabelle). Der Nutzer wartet dabei nicht – die Quittung erfolgt asynchron, der Beitrag erscheint sofort.

## 7. Sicherheit

- Keine Änderung an Bucket-Sichtbarkeit oder Storage-Policies. `media` bleibt privat.
- Der Backstop läuft serverseitig; erhöhte Rechte werden erst nach `requireSupabaseAuth` und Pfad-Ownerprüfung (`path` beginnt mit der eigenen User-ID) bzw. für die Bestandsreparatur nach `has_role(..., 'admin')` verwendet.
- Varianten erben die Zugriffslogik des Originals: Zugriff ausschließlich über kurzlebige signierte URLs, TTL unverändert.
- Keine neuen öffentlichen Endpunkte; keine `anon`-Grants.

## 8. Erfolgskriterien (messbar)

1. Neue Bild-Uploads: `__t` und `__m` in 100 % der Fälle vorhanden – geprüft per Storage-Abfrage nach dem Test-Upload auf Desktop, Android und iOS.
2. Erzwungener Client-Fehler (WebP-Encoder deaktiviert): Varianten existieren danach trotzdem, Jobzeile `status = done`.
3. Bestandsreparatur: Anzahl Datensätze ohne `__t`/`__m` sinkt auf 0; Anzahl Originale unverändert.
4. Feed lädt bevorzugt kleine Varianten: kein Media-Request > 400 KB im Feed-Netzwerkprotokoll.
5. Keine `__s`-Signieranfrage für Beiträge ohne Placements (Konsole leer).
6. Keine schwarzen/leeren Medienflächen beim Scrollen über 30 Karten.
7. Keine wiederholten `sign skipped`-Warnungen für denselben Pfad.
8. Feed, Upload, SlangTags, Likes, Kommentare, Scroll-/Ankerverhalten unverändert.

---

## A) Benötigte Codeänderungen

| Datei | Änderung |
|---|---|
| `src/lib/media-variants.server.ts` (neu) | WASM-Decode/Resize/Encode, Größenlimits, Upload der Varianten |
| `src/lib/media-variants.functions.ts` (neu) | `ensureImageVariants`, `repairMissingVariants` (admin), `reportVariantFailure` |
| `src/lib/media.ts` | `createVariants` meldet Fehlerursachen und ruft den Backstop; `postPreviewImage`/`postFullImage` mit neuer Fallbackkette; Signier-Hygiene |
| `src/lib/data.tsx` | `sharePreviewPath` nur bei `placements.length > 0` (4 Stellen) |
| Admin-Cockpit (nur additive Leseansicht) | Liste „Medien ohne Varianten“ |

## B) Backend-/Storage-Komponenten

- Bucket `media`: unverändert, privat, keine neuen Policies für Lesezugriffe.
- Tabelle `public.media_variant_jobs` inkl. GRANTs (`authenticated` SELECT, `service_role` ALL) und RLS (Besitzer sieht eigene Zeilen).
- Neue Abhängigkeiten: `@jsquash/*` (WASM, Worker-taugliche Builds) – vor dem Einbau Bundle-/Startzeitmessung.

## C) Migration

Genau eine Migration, ausschließlich Schema: `media_variant_jobs` + GRANTs + RLS + Index auf `status`. Keine Datenveränderung, keine Storage-Policy-Änderung, keine Löschung. Die Bestandsreparatur läuft danach als steuerbarer, wiederholbarer Server-Aufruf.

## D) Risiken

- **WASM im Worker:** Bundle-Größe und Kaltstartzeit; Mitigation: Messung zuerst, sonst Fallback-Variante B.
- **Doppelte Erzeugung:** Client und Backstop gleichzeitig → `upsert: false` und Existenzprüfung verhindern Überschreiben.
- **Speicherwachstum im Bucket:** zwei zusätzliche Dateien pro Bild; laut Inventur gering, wird vorab beziffert.
- **Qualitätsunterschiede** zwischen Canvas- und WASM-Encoder → gleiche Zielmaße/Qualitätsstufen (300 px cover / 1080 px, q 0,72 / 0,82).
- **Zusätzliche Requests** beim ersten Fallback → auf einmal pro Pfad und Sitzung begrenzt.
- **Sehr große Originale** bleiben ohne Variante → bewusst `status = failed` statt Worker-Absturz; Feed nutzt Original wie heute.

## E) Testplan

1. **Unit:** `variantPath`, `sharePreviewPath`, neue Fallbackkette (mit/ohne `__t`, `__m`, `__s`, mit/ohne Placements).
2. **Upload-Matrix:** JPEG 2 MB, PNG 8 MB, 12-MP-Foto, WebP, Bild mit 3 SlangTags – je Desktop-Chrome, Android-Chrome, iOS-Safari; danach Storage-Prüfung auf `__t`/`__m` (und `__s` nur bei Tags).
3. **Fehlerinjektion:** `canEncodeWebp` künstlich `false`, `toBlob` künstlich `null`, Netzabbruch während Variantenupload → Varianten müssen trotzdem entstehen, `attempts ≤ 3`, danach `failed`.
4. **Bestandsreparatur:** Inventur-Zahlen vor/nach, Originalanzahl konstant, zweiter Durchlauf ändert nichts (Idempotenz).
5. **Feed-Messung** (Playwright, Phone/Tablet/Desktop): kein Media-Request > 400 KB, keine `sign skipped`-Wiederholung, keine leeren Kartenflächen über 30 Karten, Scroll-Anker weiterhin 0 px Drift.
6. **Regression:** Login, Feed-Tabs, Beitrag öffnen/schließen, Likes, Kommentare, SlangTag-Audio, Messenger-Bild, Globe, Arena, Ad-Pause, Admin.
7. **Sicherheit:** Fremder Pfad an `ensureImageVariants` → abgelehnt; `repairMissingVariants` ohne Admin-Rolle → abgelehnt; Varianten ohne signierte URL nicht abrufbar.
