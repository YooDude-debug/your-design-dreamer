# Ausdrücklich nicht verändert

Datenbank:

- `public.user_roles` (Struktur, Grants, Policies)
- `public.comments`
- Creator Subscription V1 (`creator_subscriptions`,
  `creator_subscription_prices`, `slang_tag_drops`, zugehörige Funktionen/Jobs)
- Business Campaigns V1 (`ad_campaigns`, `ad_campaign_event_guard`,
  `business_campaign_limit()`, `enforce_business_campaign_limit()`,
  `enforce_campaign_slang_tag_owner()`, `increment_campaign_metric()`)
- `business_plan_tier()` – Rechte bleiben `service_role`-only
- Storage-Bucket `media` (Konfiguration, Policies)
- Auth-Schema, `storage`, `realtime`, `supabase_functions`, `vault`

Quellcode:

- `src/lib/ad-plan.server.ts` – Environment-Auflösung über die Anfrage
  (`getRequest()`); der frühere Fehler „Save = production / Lookup = staging“
  bleibt behoben
- `src/lib/business-campaigns.server.ts` – privilegierter `business_plan_tier`-Pfad
  über `supabaseAdmin`; kein Rückbau auf den User-Client
- `src/lib/environment.server.ts`, `src/lib/environment.shared.ts`
- `src/lib/role-scope.ts`, `src/lib/role-guard.server.ts` (Rollenarchitektur)
- `src/lib/video/short-video.ts` und alle SlangShot-Pfade (max. 5 s, stumm,
  bestehende Audioextraktion)
- Feed-Ranking, Recommendation Engine, Ads-Ranking, Business-Campaign-Ranking
- Creator SlangTags, Creator Drops, SlangTag Library
- Stripe-Architektur (Preise, Webhooks, Secrets)
- `src/routes/auth.tsx`-Bestand: `signupEntryCopy`, Turnstile-Gate, AGB-Zustimmung
- `src/components/ProfilePanel.tsx`-Bestand: Responsive-Fix (`min-w-0`, `truncate`)
- `src/lib/post-moderation.functions.ts`-Bestand: `titleField`-Kürzung
- `src/components/CreatePostDialog.tsx`-Bestand: `slice(0, 40)`

Keine neuen Features außerhalb der Scopes A und B.
