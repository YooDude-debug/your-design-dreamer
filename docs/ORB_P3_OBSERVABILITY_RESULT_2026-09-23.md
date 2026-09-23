# ORB CORE – P3 OBSERVABILITY RESULT

**Datum:** 2026-09-23
**Status:** READY FOR MANUAL REVIEW – nichts veröffentlicht, keine Migration, keine Optimierung.
**Umfang:** ausschliesslich Messbarkeit (Korrelation Ereignis → Modellaufruf).

---

## 1. Ziel

Jeder relevante Modellaufruf von ORB soll eindeutig einem Verarbeitungsvorgang
zugeordnet werden können:

```
ORB EVENT → EVENT_ID → MODEL_REQUEST_ID → MODEL CALL → MODEL RESPONSE
```

Damit sind künftig beantwortbar: Wie viele Modellaufrufe hat Ereignis X erzeugt?
Welches Modell? Welcher ORB-Pfad? Sichtbar oder intern? Erfolgreich? Wie lange?

## 2. Ausgangszustand

- Keine Ereignis-Kennung im Modellpfad; die Gateway-Protokolle liessen sich nur
  über Zeitstempel grob mit `orb_metrics`/`orb_messages` vergleichen.
- Folge (P2): 134 Modellaufrufe im Datenfenster blieben einzeln nicht zuordenbar.
- Die Gateway-Laufkennung (`X-Lovable-AIG-Run-ID`) wurde bisher nicht mitgelesen.

## 3. Implementierte Observability

Neue Datei `src/orb-core/observability.server.ts` – rein deterministisch:

| Funktion | Zweck |
| --- | --- |
| `newEventContext({path, callType, source?})` | Ereignis-Kennung je Verarbeitungsvorgang |
| `unattributedContext()` | Aufruf ohne ORB-Ereignis (Entwicklungs-/Messlauf) |
| `nextModelRequest(ctx)` | Kennung + laufender Index je Modellaufruf |
| `logModelCall(record)` | eine Zeile `[orb.obs.model_call]` je Aufruf |
| `logEventSummary({ctx,…})` | eine Zeile `[orb.obs.event]` je Ereignis |

Verdrahtung: `llm/provider.server.ts` (Gateway), `llm/openai.server.ts`,
`llm/select.server.ts` (Durchleitung), `engine.server.ts`
(`processInput` → `turn_reply`, `askProactively` → `proactive_question`,
`speak`/`formulateQuestion` als Durchleitung).

**Kein zusätzlicher Modellaufruf:** Die Schicht erzeugt keinen KI-Aufruf und
keine KI-Klassifizierung – nur Kennungen, Zähler, Zeitmessung, Protokollzeilen.

## 4. Event-ID

`evt_<uuid>` aus `crypto.randomUUID()`; eindeutig, stabil je Vorgang, nicht
personenbezogen, **nicht** aus dem Nachrichtentext erzeugt. Es wurde keine
bestehende, geeignete Ereignis-Kennung gefunden (`orb_metrics`/`orb_messages`
tragen nur Datenbank-Schlüssel, die erst am Ende des Vorgangs entstehen); daher
eine minimale neue Kennung, ohne konkurrierende zweite ID.

## 5. Model-Request-ID

Der Gateway vergibt selbst keine im Antwortkörper nutzbare Aufrufkennung; die
vorhandene `X-Lovable-AIG-Run-ID` wird nun **mitgelesen** (nie selbst erzeugt)
und als `gateway_run_id` protokolliert. Zusätzlich `mrq_<uuid>` je Aufruf mit
`call_index` innerhalb des Ereignisses – dadurch ist „mehrere Aufrufe pro
Ereignis" direkt sichtbar.

## 6. Event → Model Correlation

```
[orb.obs.model_call] {event_id, model_request_id, call_index, source, path,
  call_type, provider, model, endpoint, success, http_status, failure_kind,
  duration_ms, reply_chars, gateway_run_id}
[orb.obs.event]      {event_id, source, path, call_type, model_calls,
  outcome, db_queries, total_ms}
```

## 7. Source / Call Type

- `source`: `orb_event` (echter ORB-Vorgang) oder `development_test`
  (Aufruf ohne Ereignis, z. B. Messlauf) – wird nicht geraten, sondern ergibt
  sich daraus, ob ein Ereigniskontext übergeben wurde.
- `path`: `turn_reply`, `proactive_question`, `unattributed`.
- `call_type`: `user_visible` oder `internal`.

## 8. Datenschutz

Keine Datenbankspalte, keine Migration – nur Server-Protokoll. Protokolliert
werden ausschliesslich technische Kennungen, Pfadname, Modellname, Endpunkt,
Dauer, Erfolg, Statuscode, Fehlerart und **Längen**. Niemals Nachrichtentext,
Systemprompt, Modellantwort, Erinnerungsinhalte oder Zugangsschlüssel; ein
eigener Test prüft das.

## 9. Performance Impact

Pro Modellaufruf: eine UUID, ein Zähler, eine Protokollzeile (< 1 ms, im
Vergleichslauf 0–1 ms). Keine zusätzliche Datenbankabfrage, kein Netzwerkaufruf,
keine geänderte Reihenfolge von ORB-Schritten.

## 10. Tests

Neu: `tests/orb-p3-observability.test.ts` – 11 Tests (A: Kennung eindeutig/
stabil; C: erfolgreicher Aufruf vollständig protokolliert; E: Fehlerfall;
Guthabensperre; Datenschutz; G: 500 parallele Vorgänge ohne Kollision;
H: Aufruf ohne Ereignis; A/B/F: mehrere Nachrichten je eine Ereigniszeile;
Zählung der Aufrufe je Ereignis).
Alle Netzwerkaufrufe sind durch eine Attrappe ersetzt – **keine Kosten**.

Angepasst (nur Erwartungstexte auf die neuen Quelltextzeilen, keine Prüfung
entfernt oder abgeschwächt): `tests/orb-request-optimization-p0.test.ts`,
`tests/orb-multimodal-composer.test.ts`.

**Ergebnis:** 1371 Logiktests grün, 102 Datenbank-/Sicherheitstests grün,
Typprüfung fehlerfrei, Lint der berührten Dateien sauber, Build erfolgreich.

## 11. Ergebnisse (kontrollierter Vergleichstest, ohne echte Aufrufe)

5 normale Nachrichten und 5 synthetische Testevents plus ein Aufruf ohne Ereignis:

| Event | Model Request ID | Model | Source | Path | Call Type | Success |
| --- | --- | --- | --- | --- | --- | --- |
| evt_2e535699… | mrq_9014bca4… | openai/gpt-6-astra | orb_event | turn_reply | user_visible | true |
| evt_853fb5c5… | mrq_f621182c… | openai/gpt-6-astra | orb_event | turn_reply | user_visible | true |
| evt_59fd63b5… | mrq_8ef30cfe… | openai/gpt-6-astra | orb_event | turn_reply | user_visible | true |
| evt_f303b5d2… | mrq_2ed61971… | openai/gpt-6-astra | orb_event | turn_reply | user_visible | true |
| evt_ca9c36a4… | mrq_128156bb… | openai/gpt-6-astra | orb_event | turn_reply | user_visible | true |
| evt_e36e233d… | mrq_66c382b0… | openai/gpt-6-astra | orb_event | turn_reply | user_visible | true |
| evt_bd4a445c… | mrq_8a93cf79… | openai/gpt-6-astra | orb_event | turn_reply | user_visible | true |
| evt_b450a934… | mrq_c3c808bd… | openai/gpt-6-astra | orb_event | turn_reply | user_visible | true |
| evt_d06c88d7… | mrq_dd2380ca… | openai/gpt-6-astra | orb_event | turn_reply | user_visible | true |
| evt_63466bb5… | mrq_56620915… | openai/gpt-6-astra | orb_event | turn_reply | user_visible | true |
| evt_cd21de77… | mrq_a807120b… | openai/gpt-6-astra | development_test | unattributed | internal | true |

Ereigniszeilen der 5 Nachrichten: je **1 Modellaufruf**, je 14 Datenbank­abfragen
(Attrappen-Datenbank, daher nicht mit Produktionswerten vergleichbar).

## 12. Bekannte Einschränkungen

- Historische Protokolle werden **nicht** umgeschrieben; die 134 nicht
  zuordenbaren Aufrufe aus P2 bleiben ausdrücklich **UNGEKLÄRT**.
- Nur Server-Protokoll, keine Datenbankauswertung – Auswertungen erfolgen über
  die Protokollzeilen, nicht per Abfrage.
- Die Gateway-Laufkennung erscheint nur, wenn der Gateway sie im Antwortkopf
  sendet; fehlt sie, steht `gateway_run_id: null`.
- Sprach- und Moderationspfade (Transkription, Vorlesen, Moderation) sind nicht
  Teil dieses Schritts.
- **Zwischenfall:** Der erste Durchlauf des Vergleichstests lief versehentlich
  gegen den echten Gateway (nur `OPENAI_API_KEY` war geleert). Dabei entstanden
  5 echte Modellaufrufe (≈ 0,1 Credits). Der Test wurde auf eine Netzwerk-
  Attrappe umgestellt und erneut ausgeführt; alle weiteren Läufe sind kostenfrei.

## 13. Beispiel eines vollständigen Traces

```
[orb.obs.model_call] {"event_id":"evt_2e535699-…","model_request_id":"mrq_9014bca4-…",
  "call_index":1,"source":"orb_event","path":"turn_reply","call_type":"user_visible",
  "provider":"lovable_gateway","model":"openai/gpt-6-astra",
  "endpoint":"https://ai.gateway.lovable.dev/v1/responses","success":true,
  "http_status":200,"failure_kind":null,"duration_ms":65,"reply_chars":2,
  "gateway_run_id":"run-demo"}
[orb.obs.event] {"event_id":"evt_2e535699-…","source":"orb_event","path":"turn_reply",
  "call_type":"user_visible","model_calls":1,"outcome":"answer","db_queries":14,
  "total_ms":66}
```

---

## Unveränderte ORB-Funktionen

Memory, Graph, Gap Detection, Curiosity, Energy, Proactive Questioning,
Silent-Verhalten, Schwellen, Formeln, Prompts, Modelle, KI-Kontext, Zeittakt,
Datenbankschema, RLS – alle unverändert. Keine Kostenoptimierung durchgeführt.

**STOPP** – weitere Schritte nur nach ausdrücklicher Freigabe.
