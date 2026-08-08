# Diagnose & Fix: Werbeschalter + Globe-Einreichung

## Ursache (verifiziert, gleiche Wurzel für beide Bugs)

Die Datenbank arbeitet bei `profiles` und `slang_tags` mit **spaltengenauen Zugriffsrechten**
(aus früheren Security-Härtungen). Die neu hinzugefügten Spalten wurden dabei nie freigegeben:

- `profiles.ads_enabled` — keine Lese-/Schreibrechte für angemeldete Nutzer
- `profiles.likes_private` — ebenfalls nicht freigegeben
- `slang_tags.community_shared` — keine Lese-/Schreibrechte
- `slang_tags.normalized_name` — nicht freigegeben

Live-Test als @mario im echten Browser mit echter Sitzung:

```text
select profiles(ads_enabled)        -> "permission denied for table profiles"
update profiles(ads_enabled=false)  -> "permission denied for table profiles"
select slang_tags(community_shared) -> "permission denied for table slang_tags"
```

Damit:

- **Bug 1**: Der Admin-Schalter liest immer den Default „AN“ und jeder Speicherversuch
  scheitert stumm bzw. mit Fehlermeldung. Die alte 3-Tage-Werbepause ist **nicht** die Ursache
  (getrennte Tabelle `ad_pauses`, keine Kollision, kein Timer der `ads_enabled` überschreibt).
- **Bug 2**: Die Globe-Freigabe (`community_shared`) kann nicht geschrieben werden — und selbst
  bei Erfolg würde sie nicht angezeigt.

## Zweite, unabhängige Ursache für Bug 2 (Frontend)

`src/lib/data.tsx` → `SLANG_TAG_COLUMNS` enthält `community_shared` **nicht**.
Deshalb ist `communityShared` nach jedem Laden immer `false`:

- `SlangTagManager` zeigt Tags dauerhaft unter „Meine Sammlung“, nie unter „Globe“
- `GlobeVoteSection` findet keine Kandidaten (`tags.filter(t => t.communityShared)`)
- Arena-Kachelzähler bleibt 0

Owner-Scoping selbst ist korrekt: der Toggle nutzt `.eq("id", tag.id)`, also die konkrete
`slang_tag.id` — keine Suche über `$name`. RLS (`slang_tags_update_own`) und Foreign Keys sind
in Ordnung. Es gibt keine Legacy-Datensätze mit alter Struktur: alle Tags haben `owner_id`,
`owner_type`, `normalized_name`; `community_shared` ist gesetzt (teils true, teils false).

## Drittes Detail (Bug 1, Zustandssynchronität)

`useAdsEnabled` wird dreimal unabhängig instanziiert (`AccountSection`, `AdFeed`, `AdSlider`),
jeweils mit eigenem lokalem State und ohne gemeinsame Quelle. Nach dem Umschalten in den
Einstellungen bleiben Feed und Slider bis zum Remount auf dem alten Wert — was als
„lässt sich nicht zuverlässig bestätigen“ wahrgenommen wird.

## Fix-Plan

1. **Migration (nur GRANTs, keine Strukturänderung, keine Daten)**
   - `GRANT SELECT, UPDATE (ads_enabled, likes_private) ON public.profiles TO authenticated`
   - `GRANT SELECT, UPDATE (community_shared) ON public.slang_tags TO authenticated`
   - `GRANT SELECT (normalized_name) ON public.slang_tags TO authenticated`
   - Schutz bleibt: der Trigger `guard_profile_internal_fields` setzt `ads_enabled` für
     Nicht-Admins auf den alten Wert zurück, `guard_slang_tag_moderation` schützt Moderationsfelder.
     RLS bleibt unverändert.
2. **`src/lib/data.tsx`**: `community_shared` (und `normalized_name`) in `SLANG_TAG_COLUMNS` ergänzen.
3. **`src/lib/ad-pause.ts`**: `useAdsEnabled` auf eine gemeinsame Quelle umstellen (ein kleiner
   Modul-Store/Broadcast), damit alle drei Verbraucher denselben Zustand zeigen; Fehler beim
   Speichern sichtbar machen statt still zu verwerfen.
4. **`src/components/SlangTagManager.tsx`**: nach dem Toggle den Tag-Cache invalidieren, damit
   die Einordnung „Globe/Eigene“ sofort korrekt umspringt (`as never`-Cast entfällt).

## Tests danach

- @mario: AN → Reload → AN; AUS → Reload → AUS; Logout/Login → Zustand bleibt; anderer
  Testnutzer bleibt unberührt (Trigger verhindert Fremdänderung).
- Bot-Tag: Globe-Freigabe an → erscheint im Manager unter „Globe“ und in Globe Vote;
  geprüft wird die konkrete `slang_tag.id` (Bot A `$moin` ≠ Bot B `$moin`).
- Regression: Feed, Arena-Navigation, Werbepause für Nicht-Admins, Profil-Speichern.
