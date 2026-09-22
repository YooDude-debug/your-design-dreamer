# ORB CORE – AUTONOMOUS SUPPRESSION FIX (Variante 3)

Datum: 2026-09-22 · Modus: CONTROLLED IMPLEMENTATION · kein Deployment · keine Datenbankänderung

Grundlage: `docs/ORB_AUTONOMOUS_SUPPRESSION_FIX_DESIGN_2026-09-22.md`, Variante C/3 („Suppression nur bei eindeutigem Nutzerintent").

---

## 1. Root Cause

`DECLINE_RE` in `src/orb-core/impulse.ts` prüfte ohne Wortgrenzen auf einzelne Alltagswörter (`später`, `spaeter`, `egal`, `unwichtig`, `keine ahnung`, `weiss nicht`, `weiß nicht`, `lass das|es`). Jedes Vorkommen irgendwo im Rohtext einer der letzten Nutzernachrichten setzte `readUserControl()` auf `preference: "suppress"`, `decideImpulse()` auf `STAY_SILENT` mit `suppressed: true` und damit `finalAutonomyGate()` auf `gate: "suppressed"` — das erste und stärkste Tor der autonomen Kette. `INVITE_RE` und `PERMANENT_RE` im selben Modul arbeiteten bereits mit `\b`-Wortgrenzen; nur die Abwink-Regel nicht.

Produktionsfall (RUNTIME-BEWIESEN): Nutzertext 07:08:01 „auch. haben wir später frieden beschlossen ?" → erfasster Serverversuch 07:09:40.127Z mit `result: "silent"`, `gate: "suppressed"`.

## 2. Reproduzierter Fehler VOR dem Fix

`tests/orb-suppression-rule.test.ts` wurde **vor** der Änderung erstellt und lief ROT: **12 von 21 Fällen fehlgeschlagen**, darunter der Produktionssatz, „wir machen das später", „egal wie das ausgeht", „das ist mir nicht egal", „ich weiß nicht warum", „keine Ahnung, vielleicht 2019", „das war unwichtig für die Entscheidung", „lass das mal so stehen" sowie die eindeutigen Wendungen „frag nicht weiter", „keine weiteren Fragen", „stell mir jetzt keine Frage", „nicht weiter fragen", die die alte Regel gar nicht als solche erkannte.

## 3. Implementierte Änderung

Eine Datei, eine Konstante.

ALT (`src/orb-core/impulse.ts:87–88`):

```
/(nicht jetzt|später|spaeter|unwichtig|egal|keine ahnung|weiss nicht|weiß nicht|lass (das|es)|frag mich .{0,12}(nicht|nie wieder)|hör auf zu fragen|nie wieder fragen)/i
```

NEU (`src/orb-core/impulse.ts:87–92`, mit Begründungskommentar):

```
/\b(nicht jetzt|frag(e|st|en)? (mich )?(jetzt )?(bitte )?(nicht|nichts) (mehr|weiter)|frag(e)? (bitte )?nicht weiter|nicht weiter fragen|frag mich .{0,12}(nicht|nie wieder)|h(ö|oe)r(e|t)? (bitte )?auf zu fragen|keine (weiteren )?fragen( mehr)?|stell(e)? mir (jetzt |bitte )*keine (weitere )?frage|nie wieder fragen|lass (das|es) mit den fragen)\b/i
```

Eigenschaften: Wortgrenzen wie in `INVITE_RE` (bestehende Mechanik wiederverwendet, keine parallele Tokenizer-Logik); ausschliesslich Wendungen mit direktem Bezug auf das Fragen; `nicht jetzt` und `frag mich … nicht/nie wieder` aus der alten Liste erhalten, weil bestehende Tests sie abdecken. Deterministisch, kein Modellaufruf. `readUserControl()`, `INVITE_RE`, `PERMANENT_RE`, `decideImpulse()`, Gründe, Rückgabetypen und Gate-Reihenfolge unverändert.

## 4. Positive Suppression Cases (grün)

„hör auf zu fragen", „frag nicht weiter", „keine weiteren Fragen", „stell mir jetzt keine Frage", „nicht weiter fragen", „nie wieder fragen", „Nicht jetzt, bitte später", „Frag mich das nie wieder" (letzterer zusätzlich `permanent: true`).

## 5. False-Positive Regression Cases (grün)

Keine Suppression mehr bei: „auch. haben wir später frieden beschlossen ?" (Produktionssatz), „wir machen das später", „egal wie das ausgeht", „das ist mir nicht egal", „das passiert immer", „ich weiß nicht warum", „keine Ahnung, vielleicht 2019", „das war unwichtig für die Entscheidung", „lass das mal so stehen".

Negation: „ich will nicht, dass du aufhörst zu fragen" löst keine Suppression aus (die Wendung lautet „aufhörst zu fragen", nicht „hör auf zu fragen") — geprüft, ohne eine Negationsanalyse einzuführen.

Zeitangabe: „das passiert immer" bleibt `preference: "unset"`, `permanent: false`.

## 6. Testergebnisse

| Lauf | Ergebnis |
|---|---|
| `tests/orb-suppression-rule.test.ts` vor dem Fix | 12 von 21 rot (Fehler reproduziert) |
| `tests/orb-suppression-rule.test.ts` nach dem Fix | 21/21 grün |
| `tests/orb-proactive-impulse.test.ts` | 31/31 grün (unverändert) |
| `tests/orb-autonomy-gate.test.ts` | 19/19 grün (unverändert) |

## 7. Vollständige Regression

- Logiksuite: **1170/1170 grün** (75 Dateien; vorher 1149, +21 neue Fälle) — enthält Suppression, Autonomy, Curiosity, Impulse, Presence, Energy, Memory, Recall, Topic, Thread/Continuity, SDK-Contract.
- DB-/Security-Suite: **77/77 grün** (9 Dateien).
- Typecheck (`tsgo --noEmit`): 0 Fehler. Lint: 0 Meldungen. Build: erfolgreich.
- Kein bestehender Test geändert, abgeschwächt oder entfernt.

## 8. Energy als unabhängige Einschränkung

**Der Suppression-Fix beseitigt den False Positive, erzeugt aber bei Energy < 0.15 weiterhin keine autonome Frage.** Energie lag zuletzt bei 0.0714 (07:10:42) bzw. 0.0456/0.0507 in erfassten Versuchen; die autonome Mindestschwelle 0.15, Erholung 0.02/min, Obergrenze 0.25 und die Fragekosten sind unverändert. Die Ablehnung verschiebt sich lediglich vom Tor `suppressed` auf das Tor `energy`.

## 9. Bewusst nicht behoben: Dauer-Suppression

`rememberPreference` wird von `decideImpulse()` zurückgegeben, aber nicht gespeichert; `storedPreference` wird im Produktionscode nie gesetzt. Eine gewollte dauerhafte Ablehnung wirkt daher nur, solange der Satz im Fenster der letzten 8 Nachrichten liegt. Ausdrücklich nicht Bestandteil dieses Fixes; keine neue Präferenz, kein neues Memory.

## 10. Geänderte Dateien

| Datei | Art |
|---|---|
| `src/orb-core/impulse.ts` | eine Konstante ersetzt (+ Kommentar) |
| `tests/orb-suppression-rule.test.ts` | neu, 21 Fälle |
| `docs/ORB_AUTONOMOUS_SUPPRESSION_FIX_2026-09-22.md` | dieser Bericht |

## 11. Diff-Kontrolle

| Datei | Funktion | ALT | NEU | Grund | Test |
|---|---|---|---|---|---|
| `src/orb-core/impulse.ts` | `DECLINE_RE` (genutzt von `readUserControl`) | Substring-Treffer auf Alltagswörter, ohne Wortgrenzen | Wortgrenzen + ausschliesslich fragebezogene Wendungen | bestätigter False Positive | `tests/orb-suppression-rule.test.ts` |

Kontrollfragen: nur die Suppression-Regel geändert — **ja**. Keine Energy-Änderung — **ja**. Keine Autonomie-Architektur geändert (`autonomy.ts`, Gate-Reihenfolge, `engine.server.ts` unberührt) — **ja**. Keine Memory-/Recall-/Topic-Änderung — **ja**. Keine Thread-Änderung — **ja**. Keine neue LLM-Entscheidung, kein Prompt — **ja**. Keine DB-Änderung, keine Migration — **ja**. Keine Änderung aussserhalb des Scopes, daher keine Rücknahme erforderlich.

## 12. Verbleibende Risiken

1. **False Negatives:** Ein knappes „egal." oder „weiß nicht" schaltet ORB nicht mehr stumm. Das ist die bewusste Eigenschaft der gewählten Variante; ein genervter Nutzer muss deutlicher formulieren.
2. `nicht jetzt` bleibt aus Kompatibilität zu bestehenden Tests in der Liste und kann in seltenen Sätzen („nicht jetzt, sondern gestern") auslösen.
3. Die Wirkungsdauer der Sperre hängt weiter am Fenster der letzten 8 Nachrichten (unverändert, dokumentiert in §9).
4. Kein End-to-End-Nachweis vom Browser bis zur Speicherung; geprüft auf Funktionsebene mit den echten Kernfunktionen.
5. Solange die Energie unter 0.15 liegt, ist die Wirkung dieses Fixes im Betrieb nicht beobachtbar (§8).

---

ROOT CAUSE → FIX → REGRESSION TEST → RESULT: wortgrenzenlose Alltagswort-Erkennung → `DECLINE_RE` auf eindeutige fragebezogene Wendungen mit Wortgrenzen → `tests/orb-suppression-rule.test.ts` (vorher 12 rot) → 21/21 grün, 1170 Logiktests + 77 DB/Security grün, Typecheck/Lint/Build sauber.

**READY FOR MANUAL REVIEW** — nicht deployt, keine Datenbankänderung.
