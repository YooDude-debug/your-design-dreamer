# ORB CORE – P14 PATCH REVIEW

Reine Prüfung. **Kein Patch, keine Produktionsänderung, keine Migration, kein Deployment,
keine Schwellen- oder Formeländerung.** Referenz:
`docs/ORB_ARCHITECTURE_SELF_ANALYSIS_RESULT_2026-09-23.md` (Abschnitt 7).
Zeitpunkt: 2026-09-23, 12:3x UTC. Modellaufrufe: **0**. Kosten: **0,00 €**.
Datenbankzugriffe: **0** (rein statische Reproduktion über die reinen Kernfunktionen).
Das Reproduktionsskript lag unter `tmp-p14/` und ist entfernt.

## 1. Reproduzierbarer Fehler

Vor jeder Änderung deterministisch reproduziert (reine Funktionen
`topicOf`, `contentTokens`, `questionIntentOf`, `similarity`, `topicAffinity`;
Filterstelle `src/orb-core/engine.server.ts:959` `.filter((c) => c.overlap > 0)`).

| Fall | Frage | erkannter Informationsbereich (`questionIntentOf`) | verwendetes Thema (`topicOf`) | passende Erinnerung | Relevanz/Overlap | Filter | erreicht Modellpfad |
|---|---|---|---|---|---|---|---|
| A ohne Bereich | „Wie alt bin ich?“ | `null` | **`wie`** (Fragewort) | „Ich bin 36 Jahre.“ (Thema `jahre`) | **0.000** | verworfen | **nein** |
| A2 ohne Bereich | „Wann habe ich Geburtstag?“ | `null` | **`wann`** | „Ich bin 36 Jahre.“ | 0.000 | verworfen | nein |
| A3 ohne Bereich | „Wo wohne ich?“ | `null` | `wohne` | „Der Nutzer wohnt in Leipzig.“ | 0.000 | verworfen | nein |
| B mit Bereich | „Welche Grafikkarte habe ich?“ | `hardware` | `hardware` | „Der Nutzer besitzt eine RTX 5070 OC.“ | 0.120 | behalten | **ja** |
| C mit Bereich, Thema `null` | „Was esse ich gerne?“ | `essen` | **`null`** | „…isst am liebsten Schnitzel und Brokkoli.“ | 0.120 | behalten | **ja** |
| D ohne passende Erinnerung | „Welche Grafikkarte habe ich?“ | `hardware` | `hardware` | „Der Nutzer war letzte Woche wandern.“ | 0.000 | verworfen | nein (korrekt) |

Der Fehler ist reproduzierbar: **bestätigt.**

## 2. Tatsächlicher Root Cause – Abweichung zur Selbstdiagnose

Die Selbstdiagnose behauptet die Kette
`Fragewort → Ersatzthema → falsche Themenzuordnung → Relevanz 0.000 → Filter verwirft`.
Diese Kette ist **nur teilweise zutreffend**. Geprüft, nicht übernommen:

- **BEWIESEN:** `topicOf("Wie alt bin ich?") === "wie"`. Ursache: `contentTokenPairs`
  filtert `STOPWORDS` und `AFFECT_WORDS`, aber **keine Fragewörter**; der Fallback
  „erstes Inhaltswort“ (`src/orb-core/memory.ts:481`) liefert daher das Fragewort.
  Folge: die Themen-Kandidatenabfrage läuft auf `topic="wie"` und trifft nichts.
- **BEWIESEN, und der Selbstdiagnose widersprechend:** Das Ersatzthema ist **nicht**
  die Ursache der 0.000. Gegenbeweis Fall C: „Was esse ich gerne?“ hat `topicOf = null`
  (also gar kein Thema) und wird trotzdem korrekt behalten. Der Overlap wird
  ausschliesslich aus `max(similarity, topicAffinity)` gebildet – das Thema geht dort
  nicht ein. Die 0.000 entstehen aus **zwei** unabhängigen Lücken:
  1. keine Wortüberschneidung („alt“ vs. „Jahre“), und
  2. **`DOMAIN_PATTERNS` in `src/orb-core/recall.ts` kennt nur vier Bereiche**
     (`hardware`, `projekte`, `beruf`, `essen`) – „Alter“ und „Wohnort“ fehlen, also
     liefert `questionIntentOf` `null` und `topicAffinity` 0.
- **Korrigierte, bewiesene Kette:**
  fehlender Informationsbereich in `DOMAIN_PATTERNS` → `questionIntentOf = null` →
  `topicAffinity = 0` **und** `similarity = 0` → `overlap = 0.000` → harter Filter
  verwirft → Bewertung/aktive Erinnerungen/Kontextzeile `NOT_REACHED` → Modell erhält
  die Erinnerung nicht. **Parallel und zusätzlich:** das Fragewort als Ersatzthema
  verursacht eine nutzlose Kandidatenabfrage (`topic="wie"`) und belegt einen der drei
  Suchbegriff-Plätze (`contentTokens(text).slice(0, 3)`).

## 3. Betroffene Datei/Funktion

- `src/orb-core/recall.ts` – `DOMAIN_PATTERNS` / `questionIntentOf` / `topicAffinity`
  (**primäre Ursache**).
- `src/orb-core/memory.ts` – `contentTokenPairs` (Zeile 435) und `contentTokens`
  (Zeile 254), Fallback in `topicOf` (Zeile 473–482) (**sekundäre Ursache**).
- `src/orb-core/engine.server.ts:959` – Filterstelle. **Sie ist korrekt und wird nicht
  als Fehlerursache bewertet.**

## 4. Prüfung des ORB-Patch-Vorschlags

Vorschlag Teil 1 – „Fragewörter von der Themenbestimmung ausnehmen“:
**korrekt und notwendig**, behebt die nutzlose Themenabfrage; simuliert
(`topicOf("Wie alt bin ich?") → "alt"`, `"Wann …?" → "geburtstag"`).

Vorschlag Teil 2 – „im Fall ‚kein Thema‘ den Filter nicht als Ausschluss verwenden,
sondern die Bewertung entscheiden lassen“: **nicht korrekt.**
1. Es ist faktisch eine **globale Absenkung des Relevanzfilters** – laut P14 Abschnitt 4
   ausdrücklich verboten.
2. Es behebt die Ursache nicht: Fall A hätte nach Teil 1 das Thema `alt`, also nicht
   „kein Thema“ – die Bedingung greift gar nicht.
3. Es würde Fall D brechen: „Der Nutzer war letzte Woche wandern.“ (Overlap 0.000)
   käme in die Bewertung, weil `memoryRelevance` bei `similarity = 0` zwar 0 liefert,
   der Ausschluss aber entfällt und die Auswahl `selectByLevel` nach Ebene/Score
   auffüllt.

**Gesamtbewertung: TEILWEISE KORREKT.** Richtige Datei, richtige Beobachtung,
falsche zweite Hälfte, und die primäre Ursache (fehlende Informationsbereiche)
wird im Vorschlag überhaupt nicht genannt.

### Korrigierter Patch-Vorschlag (beschrieben, NICHT angewendet)

Im Projekt existiert bereits ein genehmigter Patch-Text, der genau diesen Weg geht und
den Filter **nicht** anfasst: `src/orb-dev/fixes/memory-recall-age.patch.ts`.
Inhalt: (a) `QUESTION_WORDS`-Menge in `memory.ts`, zusätzlich gefiltert in
`contentTokens` und `contentTokenPairs`; (b) zwei neue Einträge in `DOMAIN_PATTERNS`
(`alter`, `wohnort`); (c) ein Regressionstest.

Simulierte Wirkung (Attrappe, keine Produktionsänderung):
„Wie alt bin ich?“ 0.000 → **0.120 behalten**; „Wann habe ich Geburtstag?“ 0.000 →
**0.120 behalten**; Fall B und C unverändert 0.120; Fall D unverändert **0.000
verworfen**.

Zwei nachgewiesene Lücken dieses vorbereiteten Patches, vor einer Freigabe zu schliessen:
- `wohnort` greift bei „Wo wohne ich?“ ↔ „Der Nutzer **wohnt** in Leipzig.“ **nicht** –
  das Muster enthält `wohne|wohnst|lebe|lebst`, aber nicht `wohnt|wohnen|lebt|leben`.
  Ergebnis bleibt 0.000/verworfen.
- `wo` fehlt in `QUESTION_WORDS` (kurzes Wort, wird ohnehin durch die Mindestlänge 3
  ausgefiltert – belegt, kein Handlungsbedarf, aber dokumentieren).

## 5. Minimalität

Der korrigierte Weg berührt zwei reine Funktionsdateien und **keinen** der verbotenen
Bereiche: kein Umbau von Memory oder Graph, keine Änderung der Relevanzformel
(`memoryRelevance` unberührt), keine globale Schwellenänderung (Speicherschwelle 0.35,
`TOPIC_AFFINITY_FLOOR` 0.12, `overlap > 0` bleiben unverändert), keine Promptänderung,
kein Modellwechsel, keine Änderung an autonomen Fragen, Neugier, Energie,
DB-Architektur, kein Cache, kein neues Feature. Der vom Bericht vorgeschlagene Teil 2
verletzt die Minimalität und wird deshalb verworfen.

## 6. Regressionsrisiko (geprüft)

| Fall | vorher | nach korrigiertem Patch | Bewertung |
|---|---|---|---|
| normale Informationsfrage („Welche Grafikkarte habe ich?“) | 0.120 behalten | unverändert | ok |
| Frage mit eindeutigem Thema („Was esse ich gerne?“) | 0.120 behalten | unverändert | ok |
| Frage ohne Thema („Wer bin ich?“) | Thema `wer` | Thema `null`, **Suchbegriffe leer** | siehe Risiko R1 |
| „was“ | Thema `null` | unverändert | ok |
| „warum“ („Warum bin ich müde?“) | Thema `warum` | Thema `müde` | besser |
| „wie“ | Thema `wie` | Thema `alt` / `geburtstag` | behoben |
| „wo“ | Thema `wohne` | unverändert `wohne` | offen (Muster-Lücke) |
| „wer“ | Thema `wer` | Thema `null` | Risiko R1 |
| Frage mit passender Erinnerung | verworfen | behalten | Ziel erreicht |
| Frage ohne passende Erinnerung | verworfen | **weiterhin verworfen** | ok |

**R1 – das wesentliche Regressionsrisiko, in der Selbstdiagnose nicht genannt:**
`contentTokens` wird ausserhalb des Abrufs als Inhaltsprüfung („hat der Text
überhaupt Inhalt?“) benutzt – `src/orb-core/presence.ts:202`, `gaps.ts:181`/`:241`,
`curiosity.ts:186`, `continuity.ts:85`/`:109`, `context.ts:137`. Werden Fragewörter dort
entfernt, gilt „Wer bin ich?“ als inhaltsleer und kann aus Kontextzeile, Neugier,
Fadenbildung und Lückenanalyse herausfallen. **Empfehlung:** den Fragewortfilter nur in
`contentTokenPairs` (Themenbestimmung) anwenden oder eine getrennte Funktion für die
Themenbestimmung verwenden – **nicht** pauschal in `contentTokens`. Dieser Punkt weicht
vom vorbereiteten Patch-Text ab und muss vor einer Freigabe entschieden werden.

**R2:** „Wie“ als Suchbegriff fällt weg – das ist eine Verbesserung (ein Platz mehr von
drei), kein Risiko. **R3:** Kandidatenmenge wächst nur um den bestehenden
Informationsbereich-Kreis (`CANDIDATE_LIMIT`, begrenzt); die DB-Operationen pro
Nachricht steigen **nicht** über den P9-Stand, weil die Themenabfrage bereits heute
läuft (mit nutzlosem Thema). **R4:** Neue Bereiche `alter`/`wohnort` werden auch beim
Speichern zur Themenzuordnung genutzt – bestehende Knoten behalten ihr altes Thema,
neue erhalten das genauere; keine Migration, aber eine Inkonsistenz-Duldung, die bewusst
akzeptiert werden muss.

## 7. Modellgrenze

Der Fehler liegt vollständig **vor** dem Modellaufruf: Kandidatensuche, Overlap-Filter
und Auswahl laufen in `retrieveCandidates`/`processInput`, bevor die Kontextzeile
gebildet wird. **Die Korrektur kann vollständig vor dem Model Call erfolgen – keine
Promptänderung, kein Modellwechsel, kein zusätzlicher Modellaufruf nötig.**

## 8. Erforderliche Regressionstests (entworfen, nicht angewendet)

Vorhandene Nachweise: `tests/orb-memory-recall-fix.test.ts` (Bereich/Affinität),
`tests/orb-memory.test.ts` (Duplikate, Relevanz, Ebenen),
`tests/orb-topic-classification.test.ts`, `tests/orb-context.test.ts`,
`tests/orb-curiosity.test.ts`. Der vorbereitete Fall
`tests/orb-memory-recall-age.regression.test.ts` (im Patch-Text enthalten) deckt bereits
ab: Fragewort wird nicht Thema, Bereich erkannt, Kandidat überlebt, fremder Bereich
nicht verbunden.

Zusätzlich gefordert:

1. **VORHER/NACHHER-Nachweis:** „Wie alt bin ich?“ × „Ich bin 36 Jahre.“ –
   `max(similarity, topicAffinity)` ist heute exakt `0` und muss nach der Korrektur
   `TOPIC_AFFINITY_FLOOR` erreichen.
2. **Gegenprobe Ausschluss bleibt:** „Wie alt bin ich?“ × „Der Nutzer war letzte Woche
   wandern.“ und × „RTX 5070 OC“ bleiben exakt `0` (verworfen).
3. **Filterinvariante:** `engine.server.ts` enthält weiterhin `.filter((c) => c.overlap > 0)`
   und `TOPIC_AFFINITY_FLOOR === 0.12`; `shouldPersist(0.35) === true`,
   `shouldPersist(0.25) === false`.
4. **Formelinvariante:** `memoryRelevance` bei `similarity: 0` ergibt `0`.
5. **R1-Schutz:** `contentTokens("Wer bin ich?")` darf nicht leer werden bzw. die
   Kontext-, Neugier- und Fadenprüfungen für reine Fragen bleiben unverändert
   (Tests in `orb-context`, `orb-curiosity`, Kontinuität).
6. **Wohnort-Fall:** „Wo wohne ich?“ × „Der Nutzer wohnt in Leipzig.“ muss behalten
   werden – schlägt mit dem heutigen Patch-Text **fehl**.
7. **Kostenmessung:** DB-Operationen pro Nachricht vor/nach identisch (P6/P9-Stand),
   Modellaufrufe 0.
8. Volle Logik-Suite, DB-/Sicherheitstests, Typprüfung, Lint, Build.

## 9. Erwartete Wirkung

Fragen ohne Wortüberschneidung, deren Informationsbereich ergänzt wurde (Alter,
Geburtstag, Wohnort), erreichen die gespeicherte Erinnerung. Bestehende Fälle bleiben
identisch; unpassende Erinnerungen bleiben verworfen. Keine Änderung an Antwortstil,
Prompt, Modell, Energie, Neugier, autonomen Fragen oder Datenbankstruktur.

## 10. Offene Punkte

- **O1:** Entscheidung zu R1 – Fragewortfilter nur in `contentTokenPairs` statt auch in
  `contentTokens`. Abweichung vom vorbereiteten Patch-Text.
- **O2:** `wohnort`-Muster unvollständig (`wohnt|wohnen|lebt|leben|zuhause` fehlen).
- **O3:** `DOMAIN_PATTERNS` deckt nur sechs Bereiche ab; jede weitere Wissensart
  (Familie, Haustiere, Sprache, Musik) bleibt blind. Grundsatzfrage, nicht Teil dieses
  Fixes.
- **O4:** Der Fallback „erstes Inhaltswort als Thema“ erzeugt weiter Pseudothemen
  (`jahre`, `nutz`) – Themenzuordnung gespeicherter Erinnerungen bleibt grob.
- **O5:** Wirkung unter echter Datenlast (Kandidatenmenge, Bewertungslast) nicht
  gemessen – UNBEKANNT, kein Messweg ohne Produktionsdaten.
- **O6:** Die Behauptung „Ersatzthema verursacht 0.000“ in
  `src/orb-dev/diagnose.server.ts:61`/`:113` ist nach dieser Prüfung **sachlich
  ungenau** und sollte bei einer Freigabe mitkorrigiert werden.

## 11. Status

**KEIN PATCH ANGEWENDET.** Keine Datei in `src/` verändert, kein Schema, keine Daten,
keine Migration, kein Deployment, keine Schwelle, keine Relevanzformel, keine weitere
Selbstdiagnose. **ABSOLUTER STOPP** – Warten auf menschliche Freigabe.
