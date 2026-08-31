# Y-Dude Production – Business Campaigns V1

Release-Paket: `release/production-business-campaigns-v1-2026-08-31.tar.gz`
Staging-HEAD: `cdf7634`
Durchführung: 2026-08-31
Ergebnis: **🟢 abgeschlossen**

## 1. Paketprüfung (Phase 1–2)

- SHA-256-Prüfsummen: **39/39 in Ordnung**, keine Abweichung.
- Inhalt: 7 Datenbank-Migrationen, 12 neue und 8 geänderte Quelldateien,
  RUNBOOK und DATABASE_MIGRATION.

## 2. Baseline-Audit (Phase 3)

Der Production-Vorzustand entsprach exakt der Annahme des Runbooks:

- `ad_campaign_status` ohne den Wert `archived`
- `ad_campaigns` ohne `caption`, `hashtags`, `environment`, `slang_tag_drop_id`, `cta`
- keine Tabelle `ad_campaign_event_guard`
- keine Kampagnen-Funktionen (`business_campaign_limit`,
  `enforce_business_campaign_limit`, `enforce_campaign_slang_tag_owner`,
  `increment_campaign_metric`) und keine zugehörigen Trigger
- keine Zeitfenster-Prüfregel

Kein Abbruchkriterium ausgelöst.

## 3. Diff-Gate (Phase 4)

Der Änderungsumfang lag vollständig im Kampagnen-Scope: 12 neue Dateien
(Kampagnen-UI, Kampagnen-Bereitstellung, Kennzahlen, Tests) und 8 geänderte
Dateien (Werbeplan, Werbekatalog, Admin-Typen, Registry, Feed-Werbeplan,
Business-Seite, Entwickleransicht, generierte Typdatei).

Sicherung der 8 betroffenen Vorversionen: `backups/2026-08-31-business-campaigns/`.

## 4. Datenbank-Migrationen (Phase 5) – alle ✅

| # | Inhalt |
| --- | --- |
| 1 | Status `archived` ergänzt |
| 2 | Kampagnenfelder (`caption`, `hashtags`, `environment`), Kampagnen-Obergrenze (Business 2, Business Pro 5), Besitzprüfung für SlangTags, Schreibregeln für eigene Kampagnen |
| 3 | Eingeschränkte Ausführungsrechte der beiden Trigger-Funktionen |
| 4 | Erste Fassung der Kennzahlenerfassung (nur Serverdienst) |
| 5 | Manipulationsschutz der Zähler: Ereignis-Sperrtabelle, Prüfung auf Auslieferbarkeit, Ausschluss der Eigenmessung, Zeitfenster-Plausibilität |
| 6 | Entzug aller Rechte an der Sperrtabelle für angemeldete und anonyme Zugriffe |
| 7 | Verknüpfung mit Creator-Drops und geprüfte Handlungsaufforderungen (`listen`, `slangtag`, `profile`) |

## 5. Sicherheitsprüfung (Phase 6)

- Zeilensicherheit auf `ad_campaigns` aktiv, 8 Regeln (4 Besitzer, 4 Verwaltung).
- `ad_campaign_event_guard`: Zeilensicherheit aktiv, **keine** Regeln – nur der
  Serverdienst schreibt dort.
- Funktionsrechte: keine Rechte für `anon`; `enforce_business_campaign_limit`,
  `enforce_campaign_slang_tag_owner` und `increment_campaign_metric`
  ausschließlich für den Serverdienst.
- Kennzahlen können nicht von außen hochgezählt werden: Nur angemeldete,
  fremde Betrachter zählen, höchstens einmal pro Stunde je Kampagne und Art,
  nur bei aktiver Kampagne im passenden Zeitfenster.
- Zwei Prüfregeln auf `ad_campaigns`: Handlungsaufforderung und Zeitfenster.

## 6. Nachweise (Phase 8–18)

- Typprüfung und Lint: fehlerfrei.
- Logiktests: **527/527**.
- Datenbank-Integrationstests: **68/68** (inkl. Kampagnen-Obergrenzen,
  Kennzahlen-Schutz und Kampagnen-Medien).
- Browsertests: **10 bestanden**, 1 übersprungen.
- Build: in Ordnung.
- Smoke-Test `/business` mit dem Unternehmer-Testkonto: Kampagnenbereich wird
  angezeigt, ohne aktives Abo korrekt gesperrt, keine Fehler in der Konsole.

## 7. Zwei minimale Anpassungen am Paket

1. Die generierte Typdatei wurde nicht aus dem Paket übernommen, sondern aus
   dem neuen Datenbankstand erzeugt (identischer Inhalt der Kampagnenfelder).
2. Zwei übernommene Dateien wurden an die Formatierungsregeln von Production
   angepasst (`src/lib/admin.shared.ts`, `src/lib/business-campaigns.shared.ts`)
   – reine Formatierung, keine Logikänderung.

## 8. Rückweg

Quelldateien: Vorversionen liegen unter
`backups/2026-08-31-business-campaigns/`; zurückkopieren genügt.
Die generierte Typdatei ist dort als `types.ts.baseline` gesichert.

Datenbank: Die Migrationen sind additiv. Eine Rücknahme erfolgt gezielt, ohne
Datenverlust:

```sql
DROP TRIGGER IF EXISTS enforce_business_campaign_limit_trg ON public.ad_campaigns;
DROP TRIGGER IF EXISTS enforce_campaign_slang_tag_owner_trg ON public.ad_campaigns;
DROP POLICY IF EXISTS ad_campaigns_insert_own ON public.ad_campaigns;
DROP POLICY IF EXISTS ad_campaigns_update_own ON public.ad_campaigns;
DROP POLICY IF EXISTS ad_campaigns_delete_own ON public.ad_campaigns;
DROP POLICY IF EXISTS ad_campaigns_select_own ON public.ad_campaigns;
ALTER TABLE public.ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_cta_chk;
ALTER TABLE public.ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_time_window_chk;
```

Spalten und der Statuswert `archived` bleiben bestehen – sie sind ungenutzt,
aber ein Entfernen wäre der einzige tatsächlich brechende Schritt.
