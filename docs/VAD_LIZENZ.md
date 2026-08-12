# Y-Dude – Voice Activity Detection (VAD): Technik & Lizenz

## Welche VAD-Lösung wird verwendet?

Eine **eigene, projektinterne VAD** in `src/lib/vad.ts`:
Energie- (RMS) und Zero-Crossing-Analyse in 20-ms-Fenstern mit adaptivem
Rauschteppich, Hysterese (getrennte Ein-/Ausschaltschwelle) und Hangover.
Sie arbeitet direkt auf den Samples der bereits vorhandenen Web-Audio-Pipeline
(`ScriptProcessorNode` im Recorder, Kodierung über `src/lib/audio-format.ts`).
Es wird **keine zweite Audio-Pipeline** aufgebaut.

## Lizenz

| Frage | Antwort |
| --- | --- |
| Fremdbibliothek? | Nein – kein zusätzliches npm-Paket, kein Modell-Download. |
| Lizenz | Teil des Y-Dude-Quellcodes (proprietär, uneingeschränkt nutzbar). |
| Kommerzielle Nutzung erlaubt? | Ja, ohne Einschränkung. |
| Laufende Kosten? | Keine – die Erkennung läuft vollständig lokal im Browser. |
| Copyright-/Lizenzhinweis nötig? | Nein, da keine Drittanbieter-Software eingebunden ist. |
| GPL/AGPL-Risiko? | Nein. |

Bewusst **nicht** verwendet wurden: kostenpflichtige VAD-/Speech-to-Text-APIs,
Cloud-VAD-Dienste, Abo-Modelle sowie GPL/AGPL-Bibliotheken. Geprüfte
Alternativen mit permissiver Lizenz (z. B. `@ricky0123/vad-web`, MIT, basiert
auf Silero-ONNX) wurden verworfen, weil sie ein mehrere MB großes Modell und
eine eigene ONNX-Laufzeit nachladen – die Eigenimplementierung erfüllt die
Anforderung ohne zusätzliche Downloads und ohne Drittlizenz.

## Datenschutz

Die VAD überträgt **keine** Audiodaten. Analyse, Zuschnitt und Kodierung
finden ausschließlich im Browser des Nutzers statt; erst das fertige,
zugeschnittene SlangTag-Audio wird wie bisher gespeichert.

## Pipeline

```
Aufnahmebutton → Aufnahme startet sofort → Web-Audio-Puffer (alle Samples)
  → VAD (20-ms-Fenster, adaptiver Rauschteppich)
  → Sprachbeginn erkannt → 250 ms Pre-Roll bleiben erhalten
  → Sprache
  → Sprachende erkannt → ~400 ms Post-Roll
  → Zuschnitt → Mono / 24 kHz / 16-Bit-WAV, normalisiert → Speicherung wie bisher
```

Parameter (`src/lib/vad.ts`):

- `VAD_FRAME_MS = 20`
- `VAD_PRE_ROLL_MS = 250`
- `VAD_POST_ROLL_MS = 400`
- Mindest-Sprachdauer für den Start: 100 ms (verhindert Klicks/Störgeräusche)
- Mindest-Stille für das Ende: 550 ms (kurze Wortpausen beenden nicht)

Weil die Aufnahme ab dem Buttondruck komplett gepuffert wird, ist der
250-ms-Pre-Roll auch dann vorhanden, wenn sofort gesprochen wird – die erste
Silbe kann nicht abgeschnitten werden. Wird gar keine Sprache erkannt, bleibt
die Aufnahme unverändert (Fallback: gesamter Puffer).

Kein `setTimeout`-Trick: das Ende wird über die tatsächliche Sprachpause
erkannt; ein Timer existiert nur für die Sekundenanzeige und die bestehende
Maximallänge (5 s Community, 10 s Creator).
