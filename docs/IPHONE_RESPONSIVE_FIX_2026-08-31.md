# Y-Dude – iPhone Responsive UI Fix (2026-08-31)

## Ursache

Die Feed-Kontrollleiste (`src/routes/_authenticated/dev.tsx`) war eine einzige
Flex-Reihe mit `justify-between`, in der **alle** Chips `shrink-0` waren
(inkl. des Feed-Auswahl-Buttons und des Channels-Buttons mit Textlabel).
Sobald die Summe der intrinsischen Breiten die Viewportbreite überstieg
(vor allem bei langen Labels wie `Παγκόσμιο` / `Channels` auf 320–414 px),
konnte kein Element schrumpfen: die Chips liefen ineinander und die Labels
wurden optisch überlagert.

Analog im Profilkopf (`src/components/ProfilePanel.tsx`): Sichtbarkeits-Pill und
„+ Beitrag erstellen“ waren `shrink-0`, wodurch der grüne Button bei langen
Labels (EL) über den Kartenrand hinauslief.

## Änderung (nur Presentation/CSS-Klassen)

- `dev.tsx` Kontrollleiste: Reihe `w-full min-w-0 flex-nowrap`;
  Feed-Auswahl und Channels sind auf Mobile `min-w-0 flex-1` mit
  `truncate`-Label (Icons/Chevron bleiben `shrink-0`); ab `sm:` wieder
  `flex-none` + `justify-center` → Desktop unverändert.
  Channels-Button erhielt zusätzlich `title` für das gekürzte Label.
- `ProfilePanel.tsx`: linke Spalte `min-w-0`, Sichtbarkeits-Pill
  `min-w-0 max-w-full` mit `truncate`, „+ Beitrag erstellen“ `min-w-0`
  mit `truncate`-Label und leicht reduziertem Padding auf Mobile.

Keine Funktion entfernt: Auto Feed, Globe, Feed-Auswahl, Channels, Arena,
Auto Sound bleiben identisch verdrahtet. Touch-Höhen (h-7/h-9, py-1) unverändert.

## Getestete Breiten (Playwright, echte App)

320 / 375 / 390 / 393 / 414 / 1280 / 1440 px

- `document.scrollWidth === innerWidth` bei allen Breiten → kein horizontaler Overflow
- keine horizontalen Überlappungen der Control-Chips
- Labels werden bei Platzmangel gekürzt (`…`), Tooltip/aria-label bleibt vollständig
- Desktop 1280/1440: Leiste zentriert, Labels voll sichtbar → keine Regression

## Build / Verify

- Build: OK
- Unit-Tests: 533/533 grün

## Scope

Keine Änderung an Backend, Rollen, RLS, Datenbank, Stripe, Creator Subscription,
Business Campaigns, SlangTags, Feed-Backend oder Ranking.
