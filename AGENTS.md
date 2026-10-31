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

- ORB Core was fully removed from the active codebase on 2026-10-31 (directories src/orb-core, src/orb-sdk, src/orb-dev, src/integrations/y-dude-orb, src/components/orb*, src/lib/orb-*, all ORB routes and ORB tests). The database is untouched: all 20 orb_* tables, data, RLS policies and migrations 0041–0056 remain, and ORB media files stay in the shared `media` bucket; src/lib/account.server.ts still lists `<user>/orb/<scope>/...` paths so account export/deletion keeps covering them. Restore knowledge lives in the /mnt/documents reports (schema export, audits, cut reports); a rebuild must reuse migrations 0041–0056 instead of writing new ones; why: the user ordered a full cut with zero data loss and later optional revival.
- Server-function DB/RPC errors are thrown via internalError() from src/lib/internal-error.ts and masked to "Interner Serverfehler" by the global safeServerFnErrors function middleware in src/start.ts; the framework serializes server-fn errors (incl. cause) before request middleware sees them.
- Payment return URLs (Stripe checkout/portal) pass assertSafeReturnUrl (src/lib/return-url.server.ts) server-side; why: caller-supplied destinations enabled open redirects.
- The public voice demo (transcribeTestRecording) runs IP rate limit → server-side Turnstile verification → paid STT, fail-closed via runPublicTranscription (src/lib/public-transcribe-guard.ts); why: a client-side check alone allowed automated cost abuse.
