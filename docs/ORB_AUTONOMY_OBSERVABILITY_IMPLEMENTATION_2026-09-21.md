# ORB Autonomy Observability Implementation

Datum: 2026-09-21 · Umgebung: PRODUCTION · Art: kontrollierte Änderung, rein beobachtend.

**Observability only — autonomous decision behavior unchanged.**

## 1. Existing Diagnostic Source

Der Server (`askProactively()`, src/orb-core/engine.server.ts:2192) liefert bei
jedem eigenständigen Versuch bereits ein vollständiges Ergebnis
(`OrbProactiveResult`, engine.server.ts:1829):

- `asked: boolean` – wurde eine Frage gestellt
- `action: CuriosityAction` – DO_NOTHING | WAIT | ASK
- `reason: string` – deterministische, vorhandene Begründung (auch bei Ablehnung,
  erzeugt in `silent()`, engine.server.ts:2226)
- `question`, `topic`, `kind`, `score: number`
- `snapshot`, `perf` (nur bei gestellter Frage)

Nicht in der Antwort enthalten (werden daher NICHT angezeigt): Energie-Wert,
Branch (CURIOSITY vs. IMPULSE), Kandidaten-Einzelwerte. Es wurde kein Wert
ergänzt, neu berechnet oder abgeleitet.

## 2. Previous Silent Behavior

src/routes/_authenticated/channels.orb.tsx Zeile 222 (vor der Änderung):

```ts
onSuccess: (result) => {
  if (!result.asked || !result.question) return;
  ...
}
```

Bei `asked === false` wurde die vorhandene Diagnose verworfen. Kein Eintrag,
keine Anzeige, keine Protokollierung.

## 3. Minimal Change

Rein clientseitig, zwei Dateien, ausschließlich additive Zeilen (+54, keine
Löschung, keine Änderung bestehender Zeilen):

1. `channels.orb.tsx`: In `curiosityMutation.onSuccess` wird das vorhandene
   Ergebnis VOR dem bisherigen `return` in einen React-State
   (`lastAutonomyAttempt`) kopiert – Zeitstempel, `asked`, `action`, `reason`,
   `topic`, `kind`, `score`. Der bisherige Ablauf danach ist unverändert.
2. `OrbDevPanel.tsx`: Der vorhandene Testbereich (eingeklapptes
   Diagnose-Panel, „Testbereich (Experiment)") zeigt einen neuen Abschnitt
   „Letzter eigener Fragen-Versuch": Ergebnis (gestellt / nicht gestellt),
   Aktion, Uhrzeit, Wert, Thema/Art falls vorhanden, und der vorhandene
   Begründungstext des Servers.

Keine Server-Änderung. Keine neue Logik, keine neue Berechnung, kein neuer
Aufruf, kein Timer, kein Polling. Der Leerlauf-Beobachter ist unverändert.

## 4. Exact Files Changed

| Datei | Änderung |
|---|---|
| src/routes/_authenticated/channels.orb.tsx | +15 Zeilen (State, Anzeige-Übergabe) |
| src/components/orb/OrbDevPanel.tsx | +39 Zeilen (Typ `OrbAutonomyAttempt`, Anzeige-Abschnitt) |

Keine weiteren Dateien. Nachweis: `git diff 399c69ff..HEAD --stat`.

## 5. Exact UI/Diagnostic Path

ORB Core → technischer Bereich „Status" → Testbereich (Experiment) aufklappen →
Abschnitt „Letzter eigener Fragen-Versuch" (`data-testid="orb-autonomy-attempt"`).

Angezeigte Unterscheidung im Live-Test (ausschließlich aus der bestehenden
Serverantwort):

- **QUESTION_SENT**: „Frage gestellt" + ASK + Begründung
- **Ablehnung**: „Nicht gestellt" + Aktion (WAIT/DO_NOTHING) + vorhandener
  Grundtext des Servers (z. B. Energie-, Wert-, Duplikat-, Cooldown-,
  Sprachschicht- oder Unterdrückungs-Grund, jeweils im vorhandenen
  Wortlaut von `silent()`)

Nicht unterscheidbar (keine vorhandene Evidenz, wird nicht erfunden):
- NOT_TRIGGERED (der Beobachter ruft den Server gar nicht an – dazu gibt es
  keine Serverantwort)
- Branch CURIOSITY vs. IMPULSE (nicht Teil der Antwort)
- Energie- und Kandidaten-Einzelwerte (nicht Teil der Antwort)

## 6. Tests

- Typecheck (tsgo): grün
- ESLint (beide geänderten Dateien): grün
- Vollständige Logik-Suite: **1089/1089 grün** (70 Dateien)
- DB-/Sicherheitstests (`test:db`): **77/77 grün** (9 Dateien)
- Production-Build: grün (08:12 UTC)

Kein neuer Test nötig: die Änderung ist reine Anzeige vorhandener Daten;
bestehende OrbChat-/Autonomie-Tests laufen unverändert grün.

## 7. Confirmation of No Database Writes

Die Anzeige liest ausschließlich die bereits vorhandene Serverantwort im
Browser. Kein `insert`, `update`, `upsert`, kein RPC, keine neue Serverfunktion.
Die einzige Serveranfrage bleibt der bereits bestehende, ereignisbasierte
`requestOrbCuriosity`-Aufruf des unveränderten Leerlauf-Beobachters. Bei einer
Ablehnung schreibt `askProactively()` wie zuvor nichts (Nachweis: alle
`silent()`-Rückgaben vor jeder DB-Operation, engine.server.ts:2237–2262).

## 8. Confirmation orb_state Was Not Modified

Keine Änderung an `orb_state`, keinem Zeitstempel und keinem Trigger. Die
Anzeige schreibt nur React-State. Die Erholungsuhr (`updated_at`) wird durch
diese Änderung weder gelesen-verändert noch zurückgesetzt.

## 9. Confirmation Energy Logic Was Not Modified

Unverändert: `recoverEnergy` (+0,02/min, Deckel 0,25), Kosten 0,03 je gestellter
Frage, alle Schwellen (0,15 / 0,20 / 0,12), Cooldowns, Duplikatprüfung,
Kandidatenbewertung, Impuls-/Neugier-Logik, Listening, Gedächtnis, Persistenz.
Git-Diff zeigt ausschließlich die zwei Client-Dateien.

## 10. Production Test Instructions

1. ORB Core öffnen, technischen Bereich „Status" → Testbereich aufklappen.
2. Normal chatten oder ruhen lassen – nichts künstlich auslösen.
3. Nach jedem eigenständigen Versuch (erkennbar an „ORB denkt …") zeigt der
   Abschnitt „Letzter eigener Fragen-Versuch" Ergebnis, Aktion, Wert und den
   Grund des Servers.
4. Wird kein Versuch ausgelöst, bleibt der Abschnitt leer („noch kein Versuch
   in dieser Sitzung") – das entspricht NOT_TRIGGERED und ist die erwartete
   Anzeige.

## 11. Rollback Information

- Ausgangsstand: Commit `399c69ff73e83ffcc2ea21461cfdb704e9c0a0e7`
  (sauberer Baum, 0 offene Änderungen).
- Änderung: Commits bis `791e3bd390549abb16ad6c5f51ba731fe59d45ba`
  (ausschließlich die zwei genannten Dateien, +54 Zeilen).
- Rücksetzen: die zwei Dateien auf den Stand von `399c69ff` zurücksetzen;
  keine Datenbank-, Schema- oder Konfigurationsänderung beteiligt.

## FINDINGS

1. FINDING — NO CHANGE MADE: Die Serverantwort enthält keinen Energie-Wert und
   keinen Branch (CURIOSITY/IMPULSE); beide können im Live-Test weiterhin nicht
   angezeigt werden, ohne die Serverantwort zu erweitern (nicht freigegeben).
2. FINDING — NO CHANGE MADE: NOT_TRIGGERED (Beobachter löst keinen Aufruf aus)
   bleibt unsichtbar, weil es dafür keine Serverantwort gibt; clientseitige
   Beobachter-Protokollierung war nicht Teil der Freigabe.
3. FINDING — NO CHANGE MADE: Der Ablehnungsgrund ist ein vorhandener
   Freitext; verschiedene Ursachen (Energie, Wert, offene Frage, Cooldown)
   teilen sich teils denselben Wortlaut (`decision.reason`). Eine
   maschinelle Unterscheidung dieser Fälle würde neue Serverinformation
   erfordern – nicht freigegeben, nicht umgesetzt.
