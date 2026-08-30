# Y-Dude Production – Registration UX Release (2026-08-30)

Endstatus: **🟢 MINIMALER UI-/ROUTING-FIX ANGEWENDET UND VERIFIZIERT**

## 1. Vorgeschichte: Baseline-Mismatch (Launchpad-Paket abgelehnt)

Das Paket `production-registration-ux-2026-08-30.tar.gz` war paketseitig
sauber (`PACKAGE_FILES.sha256` 11/11 OK, keine `.env`, keine SQL), aber die
Production-Baseline passte nicht:

| Marker (Runbook §2) | Erwartet | Production tatsächlich |
|---|---|---|
| `accountTypeCopy` | Treffer | 0 Treffer |
| `privateLabel` / `businessLabel` | Treffer | 0 Treffer |
| `routeAfterLogin` | Treffer | 3 Treffer ✅ |

Der Target-Stand (`6218b2da…`, 932 Zeilen) hätte in Production +117/−2 Zeilen
eingeführt, inkl. **Preistexten** („Business 14,90 €/Monat", „Business Pro
39,00 €/Monat", DE/EN/EL) und eines vorgeschalteten Auswahl-Schirms.
Das verletzt das Scope-Gate → Paket **nicht angewendet** (🟠 STOP).

## 2. Production-Baseline / Checksummen

| Gegenstand | SHA256 | Zeilen |
|---|---|---|
| Production-Original vor Änderung | `a423515c52a82b7323fcd48d8686a8a06786fe2d14041627dc3f8a04adcfcf03` | 817 |
| Production nach Änderung | `29440b8e81da011c3266cd8b30715624ae36700ee1c071c56e5bb58a251e7aba` | 890 |
| Abgelehnter Release-Target | `6218b2da76d3a9974a9f44ec6be9831b7cf05e957bd88d27d79b85382b404072` | 932 |

## 3. Bestehender Registrierungsflow (Analyse)

`src/routes/auth.tsx` → `RegisterForm`:
E-Mail, Passwort (2×), Vor-/Nachname, Geburtsdatum (Mindestalter 16),
Username mit Live-Prüfung, Anzeigename-Modus, AGB/Richtlinien/Datenschutz-
Zustimmung, Turnstile. Absenden über `signUpWithCaptcha`, danach
`ensureProfile` und Weiterleitung über `routeAfterLogin(userId)`.

## 4. Bestehender Business-Flow (vorhanden)

`src/routes/_authenticated/business.tsx` (380 Zeilen) – bestehende
Business-Abo-Seite mit `BUSINESS_PLANS`, `billing.functions` und Stripe
Embedded Checkout. Route `/business` ist im Routenbaum registriert.
→ Kein Neubau erforderlich, es wird ausschließlich darauf verwiesen.

## 5. Tatsächliche Änderung

**Genau eine Datei:** `src/routes/auth.tsx` (Diff: 79 hinzugefügte Zeilen,
121 Diff-Zeilen). Inhalt:

1. Import: `BriefcaseBusiness`, `User`; ungenutztes `UserPlus` entfernt.
2. Neuer reiner Text-Block `signupEntryCopy` (DE/EN/EL) mit
   `privateCta`, `businessQuestion`, `businessCta`, `businessBack` –
   **ohne Preis-, Tarif- oder Subscription-Angaben**.
3. Lokaler UI-State `businessEntry` (nur Anzeige + Ziel-Route).
4. Primärer Submit-CTA vergrößert (`min-h-12`, `py-3`, `text-base`,
   `font-bold`, `shadow-glow`) mit Label „Als Privatperson registrieren".
5. Darunter sekundärer, deutlich kleinerer Text-Link „Für Unternehmen
   registrieren" (11 px, unterstrichen) plus Rückschalter.
6. Bei gewähltem Unternehmens-Einstieg endet die Registrierung auf dem
   **bestehenden** `/business` statt auf `routeAfterLogin(...)`.

**Unverändert:** Formularfelder, Validierung, `signUpWithCaptcha`,
`ensureProfile`, Turnstile, `routeAfterLogin`, Login-, Reset- und
Confirm-Pfad. Keine 50/50-Darstellung, kein vorgeschalteter Auswahl-Schirm.

## 6. Tests

`bun run verify` → **grün**
- Typprüfung ✅, Lint ✅ (nach Prettier-Formatierung der neuen Zeilen)
- Unit/Logik: **480 Tests, 21 Dateien – passed**
- DB-Integration: **26 Tests, 2 Dateien – passed**
- E2E/Browser: **10 passed** (inkl. Login/Registrierung-Regression)

`bun run build` → **erfolgreich** (Nitro/Worker-Build ohne Fehler)

Browser-Smoke-Test (Playwright, `/auth?mode=register`):

| Prüfung | Desktop 1280 | Mobile 390 | DE | EN | EL |
|---|---|---|---|---|---|
| Privat-CTA sichtbar/dominant (48 px hoch, 16 px Schrift, volle Breite) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Business-CTA sichtbar, deutlich kleiner (16,5 px hoch, 11 px Schrift) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Keine 50/50-Darstellung (Flächenverhältnis ≈ 1 : 0,02) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Business-Frage-Text vorhanden | ✅ | ✅ | ✅ | ✅ | ✅ (Kurzform) |
| Umschalten Business ↔ Privat ohne Navigationswechsel | ✅ | ✅ | ✅ | ✅ | ✅ |
| Keine Preis-/Tarifangaben im Registrierungs-Screen (`14,90`/`39,00`/`€/`) | ✅ | ✅ | ✅ | ✅ | ✅ |

## 7. Security Gate (bestätigt)

- RLS unverändert
- Auth/`signUpWithCaptcha`/Turnstile unverändert
- Rollen, JWT, Permissions unverändert
- Datenbank, Migrationen unverändert
- Subscription, Stripe, Checkout, Preise, Business-Produkte unverändert
- Storage, CDN, SSR-Cache, React Query, View-Batch, Translation-Batch,
  `public/*` unverändert
- Die Auswahl „Privatperson / Unternehmen" ist rein clientseitige Anzeige
  und erweitert **keine** Berechtigung.

## 8. Rollback

Rollback-Punkt vor der Änderung:
`/tmp/ydude-rollback-regux-2026-08-30/auth.tsx`
(SHA256 `a423515c52a82b7323fcd48d8686a8a06786fe2d14041627dc3f8a04adcfcf03`).

Rollback: Datei nach `src/routes/auth.tsx` zurückkopieren, Checksum
prüfen, `bun run verify`, Build. Nicht benötigt – alle Gates grün.
