# SlangTag Arena → 2×2 App-Navigation (UI/UX-Plan)

Nur Oberfläche, Struktur und Datenfluss. Keine Migration, keine RLS-Änderung,
keine neue Globe-Tabelle. Die owner-scoped Logik (`owner_id`,
`normalized_name`, `UNIQUE(owner_id, normalized_name)`, `slang_tag.id` als
Identität, Grants, Voting, Arena, Moderation) bleibt unverändert. Farben
(Schwarz/Grün/Weiß), Typografie, Animationen und visuelle Sprache bleiben wie
heute — nur kompakter und klarer gegliedert.

## 1. Die 2×2 Navigation

`/arena` erhält oben statt der drei Pills ein 2×2 Raster aus vier gleichwertigen
Modul-Kacheln (Zustand in der URL als `?tab=mine|manager|arena|globe`,
Standard `mine`):

```text
┌──────────────────────┬──────────────────────┐
│ MEINE SLANGTAGS      │ SLANGTAG MANAGER     │
│ Sammlung        (12) │ Freigaben        (3) │
├──────────────────────┼──────────────────────┤
│ ARENA                │ 🌍 GLOBE VOTE        │
│ Challenges       (2) │ Suchen & Voten       │
└──────────────────────┴──────────────────────┘
```

- Mobil: 2 Spalten, Kachelhöhe ~64 px, Touch-Ziel ≥44 px, Titel in Caps,
  Untertitel klein/gedimmt, optional kleine Zählerchips.
- Desktop: dieselben vier Kacheln in einer Reihe (4 Spalten) — gleiche
  Komponente, nur `md:grid-cols-4`. Kein zweites Navigationsmuster.
- Aktive Kachel: bestehender Brand-Akzent (grüner Rahmen + leichtes Glow),
  identisch zur heutigen aktiven Pill. Kein neuer Stil.
- Der Kopfbereich schrumpft auf eine Zeile: Titel + ein Satz + rechts die
  primäre Aktion (`+ Challenge`, nur Business/Admin).
- Unter der Navigation eine einzeilige, dezente Prozess-Leiste (nur Text):
  `Eigener SlangTag → Manager: für Globe einreichen → Globe Vote / Arena → Voting → Slang Globe`
- Swipe-Geste (Feed ↔ Arena ↔ Globe), `EdgePeek` und Creator-Liga bleiben
  unverändert; horizontales Wischen wechselt keine Tabs.

## 2. MEINE SLANGTAGS (Sammlung)

Persönliche Sammlung des angemeldeten Kontos — identisch für User, Creator und
Business.

- Suchfeld (filtert nur `myTags`; fremde Tags erscheinen hier nie als eigener
  Vorschlag — bestehende Logik aus `data.tsx` bleibt).
- Kompakte Rows statt großer Karten: Name, Mini-Play/Waveform, Region ·
  Sprache, Owner-Badge (User/Creator/Business), Aktionen als Icon-Buttons
  (Bearbeiten, Teilen/Grant, Löschen).
- Status-Chip pro Zeile: `Eigene` bzw. `für Globe vorgesehen` (abgeleitet aus
  `communityShared`).
- SlangTag Box als eigener, klar abgegrenzter Block darunter — Drag & Drop und
  alle Funktionen von `SlangBox.tsx` bleiben vollständig erhalten.

## 3. SLANGTAG MANAGER (Freigaben)

Verwaltung und freiwillige Einreichung. Desktop zweispaltig, Mobile gestapelt.

```text
MEINE SAMMLUNG              FÜR GLOBE EINGEREICHT
$moin  ▶ · Berlin  [Globe]  $moin ▶  wartet auf Prüfung
$digga ▶ · NRW     [Globe]  $yolo ▶  in Arena
```

- Globe-Toggle pro Zeile (schreibt weiterhin nur `community_shared` über den
  bestehenden Update-Pfad).
- Status-Chips, abgeleitet aus vorhandenen Daten (kein neues Schema):
  `Eigene` · `Für Globe eingereicht` · `Wartet auf Prüfung/Voting` ·
  `In Arena` · `Gewonnen` · `Abgeschlossen/Abgelehnt`.
- Owner-Kontext (Avatar/Handle bzw. Rollen-Badge) sichtbar in jeder Zeile,
  damit gleichnamige Varianten fremder Owner nie verwechselt werden. Alle
  Aktionen laufen über `slang_tag.id`.
- Bestehende Funktionen (Umbenennen, Löschen, Grants) bleiben.
- Deaktivierter Vorbereitungsblock „Globe-Eintrag“ bei angenommenen Varianten:
  getrennte Felder **Sprachen** (Mehrfachauswahl) und **Regionen**
  (Mehrfachauswahl), Hinweis „folgt“. Diese Zuordnung gehört zum Globe-Eintrag
  und verändert die persönliche Variante nicht.

## 4. ARENA (Challenges)

Bleibt Wettbewerbsbereich: Challenges, Einreichungen, Voting innerhalb einer
Challenge. Keine automatische Anzeige persönlicher Sammlungen — nur
eingereichte Varianten sind Kandidaten.

- Challenge-Karte wird kompakter: ein Titel + Status-Chip + Meta-Chips-Zeile
  (Region · Kategorie · Reward · Einreichungen · Restzeit), lange Texte
  geklemmt mit „mehr“. Alle Informationen bleiben erhalten.
- Einreichungen nach Namen gruppiert, Varianten als getrennte Zeilen:

```text
$moin                                 3 Varianten
  Variante A  @usera     ▶ ▇▇▁▇  124 Votes  [ Voten ]
  Variante B  Creator B  ▶ ▁▇▇▁   98 Votes  [ Voten ]
  Variante C  @userc     ▶ ▇▁▇▇   76 Votes  [ Voten ]
```

- Vote geht immer auf `slang_tag.id`, nie auf den Namen. `rankSubmissions`,
  `arenaScore`, Kommentare und Awards bleiben unverändert.

## 5. 🌍 GLOBE VOTE (neu, nur UI + Datenfluss)

Offene Community-Auswahl für den späteren Slang Globe — bewusst getrennt von
der Arena (kein Wettbewerb, keine Challenge, keine Frist).

Kopf: Suche + kombinierbare Filter, mobil zweispaltig scrollbar:

```text
[ 🔎 SlangTag suchen ... ]
LAND [ Alle Länder ▾ ]   REGION [ Alle Regionen ▾ ]
STADT [ Alle Städte ▾ ]  SPRACHE [ Alle Sprachen ▾ ]
```

- Filter sind kombinierbar und wirken zusammen mit der Suche; Zustand in der
  URL, damit Ergebnisse teilbar sind.
- Sprache und Region sind getrennte Filterachsen (z. B. Deutschland/Berlin +
  Deutsch, oder Griechenland/Katerini + Griechisch).
- Kandidatenquelle in dieser Phase: ausschließlich Varianten mit
  `communityShared = true` (bereits vorhandenes Feld). Kein neues Schema.
- Land/Stadt werden zunächst aus den vorhandenen Feldern `region` und
  `language` abgeleitet und schrittweise angeboten; fehlt eine Ebene, bleibt
  das Dropdown auf „Alle“ und blendet keine Ergebnisse aus.

Kompakte Globe-Vote-Karte, nach Namen gruppiert:

```text
$moin                     🇩🇪 Deutsch  📍 Berlin
  ▶ Variante A  User A      124 Stimmen  [ VOTEN ]
  ▶ Variante B  Creator B    98 Stimmen  [ VOTEN ]
  ▶ Variante C  User C       76 Stimmen  [ VOTEN ]
```

- Gestimmt wird auf die konkrete Audio-Variante (`slang_tag.id`), nicht auf
  den Namen. Genutzt wird der bestehende Voting-Pfad
  (`useSlangTagVotes` / `slang_tag_votes`) — ein Vote pro Nutzer und Variante,
  änderbar, eigene Varianten gesperrt.
- Leerzustand: kurzer Hinweis + Link in den Manager („Eigene Variante für den
  Globe einreichen“).
- Eine persönliche Variante wird nie automatisch Globe-Eintrag; der Owner
  bleibt Eigentümer.

## Technische Umsetzung (späterer Schritt)

- `src/routes/_authenticated/arena.tsx`: `ArenaTab` von drei auf vier Werte
  erweitern (`mine | manager | arena | globe`), Tab-Zustand in Suchparametern,
  Kopf verkleinern, 2×2-Navigation rendern.
- Neue Präsentationskomponenten unter `src/components/arena/`:
  `ArenaNavGrid.tsx`, `ArenaFlowHint.tsx`, `ArenaVariantGroup.tsx`,
  `ArenaVariantRow.tsx`, `StatusChip.tsx`; `ArenaCard.tsx` wird kompakter.
- Neu unter `src/components/globe-vote/`: `GlobeVoteSection.tsx`,
  `GlobeVoteFilterBar.tsx`, `GlobeVoteCard.tsx`. Filteroptionen aus
  `src/lib/regions.ts` bzw. den vorhandenen Tag-Feldern; Gruppierung über die
  bestehende Gruppierungslogik aus `src/lib/slangtag-votes.ts`.
- `src/components/SlangTagManager.tsx`: Zweispalten-Aufteilung, Row-Layout,
  Status-Chips, Globe-Toggle, Owner-Badge — bestehende Funktionen bleiben.
- `src/components/SlangBox.tsx`: unverändert, eingebettet im Segment
  „Meine SlangTags“.
- Keine Änderungen an Datenbank, RLS, Grants oder Moderation.
