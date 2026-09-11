# Y-Dude – Kanonischer Signalvertrag (Stand Schritt 2A, Staging)

Reiner Audit-/Vertragsschritt. Keine Ranking-, Decay-, Confidence- oder Lernraten-Änderung.

## Laufzeitpfad

```text
Nutzeraktion
  -> trackFeedSignal (eine globale Queue)
  -> Debounce 2,5 s / Flush
  -> recordFeedSignals (authentifizierte Server Function)
  -> Feed Learning
  -> Interest Learning mit serverseitigem Jugendschutz
```

Ein Serveraufruf verarbeitet beide Lernpfade. Einzelne Interaktionen lösen keinen eigenen
Signal-Request aus.

## Erzeugte Signale

| Feed-Signal | Trigger | Interest-Aktion |
|---|---|---|
| `like` | Like gesetzt | `post_like` |
| `comment` | Kommentar erfolgreich gespeichert | `post_comment` |
| `share` | Teilen ausgeführt | `post_share` |
| `save` | Merken gesetzt | `post_save` |
| `view_complete` | Detailansicht geöffnet | `post_view_complete` |
| `dwell` | Karte verlässt Sichtfeld oder wird abgebaut | `post_view` ab 4 s |
| `follow` | Folgen erfolgreich | `connection` |
| `report` | Beitrag erfolgreich gemeldet | keine Interest-Aktion |

Kurze Verweildauern werden von der bestehenden Feed-Logik als Fast Scroll bewertet, aber nicht
als Interest-Ereignis weitergegeben. Negative Signale bleiben bewusst außerhalb der Interest Engine.

## Batch-Vertrag

- Eine globale Queue für die gesamte Anwendung.
- Gleitender Debounce von 2.500 ms.
- Höchstens 50 Signale pro Serveraufruf; Queue-Grenze 200.
- Flush bei ausgeblendeter Seite, `pagehide` und Abbau der Bridge.
- Kein Retry und keine fachliche Idempotenz; beides ist bewusst nicht Teil dieses Stands.
- Fehler blockieren die Oberfläche nicht.

## Daten und Sicherheit

- Die Nutzer-ID stammt ausschließlich aus der serverseitig validierten Sitzung.
- `feed_signals`, `feed_learned_weights`, `interaction_events`, `user_interest_scores`,
  `interest_confidence` und `connection_influence` bleiben durch die bestehenden RLS-Regeln
  auf den jeweiligen Nutzer begrenzt.
- Der Jugendschutz läuft serverseitig vor der Interest-Verarbeitung und ist fail-closed.
- Feed Learning bleibt bei blockierter Interest-Verarbeitung funktionsfähig.

## Kategoriebestimmung

Es werden nur vorhandene aktive Kategorien anhand exakter normalisierter Treffer verwendet:
Hashtags, Topics, Region, Sprache sowie vorhandene redaktionelle Beitragskategorien. Es werden
keine Kategorien erfunden und keine semantischen oder KI-basierten Zuordnungen vorgenommen.

## Bewusst offene Punkte

- negative Interest-Signale
- zusätzliche Content-Kategorisierung
- Idempotenz und Doppelerkennung
- Retry fehlgeschlagener Signal-Batches
- Retention für `feed_signals`
- weitere Befüllung von Topic und Language
- zusätzliche Nutzung von `feed_score_cache`
- Embeddings und weitere Recommendation-Systeme