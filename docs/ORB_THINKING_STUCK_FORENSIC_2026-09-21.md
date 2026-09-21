# ORB CORE – „ORB denkt …“ → danach passiert nichts

## Forensische Untersuchung (READ-ONLY) – Production – 2026-09-21

Ergebnis vorweg: **Kein Fix durchgeführt.** Es wurde keine Root Cause für einen
hängenden Thinking-State nachgewiesen. Das beobachtete Verhalten entspricht einem
korrekten, absichtlich stillen `asked = false`.

---

## 1. Observed behavior

- UI zeigt „ORB denkt nach …“, danach erscheint keine eigene Frage. **BEWIESEN** (Nutzerbeobachtung + Codepfad unten)
- Kein Fehler-Toast, keine Meldung, kein sichtbarer Abschluss. **BEWIESEN** (kein UI-Element für abgelehnte Versuche ausserhalb des Testbereichs)

---

## 2. Exact lifecycle

### Thinking-State

Der Thinking-Zustand ist **kein eigener State und kein manueller Flag**:

- `src/routes/_authenticated/channels.orb.tsx:553` – `pending={sendMutation.isPending || curiosityMutation.isPending}`
- `src/components/orb/OrbChat.tsx:163-167` – bei `pending` wird „ORB denkt nach …“ gerendert
- gleiche Quelle für Statuszeile (`orbActivity`, Zeile 267-273) und Gesicht (Zeile 521/532)

Daraus folgt: **BEWIESEN**

1. Aktivierung: automatisch mit `mutate()` (Zeile 248), also **vor** dem Serveraufruf.
2. Deaktivierung: automatisch durch React Query, sobald die Mutation `settled` ist – bei Erfolg **und** bei Fehler. Es gibt keinen `return`, der einen Flag offen lassen könnte, kein `try/finally` ist nötig.
3. Es existiert kein Codepfad, der `isPending` dauerhaft `true` lässt, solange das Promise irgendwann auflöst.

### Vollständiger Pfad

```
Browser-Leerlauf-Beobachter (use-orb-presence.ts, 5-s-Intervall, rein clientseitig)
  → shouldAskProactively (presence.ts:102-124): Tab sichtbar, kein Tippen,
    kein Mikrofon, kein Sprechen, nicht pending, 40 s ≤ idle ≤ 15 min,
    Neugier ≠ low, Client-Cooldown
  → lastProactiveRef = now  (Sperre gegen Doppelaufruf, Zeile 127)
  → onAsk() → curiosityMutation.mutate()        ← „ORB denkt …“ beginnt HIER
  → requestOrbCuriosity (Server, auth-geschützt)
  → askProactively (engine.server.ts:2199)
      loadCuriosityContext → decideCuriosity (curiosity.ts:267)
      → decideImpulse (impulse.ts)
      → silent(reason) bei: Suppression / kein Impuls + kein ASK
      → formulateQuestion (LLM) → silent bei Statusfehler
      → isDuplicateQuestion → silent
      → Persistenz: orb_questions → orb_messages → orb_state → orb_metrics
      → Rückgabe asked:true + Snapshot
  → onSuccess: setLastAutonomyAttempt(...) IMMER (Zeile 227-235)
      if (!result.asked || !result.question) return;   ← Zeile 236
      sonst: Snapshot in Cache, lastReply, Cooldown, Sprachausgabe
  → „ORB denkt …“ endet (isPending = false)
```

### Fehlerpfade

- `silent(...)`: normale Antwort mit HTTP 200, `asked:false`, konkretem `reason`. Mutation erfolgreich → Thinking endet. **BEWIESEN**
- Persistenzfehler (`throw new Error(...)` in engine.server.ts:2280/2295/2310): Server-Exception → Mutation `onError` (Zeile 244) → nur `console.error`, kein Toast → Thinking endet, aber **keine sichtbare Meldung**. **BEWIESEN** (Codelage), **OFFEN** ob im beobachteten Fall eingetreten
- Netzwerkfehler / HTTP ≠ 200 / defektes JSON: identisch `onError`, Retry ist nicht konfiguriert → genau ein Versuch, dann settled. **BEWIESEN**
- LLM-Hänger: `openai.server.ts:76` nutzt `AbortSignal.timeout(OPENAI_TIMEOUT_MS)`, `analyze.server.ts:144` ebenfalls. Ein unendlich offenes Promise durch die Sprachschicht ist damit ausgeschlossen. **BEWIESEN**
- Unmount während des Laufs: React Query verwirft das Ergebnis, der Thinking-Zustand existiert dann nicht mehr. **BEWIESEN**
- Doppelter Parallelversuch: durch `pending`-Gate (presence.ts:110) und clientseitige Sofortsperre (Zeile 127) verhindert. **BEWIESEN**

---

## 3. Reproduction / Live-Evidenz (Production, Nutzer `9ce1d1b0-…`)

| Feld | Beobachtung |
| --- | --- |
| TIME | 21.09.2026, 10:49–11:36 UTC |
| Letzte eigene Frage (DB) | 10:49:57 (`hardware`, `detail`, score 0.646, answered = true) |
| Danach eigene Fragen | keine (`orb_questions` leer nach 10:49:57) — **BEWIESEN** |
| Letzte Nachrichten | 11:17 / 11:19 / 11:20 / 11:21 / 11:22 / 11:30 (normale Antworten, `proactive` = NULL) |
| Energy stored (11:34:38) | **0.25** (= Cap) |
| Energy calculated | 0.25 (Cap erreicht, Erholung greift) |
| Energy displayed | 0.25 |
| Energy in Nachrichten | 0.206 (11:19) → 0.184 → 0.145 → 0.103 (11:22) → 0.208 (11:30) |
| Offene Frage | keine (alle `answered = true`) |
| Server-Cooldown | erfüllt (> 120 s seit 10:49) |
| asked | **OFFEN** – nicht rekonstruierbar, siehe §7 |
| Thinking ended | YES (Mutation ist in jedem Fall settled) — **BEWIESEN** |

Bemerkenswert: Die Energie-Werte 0.206 → 0.103 und wieder 0.208/0.25 belegen, dass
die gestern eingebaute Erholung arbeitet und die Energie **nicht** mehr auf 0 fällt.
**BEWIESEN**

---

## 4. Root cause

**Kein Bug im Thinking-Lifecycle nachgewiesen.** Das beobachtete Muster erklärt sich
vollständig aus der bestehenden, gewollten Architektur:

1. „ORB denkt nach …“ wird **auch für einen autonomen Versuch** angezeigt, weil
   `curiosityMutation.isPending` in dieselbe `pending`-Grösse einfliesst wie eine
   Benutzernachricht. **BEWIESEN**
2. Bei `asked = false` bricht `channels.orb.tsx:236` bewusst ab: keine Nachricht,
   kein Toast, keine Chat-Zeile. Die Begründung landet ausschliesslich im
   Testbereich („Letzter eigener Fragen-Versuch“). **BEWIESEN**
3. Folge: Der Nutzer sieht Nachdenken, danach Stille – obwohl der Ablauf korrekt
   und vollständig beendet ist. **BEWIESEN**

Welches Gate im konkreten Ereignis abgelehnt hat, ist **OFFEN**: die Versuchsanzeige
ist nur sitzungslokal und war zum Zeitpunkt der Analyse nicht mehr vorhanden.

---

## 5. Evidence

- `src/routes/_authenticated/channels.orb.tsx:221-249, 553` (Mutation, Early Return, pending)
- `src/components/orb/OrbChat.tsx:163-167` (Shimmer-Text)
- `src/integrations/y-dude-orb/use-orb-presence.ts:97-132` (Takt, Sofortsperre)
- `src/orb-core/presence.ts:102-124` (Client-Gates)
- `src/orb-core/curiosity.ts:267-305` (Server-Gates, Reasons)
- `src/orb-core/engine.server.ts:2199-2360` (silent-Pfade, Persistenz, Rückgabe)
- `src/orb-core/llm/openai.server.ts:76` (Zeitlimit)
- Production-DB: `orb_state`, `orb_questions`, `orb_messages` (siehe §3)

---

## 6. Relation to Energy

- Energy ist aktuell **0.25** und damit deutlich über `CURIOSITY_MIN_ENERGY = 0.15`.
  Energie kann das Ereignis um 11:30 nicht verursacht haben. **BEWIESEN**
- Ein Energie-Update kann den autonomen Request weder abbrechen noch hängen lassen:
  Energie wirkt ausschliesslich als Gate in `decideCuriosity`, dessen Ergebnis eine
  normale Antwort (`WAIT`, „Zu wenig Energie – ORB wartet.“) ist. **BEWIESEN**
- Ein Zusammenhang zwischen dem gestrigen Energy-Reset und dem Thinking-Eindruck
  besteht nur indirekt: bei Energie < 0.15 liefert jeder Versuch `asked = false`,
  was genau das Muster „denkt … dann nichts“ erzeugt. **WAHRSCHEINLICH**

---

## 7. Relation to autonomous question path

Mögliche Ablehnungsgründe für das Ereignis, alle mit `asked = false` und still:
Cooldown, offene Frage, Score < 0.20, Neugier-Band, keine Wissenslücke,
Impuls-Suppression, Duplikatprüfung, Sprachschicht nicht verfügbar.
Welcher davon griff: **OFFEN** (Versuchsanzeige ist sitzungslokal).

---

## 8. Fix

**Keiner.** Gemäss Abschnitt 9 der Vorgabe: Der Thinking-State bleibt nicht hängen,
es wurde kein Promise-/Fehlerpfad gefunden, der den Abschluss verhindert, und Energie
ist nicht die Ursache. Es wird nichts geändert.

Als FINDING — NO CHANGE MADE festgehalten:

1. Der Thinking-Indikator unterscheidet nicht zwischen Benutzerantwort und autonomem
   Versuch; bei einer stillen Ablehnung bleibt der Nutzer ohne Abschlusszeichen.
2. Fehler des autonomen Versuchs gehen ausschliesslich in `console.error`.
3. `askProactively` ist im Client-`useCallback` von der Mutationsinstanz abhängig,
   wodurch das 5-s-Intervall bei jedem Render neu gestartet wird.
4. Die Versuchsanzeige ist nicht persistiert und nach einem Neuladen verloren.

---

## 9. Regression tests

Nicht erforderlich – keine Codeänderung. Bestehende Tests unverändert.

---

## 10. Remaining risks

- Ohne persistierte Versuchsprotokollierung bleibt jedes einzelne „denkt … dann nichts“
  nachträglich unklassifizierbar. **BEWIESEN**
- Ein Persistenzfehler im autonomen Pfad wäre für den Nutzer von einer gewollten
  Stille nicht unterscheidbar. **BEWIESEN**

---

Files changed: 1 (nur dieser Bericht)
Database changes: 0
Migrations: 0
Deployments: 0
Configuration changes: 0
Tests changed: 0
