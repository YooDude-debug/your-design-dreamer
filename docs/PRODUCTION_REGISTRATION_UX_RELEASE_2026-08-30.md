# Y-Dude Production – Registration UX Release (2026-08-30)

Status: **🟠 STOP – PRODUCTION BASELINE MISMATCH**
Es wurde **keine** Datei geändert. Kein Rollback nötig.

## 1. Paket-Preflight (grün)

- Archiv: `production-registration-ux-2026-08-30.tar.gz`, vollständig entpackt.
- Alle erwarteten Dateien vorhanden (README, RUNBOOK, RELEASE_AUDIT,
  CHANGED_FILES, NOT_CHANGED, TEST_PLAN, ROLLBACK, PRODUCTION_PROMPT,
  `target-production-files/`, `patches/`, `checksums/`).
- `sha256sum -c checksums/PACKAGE_FILES.sha256` → **alle OK** (11/11).
- Keine `.env`-Dateien, keine SQL-Migrationen im Paket (Suche leer).

## 2. Checksummen

| Gegenstand | SHA256 |
|---|---|
| Production-Original `src/routes/auth.tsx` (817 Zeilen) | `a423515c52a82b7323fcd48d8686a8a06786fe2d14041627dc3f8a04adcfcf03` |
| Release-Target `src/routes/auth.tsx` (932 Zeilen) | `6218b2da76d3a9974a9f44ec6be9831b7cf05e957bd88d27d79b85382b404072` |
| Soll laut `TARGET_FILES.sha256` | `6218b2da76d3a9974a9f44ec6be9831b7cf05e957bd88d27d79b85382b404072` (stimmt) |

## 3. Baseline-Prüfung gegen RUNBOOK §2 (rot)

Erwartet laut Runbook: Production enthält den bisherigen
Kontotyp-Auswahl-Stand (50/50) mit `accountTypeCopy` und
`privateLabel`/`businessLabel`.

Tatsächlicher Production-Stand:

| Marker | Erwartet | Tatsächlich |
|---|---|---|
| `accountTypeCopy` | Treffer | **0 Treffer** |
| `privateLabel` / `businessLabel` | Treffer | **0 Treffer** |
| `routeAfterLogin` | Treffer | 3 Treffer (Zeilen 60, 211, 580) ✅ |

Ergebnis: Die Production-Datei enthält **überhaupt keine
Kontotyp-Auswahl**. Der im Runbook vorausgesetzte Ausgangsstand
(50/50-Darstellung) existiert in Production nicht.

## 4. Diff-Befund (Production → Target)

`diff -u` Umfang: **117 hinzugefügte, 2 entfernte Zeilen** (158 Diff-Zeilen).

Die Änderung ist damit in Production **keine reine UX-Hierarchisierung**,
sondern die **Erstintroduktion des gesamten Kontotyp-Features**:

1. Import-Erweiterung: `BriefcaseBusiness`, `User` (lucide-react).
2. Neuer Block `accountTypeCopy` mit DE/EN/EL-Texten – enthält u. a.
   **Preisangaben**: „Business 14,90 €/Monat oder Business Pro
   39,00 €/Monat" (EN/EL analog).
3. Neuer State `accountType: null | "private" | "business"` und ein
   vorgeschalteter Auswahl-Schirm (großer Privat-CTA, kleiner
   Business-Link).
4. Neue Routing-Verzweigung nach der Registrierung:
   `if (accountType === "business") onDone("/business")` – d. h. ein
   zusätzlicher Weg in den Business-/Tarif-Flow.
5. Kontotyp-Badge inkl. „Zurück zur Auswahl" und Business-Hinweistext.

## 5. Warum gestoppt wurde

- **Baseline-Abweichung (Runbook §2 Stopp-Bedingung):** Die im Runbook
  geforderten Marker fehlen vollständig.
- **Scope-Gate-Konflikt:** Das Paket würde in diesem Repo neue
  Preis-/Tarif-Texte und eine neue Weiterleitung in den Business-Flow
  einführen. Der Release-Scope schließt Änderungen an Preisen,
  Subscription/Stripe und Business-Produkten ausdrücklich aus.
- Ein Zusammenführen, „intelligentes" Anpassen oder Überschreiben ist
  laut Auftrag untersagt.

## 6. Nicht ausgeführt

`bun run verify`, Build, Browser-Smoke-Test (Desktop/Mobile, DE/EN/EL),
Regression – bewusst **nicht** ausgeführt, da keine Änderung angewendet
wurde.

## 7. Security Gate

Unverändert, da keine Datei angefasst wurde: RLS, Auth, Rollen,
Permissions, Datenbank/Migrationen, Subscription, Stripe/Payments,
Storage, CDN/Cache – **alle unverändert**.

## 8. Rollback

Nicht erforderlich. Arbeitsstand entspricht bit-identisch dem
Production-Original (`a423515c…`).

## 9. Nächste Entscheidungspunkte (nur zur Vorlage, nicht ausgeführt)

1. Klären, ob die Kontotyp-Auswahl in Production **neu eingeführt**
   werden soll (dann ist es ein Feature-Release, kein UX-Release, und
   Preistexte müssen freigegeben werden).
2. Alternativ ein Paket anfordern, dessen Baseline zum tatsächlichen
   Production-Stand (`a423515c…`) passt.
