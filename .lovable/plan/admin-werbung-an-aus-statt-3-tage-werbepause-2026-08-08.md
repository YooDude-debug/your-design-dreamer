# Admin: Werbung AN / AUS (statt 3-Tage-Werbepause)

## Ausgangslage (geprüft)

Die heutige Werbepause ist zeit- und kontingentbasiert:

- Tabelle `ad_pauses`: pro Nutzer und Kalendertag eine Zeile mit `ends_at` (lokale Mitternacht), `month_key`, Zeitzone. Kein Update/Delete erlaubt.
- `src/lib/ad-pause.ts` (`useAdPause`): lädt die Zeilen des aktuellen Monats, berechnet `active` (heutige Zeile und `ends_at` in der Zukunft), `remaining` = 3 minus verbrauchte Pausen, plus Sekunden-Countdown.
- `src/components/AdFeed.tsx`: Button „Werbepause starten“, Restlaufzeit, Kontingentanzeige.
- `src/components/AdSlider.tsx`: `adBreak = pause.active` schaltet die Werbeausspielung aus.

Der Zustand endet dadurch automatisch um 24:00 Uhr und ist auf 3 Tage pro Monat begrenzt — genau das soll für den Admin entfallen.

## Zielverhalten

Nur für Admin-Konten (aktuell @mario) gibt es einen dauerhaften Schalter:

```text
WERBUNG      [ AN ]  [ AUS ]
```

- AN: normale Werbeausspielung nach bestehender Logik.
- AUS: Werbung vollständig deaktiviert, unbegrenzt, ohne Countdown, bis der Admin sie wieder einschaltet.
- Für alle anderen Nutzer, Creator und Business-Konten bleibt die bestehende Werbepause unverändert.
- Keine Änderung an Werbeformaten, Targeting oder Abrechnung.

## Umsetzung

### 1. Datenbank (Migration)

- Neue Spalte `profiles.ads_enabled boolean not null default true` — persistenter Zustand, kein Ablauf, keine Zeitlogik.
- Schreibrecht ausschließlich für das eigene Profil (bestehende Selbst-Update-Policy) und zusätzlich im Schutz-Trigger `guard_profile_internal_fields` so behandelt, dass Nicht-Admins den Wert nicht verändern können. Damit ist der Schalter faktisch admin-exklusiv.
- `bootstrap_user_state()` liefert `ads_enabled` mit, damit kein zusätzlicher Request nötig ist.

### 2. Zustands-Kern

- `src/lib/ad-pause.ts` erhält einen zweiten, klar getrennten Baustein `useAdsEnabled(userId, isAdmin)`: liest den Wert, setzt ihn per Update, ohne Zeit- oder Kontingentlogik.
- Die bestehende `useAdPause`-Logik bleibt unangetastet (andere Nutzer behalten die 3 Pausen pro Monat).
- Neue abgeleitete Regel für die Ausspielung: Werbung ist aus, wenn `pause.active` **oder** (Admin **und** `ads_enabled === false`).

### 3. UI

- `src/components/AdFeed.tsx`: für Admins wird der Pausen-Block durch die Segment-Schaltung „WERBUNG · AN / AUS“ ersetzt (kein Countdown, keine Kontingentzeile). Nicht-Admins sehen exakt die heutige Werbepause.
- `src/components/AdSlider.tsx`: `adBreak` berücksichtigt zusätzlich den Admin-Schalter.
- Zusätzlich derselbe Schalter im Einstellungsbereich (`AccountSection`-Umgebung, nur für Admins sichtbar), damit er unabhängig vom Werbefeed erreichbar ist.
- Texte über die bestehenden i18n-Wörterbücher (DE/EN etc.).

### 4. Prüfung

- Admin: AUS → keine Werbung im Feed und im Slider, Zustand bleibt nach Reload und über Mitternacht hinaus bestehen. AN → Werbung wie zuvor.
- Nicht-Admin-Testkonto: Werbepause verhält sich unverändert (Kontingent 3, Countdown bis 24:00).
- Keine Änderung an `ad_campaigns`, Targeting oder Abrechnung.

## Technische Hinweise

- Kein Eintrag in `ad_pauses` mehr für den Admin-Schalter; die Tabelle bleibt für die reguläre Nutzer-Werbepause bestehen.
- Der Admin-Zustand ist ein einzelnes Boolean-Feld, dadurch kein Cron, kein Ablauf-Job, kein automatischer Reset.
