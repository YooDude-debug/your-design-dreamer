# ORB CORE – „NICHT JETZT FRAGEN"-REGEL · FIX DESIGN ONLY

Datum: 2026-09-22 · Modus: **DESIGN ONLY** · 0 Codeänderungen · 0 Tests geändert · 0 SQL · 0 Migration · 0 Threshold · 0 Deployment

Grundlage: `docs/ORB_AUTONOMOUS_THINKING_NO_QUESTION_FORENSIC_2026-09-22.md` (nur Orientierung). Alle Aussagen hier sind erneut gegen den aktuellen Code und die aktuellen Daten geprüft. Klassifikation: **CODE-BEWIESEN**, **DB-BEWIESEN**, **RUNTIME-BEWIESEN**, **TEST-BEWIESEN**, **WAHRSCHEINLICH**, **OFFEN**.

---

## 1. Bestätigte Root Cause

Eine harmlose Nutzernachricht schaltet die eigenständigen Fragen stumm, weil die Abwink-Erkennung ausschliesslich auf dem Vorkommen einzelner Wortfolgen im Rohtext beruht — ohne Wortgrenze, ohne Satzrolle, ohne Absichtsprüfung.

Belege:
- Nutzernachricht 2026-09-22 07:08:01 UTC: „auch. haben wir später frieden beschlossen ?" (DB-BEWIESEN).
- Nachvollzug mit der echten Funktion `readUserControl()` über die letzten 12 Nutzertexte: genau dieser Satz liefert `preference = "suppress"`, `reason = "Der Nutzer möchte dieses Thema gerade nicht vertiefen."` (CODE-/RUNTIME-BEWIESEN).
- Erfasster Serverversuch 2026-09-22T07:09:40.127Z: `result: "silent"`, `gate: "suppressed"`, identischer Grund, `energy 0.0507`, `curiosityAction WAIT`, `impulseAction STAY_SILENT` (RUNTIME-BEWIESEN).

---

## 2. Exakter Codepfad

| Schritt | Ort | Inhalt |
|---|---|---|
| Eingabefenster | `src/orb-core/engine.server.ts` (`loadCuriosityContext`) | `orb_messages` `select("body, role")`, `order created_at desc`, `limit(8)`; danach `recentUserTexts = msgRes.data.filter(role === "user").map(body)` (`engine.server.ts:2075`) |
| Übergabe | `engine.server.ts:2234` | `decideImpulse({ … recentUserTexts: ctx.recentUserTexts … })` |
| Erkennung | `src/orb-core/impulse.ts:87–88` | `DECLINE_RE = /(nicht jetzt\|später\|spaeter\|unwichtig\|egal\|keine ahnung\|weiss nicht\|weiß nicht\|lass (das\|es)\|frag mich .{0,12}(nicht\|nie wieder)\|hör auf zu fragen\|nie wieder fragen)/i` |
| | `impulse.ts:89` | `INVITE_RE = /\b(frag (ruhig\|gern\|gerne\|einfach)\|du kannst (mich )?(ruhig )?fragen)\b/i` |
| | `impulse.ts:90–91` | `PERMANENT_RE = /\b(nie wieder\|niemals wieder\|grundsätzlich nicht\|immer\|dauerhaft\|generell)\b/i` |
| Klassifikation | `impulse.ts:96–118` `readUserControl()` | erste Nachricht mit `DECLINE_RE`-Treffer → `preference: "suppress"`, `permanent: PERMANENT_RE.test(text)`, fester Grundtext |
| Zusammenführung | `impulse.ts:202–217` | `effectivePreference` (Text vor gespeicherter Präferenz) → `suppressed`; `if (suppressed) return silent(control.reason)` — **vor** offener Frage, Cooldown, Kandidatenwahl und Score |
| Finales Gate | `src/orb-core/autonomy.ts:57–65` | `if (input.impulse.suppressed)` → `gate: "suppressed"`, `allowed: false`, `action: "WAIT"` — **erste** Prüfung, noch vor `no_candidate` und `energy` |
| Ergebnis | `engine.server.ts:2294–2300` | `silent(reason)` → `asked: false`, kein LLM-Aufruf, kein Schreibvorgang, ein Attempt-Datensatz |

Ablauf: **Input** (bis zu 8 letzte Nachrichten, davon die Nutzertexte) → **Erkennung** (`DECLINE_RE` gegen den vollen Rohtext) → **Klassifikation** (`suppress`) → **Gate** (`suppressed`, höchste Priorität) → **Ergebnis** (keine autonome Frage, „ORB denkt nach …" endet ohne Ausgabe).

Nebenbefunde, CODE-BEWIESEN:
- Die Wirkung reicht so weit wie das Fenster: Der auslösende Satz liegt unter den letzten 8 Nachrichten, also typischerweise die nächsten ~4 Nutzerturns. Es gibt kein Ablaufdatum und kein Aufheben durch eine spätere Einladung, weil die Schleife beim **ersten** Treffer in der Liste (neueste zuerst) endet — steht ein Abwinken irgendwo im Fenster, gewinnt es gegen ältere Einladungen, aber ein neueres „frag ruhig" gewinnt gegen ein älteres Abwinken.
- `rememberPreference` wird zurückgegeben, aber von `askProactively()` **nicht** gespeichert, und `storedPreference` wird nirgends gesetzt (`rg` über `src`): eine „dauerhafte" Ablehnung wirkt derzeit nur, solange der Satz im Fenster liegt.

---

## 3. Semantische Bedeutung der aktuellen Regel

Die Regel ist als **Nutzerkontrolle** angelegt („Nutzerkontrolle" ist die Abschnittsüberschrift im Code): Der Nutzer soll die eigenständigen Fragen abschalten können, ohne Einstellung. Ihr Zweck ist also A) „Der Nutzer möchte momentan keine autonome Frage."

Das tatsächliche Codeverhalten setzt diesen Zweck aber über reine Wortvorkommen im Rohtext um. Damit gilt für den konkreten Produktionsfall **B) Die Regel erkennt lediglich bestimmte Wörter, obwohl der Kontext etwas anderes bedeutet.** Zusätzlich trifft für einen Teil der Alternativen **C)** zu: `egal`, `unwichtig`, `keine ahnung`, `weiss nicht` sind inhaltliche Antwortsignale („ich weiss es nicht"), die hier als Wunsch nach Stille wiederverwendet werden. **D)** trifft für den Fall vom 07:09:40 nicht zu: „haben wir später frieden beschlossen?" ist eine inhaltliche Frage des Nutzers, kein Abwinken — der Grund, den ORB intern vermerkt, ist inhaltlich falsch.

Wichtig für die Bewertung: Die **Entscheidung** war formal korrekt ausgeführt (Gate greift wie vorgesehen, keine Nebenwirkung, Attempt vorhanden). Fehlerhaft ist allein die **Erkennung** des Nutzerwunsches.

---

## 4. False-Positive-Analyse

| Signal | aktuelle Bedeutung im Code | mögliche legitime Bedeutung | Risiko |
|---|---|---|---|
| `später` / `spaeter` | Abwinken, sofort, an jeder Satzposition, auch als Wortteil (`spätere`, `Spätschicht` → nur bei Präfix `später`, aber `spätere Frage` trifft) | Zeitangabe in einer Inhaltsfrage („haben wir später Frieden beschlossen?"), Erzählung, Terminplanung | **hoch** – in Produktion nachgewiesen |
| `egal` | Abwinken | Teil eines Satzes („das ist mir nicht egal", „egal welche Variante du nimmst"), Nebensatzeinleitung | **hoch** – auch die Negation „nicht egal" löst aus, weil nur das Vorkommen zählt |
| `immer` (in `PERMANENT_RE`) | verschärft ein erkanntes Abwinken zu „dauerhaft" | reine Zeitangabe („das war immer so") | **mittel** – wirkt nur zusammen mit einem `DECLINE_RE`-Treffer, erhöht dann aber die Reichweite (`rememberPreference`) |
| `weiss nicht` / `weiß nicht` | Abwinken | Antwort auf eine ORB-Frage („weiß nicht genau, glaube 2019") — also gerade ein Gesprächsbeitrag, keine Ablehnung des Fragens | **hoch** – blockiert ORB genau dann, wenn der Nutzer mitarbeitet |
| `unwichtig` | Abwinken | Bewertung eines Inhalts („dieser Befund ist unwichtig") | **mittel** |
| `keine ahnung` | Abwinken | Antwort auf eine Frage, oft gesprächsoffen | **hoch** – gleiche Lage wie „weiß nicht" |
| `lass das` / `lass es` | Abwinken | Zitat, Redewendung („lass das mal so stehen") | **mittel** |
| `nicht jetzt` | Abwinken | zeitliche Aussage („nicht jetzt, sondern gestern") | **niedrig** |
| `frag mich …(nicht\|nie wieder)`, `hör auf zu fragen`, `nie wieder fragen` | Abwinken | eindeutige Wendungen, Fehlauslösung nur durch Zitat | **niedrig** |
| `frag ruhig/gern/gerne/einfach`, `du kannst (mich) fragen` (Einladung) | Freigabe, mit Wortgrenzen (`\b`) formuliert | – | **niedrig** – zeigt, dass Wortgrenzen im selben Modul bereits bekannt sind, in `DECLINE_RE` aber fehlen |

Beobachtung (CODE-BEWIESEN): `DECLINE_RE` verwendet **keine** `\b`-Grenzen, `INVITE_RE` und `PERMANENT_RE` verwenden sie. Die Ungleichbehandlung ist der technische Kern der Fehlauslösungen.

Die Beispielsätze dieses Kapitels sind Analysematerial, keine vorgeschlagenen Regeln.

---

## 5. Kontext vs. Token

| Frage | Befund |
|---|---|
| Exakte Phrase? | nein |
| Token? | nein – kein Tokenizer beteiligt |
| Substring? | **ja** – `RegExp.test()` auf dem Rohtext, Treffer an jeder Stelle |
| Prefix? | nein (im Unterschied zu `topicOf()`) |
| Regex? | **ja**, `i`-Flag, keine Wortgrenzen in `DECLINE_RE` |
| Satzposition? | nein – irrelevant |
| Gesamter Input? | ja, gesamte Nachricht; über bis zu 8 letzte Nachrichten hinweg, erster Treffer gewinnt |
| Kontext berücksichtigt? | **nein** – keine Negation, kein Fragezeichen, keine Satzlänge, kein Bezug darauf, ob ORB gerade gefragt hatte |

Die Regel basiert damit allein auf dem Auftreten einzelner Wortfolgen. Das ist hier dokumentiert, nicht bewertet — eine Umstellung auf ein Sprachmodell ist ausdrücklich nicht Gegenstand dieses Designs (die Architekturregel „Code entscheidet OB" bleibt unberührt).

---

## 6. Designvarianten

Drei Varianten, keine als beste bezeichnet. In allen Varianten bleiben `INVITE_RE`, `PERMANENT_RE`, die Gate-Reihenfolge und alle Schwellen unverändert.

### Variante A – Strengere deterministische Erkennung

**CURRENT:** `DECLINE_RE` trifft als Substring an beliebiger Stelle; `später` und `egal` stehen gleichberechtigt neben `hör auf zu fragen`.
**PROBLEM:** Jedes Vorkommen eines Alltagsworts schaltet ORB stumm.
**DESIGN:** `DECLINE_RE` in `src/orb-core/impulse.ts` mit Wortgrenzen (`\b`) versehen — analog zu `INVITE_RE` — und die schwachen Einzelwörter in eindeutige Wendungen fassen (z. B. `später` nur in Verbindung mit einer Frage-/Bitte-Formulierung, `egal`/`unwichtig`/`weiss nicht` nur als eigenständige, kurze Äusserung). `readUserControl()` behält Signatur, Rückgabewerte und Grundtexte. Betroffen: nur die beiden Regex-Konstanten und ggf. eine Hilfsprüfung „steht als kurze Gesamtäusserung".
**REGRESSION:** Alle bestehenden positiven Fälle (`tests/orb-proactive-impulse.test.ts`: „Nicht jetzt, bitte später", „Frag mich das nie wieder", `storedPreference: "suppress"`, „Frag ruhig nach") plus neue Negativfälle aus §7.
**RISK:** Gering in der Struktur, aber Regex-Arbeit ist fehleranfällig; Gefahr neuer False Negatives bei ungewöhnlichen Formulierungen. Performance unverändert (ein Regex-Test je Nachricht). Regressionsrisiko: beschränkt auf `impulse.ts`, keine Auswirkung auf Curiosity, Energy, Score, Duplicate, Memory.

### Variante B – Phrasen- und Kontextprüfung statt einzelner Wörter

**CURRENT:** Der volle Rohtext wird gegen eine einzige Alternativenliste geprüft.
**PROBLEM:** Satzrolle und Negation bleiben unberücksichtigt („das ist mir nicht egal", „haben wir später …?").
**DESIGN:** In `readUserControl()` eine deterministische Vorprüfung ergänzen: Treffer nur zählen, wenn die Äusserung als Abwinken plausibel ist — z. B. kurze Gesamtäusserung, kein Fragezeichen am Satzende, keine unmittelbar vorangehende Negation. Zwei Stärkeklassen: eindeutige Wendungen („hör auf zu fragen") gelten immer, schwache Signale („egal", „später") nur bei erfüllter Kontextbedingung. Betroffen: ausschliesslich `impulse.ts` (`readUserControl` plus lokale Hilfsfunktionen); `decideImpulse()` und `finalAutonomyGate()` unverändert.
**REGRESSION:** wie A, zusätzlich Fälle mit Fragezeichen, mit Negation und mit langer Inhaltsnachricht.
**RISK:** Mehr eigene Logik an einer Stelle, die heute sehr klein ist; Kontextregeln können selbst falsch greifen (z. B. Abwinken mit Fragezeichen: „kannst du das später fragen?"). Performance unverändert (reine Stringarbeit). Regressionsrisiko mittel, weil mehr Verzweigungen entstehen.

### Variante C – Suppression nur bei eindeutigem Nutzerintent

**CURRENT:** Schwache und eindeutige Signale lösen dieselbe Sperre aus.
**PROBLEM:** Die Sperre ist das stärkste Tor im autonomen Ablauf (erste Prüfung, überstimmt alles), wird aber vom schwächsten Signal ausgelöst.
**DESIGN:** `DECLINE_RE` auf die eindeutig auf das Fragen bezogenen Wendungen reduzieren (`nicht jetzt` im Frage-Bezug, `frag mich … nicht/nie wieder`, `hör auf zu fragen`, `nie wieder fragen`, `lass das mit den fragen`). Inhaltliche Signale (`egal`, `unwichtig`, `keine ahnung`, `weiss nicht`, `später`) lösen **keine** Sperre mehr aus. Betroffen: nur die Regex-Konstante in `impulse.ts`.
**REGRESSION:** Bestehende positive Tests bleiben grün, sofern sie eindeutige Wendungen verwenden — „Nicht jetzt, bitte später" muss geprüft werden; alle Negativfälle aus §7 sind erfüllt.
**RISK:** Höchstes False-Negative-Risiko: ein genervtes „egal" schaltet ORB nicht mehr ab, obwohl es gemeint sein kann. Performance unverändert. Regressionsrisiko gering im Code, aber spürbar im Nutzererlebnis, weil ORB in Grenzfällen häufiger fragt.

Ausdrücklich nicht Bestandteil einer Variante: Sprachmodell-Erkennung des Nutzerwunsches, eine neue Tabelle oder Spalte für Präferenzen, ein Zeitablauf der Sperre, eine Änderung der Gate-Reihenfolge, eine Änderung des Nachrichtenfensters (8).

Offener Nebenpunkt zur späteren Entscheidung (nicht Teil der drei Varianten): `rememberPreference` wird berechnet, aber nicht gespeichert; `storedPreference` wird nie gesetzt. Eine gewollte Dauerablehnung verfällt damit mit dem Fenster. Das ist eine eigene Designfrage, kein Teil dieses Fixes.

---

## 7. Regression-Testdesign (Entwurf, nicht erstellt)

**Bestehende Fälle müssen erhalten bleiben** (`tests/orb-proactive-impulse.test.ts`): „schweigt, wenn der Nutzer abwinkt", „merkt eine dauerhafte Ablehnung", „achtet eine gespeicherte Ablehnung", „erkennt eine ausdrückliche Einladung"; ferner `tests/orb-autonomy-gate.test.ts` (Gate `suppressed` bei `suppressed: true`). Kein bestehender Test wird abgeschwächt oder entfernt.

**Neue Fälle:**

| Gruppe | Eingabe | Erwartung |
|---|---|---|
| Eindeutige Suppression | „hör auf zu fragen", „frag mich das nie wieder", „nicht jetzt, bitte" | `preference = suppress`, `decideImpulse` → `STAY_SILENT`, `suppressed = true` |
| `später` als Satzbestandteil | „auch. haben wir später frieden beschlossen ?" (Produktionssatz) | **keine** Sperre allein wegen `später` |
| `später` als Verschiebung | „wir klären das später" | Designentscheidung dokumentiert; Verhalten je gewählter Variante festgeschrieben und begründet |
| `egal` | „das ist mir nicht egal", „egal welche Variante du nimmst" vs. blosses „egal." | Negation/Nebensatz ohne Sperre; blosses „egal." gemäss gewählter Variante |
| `immer` | „das war immer so" ohne Abwink-Treffer | keine Sperre, `permanent = false` |
| `weiß nicht` | „weiß nicht genau, glaube 2019" | zunächst **bestehendes** Verhalten reproduzieren (heute: Sperre), Designentscheidung danach dokumentieren |
| Fenster | Abwinken in älterer Nachricht, neuere Einladung | Einladung gewinnt (heutiges Verhalten festschreiben) |
| Gate-Kette | Suppression aktiv + Impulse-Kandidat vorhanden | `finalAutonomyGate` → `gate: "suppressed"`, kein LLM, kein Schreibvorgang |
| Keine Nebenwirkung | jeder Negativfall | keine Änderung an Energie, Neugier, `orb_questions`, `orb_messages` |

Nach einer späteren Implementierung ist die vollständige Suite auszuführen (derzeit 1149 Logiktests + 77 DB/Security, Typecheck, Lint, Build).

---

## 8. Auswirkungen auf Autonomie

Unverändert in allen Varianten: Curiosity, Impulse-Bewertung und -Priorität, Energie und alle Energiewerte, Presence und Browser-Vorfilter, Score-Schwellen, Duplikatprüfung, Thread Matching, Memory, Recall, Topic-Klassifizierung, die Sprachschicht-Grenze („Code entscheidet OB, Modell entscheidet WIE"), die Gate-Reihenfolge und die Persistenzschritte.

Erwartete Verhaltensänderung: Weniger Versuche enden mit `gate: "suppressed"`; sie fallen dann in die bestehenden Tore `no_candidate`, `energy`, `duplicate`. Solange die Energie unter 0.15 liegt, wird eine Korrektur dieser Regel **allein** keine zusätzlichen Fragen erzeugen (siehe §9) — die Sperre verschiebt sich nur vom ersten auf das dritte Tor. Das ist für die Erwartungshaltung wichtig.

---

## 9. ENERGY THRESHOLD – OPEN DESIGN QUESTION

Nur Dokumentation. Keine Empfehlung, keine Änderung.

- **Aktuelles Verhalten:** Autonome Mindestenergie 0.15 (`AUTONOMY_MIN_ENERGY = CURIOSITY_MIN_ENERGY`), Erholung 0.02 pro Minute, Obergrenze der Erholung 0.25, Kosten einer gestellten Frage 0.03 (zusätzlich −0.06 Neugier).
- **Beobachtete Auswirkung:** gespeicherte Energie 0.0714 (2026-09-22 07:10:42), in erfassten Versuchen 0.0456 und 0.0507; letzte autonome Frage 2026-09-21 11:48:03 — über 19 Stunden keine eigene Frage, obwohl Neugier 1.00 und Kandidatenwert 0.855 betrug (DB-/RUNTIME-BEWIESEN).
- **Bestehende Regel:** Energie ist eine gemeinsame Ressource; das finale Tor prüft sie vor der Formulierung. Diese Prüfung ist das Ergebnis eines bestätigten Fehlerfixes und steht nicht in Frage.
- **Fehlende Informationen für eine späte Entscheidung:** Verteilung der Energie über die Zeit (keine Verlaufsdaten vorhanden); Anteil der Versuche, die ausschliesslich am Energietor scheitern (Attempts werden nicht persistiert); Zusammenhang zwischen Energieverbrauch pro Nutzerturn und Erholung über einen längeren Zeitraum; gewünschte Fragehäufigkeit aus Nutzersicht.

---

## 10. Scope / Nicht-Scope

**Änderbar in einer späteren Implementierung:** `src/orb-core/impulse.ts` — `DECLINE_RE`, ggf. `readUserControl()` samt lokaler Hilfsprüfungen; neue Testfälle unter `tests/`.

**Nicht ändern:** `src/orb-core/autonomy.ts`, `curiosity.ts`, `core.ts`, `presence.ts`, `memory.ts`, `continuity*.ts`, `engine.server.ts`, Client-Dateien, alle Schwellen (0.15, 0.25, 0.02, 0.30, 0.35, 0.50, 0.20, 0.60), Nachrichtenfenster 8, Gate-Reihenfolge, Persistenzpfade, bestehende Tests (nur ergänzen).

**Keine Datenbankauswirkung:** keine Tabelle, keine Spalte, kein Index, keine Migration, keine Datenänderung. RLS unberührt.

**Ausserhalb dieses Designs:** Energie-Schwellenfrage (§9), Speicherung einer dauerhaften Nutzerpräferenz, Persistenz der Attempt-Datensätze, K1 (Reason-Vorrang), K7 (ungeprüfter Metrik-INSERT), K8 (Duplikatprüfung nach Formulierung), Sprachmodell-basierte Absichtserkennung, rückwirkende Bereinigung.

---

## 11. Spätere Implementierungsreihenfolge

1. Negativtests aus §7 schreiben, die heute **rot** sind (Produktionssatz „… haben wir später frieden beschlossen ?" und „das ist mir nicht egal") — Nachweis vor dem Fix.
2. Bestehende Suppression-Tests unverändert laufen lassen (Ausgangsbeleg grün).
3. Eine der drei Varianten umsetzen — ausschliesslich in `impulse.ts`.
4. Negativtests grün, bestehende Tests weiter grün; Verhalten von „weiß nicht" und „wir klären das später" ausdrücklich festschreiben und begründen.
5. Vollständige Suite, Typecheck, Lint, Build.
6. Diff-Kontrolle: Datei, Funktion, ALT, NEU, GRUND, TEST; alles ausserhalb von `impulse.ts` und `tests/` zurücknehmen.
7. Abschlussbericht; kein Deployment ohne ausdrückliche Freigabe.

---

**READY FOR IMPLEMENTATION REVIEW**

Verändert in diesem Durchlauf: nur diese Datei. 0 Codeänderungen, 0 Tests, 0 SQL, 0 Migration, 0 Schwellen, 0 Deployment.
