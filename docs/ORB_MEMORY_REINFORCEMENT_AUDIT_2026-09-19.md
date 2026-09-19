# ORB CORE – MEMORY REINFORCEMENT AUDIT (2026-09-19)

Art: **READ-ONLY AUDIT**. Keine Codeänderung, keine Migration, keine Schema-/RLS-/Grant-Änderung,
keine Änderung an Thresholds, Gewichtungen, Decay, Reactivation, Similarity, Confidence,
Importance oder Learning Events. Es wurden ausschliesslich Dateien gelesen, bestehende Tests
ausgeführt und lesende Datenbankabfragen gestellt.

Geprüfter Stand: ORB-Core/SDK/Adapter-Stand des Release `216970db` („ORB SDK in Production
übernommen"), identisch mit dem zuvor geprüften Staging-Changeset. Dieselben Dateien liegen in
Staging und Production; die Analyse gilt für beide Stände.

---

## 1. Executive Summary

**Ergebnis: Das beobachtete Verstärken eines bestehenden Memory-Eintrags bei erneut gleicher
Information ist korrektes, bewusst so entworfenes Verhalten der bestehenden ORB-Memory-Architektur.
Kein Fehler.**

Begründung in einem Satz: Gleichheit wird über den konservativen Duplikatschlüssel `norm_key`
bestimmt; bei identischem Schlüssel wird der bestehende Knoten aktualisiert (Aktivierung,
Aktualität, Wichtigkeit, Konfidenz) statt ein zweiter Knoten angelegt — abgesichert zusätzlich
durch den Unique-Index `orb_nodes_user_norm_key_uidx` auf `(user_id, norm_key)`.

**Sekundärbefund (dokumentiert, NICHT behoben):** Der Exact-Match wird gegen den *Rohtext* der
Nutzereingabe gebildet, nicht gegen den bei einer Merk-Aufforderung aufgelösten Inhalt
(`memoryText`). Existiert bereits ein Altknoten mit dem Schlüssel der Aufforderung selbst
(hier: `lieblingsess-merke`, angelegt vor dem Conversation-Context-Fix), verstärkt ORB diesen
Altknoten und speichert die aufgelöste Angabe („Schnitzel und Brokkoli") nicht als eigenen Knoten.
Details in Abschnitt 6.

**RELEASE BLOCKER: NEIN** (Begründung in Abschnitt 12).

---

## 2. Tatsächlich beteiligte Dateien

| Datei | Rolle im Flow |
| --- | --- |
| `src/orb-core/engine.server.ts` | Orchestrierung: Abruf, Entscheidung, Persistenz, Reinforcement |
| `src/orb-core/memory.ts` | `normKey`, `contentTokens`, `similarity`, `isSameMemory`, `topicOf`, `memoryRelevance`, `memoryLevel`, `selectByLevel`, `confidenceFor` |
| `src/orb-core/core.ts` | `scoreImportance`, `shouldPersist`, `isLearningEvent`, `reinforcement`, `currentWeight`, `reactivate`, `decide`, `nextState` |
| `src/orb-core/context.ts` | 8-Zeilen-Gesprächskontext, `detectExplicitLearningRequest`, `resolveFromContext` |
| `src/orb-core/continuity.ts`, `continuity-store.server.ts` | Gedankenfäden (`syncThreads`) — kein Einfluss auf Node-Dedup |
| `src/orb-core/curiosity.ts`, `presence.ts` | eigene Fragen / Präsenz — nicht Teil des Dedup-Pfads |
| `src/orb-sdk/index.ts`, `src/orb-sdk/orb-core.server.ts` | SDK-Grenze (Typen, Kennwerte, serverseitiger Einstieg) |
| `src/integrations/y-dude-orb/orb.functions.ts` | Y-Dude-Adapter, ausschliesslich `@/orb-sdk/orb-core.server` |
| Persistenz | Tabelle `public.orb_nodes` (+ `orb_connections`, `orb_interests`, `orb_messages`, `orb_state`, `orb_metrics`) |
| Tests | `tests/orb-memory.test.ts`, `orb-core.test.ts`, `orb-context.test.ts`, `orb-sdk-contract.test.ts`, `orb-continuity.test.ts`, `orb-curiosity.test.ts`, `orb-presence*.test.ts`, `orb-avatar.test.ts` |

---

## 3. Tatsächlich ausgeführter Memory-Flow

```text
User Input (Adapter → SDK → Core: engine.server.ts)
  ↓ retrieveCandidates(text)                       engine.server.ts:684-748
      norm_key = normKey(text)                     memory.ts:317
      4 begrenzte Abfragen: norm_key | topic | last_accessed | ilike-Token
      exact = Kandidat mit gleichem norm_key       engine.server.ts:746
  ↓ Relevanzranking + Ebenen A/B/C                 memory.ts:452-501
      memoryRelevance = sim × weight × imp × recency × activation
      recalled = selectByLevel(...)                engine.server.ts:954
  ↓ learning  = isLearningEvent(text)              core.ts:138  (nur Fehler-/Korrekturmarker)
    importance = scoreImportance(text, {learning}) core.ts:95
  ↓ Gesprächskontext: letzte 8 orb_messages        engine.server.ts:971-985 / context.ts:25
    Merk-Aufforderung erkannt + aufgelöst          context.ts:79,127
    memoryText = aufgelöste Aussage ODER text      engine.server.ts:994
  ↓ Sprachschicht (AI) erzeugt Antwort
  ↓ Gedächtnis-Update                              engine.server.ts:1168-1289
      (1) alle `recalled` Knoten reaktivieren      :1174-1189
      (2) exact vorhanden  → bestehenden Knoten verstärken   :1198-1213
          sonst shouldPersist(importance) || Antwort auf eigene Frage
                               → NEUEN Knoten anlegen        :1214-1246
          sonst                → nichts speichern
      (3) Verbindungen verstärken/anlegen (touchConnection)   :1249-1268
      (4) Interessen fortschreiben                            :1271-1273
      (5) offene eigene Frage schliessen                      :1279-1289
  ↓ Threads / State / Metrics fortschreiben
```

### Antworten auf die Einzelfragen

- **Erkennung:** in `retrieveCandidates` über `normKey(text)` plus Thema-, Aktualitäts- und
  Textsuche; „bekannt" = gleicher `norm_key` derselben `user_id`.
- **Importance:** `scoreImportance` — Basis 0.25, +0.2 bei Markern (u. a. „merk"), +0.15 bei
  persönlichen Mustern („ich mag", „ich bin", …), +0.1/+0.1 bei Länge > 60/200, +0.05 bei „?",
  +0.35 bei Lernereignis. Schwelle `shouldPersist` = 0.35.
- **Similarity/Matching:** zwei getrennte Verfahren. `normKey` (sortierte Schlüsselwörter,
  Verneinung als `neg` erhalten) entscheidet ausschliesslich über Duplikate; `similarity`
  (Jaccard über Inhaltswörter) beeinflusst nur das Relevanzranking, niemals die Zusammenlegung.
  `isSameMemory` ist exakte Schlüsselgleichheit — keine unscharfe Fusion.
- **Entscheidung:** exact → verstärken; kein exact und `importance ≥ 0.35` (oder Antwort auf eine
  eigene ORB-Frage) → neuer Knoten; sonst nichts speichern.
- **Geänderte Felder beim bestehenden Knoten:** `activation_count + 1`, `last_accessed_at = now`,
  `importance = max(alt, neu)`, `confidence = max(alt, confidenceFor(source, activation_count+1))`.
  Es wird kein Knoten angelegt, kein Knoten gelöscht, `content` und `norm_key` bleiben unverändert.
- **Learning Event:** nur `isLearningEvent(text)` (Fehler-/Korrekturmarker) setzt
  `metadata.learning_event` beim *Insert* und erhöht `cracks` im Zustand. Beim reinen Verstärken
  wird kein Learning Event erzeugt; ein Lernereignis entsteht zusätzlich beim Schliessen einer
  eigenen ORB-Frage (`closeOpenQuestion`).
- **Decay/Reactivation:** Verfall betrifft ausschliesslich das *berechnete* Verbindungsgewicht
  (`currentWeight`, `reactivate`); Knoten verfallen nicht und werden nie gelöscht. Jede
  Verstärkung zählt in `orb_state.reactivation_count`.
- **User-Kontext:** jede Abfrage und jedes Update ist auf `user_id` eingeschränkt, der
  Unique-Index ist `(user_id, norm_key)` — Dedup wirkt ausschliesslich innerhalb eines Nutzers.

---

## 4. Existing Memory Test (bereits vorhandene Information)

Deterministisch über die tatsächlichen Core-Funktionen gemessen (read-only Skript ausserhalb des
Projekts, keine Projektdatei verändert):

| Eingabe | `norm_key` | importance | persist? |
| --- | --- | --- | --- |
| `Ich esse am liebsten Schnitzel und Brokkoli` | `brokkoli-esse-liebst-schnitzel` | 0.25 | nein |
| `Ich esse am liebsten Schnitzel und Brokkoli.` | `brokkoli-esse-liebst-schnitzel` | 0.25 | nein |
| `Merke dir mein Lieblingsessen` | `lieblingsess-merke` | 0.45 | ja |
| `Meine Lieblingsfarbe ist Orange` | `lieblingsfarbe-orange` | 0.25 | nein |
| `Was esse ich gerne?` | `esse` | 0.30 | nein |

`isSameMemory` Satz 1 ↔ Satz 2 = **true** (Punkt/Whitespace irrelevant), Essen ↔ Merk-Aufforderung
= false, Essen ↔ Farbe = false.

**A – zweiter Eintrag?** Nein. **B – bestehender Eintrag erkannt?** Ja, über `norm_key`.
**C – geänderte Felder:** `activation_count`, `last_accessed_at`, `importance` (nur nach oben),
`confidence` (nur nach oben). Zusätzlich: Verbindungen zu den mitabgerufenen Knoten werden
verstärkt oder angelegt, `orb_interests` fortgeschrieben, `orb_state.reactivation_count` erhöht.
Kein Learning Event, kein Löschen, `content`/`norm_key`/`source` unverändert.

Belegt in Production-Daten (lesend): der Knoten `Merke dir mein Lieblingsessen`
(`norm_key = lieblingsess-merke`) steht bei `activation_count = 4`, `importance = 0.45`,
`confidence = 0.9` — genau ein Eintrag, mehrfach verstärkt. Ebenso `Ich mag Pizza mit Ananas.`
(`anana-mag-pizza`, `activation_count = 2`) neben getrennten anderen Essens-Knoten:
semantisch verschiedene Aussagen bleiben getrennt.

---

## 5. New Memory Test (wirklich neue Information)

`Meine Lieblingsfarbe ist Orange` → `norm_key = lieblingsfarbe-orange`, kein bestehender Knoten,
Thema `lieblingsfarbe`, **importance 0.25 < Schwelle 0.35 → es wird KEIN Knoten angelegt**
(kein Learning Event, keine Persistenz), solange die Aussage nicht gleichzeitig eine Antwort auf
eine offene ORB-Frage ist. Erst zusätzliche Signale (persönliches Muster wie „ich mag",
Merk-Marker, Länge, Lernereignis, oder eine offene ORB-Frage) heben die Wichtigkeit über die
Schwelle; dann wird ein neuer Knoten mit `activation_count = 1`, `confidence = 0.9`
(`user_stated`), `type = memory` und eigenem `norm_key` persistiert.

Damit ist die Unterscheidung eindeutig: **bekannt** → bestehender Knoten verstärkt;
**neu und bedeutsam** → neuer Knoten; **neu und unbedeutend** → bewusst nichts gespeichert.
Dass die Schwelle viele reine Vorlieben-Sätze nicht speichert, ist bestehendes gewolltes
Verhalten (`shouldPersist`) und wurde nicht verändert.

---

## 6. Explicit Remember Test („Merke dir …")

Auflösung funktioniert wie geprüft: Aufforderung erkannt
(`referent = "mein lieblingsessen"`, nicht pronominal), gegen das 8-Zeilen-Fenster aufgelöst zu
`Ich esse am liebsten Schnitzel und Brokkoli` (2 Stammtreffer). Ohne passenden Kontext liefert
`resolveFromContext` `null` — ORB fragt nach und erfindet nichts.

Danach greift jedoch die Reihenfolge in `engine.server.ts`:

1. `exact` stammt aus `retrieveCandidates(db, userId, text, q)` — **Rohtext**, Schlüssel
   `lieblingsess-merke`.
2. `memoryText` (die aufgelöste Angabe) wird erst im *Insert*-Zweig verwendet
   (`content`, `norm_key`, `topic`).

Folge, zwei Fälle:

- **Kein Altknoten mit dem Schlüssel der Aufforderung:** Insert-Zweig, `importance = 0.45 ≥ 0.35`,
  gespeichert wird die aufgelöste Angabe mit eigenem `norm_key`. Erwartetes Verhalten.
- **Altknoten vorhanden** (in Production real: vor dem Context-Fix entstanden): Zweig (2)
  verstärkt den Altknoten `Merke dir mein Lieblingsessen`; die aufgelöste Angabe wird **nicht**
  als eigener Knoten gespeichert. Genau das wurde beim Release beobachtet und ist in den
  Production-Daten sichtbar (kein Knoten enthält „Schnitzel").
- Randfall: existiert die aufgelöste Aussage bereits als Knoten, schlägt der Insert mit `23505`
  fehl und wird bewusst als zweiter Knoten **ohne** `norm_key` gespeichert (Regel „bei Unsicherheit
  lieber zwei Knoten"; `engine.server.ts:1232-1242`).

Bewertung: Die *Dedup-/Reinforcement-Logik selbst* arbeitet korrekt. Der Sekundärbefund ist eine
Inkonsistenz der *Reihenfolge* (Match auf `text` statt auf `memoryText`) im Zusammenspiel mit
Altdaten — kein Datenverlust (nichts wird gelöscht), keine falsche Erinnerung, keine
Nutzer-Vermischung. **Gemäss Auftrag nicht behoben.** Betroffene Datei:
`src/orb-core/engine.server.ts` (Zeilen 684-748, 994, 1196-1246).

---

## 7. No-Context Test (Test C, „Was esse ich gerne?")

Aus dem Code und den gemessenen Werten: `Was esse ich gerne?` hat `importance = 0.30 < 0.35` und
`topic = null`, wird also nicht gespeichert. Gibt es keine passende Erinnerung, ist `recalled = 0`;
`decide` greift dann über die Regel `isQuestion && recalled === 0` → **`ask`** (`core.ts:185-187`),
die Sprachschicht erhält keinen Erinnerungsinhalt und keinen belegten Kontext. Ohne Beleg im
8-Zeilen-Fenster liefert zusätzlich `resolveFromContext` `null`. ORB kann die Angabe also nicht als
bekannt darstellen, sondern fragt nach.

Einschränkung (ehrlich benannt): Ein **live** durchgeführter Chat-Test mit einem neu angelegten,
isolierten Staging-Testkonto wurde in diesem Audit **nicht** ausgeführt. Grund: er würde
Testdaten/Konten anlegen, was über einen read-only-Audit hinausgeht; ein Production-Konto ist
ausgeschlossen. Die Aussage zu Test C beruht daher auf Codepfad plus deterministischer Messung,
nicht auf einem neuen Live-Lauf. Bestehende Testdaten wurden nicht gelöscht.

---

## 8. SDK Boundary

Unverändert und eingehalten:

```text
Y-Dude → src/integrations/y-dude-orb (Adapter) → src/orb-sdk → src/orb-core → orb_* Tabellen
```

- Ausserhalb von `src/orb-core/` und `src/orb-sdk/` importiert nur
  `src/integrations/y-dude-orb/orb.functions.ts` ORB-Logik — und zwar ausschliesslich
  `@/orb-sdk/orb-core.server` (10 dynamische Importe, alle über die SDK-Grenze).
- Kein direkter Import von `@/orb-core/*` in Y-Dude-Oberflächen; keine Umgehung des SDK.
- `src/orb-sdk/index.ts` exportiert weiterhin keine Memory-Interna (kein `normKey`,
  `similarity`, `scoreImportance`, `shouldPersist`, `memoryRelevance`, Decay/Reactivation).
- Es wurden keine Importe geändert oder hinzugefügt.

---

## 9. Database

- **Keine Migration ausgeführt.**
- **Keine neuen Tabellen**, keine Spaltenänderung.
- **Keine RLS-/Grant-Änderung.**
- Nur lesende Abfragen (`pg_indexes`, `SELECT` auf `orb_nodes`).
- Bestätigt vorhanden: Unique-Index `orb_nodes_user_norm_key_uidx` auf
  `(user_id, norm_key) WHERE norm_key IS NOT NULL` — die Dedup-Regel ist zusätzlich auf
  Datenbankebene abgesichert und wirkt nur je Nutzer.

---

## 10. Ausgeführte Tests

| Test | Ergebnis |
| --- | --- |
| `tests/orb-core.test.ts` | 18 bestanden |
| `tests/orb-memory.test.ts` | 22 bestanden |
| `tests/orb-context.test.ts` | 16 bestanden |
| `tests/orb-sdk-contract.test.ts` | 9 bestanden |
| `tests/orb-continuity.test.ts` | 36 bestanden |
| `tests/orb-curiosity.test.ts` | 28 bestanden |
| `tests/orb-presence.test.ts` | 20 bestanden |
| `tests/orb-presence-wait-fix.test.ts` | 11 bestanden |
| `tests/orb-avatar.test.ts` | 7 bestanden |
| **Summe** | **167 bestanden, 0 Fehler (9 Dateien)** |
| Deterministische Messung `normKey`/`importance`/`resolveFromContext` | durchgeführt, Ergebnisse in Abschnitt 4/6 |
| Lesende Datenbankprüfung (Index, `orb_nodes`) | durchgeführt |
| Live-Chat-Test mit neuem Staging-Testkonto | **nicht ausgeführt** (Abschnitt 7) |

---

## 11. Zukünftige Memory-Maturation

Nicht implementiert, nicht vorbereitet, keine Schwelle dafür geändert. Relevanz im bestehenden
Code ausschliesslich als Feststellung: Reifung existiert heute in abgeschwächter Form über
`activation_count`, `importance = max(alt, neu)`, `confidence` und `memoryLevel` (A/B/C). Ein
Kandidatenstatus („Beobachtung über Tage vor dauerhafter Speicherung") existiert nicht; heute
entscheidet allein `shouldPersist` zum Zeitpunkt der Eingabe. Rein als möglicher zukünftiger
Architekturpunkt vermerkt.

---

## 12. Release-Relevanz

**RELEASE BLOCKER: NEIN**

Technische Begründung:

1. Die Kernfrage ist positiv beantwortet: Verstärken eines bestehenden Eintrags bei erneut
   gleicher Information entspricht der bestehenden Architektur (konservativer `norm_key`-Dedup,
   „VERGESSEN ≠ LÖSCHEN"), ist durch Unit-Tests und den Unique-Index abgedeckt und ist kein Fehler.
2. Semantisch verschiedene Aussagen werden nicht zusammengelegt (Verneinung und Haltung bleiben
   im Schlüssel; Belege in Abschnitt 4) — das zentrale Datenqualitätsrisiko besteht nicht.
3. Der Sekundärbefund aus Abschnitt 6 betrifft nur das Anlegen eines zusätzlichen Knotens bei
   ausdrücklicher Merk-Aufforderung, wenn ein Altknoten mit dem Schlüssel der Aufforderung
   existiert. Er verursacht keinen Datenverlust, keine falsche Erinnerung, keine
   Cross-User-Sichtbarkeit, keine RLS- oder Berechtigungsschwäche und keinen Fehlerzustand im
   Gespräch; die Antwort an den Nutzer bleibt korrekt, weil der 8-Zeilen-Kontext greift.
4. Das Verhalten stammt aus der unveränderten Memory-Logik und den vor dem Context-Fix
   entstandenen Daten — es ist keine Regression des Release-Kandidaten.
5. Alle 167 ORB-/SDK-Tests sind grün, die SDK-Grenze ist intakt, Datenbank und RLS unverändert.

Offene Entscheidung (separat, nicht Teil dieses Audits): ob der Exact-Match künftig gegen
`memoryText` statt gegen den Rohtext gebildet werden soll. **Keine Lösung implementiert.**
