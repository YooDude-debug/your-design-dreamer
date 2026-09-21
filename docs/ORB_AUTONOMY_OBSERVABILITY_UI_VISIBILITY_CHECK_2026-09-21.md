# ORB Autonomy Observability — UI Visibility Check (2026-09-21)

READ-ONLY. No code, visibility, permission, deployment or configuration change was made.

## 1. Exact render location

- Section markup: `src/components/orb/OrbDevPanel.tsx:225-247`
  - `<div data-testid="orb-autonomy-attempt">` → `<h3>Letzter eigener Fragen-Versuch</h3>`
  - Rendered only inside the panel's `{open && ( … )}` body (`OrbDevPanel.tsx:81`).
- Panel header/toggle: `OrbDevPanel.tsx:68-79` — button labelled `Testbereich (Experiment)`, local state `const [open, setOpen] = useState(false)` (`OrbDevPanel.tsx:64`) → collapsed by default on every mount.
- Panel mount point: `src/routes/_authenticated/channels.orb.tsx:456-463`, inside the technical item with `id: "status"`, `label: "Status"` (`channels.orb.tsx:439-466`).
- Technical items container: `OrbTechnicalDeck` (`channels.orb.tsx:582`), component `src/components/orb/OrbTechnicalDeck.tsx:16`. It renders a card grid ("Technische Informationen / Einblicke") and shows the item body only when that card is selected: `const [activeId, setActiveId] = useState<string | null>(null)` (`OrbTechnicalDeck.tsx:17`), body gated by `{active && …}` (`OrbTechnicalDeck.tsx:71`).

Path: `/channels/orb` → `Technische Informationen` → card `Status` → collapsible `Testbereich (Experiment)` → `Letzter eigener Fragen-Versuch`.

## 2. Exact visibility condition

Three nested UI conditions, no access control:

1. `technicalItems` is built only when a snapshot exists: `const technicalItems: OrbTechnicalItem[] = snapshot ? [ … ] : []` (`channels.orb.tsx:275-276`). Without a loaded snapshot the whole deck is empty.
2. `OrbTechnicalDeck` renders the `Status` body only after the user clicks the `Status` card (`activeId === "status"`).
3. `OrbDevPanel` renders its body only after the user clicks `Testbereich (Experiment)` (`open === true`). Default `false`, not persisted — collapsed again after every reload/navigation.

Explicitly NOT gated by:

- developer mode — no such flag exists in these files
- admin/user role — no role check; the only gate is the route subtree `_authenticated` (any signed-in user)
- environment — no `import.meta.env` / `NODE_ENV` / `process.env` reference in `channels.orb.tsx`, `OrbDevPanel.tsx`, `OrbTechnicalDeck.tsx`
- feature flag — none present
- URL/query parameter — none read
- screen size — only responsive grid classes (`sm:grid-cols-3`); no conditional rendering by breakpoint
- any other server-side condition

## 3. Presence in the current Production build

Verified against the live published site `https://y-dude.com` (read-only HTTP GET):

- entry `assets/index-DL5551W1.js` → route chunk `assets/channels.orb-JDKHSRAT.js` (257 828 bytes)
- that chunk contains the literal strings `Testbereich (Experiment)` and `Letzter eigener Fragen-Versuch` (1 match each), plus the `orb-autonomy-attempt` test id.

Conclusion: the observability implementation IS deployed and IS contained in the current Production bundle. Commit-hash identity cannot be read from a minified bundle; the evidence is string-level identity with the current source (`OrbDevPanel.tsx:226`), which was introduced by the observability change (`1caebd0a` / `64380271`). Nothing in the bundle indicates an older version of the panel.

## 4. How the developer/tester reaches it

1. Open ORB Core (`/channels/orb`) and wait until the avatar/state area is rendered (snapshot loaded).
2. Scroll to `Einblicke / Technische Informationen`.
3. Tap the card `Status` (summary shows the current activity, e.g. `Online`).
4. Inside it, tap the dashed row `Testbereich (Experiment)`.
5. Scroll inside that panel past `Innenzustand`, counters, `Ziele`, `Letzte Entscheidung` → `Letzter eigener Fragen-Versuch`.

Empty-state text `noch kein Versuch in dieser Sitzung` means: no autonomous server attempt has been answered in the current page session — the value lives in React state only (`channels.orb.tsx` `lastAutonomyAttempt`), so any reload clears it.

## 5. Why it appeared invisible

Not a deployment or permission problem. Three independent reasons, all pre-existing UI behaviour:

- F-1 The section sits behind two collapsed layers (`Status` card, then `Testbereich (Experiment)`), both default-closed and both requiring a deliberate click. Nothing on the ORB main view hints at it.
- F-2 It is the 5th block inside a long collapsible panel, below `Innenzustand`, metric grids, `Ziele` and `Letzte Entscheidung` — on a mobile viewport it is far below the fold.
- F-3 State is session-local and unpersisted. If the panel is opened after a reload, or the page reloaded after an attempt, it shows the empty state — indistinguishable at a glance from "section missing".

## FINDINGS — NO CHANGE MADE

- FINDING 1: Observability section is deployed to Production and reachable by any authenticated user; there is no gate by role, env, flag or parameter. NO CHANGE MADE.
- FINDING 2: `lastAutonomyAttempt` is React-state only; every reload discards the last attempt, so a rejected attempt is observable only if the panel is open or opened before the next reload. NO CHANGE MADE.
- FINDING 3: Discoverability is effectively zero (two default-collapsed layers, below the fold, no indicator when an attempt exists). NO CHANGE MADE.
- FINDING 4: Commit identity cannot be proven from the minified Production bundle; only string-level identity with the current source was verified. NO CHANGE MADE.

Observability only — autonomous decision behaviour unchanged. No implementation change performed.
