# ORB CORE — FORENSIC MASTER REPORT

Datum: 2026-09-21 · Version: 1.0 · Umgebung: Production · Modus: READ-ONLY Quellenanalyse

Zusammenführung aller am 2026-09-21 erstellten oder aktualisierten ORB-Core-Forensik-,
Audit- und Untersuchungsberichte. Keine Codeänderung, keine Datenbankänderung, keine
Migration, keine Konfigurationsänderung, keine Teständerung, kein Deployment im Rahmen
dieses Berichts.

## Evidenzklassifikation

| Status | Bedeutung |
| --- | --- |
| KAUSAL BEWIESEN | Ursache → Wirkung technisch nachvollzogen und durch Code, DB-Zeilen, Trigger, Test oder Laufzeitdaten belegt |
| DIREKT BEOBACHTET | Ereignis sicher belegt, vollständige Ursache nicht bewiesen |
| WAHRSCHEINLICH | technisch plausibel, kein vollständiger Kausalitätsnachweis |
| OFFEN | keine ausreichende Evidenz |

## Quellenberichte (15)

| # | Bericht | Gegenstand |
| --- | --- | --- |
| 1 | ORB_ENERGY_RECOVERY_DESIGN_SIMULATION_2026-09-21.md | Entwurf und Simulation der Energie-Erholung |
| 2 | ORB_ENERGY_RECOVERY_IMPLEMENTATION_PRODUCTION_2026-09-21.md | freigegebene Umsetzung +0.02/min, Cap 0.25 |
| 3 | ORB_PROACTIVE_QUESTIONING_BLOCK_ANALYSIS_2026-09-21.md | Blockade eigener Fragen, Energie als Sperre |
| 4 | ORB_PROACTIVE_COUNTERFACTUAL_SIMULATION_2026-09-21.md | Gegenprobe der Gates |
| 5 | ORB_LISTEN_AUTONOMY_FORENSIC_2026-09-21.md | LISTEN als Prompt-Wortlaut, nicht als Sperre |
| 6 | ORB_ENERGY_FORENSIC_LIVE_EVENT_2026-09-21.md | Live-Abfall 11–15 % → 1 % |
| 7 | ORB_AUTONOMY_OBSERVABILITY_FORENSIC_2026-09-21.md | 25 Gates, stille Ablehnungen |
| 8 | ORB_AUTONOMY_OBSERVABILITY_IMPLEMENTATION_2026-09-21.md | Testbereich-Anzeige des letzten Versuchs |
| 9 | ORB_AUTONOMY_OBSERVABILITY_UI_VISIBILITY_CHECK_2026-09-21.md | Auffindbarkeit der Anzeige |
| 10 | ORB_FORENSIC_CASE2_PERSONAL_MEMORY_2026-09-21.md | Persistenz und Abruf persönlicher Angaben (19.09.) |
| 11 | ORB_CROSS_CASE_AUTONOMY_ARCHITECTURE_2026-09-21.md | Vergleich Curiosity- und Impuls-Zweig |
| 12 | ORB_FORENSIC_MEMORY_RECALL_AUTONOMY_2026-09-21.md | drei eigene Fragen, Reisen-Fehlverknüpfung, Selbstkorrektur |
| 13 | ORB_ENERGY_MESSAGE_RESET_FIX_2026-09-21.md | Ursache und minimale Behebung des Energie-Rücksetzers |
| 14 | ORB_CORE_OBJECTIVE_MATURITY_ASSESSMENT_2026-09-21.md | Reifegrad-Bestandsaufnahme |
| 15 | ORB_THINKING_STUCK_FORENSIC_2026-09-21.md | „ORB denkt …“ ohne sichtbare Folge |

---

# 1. Executive Summary

Fünf Ursache-Wirkungs-Ketten wurden heute vollständig belegt.

**1. Energie-Erholung wurde durch fremde Zustandsschreibvorgänge neutralisiert (KAUSAL BEWIESEN).**
Der angezeigte Energiewert wird zur Laufzeit als `gespeicherter Wert + Δt · 0.02` berechnet, wobei
Δt aus `orb_state.updated_at` stammt. Zwei nicht energiebezogene Schreibvorgänge —
`decay_computations` in `getSnapshot()` und der Lernzähler in `recordLearning()` — schrieben
`orb_state` ohne `energy`. Der Trigger `orb_state_updated_at` setzte dabei `updated_at = now()`.
Damit war Δt wieder nahe 0, die aufgelaufene Erholung verfiel, und die anschließenden
Nachrichtenkosten wurden auf einen nicht erholten Wert angewandt; `clamp01()` ergab exakt 0.

**2. Die Blockade eigener Fragen war ein Energie-Gate, nicht LISTEN (KAUSAL BEWIESEN).**
`decideCuriosity()` liefert `WAIT`, sobald `energy < 0.15`. Der Modus `LISTEN` existiert nur als
Antwort-Etikett und als ein Satz Prompt-Wortlaut; im eigenständigen Fragenweg wird er nicht
gelesen und nicht einmal in den Prompt übergeben.

**3. Die Energie-Erholung arbeitet zur Laufzeit korrekt (KAUSAL BEWIESEN, live reproduziert).**
Live-Werte aus `orb_messages.state_snapshot`: 0.00696 → 0.19096 → 0.18070 → 0.21162; nach der
Behebung von Punkt 1 wurde um 11:34:38 UTC der gespeicherte Wert 0.25 erreicht — die Obergrenze.

**4. Die „Reisen“-Fehlverknüpfung entstand beim Memory-Ingest am 19.09. (KAUSAL BEWIESEN).**
`topicOf()` vergleicht Wortstämme in beide Richtungen. Der Stamm `wand` aus „wandern“ trifft das
Reise-Schlüsselwort `wander`. Der Knoten wurde deshalb am 19.09. mit dem Thema `reisen`
gespeichert. Das Sprachmodell erhielt am 21.09. eine bereits falsch klassifizierte Erinnerung.

**5. Long-Term-Memory-Retrieval ist belegt (KAUSAL BEWIESEN).**
Ein am 19.09. persistierter Knoten wurde am 21.09. über Ähnlichkeit, Relevanz und Rangfolge
geladen und mit berechneter Sicherheitsstufe „wahrscheinlich“ (Schwelle 0.3 / 0.6) in die Antwort
übernommen.

Direkt beobachtet, aber ursächlich nicht abgeschlossen: das Muster „ORB denkt … danach nichts“.
Belegt ist, dass der Nachdenken-Hinweis technisch nicht hängen bleiben kann und dass eine
Ablehnung bewusst ohne sichtbaren Abschluss endet. Welches Gate im konkreten Ereignis um
11:30 UTC ablehnte, ist OFFEN, weil Ablehnungen nicht persistiert werden.

Nicht als Mechanismus bestätigt: die beobachtete Selbstkorrektur. Es existiert kein Prüfschritt,
der Themenplausibilität oder die Voraussetzung einer früheren eigenen Frage gegen den Abruf hält.

---

# 2. Ausgangslage

Stand zu Tagesbeginn (2026-09-21, 06:30 UTC):

- Die Energie-Erholung (+0.02/Minute, Obergrenze 0.25, Kosten einer eigenen Frage 0.03) war am
  Vortag freigegeben und in Production veröffentlicht. Der gespeicherte Energiewert lag bei 0.
- Es existierten 0 eigene Fragen des laufenden Tages; der letzte `proactive`-Metrikeintrag stammte
  vom 2026-09-20 07:26:13.
- Das Verhalten „ORB stellt keine eigenen Fragen mehr“ war offen und wurde von ORB selbst mit
  „LISTEN-Vorgaben“ begründet.
- Der Energiewert der Anzeige schwankte sichtbar ohne erkennbare Nutzeraktion.

---

# 3. Autonomous Question Path

Nur tatsächlich im Code belegte Komponenten. Dateien und Zeilen in Kapitel 14.

```text
Browser: Leerlauf-Beobachter (use-orb-presence.ts, Intervall 5 s, rein rechnerisch)
  G1  Tab sichtbar
  G2  kein Tippen
  G3  Mikrofon inaktiv
  G4  ORB spricht nicht
  G5  keine laufende Anfrage (pending)
  G6  Leerlauf >= 40 s
  G7  Leerlauf <= 15 min
  G8  Neugier-Band != low
  G9  Client-Cooldown (low/medium 300 s, high 180 s, very_high 120 s)
    -> Sofortsperre lastProactiveRef = now  (verhindert Doppelaufruf)
    -> genau EIN Serveraufruf: requestOrbCuriosity
Server: askProactively(db, userId)
  loadCuriosityContext: 12 Knoten, 8 Interessen, 8 Nachrichten, Fragenhistorie, 60 Verbindungen
  CURIOSITY-Zweig  decideCuriosity()
    G10 mindestens eine Wissenslücke
    G11 Neugier ausreichend (mayAskAtCuriosity)
    G12 energy >= 0.15                 -> sonst WAIT
    G13 keine offene eigene Frage      -> sonst WAIT
    G14 Server-Cooldown                -> sonst WAIT
    G15 Kandidatenwert >= 0.20         -> sonst WAIT
  IMPULSE-Zweig    decideImpulse()
    Suppression, offene Frage, Duplikat/bekannt, Priorität, Wert >= 0.20
  Merge: impulse ? gapFromImpulse(...) : decision.gap
  Formulation: formulateQuestion() -> Sprachschicht (Zeitlimit per AbortSignal)
    -> Statusfehler = still
  Duplikatprüfung: isDuplicateQuestion (Ähnlichkeitsschwelle 0.6) -> still
  Persistenz (vier Schreibvorgänge, nicht transaktional):
    orb_questions -> orb_messages (state_snapshot.proactive = true, question_id)
      -> orb_state (curiosity -0.06, energy -0.03) -> orb_metrics kind = 'proactive'
  Rückgabe: asked = true, Frage, Snapshot
UI: curiosityMutation.onSuccess
  Versuch wird immer in die Testbereich-Anzeige geschrieben
  bei asked = false: bewusster Abbruch, keine Chat-Ausgabe
  bei asked = true: Snapshot, Chat-Zeile, optional Sprachausgabe, Cooldown
```

Belegte Eigenschaften dieses Pfades:

- Die Entscheidung *ob* und *worüber* gefragt wird, ist deterministisch; nur die Formulierung
  stammt aus der Sprachschicht. **KAUSAL BEWIESEN**
- Der Takt liegt ausschließlich im Browser; ohne geöffnete ORB-Ansicht existiert kein
  eigenständiger Fragenweg. **KAUSAL BEWIESEN**
- Die vier Persistenzschritte sind nicht in einer Transaktion gebündelt; ein Fehler nach dem
  ersten Schritt kann eine Fragenzeile ohne Nachricht hinterlassen. **WAHRSCHEINLICH**
  (Codelage belegt, kein Vorfall beobachtet)

---

# 4. Energy Forensics

## 4.1 Drei Energiebegriffe

| Begriff | Definition | Ort |
| --- | --- | --- |
| STORED | Spaltenwert `orb_state.energy` | Datenbank |
| CALCULATED | `recoverEnergy(stored, updated_at, now)` = `min(0.25, stored + Δt · 0.02)` | `toState()` zur Laufzeit |
| DISPLAYED | CALCULATED, gerundet in Prozent; steuert zusätzlich die Avatar-Darstellung ab 0.20 | Oberfläche |

**KAUSAL BEWIESEN:** Der angezeigte Wert war nie der gespeicherte Wert. Der Zeitanker der
Erholung ist kein eigenes Feld, sondern `orb_state.updated_at`.

## 4.2 Belegte Energie-Abflüsse

| Quelle | Betrag | Beleg |
| --- | --- | --- |
| normale Nachricht (Zustandsverfall in `processInput`) | zustandsabhängig | `state_snapshot.energy` je Turn |
| gestellte eigene Frage | −0.03 | `askProactively`, Zustandsupdate |
| sonstige Verbraucher | keine gefunden | Suche über alle `orb_state`-Schreibpfade |

Abgelehnte Versuche, Rendern, der Nachdenken-Hinweis, Abfragen und LISTEN verbrauchen **keine**
Energie. **KAUSAL BEWIESEN**

## 4.3 Live-Werte

Quelle: `orb_messages.state_snapshot.energy` (Production, Nutzer `9ce1d1b0-…`).

| Zeit (UTC) | Wert | Bedeutung |
| --- | --- | --- |
| 08:36:16 | 0.00696 | Ausgangswert nach dem Rücksetz-Effekt, kurz vor der ersten eigenen Frage |
| 08:45:30 | 0.19096 | Snapshot der eigenen Frage A — Erholung erstmals zur Laufzeit belegt |
| 08:54:27 | 0.18070 | Snapshot der eigenen Frage B, nach Kosten 0.03 und erneuter Erholung |
| 08:59:57 | 0.21162 | Snapshot der eigenen Frage C |
| 11:19–11:22 | 0.206 → 0.103 | Absinken durch mehrere aufeinanderfolgende Nachrichten |
| 11:30:17 | 0.208 | Erholung nach Gesprächspause |
| 11:34:38 | 0.25 (STORED) | Obergrenze erreicht; erstmals ist auch der gespeicherte Wert erholt |

Die Reihe 0.007 → 0.191 → 0.181 → 0.212 ist damit nicht eine Messung derselben Größe in
gleichen Abständen, sondern die Energie **zum Zeitpunkt von vier verschiedenen Ereignissen**:
einem normalen Turn und den drei eigenen Fragen.

## 4.4 Der Abfall 11–15 % → 1 %

**KAUSAL BEWIESEN:** Anzeige-/Persistenz-Fehlpassung. Ausgeschlossen wurden wiederholte
legitime Kosten (heute 2 Nachrichten, 0 Fragen), ein unbekannter Verbraucher (keiner existiert)
und mehrfache autonome Zyklen (0 `proactive`-Metriken zum Zeitpunkt der Analyse). Ursache ist,
dass `getSnapshot()` bei jedem Abruf `decay_computations` schrieb; der Trigger setzte
`updated_at = now()`, Δt fiel auf 0, und die Anzeige sprang auf ≈ 0–1 % zurück. `decay_computations`
stand bei 4539 — jeder dieser Schreibvorgänge hatte denselben Effekt.

## 4.5 Behebung (dokumentiert, außerhalb dieses Berichts erfolgt)

Beide Schreibvorgänge schreiben seither zusätzlich `energy: toState(stateRow).energy`, also den
zum Lesezeitpunkt erholten Wert; der neue Zeitstempel gehört damit zum neuen Basiswert.
Unverändert: Kosten, Rate +0.02/min, Obergrenze 0.25, Schwelle 0.15, alle Gates, Schema und RLS.
Belegt durch 6 neue Tests sowie 1095 Logik- und 77 DB/Security-Tests.

---

# 5. LISTEN / Autonomous Path

**KAUSAL BEWIESEN:**

- `LISTEN` existiert an genau drei Stellen: als Wert von `ConversationMode`, als Rückfallzweig von
  `decideConversationMode()` und als Eintrag in `MODE_HINT` („stelle keine Frage“).
- Es gibt keine LISTEN-Spalte in `orb_state` und keinen LISTEN-Zustand, der aktiv sein könnte.
- `decideConversationMode()` wird ausschließlich im Antwortweg (`processInput`) aufgerufen.
- `askProactively()` liest `ConversationMode` nicht; `formulateQuestion()` baut einen eigenen
  Prompt **ohne** Modusfeld. `MODE_HINT.LISTEN` erreicht den eigenständigen Fragenweg nicht.
- Der einzige ausführbare Effekt von LISTEN ist, dass für die Antwort Gesprächsfäden und
  Fokusthema geleert werden.

**Entstehung der früheren Fehlinterpretation (KAUSAL BEWIESEN):** ORB selbst hatte formuliert,
„LISTEN-Vorgaben verbieten mir, eine Frage zu stellen“. Diese Aussage ist Modelltext. Technisch
entschied die Energie: beide betroffenen Antworten tragen `decision = stay_silent`, und
`decide()` liefert `stay_silent`, sobald `energy < 0.12`. FOLLOW_UP und SMALLTALK verlangen
ebenfalls `energy >= 0.12`. LISTEN war die Folge niedriger Energie, nicht deren Ursache.

---

# 6. Observability

## 6.1 Forensischer Befund

**KAUSAL BEWIESEN:** Der eigenständige Fragenweg hatte 25 Entscheidungspunkte, von denen 24
vollständig still waren. Clientseitig (G1–G9) verlässt die Begründung den Browser nie; sie lag nur
in React-State. Serverseitig gibt `silent(reason)` ein einfaches Objekt zurück — keine
Protokollzeile, keine Metrik, keine Fragen-, Nachrichten- oder Zustandszeile. Nur der
tatsächlich gesendete Fall hinterlässt eine dauerhafte Spur (`orb_questions` +
`orb_messages.state_snapshot.proactive` + `orb_metrics kind = 'proactive'` + Energie −0.03).
Ein geworfener Datenbankfehler war ausschließlich in der Browserkonsole sichtbar.

Nicht rekonstruierbar waren damit: ob der Beobachter überhaupt auslöste, welches der 16
serverseitigen Gates ablehnte, der Energiewert im Entscheidungsmoment, der Kandidatenwert einer
Ablehnung, die Anzahl der Versuche einer Sitzung und ob die Sprachschicht ausfiel.

## 6.2 Umgesetzte Änderung (dokumentiert, außerhalb dieses Berichts erfolgt)

Reine Client-Anzeige: der vom Server ohnehin zurückgegebene Grund des letzten Versuchs wird im
bestehenden Testbereich als „Letzter eigener Fragen-Versuch“ dargestellt (Zeitpunkt, `asked`,
Aktion, Grund, Thema, Lückenart, Wert). Keine Änderung an Entscheidung, Schwellen, Energie,
Persistenz, Datenbank, Anfragen, Zeitgebern oder Server.

## 6.3 Fortbestehende Grenzen

- Die Anzeige ist sitzungslokal und nach einem Neuladen verloren. **KAUSAL BEWIESEN**
- Ein ausgebliebener Versuch bleibt unklassifiziert (nicht ausgelöst oder clientseitig abgelehnt).
  **KAUSAL BEWIESEN**
- Der Abschnitt liegt hinter zwei standardmäßig geschlossenen Ebenen (Technische Informationen →
  Status) und unterhalb des sichtbaren Bereichs; es existiert kein Entwickler-, Admin-,
  Umgebungs- oder Feature-Schalter davor. **KAUSAL BEWIESEN**
- Fehler des eigenständigen Weges gehen weiterhin nur in die Browserkonsole. **KAUSAL BEWIESEN**

---

# 7. Memory Recall

## 7.1 Belegte Persistenz (Case 2, 19.09.2026)

| Zeit (UTC) | Ereignis | Beleg |
| --- | --- | --- |
| 18:04:31.688 | Nutzeraussage mit Lieblingsessen, Getränk, Schuhgröße 42, Grafikkarte RTX 5070 | `orb_messages b610a162-…` |
| 18:04:31.689 | Modellantwort „… merke ich mir …“, `recalled = 0` | `orb_messages ff3cb09b-…` |
| 18:04:35.100 | Persistenz eines Knotens mit dem **Rohsatz**, importance 0.48 ≥ Schwelle 0.35, confidence 0.9, `user_stated`, `active` | `orb_nodes 132bf051-…` |
| 18:05:12.998 | eigener Beitrag ohne neue Nutzereingabe, `decision = ask`, Curiosity-Zweig, `gap_kind detail`, score 0.40446 | `orb_questions 145b70ef-…` |
| 18:05:47.846 | Abruf: Fakten korrekt genannt, `recalled = 1`, `nodes_loaded = 3` | `orb_messages 3fdce42f-…` |
| 18:05:51.729 | Zustandsänderung: erste Verbindung `132bf051 → 4e4167ac` | `orb_connections 283725f0-…` |

**KAUSAL BEWIESEN:** Eingabe → Erkennung → Entscheidung → Persistenz → Zustandsänderung →
Abruf → Folgeverhalten. Die Modellaussage „merke ich mir“ entstand **vor** der Persistenz und ist
kein Persistenznachweis. Es wurden keine vier Einzelfakten gespeichert, sondern eine Äußerung.

## 7.2 Abgrenzungen

- **Gesprächskontext:** Der Antwortweg lädt bis zu acht der letzten Nachrichten. Für die Antwort
  um 18:04:31 ist `recalled = 0` belegt — sie stammte ausschließlich aus dem Kontextfenster.
  **KAUSAL BEWIESEN**
- Für 18:05:47 ist Abruf belegt (`recalled = 1`), der Rohsatz lag aber ebenfalls noch im
  Kontextfenster; die **Exklusivität** des Abrufs als Quelle ist an dieser Stelle nicht bewiesen.
  **WAHRSCHEINLICH**
- **Graph:** Verbindungen beeinflussen Relevanz und den Impuls-Zweig. Der Curiosity-Lückenweg
  nutzt sie nicht direkt; Gesprächsfäden werden vom eigenständigen Fragenweg nicht geladen.
  **KAUSAL BEWIESEN**
- **Long-Term-Memory-Retrieval am 21.09.:** Der am 19.09. um 19:24:02 angelegte Knoten
  `1dfb5e07-…` (importance 0.72, activation_count 16) wurde am 21.09. über Ähnlichkeit, Relevanz
  und Rangfolge geladen. Die Formulierung „wahrscheinlich“ entstammt der berechneten
  Sicherheitsstufe (`certaintyOf`: „sicher“ ab 0.6, „wahrscheinlich“ ab 0.3). Das Anzeigeetikett
  „ERINNERN“ ist die Darstellung der Entscheidung `remind`. **KAUSAL BEWIESEN**

---

# 8. Die „Reisen“-Fehlverknüpfung

Entstehungszeitpunkt: **2026-09-19, 19:24:02 UTC** · Entdeckungszeitpunkt: **2026-09-21**

Kausalkette, vollständig reproduziert:

```text
Nutzertext: „… keine Zeit in den Graphen zu wandern“
  -> Tokenisierung/Stammbildung ergibt u. a. den Stamm  wand
  -> topicOf() vergleicht bidirektional:  t.startsWith(k) || k.startsWith(t)
  -> Themenschlüsselwort des Themas „reisen“ enthält  wander
  -> "wander".startsWith("wand")  ist wahr
  -> Thema des Knotens wird  reisen
  -> Persistenz am 19.09. 19:24:02 als orb_nodes 1dfb5e07-…  (topic = reisen)
  -> 21.09.: Rangfolge wählt diesen Knoten als Wissenslücke
  -> eigene Frage A (08:45:30) und B (08:54:27) mit Thema  reisen
  -> Nutzerantwort über Griechenland (08:51:42) verstärkt die Themenspur
```

**Status: KAUSAL BEWIESEN.** Ausdrücklich festgehalten:

- Die Fehlklassifikation entstand beim Memory-Ingest, nicht bei der späteren Textausgabe.
- Sie entstand am 19.09., nicht am 21.09.
- Das Sprachmodell erhielt eine bereits falsch klassifizierte Erinnerung; es hat nicht
  zwei Erinnerungen vermischt und keine Reiseinformation erfunden.
- Der betroffene Knoteninhalt lautet wörtlich: „Okay ich sehe das problem. Der Chatverlauf ist zu
  kurz. Und die wichtigen Informationen haben keine Zeit in den Graphen zu wandern“.
- Ein Konfidenzwert für die Themenzuordnung existiert nicht; ein falsches Thema ist daher von
  einem richtigen nicht unterscheidbar.

---

# 9. Selbstkorrektur

Beobachtet: ORB stellte später fest, dass ein konkreter Bezug zu Reisen in den betreffenden
Erinnerungen nicht enthalten ist.

**Belegt (KAUSAL BEWIESEN):**

- Es existiert kein Codeabschnitt, der die Plausibilität eines Themas prüft.
- Es existiert kein Codeabschnitt, der die Voraussetzung einer früheren eigenen Frage gegen den
  Abruf hält, und keine Nachverarbeitung der Antwort.
- Der Antwort-Prompt erhält den Erinnerungstext, **ohne** das Thema zu behaupten; der
  Frage-Prompt erhält das Themen-Etikett. Diese Asymmetrie ermöglichte die Korrektur.

**Klassifikation:** LLM-basierte Selbstkorrektur, ermöglicht durch asymmetrische
Prompt-Zusammensetzung. Kein nachgewiesener eigener Validierungsmechanismus und keine
Quellenzuordnung. Eine Wiederholbarkeit ist nicht garantiert. **DIREKT BEOBACHTET** für das
Ereignis, **KAUSAL BEWIESEN** für die Abwesenheit eines Mechanismus.

---

# 10. Die drei eigenen Fragen des 21.09.

| | Frage A | Frage B | Frage C |
| --- | --- | --- | --- |
| Fragenzeile (`orb_questions`) | 08:45:30.976 | 08:54:27.211 | 08:59:57.407 |
| Nachricht / Metrik | 08:45:33 | 08:54:30 | 09:00:01 |
| Thema | reisen | reisen | hardware |
| Lückenart | detail | kontext | erfahrung |
| Wert | 0.6425 | 0.6806 | 0.5995 |
| Quellknoten | 1dfb5e07-… | 1dfb5e07-… | 59d932de-… |
| Energie im Snapshot | 0.19096 | 0.18070 | 0.21162 |
| Neugier-Band | very_high | very_high | very_high |
| Weg | CURIOSITY | CURIOSITY | CURIOSITY |
| `state_snapshot.proactive` | true | true | true |
| `impulse` im Snapshot | null | null | null |
| Persistenz | vollständig (Frage, Nachricht, Zustand, Metrik) | vollständig | vollständig |
| Ergebnis | beantwortet | beantwortet | beantwortet |

**KAUSAL BEWIESEN:** Alle drei liefen über den CURIOSITY-Zweig, keine über IMPULSE (Nachweis:
`impulse = null` im Snapshot jeder Zeile). Zwei aufeinanderfolgende Fragen stammen aus **einem**
Knoten, weil die Lückenart wechselte (detail → kontext) und der Lückenschlüssel Knoten und
Lückenart kombiniert. Ein früher im Testbereich beobachteter abgelehnter Versuch trug denselben
Wert 0.643 wie die später gestellte Frage A — es fehlte ausschließlich die Energie.

Ergänzend belegt für den 21.09. nach 09:00: weitere eigene Fragen um 09:31:19, 09:36:43,
09:47:46, 10:47:22 und 10:49:57, alle beantwortet; danach keine weitere bis 11:36.

---

# 11. „ORB denkt …“ — Forensik

## 11.1 Lebenszyklus des Nachdenken-Zustands

**KAUSAL BEWIESEN:** Es gibt keinen eigenen Zustandsschalter. Der Hinweis wird aus
`sendMutation.isPending || curiosityMutation.isPending` abgeleitet und an drei Stellen angezeigt
(Chatverlauf, Statuszeile, Gesicht). Folgen:

1. Start: automatisch mit dem Auslösen der Anfrage — also **vor** dem Serveraufruf.
2. Ende: automatisch beim Abschluss der Anfrage, bei Erfolg **und** bei Fehler.
3. Es existiert kein Rücksprung, der einen Schalter offen lassen könnte; ein `finally` ist nicht
   erforderlich.

## 11.2 Alle Fehlerpfade

| Fall | Verhalten | Nachdenken endet | Sichtbarer Abschluss |
| --- | --- | --- | --- |
| Gate lehnt ab (`silent`) | HTTP 200, `asked = false`, Grund im Ergebnis | ja | nein (bewusst) |
| Persistenzfehler (geworfene Ausnahme) | Fehlerzweig, nur Browserkonsole | ja | nein |
| Netzwerkfehler / HTTP ≠ 200 / defektes JSON | Fehlerzweig, kein Wiederholungsversuch | ja | nein |
| Sprachschicht hängt | ausgeschlossen: Zeitlimit per `AbortSignal.timeout` | ja | nein |
| Komponente wird verlassen | Ergebnis verworfen, Zustand existiert nicht mehr | entfällt | entfällt |
| Zwei gleichzeitige Versuche | verhindert durch `pending`-Gate und Sofortsperre | ja | entfällt |

## 11.3 Ergebnis

**KAUSAL BEWIESEN:** Der Nachdenken-Hinweis erscheint auch für einen eigenständigen Versuch und
zwar vor der Serverantwort; bei `asked = false` bricht die Oberfläche bewusst ohne Chat-Ausgabe,
Meldung oder Hinweis ab. Das erzeugt genau das beobachtete Muster, obwohl der Ablauf korrekt und
vollständig beendet ist.

**OFFEN:** Welches Gate im Ereignis um 11:30 UTC ablehnte. Zum Zeitpunkt der Analyse waren
Energie 0.25, keine offene Frage und der Server-Cooldown erfüllt; die sitzungslokale
Versuchsanzeige war nicht mehr vorhanden. Ein hängender Nachdenken-Zustand wurde **nicht**
nachgewiesen; es wurde deshalb nichts geändert.

---

# 12. Cross-System Causality

```text
KETTE 1 — Energie-Zeitanker
  Snapshot-Abruf / Lernzähler schreibt orb_state ohne energy
    -> Trigger orb_state_updated_at setzt updated_at = now()
    -> Δt = 0  =>  CALCULATED = STORED (niedrig)
    -> Nachrichtenkosten auf nicht erholten Wert  ->  clamp01 = 0
    -> DISPLAYED springt auf 0                                   [KAUSAL BEWIESEN]

KETTE 2 — Autonomie-Sperre
  energy < 0.15  ->  decideCuriosity = WAIT  ->  asked = false
    -> keine Frage, keine Spur, kein sichtbarer Abschluss        [KAUSAL BEWIESEN]

KETTE 3 — Erholung ermöglicht eigene Frage
  Ruhezeit  ->  +0.02/min (Cap 0.25)  ->  Schwelle 0.15 erreicht
    -> Kandidatenwert 0.643 >= 0.20  ->  Frage A 08:45:30       [KAUSAL BEWIESEN]

KETTE 4 — Themenklassifikation
  "wandern" -> Stamm "wand" -> bidirektionaler Vergleich mit "wander"
    -> Thema reisen -> Persistenz 19.09. -> Retrieval 21.09.
    -> eigene Fragen A und B mit Thema reisen                   [KAUSAL BEWIESEN]

KETTE 5 — Long-Term-Memory
  persistierter Knoten -> Ähnlichkeit/Relevanz/Rangfolge
    -> Antwortkontext -> Sicherheitsstufe "wahrscheinlich"      [KAUSAL BEWIESEN]

KETTE 6 — LISTEN
  energy < 0.12  ->  decide() = stay_silent  ->  Modus LISTEN
    -> Prompt-Wortlaut "stelle keine Frage"
    -> Modellaussage "LISTEN verbietet mir zu fragen"           [KAUSAL BEWIESEN]
  (LISTEN -> Blockade des eigenständigen Weges)                 [WIDERLEGT]
```

---

# 13. Kausalitätstabelle

| Befund | Ursache | Wirkung | Evidenz | Status |
| --- | --- | --- | --- | --- |
| Energie erscheint nach einer Nachricht als 0 | `orb_state`-Schreibvorgänge ohne `energy` + Trigger auf `updated_at` | Δt = 0, Erholung verfällt, `clamp01` ergibt 0 | `engine.server.ts` (Snapshot- und Lernpfad), `toState`, Trigger `orb_state_updated_at`, DB-Zeile energy 0 | KAUSAL BEWIESEN |
| Anzeige fiel von 11–15 % auf ≈ 1 % | derselbe Zeitanker-Verlust bei jedem Snapshot-Abruf | Anzeigesprung ohne Nutzeraktion | `decay_computations` = 4539, keine Kosten- oder Verbraucherzeile | KAUSAL BEWIESEN |
| keine eigenen Fragen am Morgen | `energy < 0.15` | `decideCuriosity` = WAIT | `curiosity.ts` Gate, `decision = stay_silent`, 0 `proactive`-Metriken | KAUSAL BEWIESEN |
| ORB nannte LISTEN als Verbot | Energie < 0.12 → `stay_silent` → Modus LISTEN → Prompt-Wortlaut | Modelltext mit falscher technischer Begründung | `conversation.ts`, `core.ts` `decide()`, `prompt.server.ts` | KAUSAL BEWIESEN |
| LISTEN blockiert eigene Fragen | – | – | `askProactively` liest den Modus nicht; `formulateQuestion` übergibt kein Modusfeld | WIDERLEGT |
| Energie-Erholung funktioniert | reine Zeitfunktion `recoverEnergy` | 0.007 → 0.191 → 0.181 → 0.212; STORED 0.25 um 11:34:38 | `orb_messages.state_snapshot`, `orb_state` | KAUSAL BEWIESEN |
| Thema „reisen“ bei einem Satz über Graphen | Stamm `wand` trifft Schlüsselwort `wander` bei bidirektionalem Vergleich | Knoten seit 19.09. mit Thema `reisen`; zwei eigene Fragen darauf | `topicOf()`, `TOPIC_KEYWORDS`, `orb_nodes 1dfb5e07-…`, Nachbau des Vergleichs | KAUSAL BEWIESEN |
| drei eigene Fragen am 21.09. | CURIOSITY-Zweig, Lücke aus Rangfolge, Gates erfüllt | Frage, Nachricht, Zustandsänderung, Metrik | `orb_questions`, `orb_messages.proactive`, `orb_metrics kind = proactive`, `impulse = null` | KAUSAL BEWIESEN |
| Long-Term-Memory-Retrieval | Ähnlichkeit/Relevanz/Rangfolge über persistierte Knoten | Antwort nennt Inhalt vom 19.09. mit Stufe „wahrscheinlich“ | `recall.ts`, `certaintyOf`, `recalled = 1`, `nodes_loaded` | KAUSAL BEWIESEN |
| Persistenz persönlicher Angaben (19.09.) | importance 0.48 ≥ 0.35, Quelle `user_stated` | Knoten `132bf051-…`, später verbunden und abgerufen | `orb_messages`, `orb_nodes`, `orb_connections`, `orb_metrics` | KAUSAL BEWIESEN |
| 24 von 25 Ablehnungspunkten ohne Spur | `silent(reason)` ohne Protokoll, Client verwarf den Grund | Ablehnungen nachträglich nicht klassifizierbar | `askProactively`, frühere UI-Bedingung, fehlende Metrikzeilen | KAUSAL BEWIESEN |
| „ORB denkt …“ ohne sichtbare Folge | Hinweis gilt auch für eigenständige Versuche; bei `asked = false` bewusster Abbruch | Nutzer sieht Nachdenken, danach Stille | `channels.orb.tsx` (Abbruchbedingung, `pending`-Quelle), `OrbChat.tsx` | KAUSAL BEWIESEN |
| Nachdenken-Zustand bleibt hängen | – | – | Zustand aus Anfragestatus abgeleitet, endet bei Erfolg und Fehler; Sprachschicht mit Zeitlimit | WIDERLEGT |
| konkretes ablehnendes Gate um 11:30 UTC | ? | keine Frage | Versuchsanzeige nur sitzungslokal, keine Persistenz | OFFEN |
| Selbstkorrektur der Reise-Annahme | kein Mechanismus; asymmetrische Prompt-Zusammensetzung | zutreffende Richtigstellung im Antworttext | Prompt-Aufbau, Abwesenheit jeder Prüf- oder Nachverarbeitungsstelle | DIREKT BEOBACHTET (Ereignis) / KAUSAL BEWIESEN (kein Mechanismus) |
| Abruf als **einzige** Quelle um 18:05:47 (19.09.) | ? | Fakten korrekt genannt | `recalled = 1`, aber Rohsatz lag auch im Kontextfenster | WAHRSCHEINLICH |
| Teilpersistenz bei Fehler nach dem ersten Schreibvorgang | vier nicht transaktionale Schritte | verwaiste Fragenzeile möglich | Codelage in `askProactively`; kein Vorfall beobachtet | WAHRSCHEINLICH |

---

# 14. Technische Evidenz

| Befund | Datei / Funktion | Datenquelle, Variable | DB-Objekt | Zeitstempel | Reproduzierbarer Test | Erwartet | Tatsächlich |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Energie-Zeitanker | `src/orb-core/engine.server.ts` — `getSnapshot()`, `recordLearning()`, `toState()`; `src/orb-core/core.ts` — `recoverEnergy`, `clamp01`, `ENERGY_RECOVERY_PER_MIN`, `ENERGY_RECOVERY_CAP` | `row.energy`, `row.updated_at` | `orb_state`, Trigger `orb_state_updated_at` (BEFORE UPDATE, `set_updated_at()`) | 21.09. 06:30–11:34 | `tests/orb-energy-message-reset.test.ts` (6 Tests, Fälle A–E) | Erholung überdauert einen Zwischenschreibvorgang | vor der Behebung: Erholung verfiel, Anzeige 0 |
| Energie-Gate | `src/orb-core/curiosity.ts` — `decideCuriosity()`, `CURIOSITY_MIN_ENERGY = 0.15`, `CURIOSITY_ASK_THRESHOLD = 0.20` | `input.energy`, `score` | `orb_state.energy` | 21.09. 07:44 / 07:57 | `tests/orb-curiosity.test.ts` (28 Tests) | WAIT unter 0.15 | WAIT, Grund „Zu wenig Energie“ |
| stay_silent unter 0.12 | `src/orb-core/core.ts` — `decide()`; `src/orb-core/conversation.ts` — FOLLOW_UP, SMALLTALK | `energy` | `orb_messages.decision` | 21.09. 07:44:26, 07:57:36 | bestehende Konversationstests | Antwort ohne eigenen Beitrag | `decision = stay_silent`, Modus LISTEN |
| LISTEN ohne Wirkung auf Autonomie | `src/orb-core/conversation.ts` (`ConversationMode`, `decideConversationMode`, `MODE_HINT`); `src/orb-core/llm/prompt.server.ts`; `src/orb-core/engine.server.ts` — `askProactively`, `formulateQuestion` | `mode` | keine Spalte vorhanden | 21.09. | Suche über `src/` nach `LISTEN`, `decideConversationMode`, `MODE_HINT` | kein Gate | kein Gate; Modusfeld fehlt im Fragen-Prompt |
| Themenklassifikation | `src/orb-core/memory.ts` — `topicOf()`, `TOPIC_KEYWORDS` (Thema `reisen` enthält `wander`), Vergleich `t.startsWith(k) \|\| k.startsWith(t)` | Wortstamm `wand` | `orb_nodes.topic` | Entstehung 19.09. 19:24:02, Entdeckung 21.09. | Nachbau der Funktion mit dem Originalsatz | Thema aus Satzinhalt | Thema `reisen` |
| drei eigene Fragen | `src/orb-core/engine.server.ts` — `askProactively()`, `loadCuriosityContext()`, `formulateQuestion()`, `isDuplicateQuestion` | `score`, `gap.kind`, `gap.topic`, `state_snapshot` | `orb_questions`, `orb_messages`, `orb_state`, `orb_metrics` | 21.09. 08:45:30 / 08:54:27 / 08:59:57 | `tests/orb-curiosity.test.ts`, `tests/orb-presence.test.ts` | vollständige Persistenz | vollständig, alle beantwortet |
| Long-Term-Memory | `src/orb-core/recall.ts`, `src/orb-core/continuity.ts` — `certaintyOf()` (0.6 / 0.3) | `recalled`, `nodes_loaded` | `orb_nodes`, `orb_connections` | 19.09. 18:05:47 · 21.09. 08:59:13 | `tests/orb-memory.test.ts`, `tests/orb-memory-recall-fix.test.ts` | Abruf persistierter Knoten | Abruf belegt, Stufe „wahrscheinlich“ |
| Client-Gates | `src/orb-core/presence.ts` — `shouldAskProactively()`, `PROACTIVE_MIN_IDLE_MS = 40_000`, `PROACTIVE_MAX_IDLE_MS = 900_000`, `PROACTIVE_COOLDOWN_MS`; `src/integrations/y-dude-orb/use-orb-presence.ts` (Intervall 5 s, Sofortsperre) | `idleMs`, `curiosity`, `pending` | – | 21.09. | `tests/orb-presence.test.ts` (20 Tests) | genau ein Aufruf je Freigabe | erfüllt |
| Nachdenken-Zustand | `src/routes/_authenticated/channels.orb.tsx` (`pending`-Quelle, Abbruch bei `!asked`), `src/components/orb/OrbChat.tsx` (Hinweistext), `src/orb-core/llm/openai.server.ts` (`AbortSignal.timeout`) | `isPending`, `result.asked` | – | 21.09. 11:30 | Abgleich aller Erfolgs- und Fehlerzweige | Hinweis endet immer | endet immer; kein sichtbarer Abschluss bei Ablehnung |
| Beobachtbarkeit | `src/components/orb/OrbDevPanel.tsx`, `src/routes/_authenticated/channels.orb.tsx` (`lastAutonomyAttempt`) | `asked`, `action`, `reason`, `topic`, `kind`, `score` | – | 21.09. | Sichtprüfung im Testbereich | letzter Versuch sichtbar | sichtbar, nur sitzungslokal |

---

# 15. Was heute NICHT bewiesen wurde

1. Welches Gate den Versuch um 11:30 UTC ablehnte — Ablehnungen werden nicht persistiert. **OFFEN**
2. Ob im beobachteten Ereignis überhaupt ein Serveraufruf erfolgte oder bereits ein clientseitiges
   Gate griff. **OFFEN**
3. Der exakte Minutenverlauf der Energieanzeige — es wird kein Energieverlauf gespeichert;
   Zwischenwerte wurden ausdrücklich nicht rekonstruiert. **OFFEN**
4. Ob der Abruf um 18:05:47 (19.09.) die **einzige** Quelle der genannten Fakten war; das
   Kontextfenster hätte den Rohsatz ebenfalls enthalten. **WAHRSCHEINLICH**
5. Ob die beobachtete Selbstkorrektur wiederholbar ist; sie ist Modellverhalten ohne
   Prüfmechanismus. **OFFEN**
6. Ob Teilpersistenz im eigenständigen Fragenweg praktisch aufgetreten ist; nur die Codelage
   erlaubt sie. **WAHRSCHEINLICH**
7. Die exakte Commit-Kennung des veröffentlichten Production-Bündels — aus dem minimierten
   Bündel nicht ableitbar; belegt ist nur, dass die erwarteten Textbausteine enthalten sind. **OFFEN**
8. Ob mehrere gleichzeitig geöffnete Ansichten in der Praxis zum Zeitanker-Verlust beitrugen; sie
   würden ihn nur häufiger auslösen, die Obergrenze bleibt eingehalten. **WAHRSCHEINLICH**
9. Wie häufig eine falsche Themenzuordnung insgesamt auftritt; belegt ist ein Einzelfall und der
   Mechanismus, keine Häufigkeit. **OFFEN**
10. Auswirkungen der Energie-Schwellen 0.12 und 0.20 auf Anschlussfragen, Smalltalk und
    Avatar-Darstellung im realen Mobilbetrieb. **OFFEN**

---

# 16. Abschlussbewertung

## KAUSAL BESTÄTIGT

1. Verlust des Erholungs-Zeitankers durch `orb_state`-Schreibvorgänge ohne `energy` in Verbindung
   mit dem Zeitstempel-Trigger; Wirkung bis zur angezeigten Energie 0.
2. Anzeige-/Persistenz-Fehlpassung als Ursache des Abfalls von 11–15 % auf ≈ 1 %.
3. Energie unter 0.15 als Ursache ausbleibender eigener Fragen (`WAIT`).
4. Energie unter 0.12 als Ursache von `stay_silent` und damit der LISTEN-Formulierung.
5. LISTEN ist kein ausführbares Hindernis für den eigenständigen Fragenweg (widerlegt).
6. Korrekte, zeitbasierte Energie-Erholung mit live belegten Werten bis zur Obergrenze 0.25.
7. Falsche Themenzuordnung `reisen` durch bidirektionalen Wortstammvergleich, entstanden am 19.09.
8. Drei eigene Fragen am 21.09., alle über den CURIOSITY-Zweig, vollständig persistiert.
9. Long-Term-Memory-Retrieval persistierter Knoten mit berechneter Sicherheitsstufe.
10. Vollständige Kette Eingabe → Persistenz → Zustandsänderung → Abruf → Folgeverhalten (19.09.).
11. 24 von 25 Ablehnungspunkten ohne jede dauerhafte Spur.
12. Der Nachdenken-Hinweis kann nicht hängen bleiben; das beobachtete Muster entsteht durch den
    bewussten Abbruch bei `asked = false`.

## DIREKT BEOBACHTET

1. „ORB denkt …“ ohne sichtbare Folge während des Live-Tests am 21.09. gegen 11:30 UTC.
2. Selbstkorrektur der Reise-Annahme im Antworttext.
3. Sichtbares Absinken der Energieanzeige ohne erkennbare Nutzeraktion.
4. Der zuvor im Testbereich beobachtete abgelehnte Versuch mit Wert 0.643.

## OFFEN

1. Konkretes ablehnendes Gate des Ereignisses um 11:30 UTC.
2. Minutenverlauf der Energieanzeige.
3. Exklusivität des Abrufs als Faktenquelle am 19.09. um 18:05:47.
4. Wiederholbarkeit der Selbstkorrektur.
5. Häufigkeit falscher Themenzuordnungen.
6. Praktische Auswirkungen der Schwellen 0.12 und 0.20 im Mobilbetrieb.
7. Commit-Kennung des veröffentlichten Bündels.
8. Tatsächliches Auftreten von Teilpersistenz im eigenständigen Fragenweg.

---

Source reports analyzed: 15
Causally confirmed findings: 12
Observed-only findings: 4
Probable findings: 4
Open findings: 8
Files changed in application: 0
Database changes: 0
Migrations: 0
Deployments: 0
Configuration changes: 0
Tests changed: 0
