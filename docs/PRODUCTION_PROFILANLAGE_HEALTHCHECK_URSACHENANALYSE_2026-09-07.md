# PRODUCTION – URSACHENANALYSE „PROFIL JE KONTO: FEHLER“

Datum: 2026-09-07 · Modus: **READ-ONLY** · Keine DB-, Daten-, Policy-, RLS-, Auth- oder Codeänderung, kein Deployment, keine Reparatur.

## Ergebnis

**Kein Produktionsfehler im Registrierungs-/Profilflow.** Der Befund ist ein
Messfehler des Health-Checks: er wertet die letzten 5 Konten aus, unabhängig
davon, ob diese ihre E-Mail bestätigt und sich jemals angemeldet haben.
Die Profilzeile entsteht planmäßig erst beim ersten Login (`ensureProfile`).

## Belege (Production, read-only)

- `auth.users`: 30 Konten. Ohne Profil: **9**.
- Alle 9 ohne Profil: `email_confirmed_at IS NULL` **und** `last_sign_in_at IS NULL`.
- Konten ohne Profil mit bestätigter E-Mail oder erfolgtem Login: **0**.
- Die 9 Konten sind ausschließlich Test-/Funnel-Konten:
  `funneltest…@example.com` (4), `prodlate…@example.com` (2),
  `fixdesk…/fixmob…@example.com` (2), `ydude.check800009@example.com` (1, heute 16:53 UTC,
  angelegt beim Smoke-Test der Turnstile-Abschaltung).
- Alle echten Nutzerkonten (Mario, MarioAdmin, Wissam, natasa_agr, Eleniagr,
  Mantec, Pit86, Dora, Dude, cstsortan, gplay_tester, DavidRostock, hannah)
  besitzen ein Profil.

## Warum „1 von 5“

`src/lib/registration-health.server.ts` → `checkProfileCreation()`:

```
listUsers({ page: 1, perPage: 5 })  → letzte 5 Konten
missing.length > 0 → status "failed"
```

Das jüngste Konto ist das heutige unbestätigte Testkonto → 1 von 5 ohne Profil
→ Status FEHLER, Bereich `ensureProfile`. Auth/DB/Login/Username = OK, weil
diese Prüfungen intakt sind.

## Punkte 1–12

1. Betroffenes Konto: `ydude.check800009@example.com`, ID `…` (Testkonto vom 2026-09-07 16:53:38 UTC).
2. Historisch? Nein – heutiges Testkonto; die 8 weiteren stammen vom 2026-08-27 (Testläufe).
3. Erstellt 2026-09-07 16:53:38 UTC, `email_confirmed_at = NULL`, `last_sign_in_at = NULL`.
4. `ensureProfile` wurde nie aufgerufen – der Aufruf erfolgt erst nach erfolgreichem Login.
5. `registration_events` zeigt für den Versuch `aa68bbd8…`: `registration_started` →
   `registration_submitted` → `email_confirmation_pending`. Kein `auth_failed`,
   kein `profile_creation_failed`, kein `validation_failed`.
6. Profilanlage ist nicht fehlgeschlagen – sie war nie fällig.
7. `public.profiles`: Zeilen existieren für alle bestätigten/angemeldeten Konten.
8. Constraints intakt: `profiles_pkey`, `profiles_id_fkey → auth.users(id) ON DELETE CASCADE`,
   `profiles_username_key`, `profiles_theme_check`. RLS/Policies unverändert und nicht ursächlich.
9. Ein Profil erhält das Konto regulär beim ersten Login nach E-Mail-Bestätigung.
10. Neue Registrierungen sind **nicht** betroffen: jedes bestätigte Konto hat ein Profil (0 Ausnahmen);
    zusätzlich existiert `ensureProfileRow()` als serverseitige Reparaturschicht.
11. Aktueller Flow: Registrierung → `auth.users` (unbestätigt) → E-Mail-Bestätigung → Login →
    `ensureProfile` legt Profil an (mit Username-Kollisionsschleife und Sperrlistenprüfung).
12. Der Befund betrifft ausschließlich unbestätigte Test-Konten, keinen echten Nutzer.

## Warum nur in Production sichtbar

Staging hat keine unbestätigten Test-Konten in den jüngsten 5 Einträgen; die
Prüfung ist datenabhängig, nicht codeabhängig.

## Empfehlung (nicht umgesetzt)

Health-Check-Kriterium präzisieren: nur Konten mit `email_confirmed_at IS NOT NULL`
oder `last_sign_in_at IS NOT NULL` bewerten; unbestätigte Konten als „ausstehend“
ausweisen. Kein Anlegen fehlender Profile, kein Löschen von Testkonten.

## Bestätigung

Code geändert: NEIN (nur dieser Bericht) · DB geändert: NEIN · Daten geändert: NEIN ·
Policies/RLS geändert: NEIN · Auth-Konfiguration geändert: NEIN · Reparatur: NEIN · Deployment: NEIN
