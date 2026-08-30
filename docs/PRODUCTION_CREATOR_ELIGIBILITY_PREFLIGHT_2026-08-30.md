# Production Preflight – Community/Creator Eligibility V1 (2026-08-30)

**Ergebnis: 🟠 BLOCKIERT – PRODUCTION BASELINE ABWEICHEND**
Es wurde **keine** Produktionsdatei geändert, erstellt oder gelöscht.
Keine DB-, RLS-, Auth-, Payments- oder Rollenänderung.

## 1. Paket-Preflight (bestanden)

- Paket entpackt: `release/production-community-creator-eligibility-2026-08-30/`
- Vollständigkeit: alle erwarteten Dokumente, `target-production-files/`,
  `patches/`, `checksums/`, `rollback-production-original/` vorhanden
- `sha256sum -c checksums/PACKAGE_FILES.sha256` → alle Einträge `OK`
- Keine `*.env*`- und keine `*.sql`-Dateien im Paket (keine Migration enthalten)

## 2. Production-Baseline (festgestellt)

| Prüfung | Erwartet laut Runbook | Production tatsächlich | Bewertung |
|---|---|---|---|
| `src/lib/creator-eligibility.ts` | fehlt | fehlt | ✅ |
| `src/lib/creator-eligibility.server.ts` | fehlt | fehlt | ✅ |
| `src/lib/creator-eligibility.functions.ts` | fehlt | fehlt | ✅ |
| `src/components/BecomeCreatorMenuItem.tsx` | fehlt | fehlt | ✅ |
| `BecomeCreatorMenuItem` in `ProfilePanel.tsx` | nicht vorhanden | nicht vorhanden | ✅ |
| `refresh` in `src/lib/data-context.ts` | vorhanden | vorhanden (Zeile 73) | ✅ |
| **`isAdminReal` im Datenkontext** | **vorhanden** | **existiert nicht – projektweit kein Treffer** | ❌ |
| Admin-Perspektive (Ansichtssimulation) | vorhanden | in `src/lib/data.tsx` nicht vorhanden; nur ein einzelnes `isAdmin` | ❌ |

### Production-Original-SHA-256 (unverändert)

```
7cf36685e3912d820f11aa6db08eadea3719b61327257e46559b9cd45a35bceb  src/components/ProfilePanel.tsx
```

Aktuelle `useData()`-Destrukturierung in Production (Zeile 80):

```ts
const { me, updateMyProfile, isAdmin, isModerator, isCreator, isBusiness } = useData();
```

## 3. Grund des Stopps

`patches/PROFILE_PANEL.md`, Hunk 2 und Hunk 3, setzen `isAdminReal` im
Datenkontext voraus und schreiben ausdrücklich:

> „Voraussetzung: `isAdminReal` und `refresh` existieren bereits im
> Datenkontext (`src/lib/data-context.ts`). Falls nicht → STOPPEN.“

`isAdminReal` existiert in Production nicht. Die Staging-Fassung setzt zudem
eine Admin-Ansichtssimulation voraus, die in Production nicht implementiert
ist. Hunk 3 (`!isCreator && !isAdminReal`) ist damit nicht anwendbar.

Eine Auflösung wäre nur möglich durch Erweiterung von
`src/lib/data-context.ts` und `src/lib/data.tsx` (echte vs. simulierte
Adminrolle). Das sind **zusätzlich benötigte Dateien außerhalb des
Release-Scopes** (Scope: 4 neue Dateien, 2 Tests, 3 Hunks in `ProfilePanel.tsx`)
und berührt die Admin-Perspektive, die laut Abschnitt 8 unverändert bleiben
muss. Nach Abschnitt 3 und Abschnitt 17 ist das ein harter Stopp ohne
Eigeninterpretation.

## 4. Rollback-Stand

Kein Rollback nötig – es wurde nichts angewendet. Production entspricht exakt
der oben dokumentierten Baseline.

## 5. Benötigte Entscheidung

Eine der folgenden Freigaben ist erforderlich, bevor die Migration fortgesetzt
werden kann:

1. **Scope-Erweiterung freigeben:** `isAdminReal` (echte Adminrolle, getrennt
   von der Anzeigeperspektive) in `data-context.ts`/`data.tsx` ergänzen – dann
   sind Hunk 2 und 3 unverändert anwendbar.
2. **Angepasster Hunk 3 freigeben:** Menüpunkt-Bedingung ohne `isAdminReal`,
   z. B. `!isCreator && !isAdmin` – funktional gleichwertig, solange in
   Production keine Admin-Ansichtssimulation existiert.
3. **Neues Release-Paket** mit einer an die Production-Baseline angepassten
   Fassung von `patches/PROFILE_PANEL.md`.
