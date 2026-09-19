# ORB Production – Memory Graph & Hallucination Audit (2026-09-19)

Art: READ-ONLY Audit gegen die echte Production-Datenbasis (kein Staging-Ersatz).
Ausgeführt wurden ausschliesslich SELECT-Abfragen und Codelektüre. Es wurden keine
Chatnachrichten, Memories, Threads, Learning Events, Reinforcements oder
Deployments erzeugt.

Datenstand: 2026-09-19, letzter Knoten 16:53:35 UTC.

---

## 1. Production Memory Gesamtbestand

| Grösse | Wert |
| --- | --- |
| Memory Nodes (`orb_nodes`) | **29** |
| davon Typ `memory` | 18 |
| davon Typ `perception` | 5 |
| davon Typ `decision` (Lernereignisse) | 4 |
| davon Typ `goal` | 1 |
| Quelle `user_stated` | 28 |
| Quelle `observed` (Feed-Beobachtung) | 1 |
| Quelle `inferred` | 0 |
| Learning-Event-Knoten (`metadata.learning_event = true`) | 4 |
| Importance-Mittel | 0.527 |
| Importance ≥ 0.67 (innerer Ring) | 6 |
| Importance 0.34–0.67 (mittlerer Ring) | 23 |
| Importance < 0.34 | 0 |
| Confidence | 0.9 (28 Knoten), 0.5 (1 Feed-Knoten) |
| Zeitraum | alle Knoten 2026-09-19, 06:46–16:53 UTC |
| Themen (`topic`) | 22 verschiedene, grösster Block `hardware` (4), danach `eier`, `merke`, `problem`, `essen` (je 2), 17 Themen mit je 1 Knoten |

Der Bestand umfasst damit mehr Knoten (29) als das Spiderweb gleichzeitig
darstellt; der Audit wurde über den vollständigen Bestand geführt.

## 2. Production Thread Gesamtbestand

17 Threads (`orb_threads`), Status OPEN/ACTIVE/PAUSED, jeweils mit
`title` (aus normalisierten Wortstämmen der Nutzereingabe), `known` (Rohtexte
der Nutzerzüge) und `unknown` (generierte Wissenslücken-Formulierungen).
Beispiel-Titel: „grafikkarte nochmal vergess“, „merke lieblingsess“,
„genau speich ochmal“.

## 3. Production Connection Gesamtbestand

22 Verbindungen (`orb_connections`). Metadaten-Herkunft: `experience`
(Mehrzahl), `potential_contradiction` (1), `learning_event`.
Weitere Zählwerte: 242 `orb_messages`, 20 `orb_interests`, 1 `orb_suggestion`,
**0** `orb_questions`, 1 Benutzer im gesamten ORB-Bestand.

## 4. Memory-Kategorien

| Kategorie | Anzahl (ca.) | Beispiele (gekürzt) |
| --- | --- | --- |
| A konkrete persönliche Fakten | 5 | Name/Interessen-Aussage; „beruflich Koch … Software“; „Nvidia rtx 5070 drin“; „CPU ist ein ryzen 7 5800x“; Geburts-/Wohnortangabe |
| B Benutzerpräferenzen | 3 | „Pizza mit Ananas“; „koche italienisch … Pasta“; „Griechisch … Kreta“ |
| C Projekte / Interessen | 2 | Arbeitsspeicher-Ausbau; „fix in arbeit“ |
| D konkrete Benutzerangaben (meta, über ORB selbst) | 6 | „Kalibrierung läuft bereits?“; „Struktur mit dem decay Werten …“ |
| E Gesprächsfragmente | 6 | „Ja das meine ich 😂 hab wohl ein Schreibfehler gehabt“; „Eier war ein Tippfehler gewesen“; „Alles schnieke“; „Davor haben wir Rostock erwähnt …“ |
| F einzelne Wörter | 2 | „Falsch“, „Rostock“ |
| G Fragen | 4 | „Weißt du wie ich heiße?“; „Whats my name“; „Welche Grafikkarte hab ich nochmal gehabt“; „Hast du eine Frage ?“ |
| H Anweisungen | 3 | „Merke dir mein Lieblingsessen“; „Speicher dir das gut ab“; „Du musst nicht jedesmal schreiben …“ |
| I ORB-generierte Aussagen | 1 | Zielknoten „Dem Benutzer helfen“ (systemseitig, Typ `goal`) |
| J sonstige | 1 | Feed-Beobachtung „‚I feel good‘ https://www.youtube.com/wa“ |

Kein einziger Knoten entspricht dem Text einer ORB-/LLM-Antwort
(geprüft durch Abgleich `orb_nodes.content` gegen alle
`orb_messages.role = 'assistant'`: 0 Treffer).

## 5. Auffällige Nodes

| Content | Typ | Importance | Conf. | Topic | Source | Aktivierungen | Metadata | Erstellt (UTC) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| „Falsch“ | decision | 0.80 | 0.9 | falsch | user_stated | 1 | learning_event: true | 16:49:39 |
| „Rostock“ | decision | 0.95 | 0.9 | rostock | user_stated | 1 | learning_event: true, **crack: true** | 16:53:35 |
| „Alles schnieke“ | memory | 0.45 | 0.9 | alle | user_stated | 1 | learning_event: false | 16:48:59 |
| „Eier war ein Tippfehler gewesen“ | decision | 0.80 | 0.9 | eier | user_stated | 3 | learning_event: true | 14:13:05 |
| „Ich bin Eier geboren und aufgewachsen und lebe seit 9 Jahren in Berlin“ | memory | 0.64 | 0.9 | eier | user_stated | 5 | learning_event: false | 14:08:04 |
| „Ja das meine ich 😂 hab wohl ein Schreibfehler gehabt“ | decision | 0.80 | 0.9 | wohl | user_stated | 1 | learning_event: true | 14:08:44 |
| „Das ist kein Problem. Wir werden die Tage schreiben …“ | memory | 0.44 | 0.9 | problem | user_stated | 5 | learning_event: false | 13:46:41 |
| „Kein Problem. Deine Struktur mit dem decay Werten …“ | memory | 0.55 | 0.9 | problem | user_stated | 1 | learning_event: false | 14:10:47 |
| „Welche Grafikkarte hab ich nochmal gehabt. Ich hab's vergessen“ | memory | 0.64 | 0.9 | hardware | user_stated | **17** | learning_event: false | 09:19:34 |
| „‚I feel good‘ https://www.youtube.com/wa“ | perception | 0.40 | 0.5 | hardware | observed | 2 | origin: feed_observation, post_id | 10:19:48 |
| „Dem Benutzer helfen“ | goal | 0.90 | 0.9 | ziele | user_stated | 0 | – | 16:53:35 |
| „Whats my name“ | memory | 0.40 | 0.9 | what | user_stated | 1 | learning_event: false | – |

**Wichtiger Befund zu den „einzelnen Wörtern“ im Spiderweb:** Die im
Spiderweb sichtbaren Wörter („falsch“, „wohl“, „problem“, „eier“,
„rostock“, „hardware“) sind überwiegend **Beschriftungen, nicht Inhalte**.
`OrbGraph.shortLabel()` zeigt `node.topic`, falls vorhanden, sonst den
gekürzten Inhalt. „elehardware“ ist keine gespeicherte Zeichenkette, sondern
die optische Überlagerung zweier benachbarter Beschriftungen („…elche“ /
„hardware“) im SVG. Tatsächlich einzelwortige **Inhalte** existieren nur
zweimal: „Falsch“ und „Rostock“.

## 6. Herkunft der auffälligen Nodes

- **„Falsch“ (0.80)** – Pfad: User Message → `scoreImportance` → Persistence.
  `isLearningEvent("falsch")` ist wahr (Marker `falsch`), daher
  0.25 (Basis) + 0.20 (Marker) + 0.35 (Lernereignis) = **0.80** ≥ 0.35 → gespeichert,
  Typ `decision`. Rekonstruiert, nicht vermutet (Werte stimmen exakt mit der Formel).
- **„Rostock“ (0.95, crack: true)** – Pfad: Eingabefeld „Lernerfahrung“ in
  `channels.orb.tsx` (Zeile 387 ff.) → serverFn `learn` → `recordLearning()`.
  Diese Funktion setzt Importance **fest auf 0.95**, Typ `decision`,
  `metadata = { learning_event: true, crack: true }` – unabhängig von Länge oder
  Inhalt. Im selben Aufruf wurde der Zielknoten „Dem Benutzer helfen“ angelegt
  (identischer Zeitstempel 16:53:35) und mit „Rostock“ verbunden.
- **„Alles schnieke“ (0.45)** – 0.25 + 0.20 Markertreffer. Ursache:
  `scoreImportance` prüft Marker per Teilstring; der Marker `"nie"` steckt in
  „sch**nie**ke“. Substring-Fehltreffer, kein inhaltlicher Grund.
- **„Whats my name“ (0.40)** – 0.25 + 0.15 persönliches Muster („my name“).
  Eine **Frage** erreicht so die Schwelle 0.35 und wird gespeichert.
- **„Eier …“-Knoten** – Nutzereingabe mit Tippfehler („Eier“ statt Rostock);
  „Eier war ein Tippfehler gewesen“ ist als Lernereignis (Marker `tippfehl`→`fehl`)
  mit 0.80 gespeichert. Die **fehlerhafte Tatsachenaussage** „Ich bin Eier geboren …“
  bleibt mit 0.64 parallel bestehen; die Korrektur überschreibt sie nicht.
- **„Welche Grafikkarte hab ich nochmal gehabt“ (0.64, 17 Aktivierungen)** –
  eine Frage, deren Importance durch Reaktivierung gewachsen ist:
  bei jedem Abruf `importance = max(alt, aktuelle_Importance × 0.8)`
  (`engine.server.ts`, Reaktivierungsblock).
- **Feed-Knoten (observed, topic `hardware`)** – `origin: feed_observation`
  mit `post_id`; Topic-Zuordnung stammt aus dem Interessenabgleich, nicht aus
  dem Inhalt. Confidence korrekt niedriger (0.5).
- **„wohl“/„problem“-Knoten** – vollständige Sätze; die Wörter sind nur die
  per `topicOf()` gewählten Themen (erstes Inhaltswort, wenn kein bekanntes
  Thema erkannt wird).

SOURCE NOT DETERMINABLE: keiner der untersuchten Knoten.

## 7. Memory-Erzeugungspfad (Production-Code)

```
User Message
  → retrieveCandidates (norm_key exact | topic | intent | token) , je Abfrage .eq(user_id)
  → Ranking (memoryRelevance) → selectByLevel (A/B/C)
  → isLearningEvent → scoreImportance → ggf. Kontextauflösung (letzte 8 Züge)
  → exact? Verstärkung : shouldPersist(0.35) | answeringQuestion | resolvedContextFact
  → orb_nodes INSERT (+ Verbindungen zu allen abgerufenen Knoten)
```

Zweiter, davon getrennter Pfad: `recordLearning()` (Feld „Lernerfahrung“) –
speichert **ohne Schwellenprüfung** mit Importance 0.95.

## 8. Thread-Einfluss

Threads sind keine Memory-Quelle: es existiert kein Codepfad
Thread → `orb_nodes`. `orb_threads.node_ids` verweist nur rückwärts auf bereits
bestehende Knoten. Thread-Inhalte gelangen aber **in den LLM-Prompt**:
`buildSpeakSystemPrompt` überträgt bei Wiederaufnahme `title`, `status` und
`unknown` als „Offene Themen bei dir“. Der Fragment-Titel
„grafikkarte nochmal vergess“ erscheint damit als offenes Thema – ausdrücklich
nicht als Tatsache, und `known` (Rohtexte) wird nicht übergeben.

## 9. Conversation-Context-Einfluss

Der flüchtige Kontext (letzte 8 Züge) wird im Prompt klar als „flüchtiger
Kontext, keine dauerhafte Erinnerung“ gekennzeichnet. Er wird jedoch über
`resolvedContextFact` zur **Persistenz** genutzt: bei einer belegten
Merk-Aufforderung wird die aus dem Kontext aufgelöste Aussage gespeichert,
auch wenn die Importance unter 0.35 liegt. Das ist gewollt und dokumentiert,
ist aber der einzige Weg, auf dem Kontext dauerhaft wird.

## 10. LLM-Einfluss und Memory → LLM Context

In den Prompt gehen: Zustandswerte, Ziele, Entscheidung, **`recalled` =
`node.content` der ausgewählten Knoten**, Interessen, Sicherheits-Hinweise
(`phrasings`), ggf. ein offener Thread, Widersprüche, flüchtiger Kontext,
Stilprofil.

Auswahl: Kandidaten über `norm_key`, Thema, Frageabsicht und Tokens; Ranking
über `memoryRelevance` (Ähnlichkeit × Gewicht × Importance × Aktualität ×
Aktivierungsbonus), Begrenzung über `selectByLevel` (Ebenen A/B/C).
**Es gibt keinen Filter nach Knotentyp.** Knoten vom Typ `perception`
(Fragen) und `decision` (Fragmente wie „Falsch“) werden genauso als
„Aktive Erinnerungen“ übergeben wie echte Fakten.

LLM → Memory: kein Pfad. Verifiziert durch Datenabgleich (0 Knoten mit
Inhalt einer Assistant-Nachricht) und Codelektüre (nur Nutzertext bzw.
`recordLearning`-Text werden geschrieben; Antworten landen ausschliesslich in
`orb_messages`).

## 11. Mögliche Feedback-Loops

| Pfad | Status | Bewertung |
| --- | --- | --- |
| A LLM → Thread → Context → LLM | NICHT GEFUNDEN | Threads entstehen aus Nutzertext, nicht aus Antworten |
| B LLM → Memory → Context → LLM | NICHT GEFUNDEN | keine Antwort wird persistiert |
| C Thread → Memory → Context → LLM | NICHT GEFUNDEN (Memory-Teil fehlt) | Threads gelangen nur als „offenes Thema“ in den Prompt |
| D Conversation Context → Memory → Context → LLM | GEFUNDEN, eingegrenzt | nur über belegte Merk-Aufforderung (`resolvedContextFact`) |
| E Unbestätigte Aussage → Memory → LLM | **GEFUNDEN** | Fragen, Anweisungen und Tippfehler-Aussagen liegen als Knoten vor und werden ohne Typfilter als „Aktive Erinnerungen“ übergeben; jede Reaktivierung hebt ihre Importance (`max(alt, imp × 0.8)`), wodurch sie häufiger abgerufen werden (Selbstverstärkung, z. B. 17 Aktivierungen bei einer Frage) |

## 12. Spiderweb-Datenquelle

`channels.orb.tsx` übergibt ausschliesslich `snapshot.nodes` und
`snapshot.connections` aus dem SDK-Snapshot (`orb_nodes`, `orb_connections`).
Keine Threads, keine Suggestions, keinen Kontext, keine LLM-Daten, keine
temporären Knoten. Begrenzung: 40 Knoten, 40 Kanten; Ring aus vorhandener
Importance, Winkel aus stabiler ID-Reihenfolge. Beschriftung = `topic`
(siehe Abschnitt 5).

## 13. User-Isolation

Der gesamte ORB-Bestand in Production gehört **einem** Benutzer
(`count(distinct user_id) = 1` in `orb_nodes`). Alle Knoten, Threads und
Verbindungen tragen dieselbe Kennung; Verbindungen verweisen nur auf Knoten
derselben Kennung. Alle Abfragepfade im Code sind auf `user_id` eingeschränkt,
RLS ist unverändert aktiv (anon ohne Rechte). Es wurden keine Inhalte in einen
Testkontext geladen und keine Nutzerdaten exportiert; Beispiele im Report sind
gekürzt.

## 14. Halluzinationsrisiko

Erhöht, aber nicht durch LLM-Rückkopplung. Ursache ist die Zusammensetzung der
übergebenen „Aktiven Erinnerungen“: 4 Fragen, 3 Anweisungen, 6 Fragmente,
2 Einzelwörter und eine sachlich falsche Tatsachenaussage („Ich bin Eier
geboren …“, 0.64, 5 Aktivierungen) stehen gleichrangig neben echten Fakten.
Die Sprachschicht kann daraus Aussagen formen, die nie als Tatsache genannt
wurden. Verstärkend: die Korrektur („Eier war ein Tippfehler gewesen“, 0.80)
existiert **zusätzlich** zur falschen Aussage, ohne sie zu entwerten.

## 15. Konkrete Ursachen (eindeutig feststellbar)

1. **Kein Typ- bzw. Aussagefilter vor dem Recall:** Fragen (`perception`) und
   Fragmente (`decision`) werden wie Fakten in `recalled` übergeben.
2. **Marker-Treffer per Teilstring** in `scoreImportance` – „sch**nie**ke“
   erreicht über den Marker `nie` die Speicherschwelle; „falsch“ erzeugt zudem
   ein Lernereignis (+0.35) für ein einzelnes Wort.
3. **`recordLearning()` umgeht die Schwelle 0.35** und setzt 0.95 – dadurch
   entstand der Einzelwort-Knoten „Rostock“ im innersten Ring.
4. **Importance-Anhebung bei Reaktivierung** (`max(alt, imp × 0.8)`) hebt auch
   Fragen und Fragmente dauerhaft an (Selbstverstärkung).
5. **Korrekturen entwerten die falsche Vorgängeraussage nicht** (bewusst
   „Vergessen ≠ Löschen“, hier aber Quelle falscher Kontexte).
6. **Topic-Rückfall auf das erste Inhaltswort** erzeugt Einzelwort-Themen
   („falsch“, „wohl“, „problem“, „eier“), die im Spiderweb wie Einzelwort-
   Erinnerungen wirken.

## 16. Empfohlene minimale Korrektur (NICHT umgesetzt)

Alle Punkte sind Vorschläge; im Rahmen dieses Audits wurde nichts geändert.

1. Recall-Filter: Knoten, die als Frage erkannt sind (`type = perception`
   bzw. Inhalt mit Fragezeichen/Frageintent), nicht als „Aktive Erinnerungen“
   übergeben, sondern höchstens als offene Frage kennzeichnen.
2. Marker-Vergleich in `scoreImportance` auf Wortgrenzen umstellen
   (Tokenvergleich statt `includes`), damit „schnieke“ kein Marker mehr trifft.
3. Mindestlänge/Mindestinformationsgehalt für `recordLearning()` prüfen oder
   Lernereignisse mit einem Bezugsknoten verknüpfen, statt ein Einzelwort mit
   0.95 anzulegen.
4. Prompt-Zeile ergänzen, dass gespeicherte Fragen und Aufforderungen keine
   Tatsachen sind (reine Textänderung in `prompt.server.ts`).
5. Widerspruchsbehandlung: bei erkannter Korrektur die widersprochene Aussage
   in der Sicherheits-Angabe (`phrasings`) als „bestritten“ ausweisen –
   ohne Löschung.
6. Spiderweb-Beschriftung: Inhaltsauszug statt Topic anzeigen, damit
   Einzelwort-Themen nicht als Einzelwort-Erinnerungen erscheinen (reine UI).

Jede dieser Korrekturen ist eine Codeänderung und gehört nach Staging –
nicht in diesen Audit.

---

## 17. Ergebnis

PRODUCTION MEMORY DATA INTEGRITY: PASS
MEMORY SOURCE INTEGRITY: PASS
SINGLE-WORD MEMORY DETECTION: FAIL
THREAD → MEMORY ISOLATION: PASS
LLM → MEMORY ISOLATION: PASS
CONTEXT → MEMORY ISOLATION: PASS
MEMORY → LLM CONTEXT: FAIL
SPIDERWEB DATA SOURCE: PASS
USER ISOLATION: PASS
HALLUCINATION LOOP: FOUND
HALLUCINATION SOURCE IDENTIFIED: YES

PRODUCTION CHANGED: NO
DATABASE CHANGED: NO
DATA CHANGED: NO
RLS CHANGED: NO
MEMORY CHANGED: NO
THREADS CHANGED: NO
OPENAI CHANGED: NO
UI CHANGED: NO
