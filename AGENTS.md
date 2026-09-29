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

- Cognitive Globe geometry derives from the compact observation and measured existing Memory bounds; camera framing follows visible layer bounds, so presentation cannot alter ORB or Memory semantics.
- Server-function DB/RPC errors are thrown via internalError() and masked to "Interner Serverfehler" by the global safeServerFnErrors function middleware in src/start.ts; the framework serializes server-fn errors (incl. cause) before request middleware sees them.
