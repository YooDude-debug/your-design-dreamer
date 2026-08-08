# SlangTag Arena — neue Informationsarchitektur (UI/UX)

Nur Oberfläche und Struktur. Keine Migration, keine RLS-Änderung, keine neue
Datenarchitektur. Die owner-scoped Logik (`slang_tag.id` als Identität,
`UNIQUE(owner_id, normalized_name)`, Vorschläge nur aus eigenen/freigegebenen
Tags) bleibt unangetastet. Design, Farben, Typografie bleiben wie heute —
lediglich kompakter, mit klarerer Hierarchie und mehr Leerraum.

## 1. Eine Seite, drei Segmente

`/arena` bekommt oben eine kompakte Segment-Navigation (Pills im bestehenden
Brand-Stil, mobil scrollbar, Zustand in der URL als `?tab=`):

```text
[ ARENA ]  [ MEINE SLANGTAGS ]  [ MANAGER ]
```

Der heutige Kopfbereich schrumpft auf eine Zeile: Titel + ein Satz + rechts nur
noch die primäre Aktion (`+ Challenge`, nur für Business/Admin). Die bisherigen
Buttons „SlangTag Box“ und „SlangTag Manager“ verschwinden nicht — sie werden zu
Segmenten bzw. zu einem Bereich innerhalb eines Segments.

- **ARENA** — Challenges + Voting (öffentlich).
- **MEINE SLANGTAGS** — persönliche Sammlung inkl. SlangTag Box als eigener,
  klar abgegrenzter Block (Drag & Drop bleibt vollständig erhalten).
- **MANAGER** — Verwaltung inkl. Einreichungen und Freigaben/Grants.

Unter der Navigation eine einzeilige, dezente Prozess-Leiste (Text, keine
Karten), die die Logik erklärt:
`Eigener SlangTag → Globe-Freigabe → Manager → Arena-Voting → Slang Globe`

## 2. Erstellen: Schieberegler EIGENE ─ GLOBE

Im SlangTag-Erstellen-Flow (`SlangTagInput` / `AdminSlangTagCreate` /
Manager-Anlegen) kommt ein kleiner Zwei-Stufen-Schalter direkt unter dem Namen:

```text
Sichtbarkeit   [ EIGENE ]──────( GLOBE )
```

- Standard **EIGENE**: persönliche Variante, nur in der eigenen Auswahl, keine
  Einreichung.
- **GLOBE**: Owner bleibt Eigentümer; die Variante wird für den
  Community-Prozess freigegeben und erscheint im Manager unter „Für Globe
  eingereicht“. Kein automatischer Globe-Eintrag.

Technisch nutzt der Schalter ausschließlich das bereits vorhandene Feld
`community_shared` auf `slang_tags` — kein neues Schema. Unter dem Schalter eine
zweizeilige Mikro-Erklärung, identisch für User, Creator und Business.

## 3. Manager: Sammlung vs. Einreichung getrennt

Zwei Spalten auf Desktop, zwei gestapelte Abschnitte auf Mobil:

```text
MEINE SLANGTAGS            FÜR GLOBE EINGEREICHT
$moin   ▶  · Berlin        $moin  ▶  Status: wartet auf Arena
$digga  ▶  · NRW           $yolo  ▶  Status: Voting
$yolo   ▶  · DE
```

- Jede Zeile ist eine kompakte Row (Name, Mini-Play, Region/Sprache,
  Owner-Badge, Aktionen als Icon-Buttons) statt einer großen Karte.
- Rechts pro Zeile der Globe-Toggle, damit Freigabe auch nachträglich möglich
  ist.
- Statusanzeige als kleines Chip: `wartet auf Arena` · `Voting` · `angenommen` ·
  `nicht angenommen`. Ableitung aus vorhandenen Daten (Einreichung vorhanden,
  laufende Challenge, Award) — keine neuen Tabellen.
- Jede Zeile trägt sichtbar den Owner-Kontext (Avatar/Handle bzw.
  Community/Creator/Business-Badge), damit gleichnamige Varianten fremder Owner
  nie verwechselt werden. Alle Aktionen laufen über `slang_tag.id`.

## 4. Arena: nur freigegebene Varianten, nach Namen gruppiert

Die Arena zeigt keine persönlichen Sammlungen. Sie zeigt Challenges und
Namensgruppen aus eingereichten Varianten.

```text
$moin                                   4 Varianten
  @usera     ▶ ▇▇▁▇  · Berlin      312 Votes   [ Voten ]
  @userb     ▶ ▁▇▇▁  · Hamburg     104 Votes   [ Voten ]
  Creator C  ▶ ▇▁▇▇  · NRW          88 Votes   [ Voten ]
  Business D ▶ ▇▇▇▁  · DE           41 Votes   [ Voten ]
```

- Gruppenkopf: normalisierter Name + Variantenzahl, aufklappbar.
- Jede Variante eine eigene, klar getrennte Zeile mit Owner, Play, Votes und
  einer primären Aktion. Vote geht immer auf die Variante, nie auf den Namen.
- Bestehende Ranking-Logik (`rankSubmissions`, `arenaScore`), Kommentare und
  Awards bleiben unverändert; nur die Darstellung wird kompakter.

## 5. Kompaktere Challenge-Karte

Die heutigen fünf großen Info-Blöcke (Unternehmen, Kategorie, Region, Gewinn,
Teilnahmebedingungen) werden zu einer Karte mit Meta-Chips — alle Informationen
bleiben erhalten:

```text
Sommer-Sound 2026                       ● LÄUFT
Region Berlin · Kategorie Food · Reward 500 € · 12 Einreichungen · 3 Tage
Teilnahme: eigener SlangTag, max. 5 s                  [ mehr ]
                                     [ Anhören ]  [ Einreichen ]
```

Lange Texte (Teilnahmebedingungen, Beschreibung) werden geklemmt und über
„mehr“ ausgeklappt. Countdown und Status als Chip rechts oben.

## 6. Slang Globe (nur Vorbereitung der UI)

Im Manager erhält eine angenommene Variante einen ausgegrauten, deaktivierten
Abschnitt „Globe-Eintrag“ mit getrennten Feldern für **Sprachen**
(Mehrfachauswahl, z. B. Deutsch / Englisch / Griechisch) und **Region**
(separat, z. B. Berlin / Brandenburg), plus Hinweis „folgt“. Sprache und Region
werden nie vermischt; diese Zuordnung gehört sichtbar zum Globe-Eintrag, nicht
zum persönlichen SlangTag. Kein Datenmodell in diesem Schritt.

## Technische Umsetzung

- `src/routes/_authenticated/arena.tsx`: Segment-Navigation, Kopf verkleinern,
  Rendern der drei Segmente. Swipe-Geste, `EdgePeek`, Creator-Liga bleiben.
- Neue Präsentationskomponenten unter `src/components/arena/`:
  `ArenaTabs.tsx`, `ArenaFlowHint.tsx`, `ArenaVariantGroup.tsx`,
  `ArenaVariantRow.tsx`; `ArenaCard.tsx` wird kompakter umgebaut.
- `src/components/SlangTagManager.tsx`: Zweispalten-Aufteilung, Row-Layout,
  Status-Chips, Globe-Toggle, Owner-Badge. Bestehende Funktionen (Umbenennen,
  Löschen, Grants) bleiben.
- `src/components/SlangBox.tsx`: unverändert in der Funktion, wird als eigener
  Block im Segment „Meine SlangTags“ eingebettet statt als Dialog.
- Globe-Freigabe schreibt nur `community_shared` über den bestehenden
  Update-Pfad; keine Migration, keine RLS-Änderung.
- Mobile first: Segmente scrollbar, Karten einspaltig, Aktionen ≥44 px;
  Desktop bleibt zweispaltig.
