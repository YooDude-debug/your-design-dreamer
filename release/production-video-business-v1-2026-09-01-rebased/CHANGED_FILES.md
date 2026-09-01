# Diff-Gate – Production vs. rebasiertes Release

Baseline: **aktueller Production-Stand**. Vergleichsquelle:
`rollback-production-original/` (Kopien der aktuellen Production-Dateien).

## ADDED (9)

Scope A – Video V1:

- `src/lib/video/video-file.ts` – MIME-/Container-Prüfung, Maße, Rotation,
  Dauer (max. 60 s), Größe (max. 50 MB), MP4 + MOV/QuickTime
- `src/lib/video/video-thumbnail.ts` – automatisches Standbild
- `src/lib/video/video-errors.ts` – Fehlercodes/Texte
- `src/lib/video/video-upload.shared.ts` – Pfadlogik, Besitzprüfung des Pfads
- `src/lib/video/video-upload.functions.ts` – Serverpfad (`requireSupabaseAuth`,
  Schreiben auf `media_video_assets` ausschließlich privilegiert)
- `src/lib/video/video-upload-client.ts` – Client-Anbindung des Composers
- `tests/video-upload-validation.test.ts`

Scope B – Business V1:

- `src/lib/business-role.functions.ts` – Rollenvergabe `business` bei
  Unternehmerregistrierung
- `tests/business-onboarding.test.ts`

## CHANGED (14, zusammengeführt)

Scope A:

- `src/components/CreatePostDialog.tsx` – Einstieg „Video hochladen“, Publish-Pfad
  (Production-Fix `slice(0, 40)` erhalten)
- `src/components/SlangTagCanvas.tsx` – `videoWithSound` / `videoPoster`
- `src/components/feed/FeedPost.tsx` – Shot vs. Video-Beitrag
- `src/components/PostDetailOverlay.tsx` – dito
- `src/lib/post-moderation.functions.ts` – `videoKind`, serverseitige Dauerquelle
  (Production-Fix `titleField` erhalten)
- `src/lib/data.tsx` – `videoPath` / `videoKind` in `createPost`, Mapping
- `src/lib/types.ts` – `videoKind` am Post-Typ
- `src/lib/i18n-dict.ts` – Video-Texte (de/en/el)
- `src/integrations/supabase/types.ts` – generierte Typen inkl.
  `media_video_assets`, `posts.video_kind` (auf dem aktuellen Production-Typstand
  aufgesetzt, Creator/Business-Strukturen erhalten)

Scope B:

- `src/routes/auth.tsx` – Unternehmerregistrierung vergibt Rolle und führt nach
  `/business?onboarding=1`; bestehende Production-UI (`signupEntryCopy`,
  `businessEntry`) unverändert erhalten
- `src/routes/_authenticated/business.tsx` – Onboarding-Karte, Tarifauswahl,
  „Später entscheiden“, Zugang ohne Abo
- `src/components/business/BusinessCampaignsSection.tsx` – gesperrte
  Kampagnenansicht + CTA
- `src/lib/business-campaigns.shared.ts` – `campaignGate()` (reine Anzeige)
- `src/components/ProfilePanel.tsx` – Menüpunkt „Business & Kampagnen“
  (iPhone-Responsive-Stand `min-w-0` / `truncate` erhalten)

## CONFLICT – manuell entschieden (3), Production behalten

| Datei | Konflikt | Entscheidung |
| --- | --- | --- |
| `src/routes/auth.tsx` | Paket-`accountTypeCopy` vs. Production-`signupEntryCopy` | Production-UI behalten, aus dem Paket nur Rollenvergabe + `/business?onboarding=1` übernommen |
| `src/routes/_authenticated/creator.tsx` | Paket-Labels (`onlyBusiness`) vs. Production `role-scope.ts` | Production behalten → Datei **nicht** Teil des Releases |
| `src/components/CreatorSlangTagsDialog.tsx` | Paket-`variant` vs. Production `roleSlangTagLabel` | Production behalten → Datei **nicht** Teil des Releases |

## AUS DEM RELEASE ENTFERNT (out of scope)

Diese Paketdateien betrafen ausschließlich Rollenbeschriftung/-sichtbarkeit,
die in Production bereits in neuerer Form existiert. Sie liegen außerhalb der
freigegebenen Scopes A/B:

- `src/lib/role-visibility.ts` (Dublette zu `src/lib/role-scope.ts`)
- `tests/role-separation.test.ts` (Production-Fassung bleibt)
- `src/routes/_authenticated/creator.tsx`
- `src/components/CreatorSlangTagsDialog.tsx`
- `src/routes/_authenticated/profile.$username.tsx`

## UNCHANGED

Alles übrige, insbesondere `src/lib/ad-plan.server.ts`,
`src/lib/business-campaigns.server.ts`, `src/lib/environment.server.ts`,
`src/lib/role-scope.ts`, `src/lib/role-guard.server.ts`, `src/lib/video/short-video.ts`
und alle SlangShot-Pfade. Siehe `NOT_CHANGED.md`.
