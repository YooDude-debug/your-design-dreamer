# Backend-Optimierung und Nachmessung (15.08.2026)

Grundlage: Lasttest vom 15.08.2026 (250/500/750 gleichzeitige Nutzer, identisches
Testskript, identischer Routen-Mix, 45 s je Stufe, 15 s Abkühlphase, lokale Instanz).
Es wurde keine Funktion, kein Design und keine Datenlogik geändert.

## 1. Priorität A – Ursache des „256er-Deckels"

**Ergebnis: Der Deckel lag nicht am Server, sondern am Testclient.**

Der Lasttest läuft mit Bun-`fetch`. Bun begrenzt gleichzeitige HTTP-Anfragen pro
Prozess standardmäßig auf **256** (`BUN_CONFIG_MAX_HTTP_REQUESTS`). Der gemessene
Wert „256 gleichzeitig verarbeitete Requests" war also die Obergrenze des
Messwerkzeugs, nicht des Servers.

Gegenprobe (Burst gegen `/impressum`, gemessen über `/api/public/cache-metrics`):

| Client-Limit   | Burst | gleichzeitig auf dem Server |
| -------------- | ----- | --------------------------- |
| 256 (Standard) | 800   | 154                         |
| 2048           | 800   | 201                         |
| 2048           | 1200  | **510**                     |

Damit ist belegt: Die Instanz verarbeitet nachweislich über 500 Anfragen
gleichzeitig. Es gibt keinen konfigurierten Deckel bei 256 – weder in
`src/server.ts`, noch in der Vite/Nitro-Konfiguration, noch in einer eigenen
Request-Queue. Der Event-Loop-Lag lag durchgehend bei 1–2 ms, die Instanz war
also nie blockiert. **Es wurde deshalb kein Limit „erhöht"** – es existierte keines.

Was oberhalb ~250 Nutzern tatsächlich passiert: Jede Anfrage wartet länger, weil
die _Arbeit pro Anfrage_ (SSR-Rendering) die Grenze setzt, nicht die Anzahl
gleichzeitiger Verbindungen. Deshalb zielten alle Optimierungen darauf, Arbeit
pro Anfrage zu vermeiden.

## 2. Priorität A – Vier häufige Sitzungsabfragen gebündelt

Neue Datenbankfunktion `feed_viewer_context()` (`STABLE SECURITY DEFINER`,
`EXECUTE` nur für `authenticated`/`service_role`, liest ausschließlich
`auth.uid()`). Sie liefert in **einem** Aufruf:

- `ad_preferences.interests`
- `profiles.location` / `profiles.language`
- `follows`
- `feed_learned_weights`
- `hashtag_follows` (inkl. Hashtag-Namen)
- `connections` (bestätigt, beide Richtungen)

`loadViewerContext()` in `src/lib/feed-ranking/engine.server.ts` nutzt jetzt
diesen einen Aufruf statt sechs Einzelabfragen: **6 → 1 Round Trip**.
Schlägt der Aufruf fehl, greift unverändert der bisherige Einzelweg (Fallback),
die Rückgabewerte sind feldgleich. Die Trendliste (`trending_hashtags`) ist für
alle Betrachter identisch und wird zusätzlich 60 s zwischengespeichert.

## 3. Priorität A – HTTP-Caching für öffentliche GET-Routen

Neu: `src/lib/http-cache.server.ts`, eingebunden in `src/server.ts`.

Freigegebene Pfade und Gültigkeit: `/` 60 s, `/auth` 300 s,
`/reset-password` 300 s, `/agb` `/datenschutz` `/impressum` `/richtlinien`
je 3600 s. Antworten erhalten
`cache-control: public, max-age=0, s-maxage=<ttl>, stale-while-revalidate=<ttl>`
und werden zusätzlich kurz in der Instanz gehalten (kein erneutes SSR).

**Sicherheitsregeln (streng, mehrfach geprüft):**

- Gecacht wird nur bei `GET`, Status 200 und **ohne jeden Cookie und ohne
  `Authorization`-Kopfzeile**. Sobald eine Sitzung mitkommt, wird die Antwort
  frisch gerendert, nicht gecacht und ohne Cache-Kopfzeile ausgeliefert
  (verifiziert: Anfrage mit `cookie:` erhält weder `cache-control` noch
  `x-ydude-cache`).
- Jede gecachte Antwort trägt `Vary: Cookie, Authorization`.
- Antworten mit `set-cookie` werden nie gespeichert.
- Nicht freigegeben und damit unverändert dynamisch: Feed, Profile, Messenger,
  Beiträge, `/admin/*`, alle `/api/*`-Routen, alles unter `_authenticated`.

Damit ist ausgeschlossen, dass Nutzer A gecachte Daten von Nutzer B erhält.

## 4. Priorität A – Stammdaten-Cache

Selten veränderte, öffentliche Stammdaten leben länger im bestehenden Cache:
Interest-Engine-Konfiguration 300 → **900 s**, Interest-Kategorien
600 → **3600 s**. Personenbezogene Daten bleiben ungecacht. Es wurde keine
zusätzliche Invalidierung eingebaut; die bestehenden gezielten Invalidierungen
bleiben unverändert.

## 5. Priorität B – SSR reduziert

Die Rechtsseiten und die Startseite werden für anonyme Besucher nicht mehr je
Anfrage neu gerendert (siehe Punkt 3). Messbarer Effekt: `/` fiel bei 250
Nutzern von durchschnittlich ~700 ms auf **42 ms**. Ein echtes Prerendering in
statische Dateien wurde nicht eingeführt, weil die Seiten Sprachumschaltung und
gemeinsames Layout nutzen – der Instanz-Cache erreicht denselben Effekt ohne
Funktionsänderung.

## 6. Priorität B – Cloud-/Instanz-Skalierung

- **Limitierender Faktor:** SSR-Rechenzeit pro Anfrage (CPU), nicht Parallelität,
  nicht die Datenbank, nicht der Verbindungspool. Belege: Event-Loop-Lag 1–2 ms,
  3 DB-Abfragen je Laststufe, RAM stabil, 0 Fehler.
- **Was eine größere Instanz bringt:** mehr CPU ⇒ mehr SSR-Renderings pro
  Sekunde ⇒ höherer Durchsatz und niedrigere Wartezeit oberhalb 500 Nutzern.
  Sinnvoll erst, wenn dauerhaft > 800 Req/s dynamischer Inhalte anfallen.
- **Innerhalb Lovable möglich:** die Größe der Cloud-Instanz erhöhen
  (Projekt → Backend → Advanced settings → Upgrade instance). Das kann bei
  Bedarf auch direkt im Chat angestoßen werden.
- **Innerhalb Lovable nicht konfigurierbar (ausdrücklich):** Anzahl der Worker,
  Thread-/Concurrency-Limits pro Instanz, Keep-Alive-Grenzen, horizontale
  Instanzen und Load-Balancer-Regeln. Diese Werte werden von der Plattform
  verwaltet und können hier nicht gesetzt werden.
- **Kosten/Risiko:** eine größere Instanz erhöht die Cloud-Nutzung (Abrechnung
  über den Plan); die Umstellung dauert einige Minuten mit möglicher kurzer
  Unterbrechung. Aktuell **nicht erforderlich** – die Optimierungen haben den
  Bedarf ohne Aufpreis gedeckt.

## 7. Datenbank

Keine Migration am Datenmodell, keine Änderung am Verbindungspool, keine
Vergrößerung. Ergänzt wurde ausschließlich die lesende Bündelfunktion
`feed_viewer_context()`. DB-Abfragen im Test unverändert bei 3 je Laststufe
(alles übrige aus dem Cache).

## 8. Messung vorher/nachher (identische Bedingungen)

| Nutzer | Messwert      | vorher 15.08.  | nachher           | Änderung          |
| ------ | ------------- | -------------- | ----------------- | ----------------- |
| 250    | Req/s         | 329,8          | **789,7**         | +139,5 %          |
| 250    | Ø Antwortzeit | 755 ms         | **315 ms**        | −58,3 %           |
| 250    | p50 / p90     | 838 / 1015 ms  | **313 / 613 ms**  | −62,6 % / −39,6 % |
| 250    | p95           | 1423 ms        | **664 ms**        | −53,3 %           |
| 250    | p99           | 3642 ms        | **859 ms**        | −76,4 %           |
| 250    | Maximum       | 14 621 ms      | **8055 ms**       | −44,9 %           |
| 500    | Req/s         | 329,3          | **868,7**         | +163,8 %          |
| 500    | Ø Antwortzeit | 1498 ms        | **573 ms**        | −61,7 %           |
| 500    | p50 / p90     | 1347 / 2104 ms | **571 / 837 ms**  | −57,6 % / −60,2 % |
| 500    | p95           | 2301 ms        | **909 ms**        | −60,5 %           |
| 500    | p99           | 2892 ms        | **1051 ms**       | −63,7 %           |
| 500    | Maximum       | 12 498 ms      | **3289 ms**       | −73,7 %           |
| 750    | Req/s         | 316,2          | **790,0**         | +149,8 %          |
| 750    | Ø Antwortzeit | 2328 ms        | **942 ms**        | −59,5 %           |
| 750    | p50 / p90     | 2202 / 2981 ms | **967 / 1204 ms** | −56,1 % / −59,6 % |
| 750    | p95           | 3115 ms        | **1309 ms**       | −58,0 %           |
| 750    | p99           | 3797 ms        | **1478 ms**       | −61,1 %           |
| 750    | Maximum       | 14 772 ms      | **3282 ms**       | −77,8 %           |

Alle Stufen: **0 Fehler, 0 Timeouts, 0 DB-Fehler** (vorher und nachher).

Weitere Kennzahlen (nachher, gleiche Bedingungen):

| Nutzer | Requests | gleichzeitig | Serverzeit Ø | Event-Loop-Lag | RSS     | CPU (User, 45 s) | Cache-Treffer | DB-Abfragen |
| ------ | -------- | ------------ | ------------ | -------------- | ------- | ---------------- | ------------- | ----------- |
| 250    | 35 827   | 192          | 179 ms       | 1 ms           | 2344 MB | 51,2 s           | 14 365        | 3           |
| 500    | 39 467   | 192          | 157 ms       | 2 ms           | 2339 MB | 48,3 s           | 13 881        | 3           |
| 750    | 36 301   | 198          | 148 ms       | 2 ms           | 2344 MB | 48,2 s           | 14 042        | 3           |

Cache-Trefferquote des Server-Caches weiterhin > 99,9 %; zusätzlich greift der
neue HTTP-/SSR-Cache für die öffentlichen Seiten.

## 9. Erfolgskriterien

| Frage                                                    | Antwort                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wird bei 500/750 mehr gleichzeitig verarbeitet?          | Der alte Wert 256 war eine Grenze des Testclients. Mit angehobenem Client-Limit wurden **510 gleichzeitige Anfragen** auf dem Server gemessen. Unter Last liegt der Wert jetzt bei 192–198, **weil** jede Anfrage schneller fertig ist – nicht wegen einer Grenze. |
| Steigt der Durchsatz über das Plateau von 316–330 Req/s? | Ja: **790–869 Req/s**, Maximum im Zusatzlauf **900,7 Req/s**.                                                                                                                                                                                                      |
| Sinkt p95 bei 500 und 750?                               | Ja: 2301 → 909 ms und 3115 → 1309 ms.                                                                                                                                                                                                                              |
| Bleibt die Fehlerquote bei 0 %?                          | Ja, in allen drei Stufen des Vergleichslaufs.                                                                                                                                                                                                                      |

### Zusatzlauf mit angehobenem Client-Limit (4096)

| Nutzer | Req/s | Ø      | p95     | p99       | gleichzeitig | Fehler/Timeouts |
| ------ | ----- | ------ | ------- | --------- | ------------ | --------------- |
| 250    | 827,6 | 301 ms | 651 ms  | 732 ms    | 198          | 0 / 0           |
| 500    | 900,7 | 553 ms | 968 ms  | 1100 ms   | 241          | 0 / 0           |
| 750    | 876,0 | 796 ms | 1277 ms | 11 026 ms | 248          | 116 / 116       |

Ehrliche Einordnung: Bei 750 Nutzern **und** entfesseltem Client traten 116
Timeouts auf (0,3 %) und p99 brach ein. Mehr Parallelität bringt oberhalb ~900
Req/s also keinen Gewinn mehr, sondern erzeugt eine Warteschlange. Der Engpass
ist ab dort die SSR-Rechenzeit.

## 10. Fazit

- **Wirksam:** HTTP-/SSR-Cache für öffentliche Seiten (größter Effekt),
  Bündelung der Sitzungsabfragen (6 → 1), längere Stammdaten-Gültigkeit.
- **Neuer stabiler Lastbereich:** bis 750 gleichzeitige Nutzer fehlerfrei bei
  ~790–870 Req/s und p95 ≤ 1,3 s.
- **Neuer maximal gemessener Durchsatz:** 900,7 Req/s.
- **Neuer Engpass:** SSR-Rechenzeit pro dynamischer Anfrage (CPU). Datenbank,
  Verbindungspool, RAM und Event-Loop sind weiterhin unauffällig.
- **Ohne messbaren Effekt:** die Anhebung des Client-Parallelitätslimits – sie
  erhöht nur die Wartezeit. Am Server gibt es nichts zu „entdeckeln".
- **Noch sinnvoll:** dynamische Ansichten weiter entlasten (weniger SSR-Arbeit
  pro Feed-Anfrage), Bilder/Medien über CDN-Cache, danach größere Instanz.
- **Externe Infrastruktur** wird erst interessant, wenn dauerhaft > 1000 Req/s
  dynamischer Inhalte anfallen oder mehrere Regionen bedient werden sollen.

Rohdaten: `/tmp/loadtest/results-before-2026-08-15.json`,
`results-after-same.json`, `results-after-pool.json`.
