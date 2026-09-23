# ORB Memory-State Forensik — 2026-09-23

Read-only. Kein Patch, keine Migration, kein Deployment, keine Datenmutation,
0 Modellaufrufe. Alle Zahlen stammen aus lesenden Abfragen und aus dem Code.

## Antwort zuerst

**Sind die bisherigen ORB-Erinnerungen physisch noch vorhanden? — JA (BEWIESEN).**

Einordnung: **DATA_PRESENT (BEWIESEN)** + **DATA_RETRIEVAL_FAILED (BEWIESEN,
fallbezogen)**.
Widerlegt: DATA_DELETED, WRONG_USER, WRONG_SESSION, WRONG_ENVIRONMENT,
GRAPH_RETRIEVAL_FAILED, CONTEXT_INJECTION_FAILED (je BEWIESEN widerlegt, s. u.).

## 1. Memory-Datenbestand (BEWIESEN)

| Tabelle | Zeilen |
|---|---|
| orb_nodes (gesamt) | 117, davon 113 für den Hauptnutzer |
| orb_connections | 358 |
| orb_messages | 852 (821 Hauptnutzer) |
| orb_threads | 125 |
| orb_state | 2 Zeilen (eine je Nutzer) |

- Lifecycle des Hauptnutzers: **alle 113 Knoten `active`** (101 memory,
  11 decision, 1 perception). Kein `archived`, kein `dormant`.
- Zeitachse durchgehend: 19.09. = 16, 20.09. = 10, 21.09. = 45, 22.09. = 22,
  23.09. = 20 Knoten. Ältester Knoten 2026-09-19 17:57, neuester 2026-09-23 13:10.
- Es fehlt kein Tag, keine Lücke, kein Massenabgang.
- Konkret noch vorhanden (lesend gefunden): „Ich heiße Mario …“,
  „Korrekt aber mein Name ist Mario …“, „Ich esse gerne Brokkoli, Schnitzel …
  Schuhgröße 42 … RTX 5070“, „Ich bin 36 Jahre Alt …“.
- Löschungen/Änderungen: keine Hinweise. Löschpfade existieren im Retrieval-Weg
  nicht (der Abrufpfad schreibt nur `activation_count`, `last_accessed_at`,
  `importance`).
- **Neue Migrationen: keine.** Jüngste Migration 2026-08-28 — also 22 Tage vor
  P15/P16/P17. Schema von `orb_nodes`/`orb_state` unverändert.

## 2. User-Scope (BEWIESEN)

Derselbe Nutzer, dieselbe Kennung: `9ce1d1b0-…67297` trägt 113 von 117 Knoten,
die einzige aktive `orb_state`-Zeile (erstellt 19.09. 17:50, zuletzt
aktualisiert 23.09. 13:21) und 821 Nachrichten. Neue Knoten von heute liegen
unter derselben Kennung. Kein Scope-Wechsel, kein zweiter Nutzer im Spiel.

## 3. Session-Scope (BEWIESEN)

ORB hat kein Session- oder Conversation-Feld: Gedächtnis und Gesprächsablage
sind ausschließlich über `user_id` verknüpft (`orb_nodes.user_id`,
`orb_messages.user_id`; RLS `user_id = auth.uid()`). Eine „falsche Sitzung“ ist
technisch nicht möglich. WRONG_SESSION entfällt.

## 4. Environment (BEWIESEN)

Ein Backend für Vorschau und Veröffentlichung (`lxhdvbtkulwgkvqpjsvt`) —
identisch in `.env`, `.env.development`, `.env.production`. Kein zweites
Projekt, keine zweite Datenbank. WRONG_ENVIRONMENT entfällt.

## 5. Retrieval — der Pfad und die Bruchstelle

Pfad: `sendOrbInput` → `processInput` (`engine.server.ts:895+`) →
`retrieveCandidates` (`engine.server.ts:647`) → Bewertung/Filter
(`engine.server.ts:930–961`) → Prompt (`llm/prompt.server.ts`).

`retrieveCandidates` stellt bis zu fünf begrenzte Abfragen, **alle mit
`eq("user_id", userId)`, ohne Lifecycle-Filter**:
1. `norm_key` = Schlüssel der Eingabe (limit 1)
2. `topic` = `topicOf(text)` (limit 20)
3. `topic` = `questionIntentOf(text)`, falls abweichend (limit 20)
4. Ebene A: 10 Knoten nach `last_accessed_at` DESC
5. `content ilike %stamm%` für bis zu 3 Inhaltswörter (limit 20)

Danach: `overlap = max(similarity, topicAffinity)`, harter Filter
`overlap > 0`, Auswahl `selectByLevel(…, 6)`.

**Retrieval arbeitet grundsätzlich weiter (BEWIESEN):** die letzten acht
ORB-Nachnachrichten von heute tragen `recalled` = 1, 2, 0, 6, 6, 1, 5, 4.
Es kommen also sehr wohl Erinnerungen vor dem Modell an → CONTEXT_INJECTION_FAILED
widerlegt; der Prompt führt sie als „Aktive Erinnerungen“.

**Fallbezogener Ausfall (BEWIESEN, deterministisch nachgespielt** — reine Logik,
ohne Datenbank, ohne Modell, Hilfsdatei nach der Messung gelöscht**):**

| Eingabe | Inhaltswörter | topicOf | Fragebereich | Treffer „Essen/Schuhgröße/RTX“-Knoten |
|---|---|---|---|---|
| „Mein Lieblingsessen“ | lieblingsess | lieblingsess | – | 0.000 → verworfen |
| „Welche hab ich“ | welche | – | – | 0.000 → verworfen |
| „Wie heiße ich?“ | wie, heiße | heiße | – | 0.000 → verworfen |
| „Was esse ich gerne?“ | – | – | essen | 0.000 → verworfen |
| „Welche Schuhgröße habe ich?“ | welche, schuhgröße | schuhgröße | – | 0.111 → gefunden |

**Exakte Bruchstelle (BEWIESEN):** Der Knoten mit den persönlichen Angaben
vermischt mehrere Bereiche in einem Satz („Brokkoli, Schnitzel … Schuhgröße 42
… RTX 5070“). Die Bereichszuordnung ist prioritätsgesteuert und der erste
Treffer gewinnt — `hardware` steht in `recall.ts` an erster Stelle, also lautet
der Bereich dieses Knotens **`hardware`, nicht `essen`**. Deshalb liefert
`topicAffinity("Was esse ich gerne?", …)` **0**, und weil kein Wortstamm
überlappt („Lieblingsessen“ ≠ „esse/Schnitzel“ nach Stammbildung), greift auch
`similarity` nicht. Der harte Filter `overlap > 0` verwirft den Knoten, bevor er
das Sprachmodell erreicht. Gleiches gilt für den Namen: `topicOf` des
Namens-Knotens ist `korrekt`, es gibt keinen Bereich „Name“, und „Wie heiße
ich?“ teilt mit „mein Name ist Mario“ keinen Wortstamm.

Die Ursache liegt damit **vollständig vor dem Modellaufruf** und ist nicht die
Antwort des Modells: ORB sagt sachlich korrekt, dass die Angabe im verfügbaren
Kontext nicht vorliegt.

## 6. Graph (BEWIESEN)

358 Verbindungen vorhanden, keine verwaisten Knoten nötig; die
Momentaufnahme lädt Knoten und Kanten mit `limit 40` je Seite, nach
`importance`/`weight` sortiert — eine bewusst begrenzte Teilansicht, kein
Datenverlust. Der Abrufpfad lädt Kanten nur zu den gefundenen Kandidaten.
GRAPH_RETRIEVAL_FAILED: widerlegt. Einschränkung (BEWIESEN): die Oberfläche
zeigt bei 113 Knoten nur 40 — Anzeigegrenze, keine Löschung.

## 7. P15 (BEWIESEN)

P15 hat genau zwei Dinge geändert (letzter Commit an `memory.ts`/`recall.ts`):
- `recall.ts`: zwei zusätzliche Bereiche `alter`, `wohnort`.
- `memory.ts`: Fragewörter werden in `contentTokenPairs` übersprungen.

`contentTokenPairs` wird ausschließlich von `topicOf` und `topicsOf` benutzt.
**Nicht betroffen:** `normKey` (nutzt `keyTokens`), `similarity` und
`contentTokens`, Relevanzformel, Speicherschwelle, Speicherpfad, Graph,
User-Scope. P15 kann daher weder Daten verlieren noch den Nutzerbezug ändern.

Einzige belegbare Nebenwirkung auf den Abruf (WAHRSCHEINLICH, Ausmaß minimal):
Vor P15 konnte eine Frage über ein Fragewort-Thema Knoten treffen, die selbst
unter einem Fragewort-Thema abgelegt wurden. Im Datenbestand existiert genau
**ein** solcher Knoten (`topic = 'warum'`). Das erklärt den beobachteten
Ausfall nicht.

## 8. P16 (BEWIESEN)

Die synthetische Vorlage liegt in `tests/helpers/` und in isolierten
Sandbox-Kopien. Lesende Prüfung: **weder `src/orb-dev` noch `tests/helpers`
enthalten eine Referenz auf `orb_nodes`, `orb_state` oder `orb_messages`** — die
Reparaturstrecke kann den produktiven Gedächtniszustand nicht berühren.

## 9. P17 (BEWIESEN)

P17 war rein forensisch: kein Commit an `memory.ts`, `recall.ts`,
`engine.server.ts` oder am Sprachpfad seit P15. Die P12/P17-Commits betreffen
nur `toolbox/*`, `orb-sdk` und `src/lib/orb-toolbox.functions.ts`. Kein
Tool-Wiring-Schritt liegt im Memory-Pfad.

## 10. Vergleich mit dem letzten bekannten Zustand

- Vorher nachweislich vorhanden: Name, Alter, Essen, Grafikkarte, Schuhgröße —
  **heute alle noch vorhanden** (Abschnitt 1).
- Retrieval-Codepfad vorher = heute (`retrieveCandidates` → `overlap > 0` →
  `selectByLevel`); die einzige Änderung ist P15, und die erweitert den
  Kandidatenkreis, verengt ihn nicht.
- Was sich tatsächlich verändert hat: der Datenbestand selbst. 20 neue Knoten
  allein heute, überwiegend Gesprächssätze mit generischen Themen („nur“,
  „okay“, „denke“, „zugang“). Die Ebene-A-Abfrage lädt nur 10 Knoten nach
  Letztzugriff — je mehr frische Gesprächsknoten, desto unwahrscheinlicher,
  dass ein älterer Tatsachenknoten ohne Wort- oder Bereichstreffer noch in den
  Kandidatenkreis gelangt (WAHRSCHEINLICH, verstärkender Faktor).
- Zusatzbefund (BEWIESEN, nicht Ursache): `orb_state.energy` = 0.25 bei
  `curiosity` 0.98; der Schweige-Schwellwert liegt bei 0.12, ist also nicht
  erreicht.

## 11. Wahrscheinlichste Ursache (nur soweit belegt)

Die Erinnerungen sind vollständig vorhanden; verloren geht **der Zugriff im
Kandidaten- und Filterschritt vor dem Sprachmodell**, weil
(a) ein Sammelknoten mehrere Bereiche vermischt und prioritätsbedingt als
`hardware` geführt wird, (b) für „Name“ kein Bereich existiert und
(c) der harte Filter `overlap > 0` ohne Wort- oder Bereichstreffer verwirft.
Unverändert UNBEKANNT bleibt, ob dieselben Fragen vor P15 erfolgreich waren —
dazu liegen keine Protokolle mit Trefferzahlen pro Frage vor.

## Kein Fix

Es wurde nichts geändert. Jeder Eingriff braucht eine eigene ausdrückliche
Freigabe. **ABSOLUTER STOPP.**
