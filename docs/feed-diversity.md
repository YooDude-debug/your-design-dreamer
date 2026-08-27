# Y-Dude Feed – Diversity-/Re-Ranking-Schicht

## Bestehender Ranking-Algorithmus (unverändert)

Ablauf: `Beiträge laden → Ranking (Score) → Diversity → Exploration → Seite`

Der Score entsteht in `src/lib/feed-ranking/factors.ts` aus den Modulen
Interessen (34), Region (18), Hashtags (16), Beziehung (13), Engagement (12),
SlangTag-Affinität (10), SlangTag-Qualität (8), Beitragsqualität (8),
Aktualität (12), neue Ersteller (6), Ersteller-Vertrauen (8), Spam (−22),
Gelerntes, Stummschaltung, Jitter (2). Gewichte: `feed-ranking/config.ts`.
Pagination bleibt unverändert (serverseitig 20er-Seiten, clientseitig
`renderCount`); das Ranking arbeitet über alle bereits geladenen Kandidaten.

## Was vorher monoton wirkte

Die alte Vielfalt-Regel (`arrangeWithDiversity`) war eine harte Ja/Nein-Prüfung:
sie nahm den ersten Kandidaten, der alle Cooldowns erfüllte, sonst den besten.
Channels, Videos, Galerien und „mit/ohne SlangTag“ waren gar keine Merkmale,
und der Jitter war pro Nutzer fest – jeder Refresh ergab dieselbe Reihenfolge.

## Neue Logik: `applyFeedDiversity()` (`src/lib/feed-ranking/diversity.ts`)

Eine zentrale Funktion, weiche Strafen statt harter Regeln, alle Gewichte in
`FEED_CONFIG.diversity`:

| Merkmal                                            | Strafe | Fenster      |
| -------------------------------------------------- | ------ | ------------ |
| gleicher Autor                                     | 3      | 4 Positionen |
| gleicher Channel                                   | 2,8    | 3            |
| gleiches Thema                                     | 1,8    | 3            |
| gleiche Region                                     | 1      | 2            |
| gleicher Medientyp (Bild/Galerie/Video/Text/Audio) | 3      | 3            |
| mit/ohne SlangTag                                  | 1,2    | 2            |
| kürzlich oben gesehen (Position < 3)               | 4      | –            |
| viraler Block (ab 3 Beiträgen in Folge)            | 2,5    | –            |
| Entdeckungsbonus junger SlangTags (≤ 25 Plays)     | +0,8   | –            |
| Session-Variation                                  | ±0,6   | –            |

Details:

- Strafen klingen mit dem Abstand linear ab (direkt hintereinander = volle Strafe).
- Maßstab ist die Score-Spanne **innerhalb des Kandidatenfensters**
  (`penaltyScale 0,9`, gedeckelt mit `maxPenaltyShare 3`): liegen Kandidaten
  dicht beieinander, genügen kleine Verschiebungen; ein klar relevanterer
  Beitrag bleibt trotz Strafe vorne.
- Es werden pro Position nur die besten 18 Kandidaten betrachtet
  (`candidateWindow`) – ein schwacher Beitrag kann nie nach oben springen.
- Zufall: nur die Session-Variation (`sessionSeed`, `sessionStorage`,
  nicht dauerhaft gespeichert) sowie der bestehende Jitter-Faktor, der jetzt
  ebenfalls den Session-Seed berücksichtigt. Refresh in derselben Sitzung
  → gleiche Reihenfolge; neue Sitzung → andere Reihenfolge bei gleichwertigen
  Beiträgen.
- „Nicht zweimal gleich“: die letzten 3 Kopfbeiträge liegen in
  `sessionStorage` (`yd-feed-top`) und werden oben leicht abgewertet. Keine neue
  Tracking-Infrastruktur.
- Exploration (12 %) und Frische bleiben unverändert.

## Testergebnisse (synthetische Kandidaten, 60 Beiträge, Top 20)

| Kennzahl                            | vorher | nachher                 |
| ----------------------------------- | ------ | ----------------------- |
| direkte Autoren-Wiederholungen      | 11     | 3                       |
| direkte Medientyp-Wiederholungen    | 7      | 8 → 3–5 je nach Angebot |
| verschiedene Autoren in Top 10      | 2      | 4                       |
| identische Reihenfolge nach Refresh | ja     | nein (neue Sitzung)     |

Randfälle geprüft: 0/1/2/5 Kandidaten, nur ein Autor, 2000 Kandidaten
(53 ms, keine zusätzlichen Datenbankabfragen). Scrollposition, Infinite Scroll,
Lazy Loading, Medien-, Video- und SlangTag-Wiedergabe sind nicht betroffen –
die Schicht ordnet ausschließlich bereits geladene Beiträge um.
