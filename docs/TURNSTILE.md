# Cloudflare Turnstile – Integration (Y-Dude)

## Überblick

Turnstile schützt alle öffentlichen Formulare. Die Prüfung erfolgt
**ausschließlich serverseitig**; ein Frontend-Bypass ist nicht möglich, weil
jede beteiligte Server-Funktion ohne gültiges Token abbricht, bevor irgendeine
Aktion ausgeführt wird.

| Bereich            | Server-Funktion                   | Datei                             |
| ------------------ | --------------------------------- | --------------------------------- |
| Notify Me          | `subscribeNewsletter`             | `src/lib/newsletter.functions.ts` |
| Login              | `signInWithCaptcha`               | `src/lib/auth.functions.ts`       |
| Registrierung      | `signUpWithCaptcha`               | `src/lib/auth.functions.ts`       |
| Passwort vergessen | `requestPasswordResetWithCaptcha` | `src/lib/auth.functions.ts`       |

Reihenfolge in jeder Funktion:

1. Eingaben validieren (zod, Token 10–4096 Zeichen – fehlendes Token = Abbruch)
2. `verifyTurnstileToken()` gegen `https://challenges.cloudflare.com/turnstile/v0/siteverify`
3. Erst danach: Account anlegen / anmelden / Reset-Mail / E-Mail speichern + Double-Opt-in

## Dateien

- `src/lib/turnstile.server.ts` – serverseitige Verifikation (liest den Secret Key aus der Umgebung, gibt nur `true`/`false` zurück, loggt Details nur serverseitig)
- `src/lib/turnstile.functions.ts` – `getTurnstileSiteKey` liefert den öffentlichen Site Key aus der Umgebung an den Client
- `src/lib/auth-public.server.ts` – serverseitiger Supabase-Client (publishable key) für Auth nach erfolgreicher Prüfung
- `src/lib/auth.functions.ts` – Login / Registrierung / Passwort-Reset mit vorgeschalteter Prüfung
- `src/components/Turnstile.tsx` – Widget (Managed Mode, `theme: dark`, `size: flexible`), Script wird **lazy** und nur einmal geladen, nur dort, wo ein Formular gerendert wird

## Environment Variables (Secrets)

| Name                              | Sichtbarkeit                    | Verwendung          |
| --------------------------------- | ------------------------------- | ------------------- |
| `CLOUDFLARE_TURNSTILE_SITE_KEY`   | öffentlich (nur über Server-Fn) | Rendern des Widgets |
| `CLOUDFLARE_TURNSTILE_SECRET_KEY` | **nur Server**                  | `siteverify`-Aufruf |

Hinterlegt sind beide Werte als Projekt-Secrets (Lovable Cloud → Secrets). Sie
stehen dem Server als `process.env[...]` zur Verfügung und werden **nirgendwo im
Quellcode** gespeichert. Der Secret Key wird nie an den Client übertragen; er
kommt ausschließlich in `turnstile.server.ts` vor.

## Fehlerbehandlung

- Kein/abgelaufenes Token → Submit-Button bleibt deaktiviert, Meldung
  „Bitte bestätige die Sicherheitsprüfung und versuche es erneut.“
- Serverseitige Ablehnung (`status: "captcha"`) → Widget wird zurückgesetzt,
  neuer Versuch sofort möglich
- Es werden keine technischen Details, Cloudflare-Fehlercodes oder interne
  Informationen im UI angezeigt; sie landen nur im Server-Log.

## Performance

- Script nur bei gerenderten Formularen, `async`/`defer`, `render=explicit`
- Site Key wird pro Browser-Session einmal geholt und gecacht
- Feste Mindesthöhe (65 px) im Container → keine Layoutverschiebung

## Betrieb

Damit das Widget rendert, müssen im Cloudflare-Dashboard die Hostnames des
Widgets gepflegt sein (`y-dude.com`, `www.y-dude.com`, Preview-Domains sowie
`localhost` für lokale Tests). Ohne passenden Hostname liefert Cloudflare
`400` und das Widget bleibt leer – die Server-Prüfung schlägt dann korrekt fehl
und das Formular wird nicht verarbeitet.
