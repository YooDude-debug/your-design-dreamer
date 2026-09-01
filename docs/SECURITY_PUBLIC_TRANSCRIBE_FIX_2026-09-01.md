# Security / Kostenschutz – öffentlicher Transkriptions-Endpoint (2026-09-01)

## Root Cause

`transcribeTestRecording` (`src/lib/public-transcribe.functions.ts`) war ein
unauthentifizierter Server-Endpoint ohne Captcha-Prüfung und ohne Rate Limit.
Jeder Request wurde direkt an die kostenpflichtige Lovable-AI-Transkription
(`openai/gpt-4o-mini-transcribe`) weitergeleitet. Ein Skript konnte damit
beliebig viele bezahlte API-Aufrufe auf Kosten von Y-Dude auslösen.

## Abhängigkeit

Genutzt ausschließlich vom öffentlichen SlangTag Tester der Landingpage
(`src/components/landing/SlangTagTester.tsx`). Der Endpoint ist für nicht
eingeloggte Besucher fachlich erforderlich → **kein Entfernen**, sondern
Absicherung. Der eingeloggte Messenger nutzt `transcribeChatRecording`
(`src/lib/translate.functions.ts`) und ist bereits per
`requireSupabaseAuth` geschützt.

## Vorher vorhanden

- Format-Allowlist (wav/webm/mp4/mp3)
- Mindestgröße 1 KB, Maximalgröße 4 MB
- Zod-Längenlimit auf der Data-URL
- API-Key ausschließlich serverseitig (`process.env["LOVABLE_API_KEY"]`)

## Änderungen

1. `src/lib/public-transcribe.functions.ts`
   - `captchaToken` ist jetzt Pflichtfeld (10–4096 Zeichen, Zod).
   - Serverseitige Turnstile-Prüfung über `verifyTurnstileToken()` (fail-closed).
   - Rate Limit pro Client-IP: max. **8 Transkriptionen / 10 Minuten**.
   - Reihenfolge: Rate Limit → Captcha → externer Aufruf. Kein Pfad erreicht
     die bezahlte API ohne bestandene Prüfungen.
2. `src/lib/ip-rate-limit.server.ts` (neu)
   - Wiederverwendbares In-Memory-Sliding-Window pro IP/Scope, ohne
     zusätzliche Tabelle; ergänzt den bestehenden DB-basierten
     `checkRateLimit` (der User-IDs braucht und hier nicht anwendbar ist).
3. `src/lib/public-transcribe.server.ts`
   - Maximalgröße auf **2 MB** reduziert.
   - Neue Dauerprüfung `audioSeconds()` (WAV-Header exakt, sonst konservative
     Bitratenschätzung), harte Obergrenze **15 s**.
   - Externer Aufruf mit `AbortSignal.timeout(20s)`, genau ein Aufruf, kein
     Retry.
   - Fehlerdetails der Gateway-Antwort nur noch im Server-Log, nicht mehr in
     der an den Client propagierten Fehlermeldung.
4. `src/components/landing/SlangTagTester.tsx`
   - Rendert das bestehende `Turnstile`-Widget und sendet das Token mit.
   - Nach jeder Transkription `captcha.reset()` (Tokens sind einmalig).

## Warum jetzt geschützt

- Ohne gültiges, von Cloudflare bestätigtes Token gibt es keinen Codepfad zur
  bezahlten API (fehlender Secret Key, Netzwerkfehler, kurzes/leeres Token →
  `false`).
- Pro IP sind Aufrufe hart begrenzt; pro Request ist genau ein externer
  Aufruf möglich, mit Timeout und ohne Wiederholungen.
- Größe, Dauer und Format werden vor dem Aufruf geprüft.
- Der API-Key bleibt serverseitig, wird nicht geloggt und nie zurückgegeben.

## Tests

`tests/public-transcribe-guard.test.ts` (9 Tests):

- Rate Limit greift nach N Requests, Buckets pro IP getrennt, Fenster öffnet wieder
- ungültiges Format, kaputte Data-URL, zu große Datei, zu lange Audiodatei → abgelehnt
- gültige kurze Aufnahme → akzeptiert
- Gateway-Fehler → genau ein `fetch`, kein Retry, generische Fehlermeldung
- fehlender API-Key → kein Request

Captcha-Fehlerfälle sind weiterhin durch `tests/turnstile-verify.test.ts` und
`tests/captcha-gate.test.ts` abgedeckt. Gesamtsuite: **569/569 grün**,
Typecheck ✅.

## Weitere öffentliche KI-Endpunkte

Projektweite Prüfung auf `ai.gateway.lovable.dev`:
`content-moderation.server.ts`, `moderation.server.ts`, `translate.server.ts`
werden ausschließlich von Server-Funktionen mit `requireSupabaseAuth`
aufgerufen. `public-transcribe` war der einzige öffentliche bezahlte Pfad.
