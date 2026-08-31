# Production-Testkonten (Community / Creator / Unternehmer) – 2026-08-31

Ziel: drei kontrollierte Testkonten in der bestehenden Production-Auth für
manuelle Rollen- und UI-Tests auf drei Geräten.

**Keine Passwörter in dieser Datei.** Die Passwörter wurden einmalig im
Abschlussreport an den Administrator ausgegeben und ausschließlich in der
bestehenden Auth-Verwaltung (Supabase Auth, gehashter Speicher) gespeichert.

## Umgesetzte Architektur

- Auth: bestehende Production-Auth (Admin-API `createUser`, `email_confirm`),
  keine neue Auth-Architektur, keine Testtabellen, keine Fake-Sessions.
- Rollen: ausschließlich bestehende autoritative Quelle `public.user_roles`
  (Enum `app_role`), Prüfung über `public.has_role`.
- Rollenzuordnung im Produkt: „Community“ = keine Sonderrolle,
  „Creator“ = `creator`, „Unternehmer“ = `business` (identisch zu
  `getCreatorAccess` / `src/lib/creator.functions.ts`).
- Profile: normale Zeilen in `public.profiles` mit Handle = Username,
  `display_name_mode = username`.

## Konten

| Handle | Rolle (user_roles) | Auth | Profil | Login-Test | has_role-Prüfung |
| --- | --- | --- | --- | --- | --- |
| @community | – (Community) | erstellt, E-Mail bestätigt | erstellt | OK | admin/moderator/creator/business: alle false |
| @creator | `creator` | erstellt, E-Mail bestätigt | erstellt | OK | creator: true; business/admin/moderator: false |
| @unternehmer | `business` | erstellt, E-Mail bestätigt | erstellt | OK | business: true; creator/admin/moderator: false |

E-Mail-Adressen: `community@y-dude.com`, `creator@y-dude.com`,
`unternehmer@y-dude.com`.

## Geprüfte Berechtigungen

- Login über den normalen Production-Login (Publishable Key,
  `signInWithPassword`) für alle drei Konten erfolgreich.
- Rollen jeweils über `has_role` mit der eigenen Session verifiziert
  (nicht über Service-Role, nicht über Admin-Perspektive).
- @creator: Creator-Status wird von `getCreatorAccess` als `isCreator = true`
  gemeldet → Creator-Profil, Creator-SlangTags und Creator-Funktionen sind
  freigeschaltet. Kein Abo, kein Stripe-Vorgang erzeugt.
- @unternehmer: `isBusiness = true` → bestehende Unternehmer-Funktionen
  (Business-SlangTags, Unternehmer-Kennzeichnung) aktiv. Keine neuen Produkte
  oder Abos erzeugt.
- @community: keine Sonderrolle; Creator-Eligibility greift unverändert
  (0 Connections / 0 Follower < 10 → „Creator werden“ gesperrt). Es wurden
  keine künstlichen Connections oder Follower erzeugt.

## Security

- Keine Admin- oder Moderator-Rolle vergeben, keine zusätzlichen Rollenzeilen.
- Service-Role ausschließlich serverseitig im Anlage-Skript verwendet, nie im
  Client; keine Secrets im Client, keine Passwörter im Code, in Git, in `.env`
  oder in Datenbankfeldern außerhalb der Auth-Verwaltung.
- Keine Änderung an RLS, Auth-Architektur, Stripe, Subscriptions,
  SlangTag-Daten, Feed oder CDN.
- Bestehende Production-Nutzer und deren Rollen wurden nicht verändert; es
  wurden ausschließlich drei neue Auth-Nutzer, drei Profile und zwei
  Rollenzeilen angelegt.

## Betrieb

Die Konten sind unabhängig auf drei Geräten nutzbar (getrennte Sessions,
keine Session-Zusammenlegung).
