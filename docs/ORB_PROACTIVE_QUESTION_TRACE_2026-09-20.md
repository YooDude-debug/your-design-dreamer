# ORB Proactive Question – Read-Only Trace (2026-09-20)

READ-ONLY. Kein Code, keine Schwelle, keine Datenbankzeile, keine Rechte
geändert. Kein Deployment. Nur Diagnose.

Grundlage: Production-Code (`src/orb-core/*`, `src/integrations/y-dude-orb/*`,
`src/routes/_authenticated/channels.orb.tsx`) und lesende Abfragen auf
`orb_messages`, `orb_state`, `orb_questions`, `orb_nodes`, `orb_metrics`.

---

## 0. Kernbefund in einem Satz

Der Satz „Ja: Welche Pasta kochst du am liebsten?“ war **kein eigener
ORB-Impuls**, sondern eine vom Sprachmodell formulierte Rückfrage innerhalb des
Modus `DIRECT_ANSWER` (ausgelöst durch das „?“ in „gibt es fragen ?“). Der echte
Impulspfad (Curiosity/Presence/`decideImpulse`) wurde in diesem Gespräch **nie
freigegeben**, weil `energy = 0` ist. Die Abkühlphase (Cooldown) war **nicht**
der Blocker.

Belege:
- `orb_questions` enthält für diesen Verlauf **keine** Zeile; letzter Eintrag
  06:26/07:26 UTC (Themen „faktisch“, „hardware“, „erzähle“). Jeder echte
  Impuls würde dort zwingend eine Zeile schreiben
  (`engine.server.ts:2261` bzw. `1237`).
- Jede ORB-Nachricht des Verlaufs trägt `decision = stay_silent`, keine
  `decision = ask` (ein echter Impuls schreibt `ask`, `engine.server.ts:2285`).
- `orb_metrics` für 19:00–19:30 UTC: nur `turn` (14) und `analysis` (6), **kein**
  `proactive`.
- `orb_state` des Test-Nutzers: `curiosity 0.955`, `energy 0`, `joy 1`,
  `trust 1`, `uncertainty 0.875`, `updated_at 19:28:03Z`.

---

## A) PRESENCE

Beteiligte Stellen: `src/integrations/y-dude-orb/use-orb-presence.ts`,
`src/orb-core/presence.ts` (`shouldAskProactively`).

- Takt: 5 s, **nur im Browser** (`PRESENCE_TICK_MS`). Kein Server-Polling.
- Idle-Zeit: `now - lastActivity`. Zurückgesetzt bei Tippen, Senden, Sprache,
  laufender Anfrage, Tab-Rückkehr (`use-orb-presence.ts:61-95`).
- Erlaubtes Fenster: `PROACTIVE_MIN_IDLE_MS = 40_000` bis
  `PROACTIVE_MAX_IDLE_MS = 900_000`.
- Cooldown clientseitig: `PROACTIVE_COOLDOWN_MS[band]`; bei `curiosity ≈ 0.96`
  → Band `very_high` → 120 s. **Jede Nutzereingabe löscht den Cooldown**
  (`lastProactiveRef = null`, Zeile 64).
- Letzter Impulszeitpunkt: clientseitig `lastProactiveRef`, serverseitig
  `lastQuestionAt` = `max(asked_at)` aus `orb_questions`
  (`engine.server.ts:2033`) → für diesen Verlauf 07:26 UTC, also weit außerhalb
  jedes Cooldowns.
- Energy: wird von Presence **nicht** geprüft; der Client kennt sie nur zur
  Anzeige. Die Energieprüfung liegt serverseitig in `decideCuriosity`.

Zeitabstände im Verlauf (UTC): 19:16:12 → 19:16:21 (9 s) → 19:16:30 (9 s) →
19:16:39 (9 s) → 19:17:06 (27 s) → 19:17:16 (10 s) → 19:21:26 (**250 s**) →
19:21:55 (29 s) → 19:22:08 (13 s) → 19:22:34 (26 s) → 19:24:21 (**107 s**) →
19:24:37 (16 s) → 19:24:57 (20 s) → 19:25:13 (16 s).

Nur in den beiden großen Lücken (250 s, 107 s) konnte der Beobachter die 40-s-
Grenze überschreiten und `requestOrbCuriosity` genau einmal aufrufen. Ein
Ergebnis erreichte den Nutzer nicht: ein stiller Serverbescheid wird bewusst
verworfen (`channels.orb.tsx:222`, `if (!result.asked) return`).

## B) CURIOSITY

Beteiligte Stellen: `src/orb-core/curiosity.ts`,
`engine.server.ts:2187` (`askProactively`), `:2020-2051` (Kontextladen).

- `curiosity` selbst: 0.955–1.0 über das ganze Gespräch (aus
  `orb_messages.state_snapshot`). Band `very_high`, also **nicht** limitierend.
- Wissenslücken wären vorhanden: `orb_nodes` enthält Knoten mit
  `confidence 0.9 ≥ PROACTIVE_MIN_CONFIDENCE (0.5)` und Themen („fortnite“,
  „gefecht“, „hardware“, „neugi“ …), `gapKindsFor` liefert für „Ich esse gerne
  …“/„Für fortnite reicht es …“ mindestens `detail`/`kontext`, bei „gerne“ auch
  `grund`/`praeferenz`.
- Prüfreihenfolge in `decideCuriosity` (Zeilen 279-303):
  1. keine Lücke → DO_NOTHING
  2. Neugier zu gering → DO_NOTHING
  3. **`energy < CURIOSITY_MIN_ENERGY (0.15)` → WAIT** ← hier endet es
  4. offene eigene Frage → WAIT
  5. Cooldown → WAIT
  6. `score < CURIOSITY_ASK_THRESHOLD (0.2)` → WAIT
  7. sonst ASK

Da `energy = 0`, bricht die Kette **immer bei Schritt 3** ab. Der Punktwert
(`curiosityScore`) wird zwar berechnet (`deriveKnowledgeGaps` läuft vorher),
aber nie ausgewertet. Es wurde deshalb keine neue Curiosity-Frage erzeugt – nicht
wegen fehlender Neugier, sondern wegen Energie 0.

## C) IMPULSE

`decideImpulse` (`src/orb-core/impulse.ts:163`) wird ausschließlich in
`askProactively` (`engine.server.ts:2209`) aufgerufen – also nur über den
Leerlauf-Beobachter oder eine ausdrückliche „frag mich“-Aufforderung.

- Ein Impuls kann `decideCuriosity` vorgeschaltet überstimmen
  (`engine.server.ts:2238`), **aber** er braucht Lücken aus
  `ctx.detectedGaps` (Analysepfad `gaps.ts`, `GAP_MIN_CONFIDENCE 0.55`).
- Abbruchgründe in Reihenfolge: Nutzer-Unterdrückung → offene eigene Frage →
  Abkühlphase → keine Lücke → `score < IMPULSE_MIN_SCORE (0.2)`.
- Für diesen Verlauf ist **keine** Spur eines SPEAK-Ergebnisses vorhanden
  (kein `orb_questions`-Eintrag, kein `proactive`-Metrikeintrag, keine
  `decision = ask`-Nachricht). Ob `decideImpulse` überhaupt erreicht wurde,
  ist aus persistierten Daten nicht belegbar (siehe Punkt 6).
- „Nur einmal erlaubt“ gibt es als Regel nicht. Begrenzend wirken Cooldown,
  Duplikatprüfung (`IMPULSE_DUPLICATE_SIMILARITY 0.6`) und Novelty.

## D) CONVERSATION DECISION – Rekonstruktion je Nachricht

Regelreihenfolge `decideConversationMode` (`conversation.ts:147`):
1. `needsDirectAnswer(text)` → DIRECT_ANSWER
2. ausdrückliche Merk-Aufforderung → DIRECT_ANSWER
3. `impulseAllowed` → PROACTIVE_IMPULSE (nur im „frag mich“-Zweig gesetzt,
   `engine.server.ts:1159`; im normalen Gespräch **immer `false`**, Zeile 1066)
4. `curiosity ≥ 0.3` **und `energy ≥ 0.12`** und tragender Strang/offener Faden
   → FOLLOW_UP
5. `contextMessages ≥ 2` **und `energy ≥ 0.12`** → SMALLTALK
6. sonst LISTEN

Mit `energy = 0` sind Regel 4 und 5 dauerhaft geschlossen. Es bleiben nur
DIRECT_ANSWER (bei Frageform) und LISTEN.

| Zeit UTC | Nutzereingabe | rekonstruierter Modus | Grund | ORB-Antwort |
| --- | --- | --- | --- | --- |
| 19:16:12 | „Ich arbeite als Koch.“ | LISTEN | keine Frageform, Energie 0 | „Du arbeitest also als Koch …“ |
| 19:16:21 | „Was mache ich beruflich?“ | DIRECT_ANSWER | „?“ + „Was“ | „Du arbeitest als Koch.“ |
| 19:16:30 | „Hallo“ | LISTEN | Smalltalk-Muster erkannt, aber Energie 0 | „Hallo, ich höre zu.“ |
| 19:16:39 | „Danke“ | LISTEN | wie oben | „Gern.“ |
| 19:17:06 | „Welche Schuhgröße habe ich?“ | DIRECT_ANSWER | „?“ + „Welche“ | „… Schuhgröße 42 …“ |
| 19:17:16 | „Ich koche gern Pasta.“ | LISTEN | Aussage, Energie 0 | „Pasta gehört also zu deinen Kochvorlieben.“ |
| 19:21:26 | „genau“ | LISTEN | kein Anschlussgrund | „Verstanden.“ |
| 19:21:55 | „gibt es fragen ?“ | **DIRECT_ANSWER** | Regex `/\?/` | **„Ja: Welche Pasta kochst du am liebsten?“** |
| 19:22:08 | „penne“ | LISTEN | Aussage | „Du kochst also am liebsten Penne.“ |
| 19:22:34 | „gibr verschiedene soßen die gut sind“ | LISTEN | kein „?“, kein Muster | Soßen-Aufzählung |
| 19:24:21 | „magst du fortnite“ | LISTEN | kein „?“, „magst du“ ist kein Muster | „Ich habe keine eigenen Vorlieben …“ |
| 19:24:37 | „und wenn du welche hättest“ | LISTEN | – | hypothetische Antwort |
| 19:24:57 | „also gefällt dir doch was“ | LISTEN | – | „Das war nur hypothetisch gemeint …“ |
| 19:25:13 | „noch nicht ^^“ | LISTEN | – | „Wer weiß, was künftig …“ |

**PROACTIVE_IMPULSE wurde in diesem Verlauf nie vergeben.**

Wichtig zum Modus LISTEN: der Modus-Hinweis lautet „höchstens ein kurzer Satz,
keine Frage“ (`conversation.ts:213`). Genau das erklärt, warum nach 19:21:55
keine weitere Frage mehr erschien – die Sprachschicht hatte ab dann in jedem
Zug die ausdrückliche Anweisung, **nicht** zu fragen.

Die eine sichtbare Frage entstand dagegen im Modus DIRECT_ANSWER, dessen Hinweis
lediglich „knapp und konkret antworten, keine unnötige Rückfrage“ sagt. Auf
„gibt es fragen ?“ ist eine Frage die inhaltlich korrekte Antwort – sie kam vom
Sprachmodell, nicht aus dem Impulspfad.

## E) MEMORY / CONTEXT bei der Entscheidung

- Gesprächsfenster: 8 Nachrichten (`CONTEXT_WINDOW_MESSAGES`), flüchtig.
- Abruf: max. 6 belastbare Erinnerungen; bei DIRECT_ANSWER gehen diese
  vollständig mit, in allen anderen Modi nur Stränge mit Themenbezug oder
  `relevance ≥ MODE_RELEVANCE_MIN (0.18)`, hart begrenzt auf 2
  (`engine.server.ts:1075-1080`).
- Vorhandene Knoten zur Zeit des Gesprächs (Auszug, `confidence 0.9`):
  „Ich esse gerne Brokkoli, Schnitzel …“ (Thema `hardware`, importance 0.48,
  11 Aktivierungen), „Mein Lieblingsessen. Meine Grafikkarte und meine
  Schuhgröße …“ (0.48), „Für fortnite reicht es auf epische Einstellungen …“
  (Thema `fortnite`, 0.35), „Immer den Gefechten nach …“ (`gefecht`, 0.55),
  „Dein Neugier wert ist hoch …“ (`neugi`, 0.48).
- Auffällig für die Themennähe: mehrere Essens-Erinnerungen tragen das Thema
  `hardware` (Themenableitung aus dem ersten Inhaltswort). Das mindert die
  Themenüberdeckung für Pasta/Penne, ist aber nicht der Blocker – der Blocker
  ist Energie 0.

## F) COOLDOWN – ausdrückliche Prüfung

Der Cooldown hat die weiteren Fragen **nicht** verhindert:

1. Serverseitig ist `lastQuestionAt` der jüngste `orb_questions.asked_at` =
   07:26 UTC; um 19:21–19:25 sind das über 11 Stunden, also weit über den
   120 s des Bands `very_high`.
2. Clientseitig wird `lastProactiveRef` von **jeder** Nutzereingabe auf `null`
   gesetzt (`use-orb-presence.ts:64`). In einem laufenden Gespräch existiert
   daher praktisch kein Cooldown.
3. Die eine sichtbare Frage lief ohnehin nicht über den Impulspfad und hat
   deshalb keinen Cooldown gestartet (kein `orb_questions`-Eintrag, keine
   Zustandsänderung `curiosity -0.06 / energy -0.03`).

## G) SILENT STATE

`decide` (`core.ts:172-192`) prüft **zuerst** `state.energy < 0.12` und liefert
dann `stay_silent` („Energie zu niedrig – kurze Pause“). Genau das steht bei
**allen** ORB-Nachrichten des Verlaufs in `orb_messages.decision`.

`conversationDecision` wandelt diesen internen Steuerwert bei einer
Nutzereingabe in `answer` um (`core.ts:194 ff.`, genutzt in
`engine.server.ts:1195`), und `stripFakePauseClaim` verhindert, dass daraus ein
behaupteter „Pausen“-Text wird. Das Gespräch funktionierte also korrekt trotz
dauerhaft interner Stille – bestätigt durch den Verlauf.

---

## Antworten auf die sechs Fragen

1. **Warum kam die erste eigene Frage?** Weil „gibt es fragen ?“ das Muster
   `/\?/` erfüllt → Modus DIRECT_ANSWER → die Sprachschicht durfte antworten und
   hat als Antwort sinnvollerweise eine Frage formuliert. Kein Core-Impuls.
2. **Warum kam die nächste eigene Frage?** Im gesicherten Verlauf
   (19:16–19:25 UTC) ist nur **eine** ORB-Frage vorhanden. Eine zweite lässt
   sich nicht belegen; falls sie früher fiel, gehörte sie entweder zu den drei
   echten Impulsen aus `orb_questions` (18:05/18:07 UTC am 19.09., 07:26 UTC am
   20.09.) oder ebenfalls zu einer DIRECT_ANSWER-Antwort.
3. **Warum kam danach keine weitere?** Alle folgenden Eingaben waren keine
   Frageform → Modus LISTEN, dessen Anweisung „keine Frage stellen“ lautet; und
   der Impulspfad war durch `energy = 0` geschlossen.
4. **Welche konkrete Bedingung blockierte den nächsten Impuls?**
   `energy = 0` gegen zwei Schwellen: `CURIOSITY_MIN_ENERGY = 0.15`
   (`curiosity.ts:285`, liefert WAIT) und `energy ≥ 0.12` für FOLLOW_UP und
   SMALLTALK (`conversation.ts:180/194`). Zusätzlich: `impulseAllowed` ist im
   normalen Gesprächszweig fest `false` (`engine.server.ts:1066`), ein
   PROACTIVE_IMPULSE im laufenden Chat ist ohne „frag mich“-Formulierung
   konstruktiv nicht erreichbar.
5. **Ist das Verhalten erwartbar?** Ja, es folgt exakt der bestehenden Logik.
   Strukturell erwähnenswert (ohne Wertung, ohne Vorschlag): `energy` wird an
   jeder Stelle nur verringert (`core.ts:164`: `energy - 0.03 - 0.04·importance`;
   `engine.server.ts:2313`: `- 0.03`) und an keiner Stelle im Code wieder
   erhöht oder regeneriert. Sie steht seit dem 19.09. auf 0 – damit sind
   FOLLOW_UP, SMALLTALK und der gesamte Curiosity-Pfad dauerhaft gesperrt.
6. **Welche Runtime-Information fehlt?**
   - Ob `requestOrbCuriosity` in den beiden Leerlauflücken (250 s, 107 s)
     tatsächlich aufgerufen wurde: stille Ergebnisse werden weder als
     `orb_metrics`-Zeile noch als Log persistiert; Serverfunktions-Logs der
     letzten Stunde enthalten keine Einträge.
   - Der jeweils berechnete `curiosityScore` / `impulseScore` und die konkreten
     `detectedGaps` pro Zug – sie existieren nur im Speicher.
   - Der pro Zug tatsächlich gewählte `conversation.mode` und `reason`: sie
     stehen im Antwortobjekt der Serverfunktion, werden aber nicht in
     `orb_messages.state_snapshot` gespeichert. Die Tabelle oben ist daher eine
     Rekonstruktion aus Code + gespeicherten Zustandswerten, keine Aufzeichnung.

---

PRODUCTION CHANGED: NO · DATABASE CHANGED: NO · RLS CHANGED: NO ·
THRESHOLDS CHANGED: NO · DEPLOYMENT: NONE
