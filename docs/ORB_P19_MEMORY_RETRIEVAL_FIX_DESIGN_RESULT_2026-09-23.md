# P19 – Minimaler Memory-Retrieval-Fix / Design Review

Datum: 2026-09-23 · Modus: READ-ONLY · Referenz: `docs/ORB_P18_MEMORY_RETRIEVAL_FORENSIC_RESULT_2026-09-23.md`

**Status: NUR ENTWURF. Kein Patch angewendet, keine Datenänderung, keine Migration, kein Deployment, 0 Modellaufrufe.**

---

## 1. Antworten auf die Prüffragen A–F

### A) Wo wird der einzelne Bereich/das Stichwort einer Memory bestimmt?

Zwei getrennte Mechanismen, die im Bericht bisher oft vermischt wurden:

| Mechanismus | Ort | Zweck | Kardinalität |
| --- | --- | --- | --- |
| `topic` | `src/orb-core/memory.ts:501-508` (`topicOf`) | Kandidatensuche in der DB (`orb_nodes.topic`), Interessenmodell | **genau eins** (erster Treffer in `TOPIC_KEYWORDS`, sonst erstes Inhaltswort) |
| Informationsbereich | `src/orb-core/recall.ts:42-49` (`infoDomainOf`) | Untergrenze `topicAffinity` = 0.12 bei Bereichsgleichheit | **genau eins** (erster Treffer in `DOMAIN_PATTERNS`) |

### B) Wird das Stichwort dauerhaft gespeichert oder beim Retrieval erzeugt?

- `topic`: **dauerhaft gespeichert** in `orb_nodes.topic` (einmal beim Anlegen des Knotens berechnet). Der Sammelknoten trägt dauerhaft `hardware`.
- Informationsbereich: **nur zur Laufzeit** aus dem Text berechnet (`infoDomainOf(n.content)` in `engine.server.ts:934`). Er steht nirgends in der DB → an dieser Stelle ist eine Erweiterung **datenkompatibel und ohne Migration** möglich.

### C) Kann eine Memory bereits mehrere Bereiche tragen?

- In der DB: **nein** (eine Spalte `topic`, ein Wert).
- Im Code: **teilweise ja** — `topicsOf` (`memory.ts:511-519`) liefert bereits *alle* erkennbaren Themen, wird aber ausschliesslich für Feed-/Interessenvergleiche benutzt, nicht im Memory-Retrieval. Für Informationsbereiche existiert kein Mehrfach-Pendant.

### D) Kann die bestehende Retrieval-Struktur minimal erweitert werden?

Ja. `retrieveCandidates` (`engine.server.ts:645-728`) ist bereits eine Sammlung mehrerer begrenzter Abfragen, deren Ergebnisse per `Map` vereinigt werden (`byId`, Zeile 721-727). Ein weiterer, gleich begrenzter Kandidatenkreis fügt sich ohne Umbau ein. Die Rangfolge, `memoryRelevance`, der harte Filter `overlap > 0` (Zeile 959) und `selectByLevel` bleiben unberührt.

### E) Warum wird beim Retrieval nur der erste Bereich verwendet?

Zwei Ursachen, beide „erster Treffer gewinnt":
1. `topicOf` gibt beim ersten passenden Eintrag von `TOPIC_KEYWORDS` zurück (Reihenfolge: `hardware` vor `gaming` vor `essen`) → Sammelknoten = `hardware`, Koch-Satz = `gaming`.
2. `infoDomainOf` gibt beim ersten passenden `DOMAIN_PATTERNS`-Eintrag zurück (`hardware` steht an Position 1) → für die Essensfrage ist `topicAffinity` = 0, obwohl der Text „Schnitzel" enthält.

Folge: Frage „Was esse ich gerne?" fragt `topic = 'essen'` ab → 0 Kandidaten; selbst wenn der Knoten über einen anderen Weg käme, wäre die Affinität 0.

### F) Normalisierung heute – geprüfte Paare

| Paar | Heute | Befund |
| --- | --- | --- |
| Name ↔ heiße / heißt / mein Name | kein Bereich „name" in `DOMAIN_PATTERNS`; `similarity` vergleicht Stämme → „name" ≠ „heiss" | **Lücke** |
| Beruf ↔ arbeite / Job / Beruf / Koch | Bereich `beruf` deckt `arbeite als`, `job`, `beruf`; **nicht** „Was arbeite ich?" (ohne „als") und **nicht** „koch" | **Lücke** |
| Essen ↔ esse / gegessen / Lieblingsessen | Bereich `essen` deckt alle drei; scheitert nur an der Ein-Bereich-Regel | Regel-, keine Wortlücke |
| Alter ↔ alt / Jahre / Geburtstag | Bereich `alter` deckt alle (P15); `topic` des Satzes „Ich bin 36 Jahre" ist jedoch `jahre` | Regel-, keine Wortlücke |
| Wohnort ↔ wohne / Wohnort / lebe | Bereich `wohnort` deckt alle (P15) | vollständig |
| Grafikkarte ↔ GPU / RTX | Bereich `hardware` deckt alle | vollständig |
| Schuhgröße ↔ Schuhe / Größe | kein Bereich; funktioniert heute rein wörtlich (`similarity` 0.111) | genügt, keine Änderung nötig |

Mechanik der Normalisierung: `words()` → `stem()` (nur Endungen) → `matchesKeyword` (Stammgleichheit oder Präfix mit ≤ `TOPIC_MAX_SUFFIX` Rest). **Keine Synonymauflösung.** Genau hier liegt die Name-Lücke; sie ist über den vorhandenen Bereichsmechanismus lösbar, nicht über Stemming.

---

## 2. Patch-Entwurf (kleinster Eingriff, Variante 1)

Drei Teile, zwei Dateien, keine Schemaänderung.

### Teil 1 – Mehrere Informationsbereiche je Text

- **Datei:** `src/orb-core/recall.ts`
- **Neu:** `infoDomainsOf(text): string[]` — läuft alle `DOMAIN_PATTERNS` durch und sammelt *alle* Treffer statt abzubrechen. `infoDomainOf` bleibt unverändert (erster Treffer) und behält alle bestehenden Aufrufer.
- **Geändert:** `topicAffinity(question, memory)` prüft `infoDomainsOf(memory).includes(questionIntentOf(question))` statt Gleichheit des ersten Treffers.
- **Unverändert:** `TOPIC_AFFINITY_FLOOR = 0.12`, `questionIntentOf`, Relevanzformel, Schwelle 0.35, harter Filter.

Wirkung: Sammelknoten trägt die Bereiche `hardware` **und** `essen`; Essensfrage × Sammelknoten → 0.12 statt 0.

### Teil 2 – Kandidatensuche über den Fragebereich statt nur über `topic`

- **Datei:** `src/orb-core/engine.server.ts`, Funktion `retrieveCandidates`
- **Änderung:** Der bereits vorhandene `intentTopic`-Zweig (Zeile 682-694) fragt heute `eq("topic", intentTopic)`. Er wird ergänzt/ersetzt durch eine gleich begrenzte Inhaltsabfrage über die Leitwörter des erkannten Bereichs:
  `.or(keywords.map(k => \`content.ilike.%${k}%\`).join(","))` mit `.order("importance", {ascending:false}).limit(CANDIDATE_LIMIT)`.
  Dafür exportiert `recall.ts` je Bereich eine kleine, feste Leitwortliste (≤ 8 Wörter, exakt die Wörter, die bereits in `DOMAIN_PATTERNS` stehen — **keine neue Synonymdatenbank**).
- **Anzahl Abfragen:** unverändert (eine statt einer). Keine Vollabfrage, gleiches `CANDIDATE_LIMIT`, weiterhin `eq("user_id", userId)`.

Wirkung: Die Frage findet den Knoten unabhängig vom dauerhaft gespeicherten `topic`. Das Feld `topic` wird **nicht** neu berechnet und keine Memory umgeschrieben.

### Teil 3 – Zwei belegte Wortlücken lokal schliessen

- **Datei:** `src/orb-core/recall.ts`, `DOMAIN_PATTERNS`
- Neuer Bereich `name`: `heiße|heisse|heißt|heisst|name|namen|nenne|nennt`.
- Bereich `beruf` erweitert um: `arbeite|arbeitest|arbeitet` (ohne „als"), `koch|köchin|kellner`-artige Berufsbezeichnung **nur** soweit im vorhandenen Bestand belegt (aktuell `koch`).
- Reihenfolge: `name` und `beruf` **vor** `hardware` ist nicht erforderlich, weil Teil 1 die Erstplatzierung entwertet.

---

## 3. Warum keine anderen ORB-Systeme betroffen sind

| System | Betroffen? | Begründung |
| --- | --- | --- |
| Relevanzformel `memoryRelevance` | nein | unverändert; Eingabe bleibt `max(similarity, topicAffinity)` |
| Harter Filter `overlap > 0` (Z. 959) | nein | Bedingung identisch |
| Speicherschwelle 0.35, `scoreImportance` | nein | nicht berührt |
| `topicOf` / `orb_nodes.topic` / Interessen | nein | Teil 2 liest `topic` nur nicht mehr exklusiv; Schreibpfad unverändert |
| Graph, Kanten, Curiosity, Energy, Autonomie | nein | keine Datei im Pfad |
| Prompt, Modell, `max_tokens` | nein | Korrektur liegt vollständig vor dem Modellaufruf |
| ChatBridge, Reparaturstrecke, Freigaben | nein | kein Import |
| DB-Schema, Migrationen | nein | rein lesende Abfrageänderung |

---

## 4. Testfälle und Messplan (noch nicht ausgeführt)

Zu erfassen je Fall: Kandidaten vor Fix · Kandidaten nach Fix · `overlap`/Relevanz · Filterentscheidung · erreicht Modellkontext.

| # | Frage × Memory | Erwartet vorher | Erwartet nachher |
| --- | --- | --- | --- |
| 1a | „Was esse ich gerne?" × Sammelknoten `132bf051` | 0 Kandidaten | ≥1 Kandidat, `overlap` 0.12, durchgelassen |
| 1b | „Welche Schuhgröße habe ich?" × Sammelknoten | Kandidat, 0.111 | unverändert |
| 1c | „Welche Grafikkarte habe ich?" × Sammelknoten | Kandidat, 0.12 | unverändert |
| 2 | „Was arbeite ich?" × „Ich bin Koch …" (`1db76f06`) | 0 / kein Beruf | Kandidat, 0.12 |
| 3 | „Wie heiße ich?" × „… Ich heiße Mario" (`c6d0f938`) | durchgelassen | unverändert |
| 4 | „Wie heiße ich?" × „mein Name ist Mario" (`3ef66eb8`) | 0.000 verworfen | Kandidat, 0.12 |
| 5 | „Wie alt bin ich?" × „Ich bin 36 Jahre" (`fac1e7a5`) | nie geholt | Kandidat, 0.12 |
| 6 | „Wo wohne ich?" × „wohnt in Leipzig" (nur Testtext) | – | Bereich `wohnort` greift |

**Gegenproben (müssen unverändert bleiben):**

| Gegenprobe | Erwartung |
| --- | --- |
| Altersfrage × reine RTX-Memory | `overlap` 0.000 → verworfen |
| Essensfrage × reine RTX-Memory | 0.000 → verworfen |
| Grafikkartenfrage × reine Essens-Memory | 0.000 → verworfen |
| „Wo wohne ich?" ohne Wohnort-Memory | 0 Treffer, keine Antwortinhalte erfunden |
| Wörtlicher Treffer vs. Bereichs-Untergrenze | wörtlich rankt weiter höher (>0.12) |
| Speicherschwelle / Relevanzformel | numerisch identisch |

---

## 5. Alternativen (nur dokumentiert, technische Unterschiede statt Bewertung)

**Variante 2 – Mehrfachthemen im Retrieval über `topicsOf`.**
`retrieveCandidates` fragt `in("topic", topicsOf(text))` statt `eq`. Eingriff ebenfalls klein, wirkt aber nur auf die *Frage*-Seite; der gespeicherte `topic` des Sammelknotens bleibt `hardware`, also löst es Fall 1a nicht. Zusätzlich vergrössert `topicsOf` die Themenliste um jeden Wortstamm → breitere, weniger vorhersagbare Kandidatenmenge.

**Variante 3 – Persistierte Bereichsliste (Schemaänderung, NICHT durchzuführen).**
Neue Spalte `orb_nodes.domains text[]` + GIN-Index, beim Anlegen aus `infoDomainsOf` gefüllt. Unterschiede: exakte Indexsuche statt `ilike`, konstante Abfragekosten bei vielen Knoten; erfordert Migration, Backfill bestehender 119 Knoten (= Datenmutation) und doppelte Wahrheit (Spalte vs. Laufzeitberechnung). Variante 1 kommt ohne beides aus.

**Variante 4 – Volltextsuche (`to_tsvector`)** ersetzt die `ilike`-Liste; benötigt Index/Migration und trifft die Bereichsfrage nur indirekt über Wörter.

---

## 6. Risiko und Rollback

**Risiken (Variante 1):**
- R1: `ilike %wort%`-Abfrage ohne Index — bei 119 Knoten unkritisch, wächst linear. Bereits heute existiert eine gleichartige Tokenabfrage (Zeile 707-718), also keine neue Klasse.
- R2: Mehr Kandidaten ⇒ mehr Knoten erreichen die Relevanzberechnung. Die Auswahl bleibt bei `RECALL_LIMIT = 6`; der Filter entscheidet unverändert.
- R3: Ein Knoten mit vielen Bereichen (Sammelknoten) kann in mehreren Fragen erscheinen — sachlich korrekt, aber der separat gemeldete Diff-Text-Knoten `e2fb4b1f` würde damit ebenfalls häufiger sichtbar. **Separater Befund, nicht Teil dieses Patches.**
- R4: Bereich `name` könnte auf Sätze über fremde Namen greifen. Begrenzt, weil `questionIntentOf` nur bei echten Fragen auslöst.

**Rollback:** rein additive Codeänderung in zwei Dateien, keine Daten- und keine Schemaänderung → Rücknahme durch Revert der beiden Dateien; kein Backfill, kein Datenzustand zu reparieren.

---

## 7. Ergebnis

Der Ausschluss ist ein **Kandidatenproblem**, nicht ein Filterproblem. Der kleinste Eingriff verbessert ausschliesslich die Kandidatenmenge (Mehrfachbereiche + Inhaltsabfrage über den Fragebereich) und lässt Relevanzformel, Untergrenze 0.12, harten Filter `overlap > 0` und Speicherschwelle 0.35 numerisch unangetastet.

**ABSOLUTER STOPP.** Kein Patch, keine Datenänderung, kein Deployment. Umsetzung erst nach ausdrücklicher Freigabe.
