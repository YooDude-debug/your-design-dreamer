<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Architecture rules

- Cognitive Globe geometry derives from the compact observation and measured existing Memory bounds; camera framing follows visible layer bounds, so presentation cannot alter ORB or Memory semantics. Zoom limits: min distance from the Memory core only, max from visible layers; manual zoom survives layer/cognitive updates (ratio kept on resize) so Memory nodes stay reachable.
- Server-function DB/RPC errors are thrown via internalError() and masked to "Interner Serverfehler" by the global safeServerFnErrors function middleware in src/start.ts; the framework serializes server-fn errors (incl. cause) before request middleware sees them.
- ORB scope isolation: every ORB data access goes through `createOrbCore({ data, userId, scope })`, which wraps the client in `scopedDb` (src/orb-core/scope.ts) so all orb_messages/nodes/connections/threads/questions/interests/candidates queries filter and inserts set `scope` in the query itself; why: one central guarantee instead of ~20 hand-written filters.
- ORB scope comes only from the route `/channels/orb/$scope` (normal | orb_core | y_dude) and is re-validated by Zod in every ORB server function without default; feed observation uses `unassigned`, ORB-Dev is fixed `orb_core`, orb_state/orb_style stay user-wide; why: fixed decision, no text-based scope detection.
- ORB concepts are separate orb_nodes (type fact, metadata.kind=concept, norm_key prefix `concept:`) created only inside the existing background analysis call and validated by src/orb-core/analysis/concepts.ts (verbatim user-text evidence, typed relations with evidence_status, never "confirmed"); concept rows are excluded from memory recall; why: organic graph growth without fixed taxonomy, extra model calls, or memory pollution.
