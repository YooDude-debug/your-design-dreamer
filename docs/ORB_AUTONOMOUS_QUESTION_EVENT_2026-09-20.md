# ORB AUTONOMOUS QUESTION – Forensik eines konkreten Ereignisses

Datum der Analyse: 2026-09-20 · Modus: READ-ONLY · Nichts geändert · Kein Deployment ·
Keine Schwellen-/Formel-/DB-Änderung.

Untersuchtes Ereignis (Screenshot 20.09.2026, Anzeige 09:30 Berlin = 07:26 UTC):
ORB-Frage „Worauf bezieht sich „Nicht faktisch falsch“?“

## Ergebnis in einem Satz

Das war ein **echter eigener ORB-Impuls** über den Proactive-Intent-Pfad
(`decideImpulse`), ausgelöst vom **Leerlauf-Beobachter im Browser ohne neue
Nutzereingabe**. Dieser Pfad prüft **keine Energie** und umgeht damit die im
vorherigen Trace beschriebene Energie-Schwelle 0.15. Antwort auf die Schlussfrage:
**C) der bestehende Impulspfad wurde tatsächlich verwendet** – aber über den
Impuls-Zweig, nicht über den Curiosity-Zweig.

## Belege aus der Produktionsdatenbank

| Zeit (UTC) | Rolle | Entscheidung | Inhalt |
|---|---|---|---|
| 07:25:30.459 | orb | `stay_silent` | „Stimmt: Bevor du Brokkoli und Schnitzel …“ |
| 07:25:33.996 | – | – | Knoten „Nicht faktisch falsch“ angelegt (importance 0.8, confidence 0.9) |
| 07:26:11.726 | orb | `ask` | „Worauf bezieht sich „Nicht faktisch falsch“?“ |
| 07:26:55.605 | – | – | Frage als beantwortet markiert (Nutzerantwort) |

`orb_questions` Zeile `a95656dc-…`: topic `faktisch`, gap_kind `kontext`,
score `0.36288`, reason „„Nicht faktisch falsch“ ist wichtig, aber mit nichts
verknüpft. Priorität P2, Wert 0.36.“

`state_snapshot` der Frage: `proactive: true`, `explicit: false`,
`impulse: { type: missing_information, priority: P2, form: question }`,
`scope/impulse_scope: orb_core_chat_only`, **energy 0**, curiosity 1,
uncertainty 0.939, trust 1, question_id gesetzt.

Zwischen 07:25:30 und 07:26:11 liegt **keine** Nutzernachricht in `orb_messages`.
Die Aussage des Nutzers ist damit bestätigt.

## Antworten auf die Prüfpunkte

1. **Codepfad:** Browser-Leerlauf-Beobachter `useOrbPresence`
   (`shouldAskProactively` in `src/orb-core/presence.ts`) → `onAsk` →
   `curiosityFn` (`src/routes/_authenticated/channels.orb.tsx:233`) → SDK
   `orb-core.server.ts:67` → `askProactively` in
   `src/orb-core/engine.server.ts:2186 ff.`
2. **Kategorie:** PROACTIVE_IMPULSE (Proactive Intent), ausgelöst durch
   Presence/Idle-Observer. Nicht FOLLOW_UP, nicht SMALLTALK, nicht der
   klassische CURIOSITY-Zweig (`decideCuriosity`).
3. **Neue Nutzereingabe nötig?** Nein. Der Aufruf ist ereignisbasiert aus dem
   Leerlauf; es gibt keinen Nutzer-Turn in dieser Lücke.
4. **Erzeugende Funktionen:** Lücke aus `detectGaps`
   (`src/orb-core/gaps.ts:251-257`, Regel „wichtige Angabe ohne Verknüpfung“,
   importance ≥ 0.6, 0 Verbindungen), Auswahl in `decideImpulse`
   (`src/orb-core/impulse.ts`), Umformung `gapFromImpulse`, Formulierung
   `formulateQuestion` → Sprachschicht `speak` mit `decision: "ask"`.
   Der Wortlaut stammt aus der Sprachschicht, die inhaltliche Richtung aus der
   Vorlage in gaps.ts:256.
5. **Werte unmittelbar davor:** energy 0 · curiosity 1 (Band `very_high`) ·
   uncertainty 0.939 · trust 1 · joy 0.95 · fear 0.12 · Idle-Zeit ≈ 41 s
   (07:25:30 → 07:26:11, Minimum 40 s) · Cooldown: letzte eigene Frage
   19.09. 18:07 UTC, Cooldown `very_high` = 120 s → lange abgelaufen ·
   relevante Memory: Knoten `5d140b55…` „Nicht faktisch falsch“ (importance 0.8,
   confidence 0.9) · relevante Connection: zum Erkennungszeitpunkt keine
   (genau das war die Lücke) · Kontext: laufendes Gespräch über Lieblingsessen
   und eine korrigierte frühere Aussage.
6. **Warum trotz energy = 0?** `decideImpulse` und `shouldAskProactively`
   enthalten **keine** Energieprüfung (kein Vorkommen von `energy` in
   `impulse.ts` und `presence.ts`). Die Energieprüfung `CURIOSITY_MIN_ENERGY`
   liegt nur in `decideCuriosity` (`curiosity.ts:285`). In `askProactively` gilt:
   `if (!impulse && (decision.action !== "ASK" …)) return silent(...)` – sobald
   ein Impuls vorliegt, wird die energieabhängige Curiosity-Entscheidung
   übersprungen. Ebenso ohne Energiebezug: das Client-Gate.
7. **Zweiter Pfad, der die Energie-Schwellen umgeht?** Ja, genau dieser:
   Proactive Intent über `detectGaps` + `decideImpulse`. Er nutzt
   Neugier-Band, Cooldown, Duplikatprüfung und `IMPULSE_MIN_SCORE = 0.2`
   (hier 0.36 > 0.2), aber keine Energie. Reine Feststellung, keine Bewertung.
8. **„NACHFRAGEN“ – echte Core-Entscheidung?** Echte Core-Entscheidung.
   `decision: "ask"` ist in der Datenbankzeile gespeichert; das UI-Label
   „nachfragen“ ist nur die Anzeige dieses Wertes
   (`OrbChat.tsx` `DECISION_LABEL`). „KEIN EIGENER IMPULS“ an der vorherigen
   Antwort ist ebenfalls echt (`stay_silent` wegen energy < 0.12 in `decide`).
9. **Gespeichert?** Ja, doppelt: `orb_questions` (a95656dc-…, asked_at
   07:26:11.726, answered_at 07:26:55.605) und `orb_messages`
   (409fc08f-…, decision `ask`, vollständiger `state_snapshot`). Zusätzlich
   wurden curiosity −0.06 und energy −0.03 (bereits 0) gebucht.
10. **Fehlende Daten:** (a) keine Serverprotokolle für die abgelehnten
    Leerlauf-Prüfungen – wie oft der Beobachter vorher still blieb, ist nicht
    rekonstruierbar; (b) der Knoten hat heute 1 Verbindung, der Zustand
    „0 Verbindungen“ zum Erkennungszeitpunkt ist aus `orb_questions.reason`
    erschlossen, nicht als Verlaufsdatensatz vorhanden; (c) `detectedGaps` der
    Laufzeit werden nicht persistiert; (d) Interest-Gewicht und exakte Idle-Zeit
    des Clients sind nicht gespeichert (Idle-Zeit aus Zeitstempeln abgeleitet).

## Abgleich mit dem vorherigen Trace

Der vorherige Bericht (`ORB_PROACTIVE_QUESTION_TRACE_2026-09-20.md`) nannte
07:26 UTC als „letzten echten eigenen Impuls“ – das ist genau dieses Ereignis.
Kein Widerspruch: die dort untersuchte Folge „Ja: Welche Pasta …“ war eine
LLM-Antwort im DIRECT_ANSWER-Pfad, dieses Ereignis hier ist der Impulspfad.
Die Aussagen „Energy = 0“, „eigene Curiosity-Frage ab 0.15“, „Smalltalk ab 0.12“
bleiben gültig; sie betreffen `decide`/`decideCuriosity`, nicht `decideImpulse`.

Einordnung A–D: **C)** – bestehender Impulspfad, real ausgeführt und persistiert;
zusätzlich **B)** insofern, als der Auslöser der clientseitige Leerlauf-Beobachter
war. Nicht A), nicht D).
