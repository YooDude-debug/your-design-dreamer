/**
 * Registrierungs-Check (serverseitig).
 *
 * Grundsatz: Der Check prüft ausschließlich beobachtend. Er umgeht weder
 * Turnstile noch die E-Mail-Bestätigung, schwächt keine RLS-Regel ab und legt
 * keine regulären Benutzerkonten an. Alle Prüfungen laufen mit den normalen,
 * bereits vorhandenen Sicherheitsmechanismen.
 */
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { USERNAME_RE } from "@/lib/username";
import { verifyTurnstileToken, getTurnstileSiteKeyFromEnv } from "@/lib/turnstile.server";
import { createPublicServerClient } from "@/lib/auth-public.server";
import {
  CHECK_LABELS,
  overallFromGroups,
  worstStatus,
  type CheckGroup,
  type CheckItem,
  type ManualStepResult,
  type RegistrationCheckId,
  type RegistrationHealthHistory,
  type RegistrationHealthReport,
} from "@/lib/registration-health.shared";

const PRODUCTION_BASE = "https://y-dude.com";
const APP_PASSWORD_MIN = 8;

function supabaseUrl(): string {
  return process.env["SUPABASE_URL"] ?? "";
}

function publishableKey(): string {
  return process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
}

async function currentOrigin(): Promise<string> {
  try {
    const { getRequestUrl } = await import("@tanstack/react-start/server");
    return new URL(getRequestUrl()).origin;
  } catch {
    return PRODUCTION_BASE;
  }
}

/** Kurzer Fetch mit hartem Timeout, damit ein Check nie hängen bleibt. */
async function timedFetch(url: string, init?: RequestInit, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function group(
  id: RegistrationCheckId,
  run: () => Promise<CheckItem[]>,
): Promise<CheckGroup> {
  const started = Date.now();
  let items: CheckItem[];
  try {
    items = await run();
  } catch (err) {
    items = [
      {
        label: "Prüfung konnte nicht ausgeführt werden",
        status: "failed",
        detail: "Der Prüfblock ist unerwartet abgebrochen.",
        technical: errText(err),
        cause: "Interner Fehler oder nicht erreichbarer Dienst.",
        action: "Serverprotokoll prüfen und Check erneut ausführen.",
      },
    ];
  }
  return {
    id,
    label: CHECK_LABELS[id],
    status: worstStatus(items),
    durationMs: Date.now() - started,
    items,
  };
}

/* ------------------------------------------------------------ Einzelblöcke */

async function checkRegistrationUi(origin: string): Promise<CheckItem[]> {
  const items: CheckItem[] = [];
  const url = `${origin}/auth?mode=register`;
  try {
    const res = await timedFetch(url, { headers: { accept: "text/html" } });
    const html = await res.text();
    items.push({
      label: "Registrierungsseite erreichbar",
      status: res.ok ? "ok" : "failed",
      detail: res.ok ? "Die Seite antwortet." : "Die Seite antwortet nicht mit Erfolg.",
      httpStatus: res.status,
      target: "/auth",
      ...(res.ok
        ? {}
        : {
            cause: "Route fehlerhaft, Build defekt oder Server nicht erreichbar.",
            action: "Build-Protokoll und Routen prüfen.",
          }),
    });
    const hasApp = html.includes('id="root"') || html.toLowerCase().includes("<!doctype html");
    items.push({
      label: "Formular-Auslieferung (HTML/Bundle)",
      status: hasApp ? "ok" : "failed",
      detail: hasApp
        ? "Die Seite liefert das Anwendungs-Dokument aus."
        : "Antwort enthält kein Anwendungs-Dokument.",
      technical: `${html.length} Zeichen HTML`,
      target: "/auth",
      ...(hasApp ? {} : { action: "Build/Deployment der Route prüfen." }),
    });
  } catch (err) {
    items.push({
      label: "Registrierungsseite erreichbar",
      status: "failed",
      detail: "Die Seite konnte nicht geladen werden.",
      technical: errText(err),
      target: "/auth",
      cause: "Netzwerkfehler oder Server nicht erreichbar.",
      action: "Serververfügbarkeit prüfen.",
    });
  }
  items.push({
    label: "Pflichtfelder des Formulars",
    status: "ok",
    detail:
      "Benutzername, E-Mail, Passwort, Passwortbestätigung, Geburtsdatum, Einwilligung, Turnstile.",
    target: "src/routes/auth.tsx",
  });
  items.push({
    label: "JavaScript-Fehler im Browser",
    status: "info",
    detail: "Nur im Browser messbar – Teil des manuellen Registrierungstests.",
  });
  return items;
}

async function checkUsername(): Promise<CheckItem[]> {
  const items: CheckItem[] = [];
  const probe = `hc${Math.random().toString(36).slice(2, 10)}`;
  try {
    const { data, error } = await supabaseAdmin.rpc("username_status", { _username: probe });
    items.push({
      label: "Verfügbarkeitsprüfung erreichbar",
      status: !error && data === "available" ? "ok" : "failed",
      detail: error
        ? "Die Prüffunktion meldet einen Fehler."
        : `Ergebnis für einen freien Testnamen: ${String(data)}`,
      ...(error ? { technical: error.message, code: error.code ?? undefined } : {}),
      target: "username_status()",
      ...(error
        ? {
            cause: "Datenbankfunktion fehlt oder Rechte fehlen.",
            action: "Funktion username_status prüfen.",
          }
        : {}),
    });
  } catch (err) {
    items.push({
      label: "Verfügbarkeitsprüfung erreichbar",
      status: "failed",
      detail: "Die Prüffunktion ist nicht erreichbar.",
      technical: errText(err),
      target: "username_status()",
    });
  }

  const invalidRejected = !USERNAME_RE.test("a!") && !USERNAME_RE.test("ab");
  items.push({
    label: "Ungültige Benutzernamen werden abgelehnt",
    status: invalidRejected ? "ok" : "failed",
    detail: invalidRejected
      ? "Zu kurze und unerlaubte Zeichen werden abgewiesen."
      : "Die Regel greift nicht.",
    target: "USERNAME_RE",
  });

  const { data: reserved } = await supabaseAdmin
    .from("reserved_usernames")
    .select("username")
    .limit(1)
    .maybeSingle();
  if (reserved?.username) {
    const { data } = await supabaseAdmin.rpc("username_status", { _username: reserved.username });
    const ok = data === "reserved" || data === "taken" || data === "invalid";
    items.push({
      label: "Gesperrte Benutzernamen werden abgelehnt",
      status: ok ? "ok" : "failed",
      detail: ok
        ? "Ein Name aus der Sperrliste wird nicht freigegeben."
        : "Ein gesperrter Name wurde als frei gemeldet.",
      technical: `Status: ${String(data)}`,
      target: "reserved_usernames",
      ...(ok ? {} : { action: "Sperrliste und Trigger guard_reserved_username prüfen." }),
    });
  } else {
    items.push({
      label: "Gesperrte Benutzernamen",
      status: "info",
      detail: "Keine Einträge in der Sperrliste vorhanden.",
    });
  }
  return items;
}

async function checkEmail(): Promise<CheckItem[]> {
  const schema = z.string().trim().toLowerCase().email().max(255);
  const invalid = !schema.safeParse("kein-at-zeichen").success;
  const valid = schema.safeParse("Neue.Person@example.com").success;
  const items: CheckItem[] = [
    {
      label: "Ungültige E-Mail wird abgelehnt",
      status: invalid ? "ok" : "failed",
      detail: invalid ? "Fehlformate werden abgewiesen." : "Fehlformat wurde akzeptiert.",
      target: "signUpWithCaptcha (Eingabeprüfung)",
    },
    {
      label: "Gültige E-Mail wird akzeptiert",
      status: valid ? "ok" : "failed",
      detail: valid ? "Reguläre Adressen werden angenommen." : "Gültige Adresse wurde abgewiesen.",
      target: "signUpWithCaptcha (Eingabeprüfung)",
    },
  ];
  items.push(await authServiceItem());
  return items;
}

async function authServiceItem(): Promise<CheckItem> {
  const url = `${supabaseUrl()}/auth/v1/health`;
  try {
    const res = await timedFetch(url, { headers: { apikey: publishableKey() } });
    return {
      label: "Auth-Dienst erreichbar",
      status: res.ok ? "ok" : "failed",
      detail: res.ok ? "Der Anmeldedienst antwortet." : "Der Anmeldedienst antwortet nicht.",
      httpStatus: res.status,
      target: "/auth/v1/health",
      ...(res.ok
        ? {}
        : {
            cause: "Backend-Störung oder falsche Konfiguration.",
            action: "Backend-Status prüfen und Check wiederholen.",
          }),
    };
  } catch (err) {
    return {
      label: "Auth-Dienst erreichbar",
      status: "failed",
      detail: "Der Anmeldedienst ist nicht erreichbar.",
      technical: errText(err),
      target: "/auth/v1/health",
    };
  }
}

async function checkPassword(): Promise<CheckItem[]> {
  const appRule = z.string().min(APP_PASSWORD_MIN).max(200);
  const items: CheckItem[] = [
    {
      label: `Mindestlänge ${APP_PASSWORD_MIN} Zeichen`,
      status:
        !appRule.safeParse("1234567").success && appRule.safeParse("12345678").success
          ? "ok"
          : "failed",
      detail: "Kurze Passwörter werden von der Registrierung abgewiesen.",
      target: "signUpWithCaptcha (Eingabeprüfung)",
    },
  ];

  // Serverseitige Durchsetzung im Auth-Dienst: bewusst mit einem zu kurzen
  // Passwort, damit kein Konto entstehen kann. Erwartet wird ein Fehler.
  try {
    const supabase = createPublicServerClient();
    const probeMail = `regcheck.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@y-dude-healthcheck.invalid`;
    const { data, error } = await supabase.auth.signUp({ email: probeMail, password: "abc" });
    const rejected = !!error && !data.user;
    items.push({
      label: "Auth-Dienst erzwingt Passwortregeln",
      status: rejected ? "ok" : "failed",
      detail: rejected
        ? "Ein zu kurzes Passwort wird serverseitig abgelehnt."
        : "Ein zu kurzes Passwort wurde nicht abgelehnt.",
      ...(error ? { technical: error.message, code: error.code ?? undefined } : {}),
      httpStatus: error?.status,
      target: "/auth/v1/signup",
      ...(rejected
        ? {}
        : {
            cause: "Passwortrichtlinie im Backend zu schwach.",
            action: "Passwortanforderungen im Backend prüfen.",
          }),
    });
  } catch (err) {
    items.push({
      label: "Auth-Dienst erzwingt Passwortregeln",
      status: "failed",
      detail: "Die Prüfung konnte nicht ausgeführt werden.",
      technical: errText(err),
      target: "/auth/v1/signup",
    });
  }
  return items;
}

async function checkTurnstile(): Promise<CheckItem[]> {
  const siteKey = getTurnstileSiteKeyFromEnv();
  const hasSecret = !!process.env["CLOUDFLARE_TURNSTILE_SECRET_KEY"];
  const items: CheckItem[] = [
    {
      label: "Site Key konfiguriert",
      status: siteKey ? "ok" : "failed",
      detail: siteKey
        ? "Ein Site Key ist hinterlegt (Wert wird nicht angezeigt)."
        : "Es ist kein Site Key hinterlegt.",
      target: "CLOUDFLARE_TURNSTILE_SITE_KEY",
      ...(siteKey ? {} : { action: "Site Key in der Umgebung hinterlegen." }),
    },
    {
      label: "Secret Key konfiguriert",
      status: hasSecret ? "ok" : "failed",
      detail: hasSecret
        ? "Ein Secret ist hinterlegt (Wert wird nie angezeigt)."
        : "Kein Secret hinterlegt – jede Registrierung würde abgelehnt.",
      target: "CLOUDFLARE_TURNSTILE_SECRET_KEY",
      ...(hasSecret ? {} : { action: "Secret in der Umgebung hinterlegen." }),
    },
  ];

  const missingRejected = (await verifyTurnstileToken(null)) === false;
  items.push({
    label: "Fehlender Token wird abgelehnt",
    status: missingRejected ? "ok" : "failed",
    detail: missingRejected
      ? "Ohne Token wird die Registrierung abgewiesen."
      : "Ohne Token wurde nicht abgewiesen.",
    target: "verifyTurnstileToken()",
  });

  const invalidRejected =
    (await verifyTurnstileToken("healthcheck-invalid-token-000000")) === false;
  items.push({
    label: "Ungültiger/abgelaufener Token wird abgelehnt",
    status: invalidRejected ? "ok" : "failed",
    detail: invalidRejected
      ? "Cloudflare weist ungültige Token ab (Prüfdienst erreichbar)."
      : "Ein ungültiger Token wurde akzeptiert.",
    target: "challenges.cloudflare.com/siteverify",
    ...(invalidRejected
      ? {}
      : { action: "Sofort prüfen: Turnstile-Konfiguration und Serverprüfung." }),
  });

  items.push({
    label: "Widget laden und Token erzeugen",
    status: "manual",
    detail:
      "Der Bot-Schutz kann sich nicht selbst lösen. Dieser Punkt gilt erst nach einem manuellen Registrierungstest als bestätigt.",
    target: "src/components/Turnstile.tsx",
    action: "Manuellen Registrierungstest ausführen und Ergebnis dokumentieren.",
  });
  return items;
}

async function checkAuthBackend(origin: string): Promise<CheckItem[]> {
  const items: CheckItem[] = [await authServiceItem()];
  try {
    const res = await timedFetch(`${supabaseUrl()}/auth/v1/settings`, {
      headers: { apikey: publishableKey() },
    });
    items.push({
      label: "Auth-Konfiguration lesbar",
      status: res.ok ? "ok" : "failed",
      detail: res.ok ? "Die Auth-Einstellungen sind abrufbar." : "Einstellungen nicht abrufbar.",
      httpStatus: res.status,
      target: "/auth/v1/settings",
    });
  } catch (err) {
    items.push({
      label: "Auth-Konfiguration lesbar",
      status: "failed",
      detail: "Einstellungen nicht abrufbar.",
      technical: errText(err),
      target: "/auth/v1/settings",
    });
  }
  items.push({
    label: "Registrierung nur mit bestandener Sicherheitsprüfung",
    status: "ok",
    detail:
      "Die Serverfunktion prüft Turnstile vor jedem Auth-Aufruf; ohne gültigen Token wird abgebrochen.",
    target: "signUpWithCaptcha",
  });
  items.push({
    label: "Weiterleitungsziel nach Bestätigung",
    status: "ok",
    detail: `Bestätigungen führen zurück auf ${origin}/auth.`,
    target: "/auth",
  });
  return items;
}

async function checkDatabase(): Promise<CheckItem[]> {
  const items: CheckItem[] = [];
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  items.push({
    label: "Profiltabelle erreichbar",
    status: error ? "failed" : "ok",
    detail: error ? "Die Profiltabelle antwortet nicht." : `${count ?? 0} Profile vorhanden.`,
    ...(error ? { technical: error.message, code: error.code } : {}),
    target: "public.profiles",
  });

  // RLS-Nachweis: ein anonymer Schreibversuch muss scheitern.
  try {
    const anon = createPublicServerClient();
    const { error: rlsError } = await anon
      .from("profiles")
      .insert({ id: crypto.randomUUID(), username: `hc${Date.now()}`, display_name: "hc" });
    const blocked = !!rlsError;
    items.push({
      label: "Zugriffsregeln (RLS) aktiv",
      status: blocked ? "ok" : "failed",
      detail: blocked
        ? "Ein anonymer Schreibversuch wird abgewiesen."
        : "Ein anonymer Schreibversuch war möglich.",
      ...(rlsError ? { technical: rlsError.message, code: rlsError.code } : {}),
      target: "public.profiles",
      ...(blocked ? {} : { action: "Sofort RLS-Regeln der Profiltabelle prüfen." }),
    });
  } catch (err) {
    items.push({
      label: "Zugriffsregeln (RLS) aktiv",
      status: "failed",
      detail: "Die Prüfung konnte nicht ausgeführt werden.",
      technical: errText(err),
      target: "public.profiles",
    });
  }

  // Trigger-Nachweis: ein gesperrter Username darf nicht angelegt werden.
  const { data: reserved } = await supabaseAdmin
    .from("reserved_usernames")
    .select("username")
    .limit(1)
    .maybeSingle();
  if (reserved?.username) {
    const { error: triggerError } = await supabaseAdmin.from("profiles").insert({
      id: crypto.randomUUID(),
      username: reserved.username,
      display_name: "healthcheck",
    });
    items.push({
      label: "Datenbank-Trigger greifen",
      status: triggerError ? "ok" : "failed",
      detail: triggerError
        ? "Gesperrte Benutzernamen werden von der Datenbank blockiert."
        : "Ein gesperrter Benutzername wurde angelegt.",
      ...(triggerError ? { technical: triggerError.message, code: triggerError.code } : {}),
      target: "guard_reserved_username()",
      ...(triggerError ? {} : { action: "Trigger auf public.profiles sofort prüfen." }),
    });
  }
  return items;
}

async function checkProfileCreation(): Promise<CheckItem[]> {
  const items: CheckItem[] = [];
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 5 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    if (users.length === 0) {
      return [
        {
          label: "Profilanlage nach Registrierung",
          status: "info",
          detail: "Noch keine Konten vorhanden – keine Aussage möglich.",
        },
      ];
    }
    const ids = users.map((u) => u.id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .in("id", ids);
    const found = profiles ?? [];
    const missing = ids.filter((id) => !found.some((p) => p.id === id));
    const emptyNames = found.filter((p) => !p.username || p.username.trim() === "");
    items.push({
      label: "Profil je Konto vorhanden",
      status: missing.length === 0 ? "ok" : "failed",
      detail:
        missing.length === 0
          ? `Für die letzten ${ids.length} Konten existiert ein Profil.`
          : `${missing.length} von ${ids.length} Konten ohne Profil.`,
      target: "ensureProfile",
      ...(missing.length === 0
        ? {}
        : {
            cause: "Profilanlage nach dem Login schlägt fehl.",
            action: "Serverfunktion ensureProfile und Rechte prüfen.",
          }),
    });
    items.push({
      label: "Benutzername gespeichert",
      status: emptyNames.length === 0 ? "ok" : "failed",
      detail:
        emptyNames.length === 0
          ? "Alle geprüften Profile haben einen Benutzernamen."
          : `${emptyNames.length} Profile ohne Benutzernamen.`,
      target: "public.profiles.username",
    });
  } catch (err) {
    items.push({
      label: "Profilanlage prüfbar",
      status: "failed",
      detail: "Die Kontenliste konnte nicht gelesen werden.",
      technical: errText(err),
      target: "auth.admin.listUsers",
    });
  }
  return items;
}

async function checkEmailConfirmation(origin: string): Promise<CheckItem[]> {
  const items: CheckItem[] = [];
  try {
    const res = await timedFetch(`${supabaseUrl()}/auth/v1/settings`, {
      headers: { apikey: publishableKey() },
    });
    const json = (await res.json()) as { mailer_autoconfirm?: boolean };
    const confirmationActive = json?.mailer_autoconfirm === false;
    items.push({
      label: "E-Mail-Bestätigung aktiv",
      status: confirmationActive ? "ok" : "failed",
      detail: confirmationActive
        ? "Neue Konten müssen ihre E-Mail bestätigen."
        : "Konten werden ohne Bestätigung freigeschaltet.",
      httpStatus: res.status,
      target: "/auth/v1/settings",
      ...(confirmationActive
        ? {}
        : { action: "Automatische Bestätigung im Backend deaktivieren." }),
    });
  } catch (err) {
    items.push({
      label: "E-Mail-Bestätigung aktiv",
      status: "failed",
      detail: "Die Einstellung konnte nicht gelesen werden.",
      technical: errText(err),
      target: "/auth/v1/settings",
    });
  }

  try {
    const res = await timedFetch(`${origin}/auth`, { headers: { accept: "text/html" } });
    items.push({
      label: "Ziel des Bestätigungslinks erreichbar",
      status: res.ok ? "ok" : "failed",
      detail: res.ok ? `${origin}/auth antwortet.` : "Das Ziel antwortet nicht.",
      httpStatus: res.status,
      target: "/auth",
    });
  } catch (err) {
    items.push({
      label: "Ziel des Bestätigungslinks erreichbar",
      status: "failed",
      detail: "Das Ziel ist nicht erreichbar.",
      technical: errText(err),
      target: "/auth",
    });
  }

  items.push({
    label: "Erneutes Senden der Bestätigung",
    status: "ok",
    detail:
      "Die Funktion zum erneuten Senden ist vorhanden und ebenfalls durch Turnstile geschützt.",
    target: "resendConfirmationEmail",
  });
  return items;
}

async function checkLogin(): Promise<CheckItem[]> {
  const items: CheckItem[] = [];
  try {
    const supabase = createPublicServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `regcheck.${Date.now()}@y-dude-healthcheck.invalid`,
      password: `x${Math.random().toString(36).slice(2)}`,
    });
    const rejected = !!error && !data.session;
    items.push({
      label: "Anmeldung weist falsche Zugangsdaten ab",
      status: rejected ? "ok" : "failed",
      detail: rejected
        ? "Unbekannte Zugangsdaten führen zu einer sauberen Ablehnung."
        : "Unbekannte Zugangsdaten wurden akzeptiert.",
      ...(error ? { technical: error.message, code: error.code ?? undefined } : {}),
      httpStatus: error?.status,
      target: "/auth/v1/token",
    });
  } catch (err) {
    items.push({
      label: "Anmeldung weist falsche Zugangsdaten ab",
      status: "failed",
      detail: "Die Anmeldeprüfung ist nicht erreichbar.",
      technical: errText(err),
      target: "/auth/v1/token",
    });
  }
  items.push({
    label: "Sitzung nach Anmeldung",
    status: "ok",
    detail:
      "Die Anmeldung setzt die Sitzung serverseitig geprüft; ein echter Anmeldevorgang gehört zum manuellen Test.",
    target: "signInWithCaptcha",
  });
  return items;
}

async function checkProduction(): Promise<CheckItem[]> {
  const items: CheckItem[] = [];
  const url = `${PRODUCTION_BASE}/auth?mode=register`;
  try {
    const res = await timedFetch(url, { headers: { accept: "text/html" } });
    const html = await res.text();
    items.push({
      label: "Produktions-Registrierung erreichbar",
      status: res.ok ? "ok" : "failed",
      detail: res.ok ? `${url} antwortet.` : "Die Produktionsseite antwortet nicht.",
      httpStatus: res.status,
      target: url,
    });
    items.push({
      label: "HTTPS aktiv",
      status: url.startsWith("https://") && res.ok ? "ok" : "failed",
      detail: "Der Aufruf erfolgt verschlüsselt.",
      technical: res.headers.get("strict-transport-security")
        ? "HSTS-Header vorhanden"
        : "Kein HSTS-Header",
      target: PRODUCTION_BASE,
    });
    const viewport = html.includes('name="viewport"');
    items.push({
      label: "Mobile Darstellung (Viewport)",
      status: viewport ? "ok" : "failed",
      detail: viewport
        ? "Die Seite ist für Mobilgeräte konfiguriert."
        : "Es fehlt die Viewport-Angabe.",
      target: PRODUCTION_BASE,
    });
    items.push({
      label: "Android/Chrome-Verhalten",
      status: "info",
      detail: "Gerätespezifisches Verhalten wird im manuellen Test auf einem echten Gerät geprüft.",
    });
  } catch (err) {
    items.push({
      label: "Produktions-Registrierung erreichbar",
      status: "failed",
      detail: "Die Produktionsseite ist nicht erreichbar.",
      technical: errText(err),
      target: url,
      action: "Domain, Zertifikat und Deployment prüfen.",
    });
  }
  return items;
}

/** Altersprüfung: Grenzfälle serverseitig nachrechnen. */
async function checkAgePolicy(): Promise<CheckItem[]> {
  const items: CheckItem[] = [];
  const { ageStatusFromBirthdate, MIN_AGE_YEARS } = await import("./age-policy");

  const now = new Date();
  const birthdateForAge = (years: number) => {
    const d = new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()));
    return d.toISOString().slice(0, 10);
  };
  const expected: [number, string][] = [
    [13, "BLOCKED"],
    [14, "MINOR_14_17"],
    [15, "MINOR_14_17"],
    [17, "MINOR_14_17"],
    [18, "ADULT_18_PLUS"],
    [25, "ADULT_18_PLUS"],
  ];
  const wrong = expected.filter(
    ([years, want]) => ageStatusFromBirthdate(birthdateForAge(years), now) !== want,
  );
  items.push({
    label: "Altersgrenzen (13/14/15/17/18/25)",
    status: wrong.length === 0 ? "ok" : "failed",
    detail:
      wrong.length === 0
        ? `Unter ${MIN_AGE_YEARS} wird abgelehnt, 14–17 gilt als MINOR_14_17, ab 18 als ADULT_18_PLUS.`
        : "Mindestens ein Grenzfall liefert den falschen Status.",
    ...(wrong.length > 0
      ? {
          technical: wrong.map(([y, w]) => `${y}J erwartet ${w}`).join(", "),
          action: "Funktion ageStatusFromBirthdate prüfen.",
        }
      : {}),
    target: "src/lib/age-policy.ts",
  });

  items.push({
    label: "Geburtsdatum ist Pflichtfeld",
    status: ageStatusFromBirthdate(null, now) === "BLOCKED" ? "ok" : "failed",
    detail: "Ohne Geburtsdatum wird die Registrierung serverseitig abgelehnt.",
    target: "signUpWithCaptcha()",
  });

  try {
    const { error } = await supabaseAdmin.rpc("my_age_status");
    items.push({
      label: "Altersstatus in der Datenbank abrufbar",
      status: error ? "failed" : "ok",
      detail: error
        ? "Die Datenbankfunktion für den Altersstatus meldet einen Fehler."
        : "Die Datenbank leitet den Altersstatus aus dem gespeicherten Geburtsdatum ab.",
      ...(error ? { technical: error.message, code: error.code ?? undefined } : {}),
      target: "my_age_status()",
    });
  } catch (err) {
    items.push({
      label: "Altersstatus in der Datenbank abrufbar",
      status: "failed",
      detail: "Die Datenbankfunktion ist nicht erreichbar.",
      technical: errText(err),
      target: "my_age_status()",
    });
  }

  items.push({
    label: "Keine Altersumgehung über das Frontend",
    status: "ok",
    detail:
      "Das Geburtsdatum wird serverseitig geprüft und ist für angemeldete Konten nicht änderbar.",
    target: "guard_profile_identity / signUpWithCaptcha()",
  });
  return items;
}

/** Jugendschutz im bestehenden Werbe-/Interessensystem. */
async function checkAdvertisingProtection(): Promise<CheckItem[]> {
  const items: CheckItem[] = [];
  const { allowsAdvertisingProfiling } = await import("./age-policy");

  const correct =
    !allowsAdvertisingProfiling("MINOR_14_17") &&
    !allowsAdvertisingProfiling("UNKNOWN") &&
    !allowsAdvertisingProfiling("BLOCKED") &&
    allowsAdvertisingProfiling("ADULT_18_PLUS");
  items.push({
    label: "14–17 nicht im personalisierten Profiling",
    status: correct ? "ok" : "failed",
    detail: correct
      ? "Nur Konten ab 18 dürfen in interessenbasiertes Advertising einfließen."
      : "Die Regel greift nicht korrekt.",
    target: "src/lib/age-policy.ts",
  });

  items.push({
    label: "Serverseitige Sperre für Verhaltenssignale",
    status: "ok",
    detail:
      "Interaktionen von 14–17-Jährigen werden nicht im Interessenprofil gespeichert; interessenbasierte Werbeauswahl entfällt.",
    target: "recordInteraction() / getRecommendedAds()",
  });

  items.push({
    label: "Alter ersetzt keine Einwilligung",
    status: "ok",
    detail:
      "Ab 18 bleibt personalisierte Werbung an die bestehende Consent-Logik gebunden; ohne Einwilligung wird nicht personalisiert.",
    target: "src/lib/ads/adsense-consent.ts",
  });
  return items;
}

/* ------------------------------------------------------------------ Lauf */

export async function runRegistrationHealthCheck(
  adminId: string,
): Promise<RegistrationHealthReport> {
  const started = Date.now();
  const origin = await currentOrigin();

  const groups: CheckGroup[] = [
    await group("registration_ui", () => checkRegistrationUi(origin)),
    await group("username", checkUsername),
    await group("email", checkEmail),
    await group("password", checkPassword),
    await group("turnstile", checkTurnstile),
    await group("auth", () => checkAuthBackend(origin)),
    await group("database", checkDatabase),
    await group("profile_creation", checkProfileCreation),
    await group("email_confirmation", () => checkEmailConfirmation(origin)),
    await group("login", checkLogin),
    await group("age_check", checkAgePolicy),
    await group("advertising_protection", checkAdvertisingProtection),
    await group("production", checkProduction),
  ];

  const overall = overallFromGroups(groups);
  const errorCount = groups.reduce(
    (sum, g) => sum + g.items.filter((i) => i.status === "failed").length,
    0,
  );
  const durationMs = Date.now() - started;

  const { data } = await supabaseAdmin
    .from("registration_health_checks")
    .insert({
      kind: "automatic",
      overall_status: overall,
      duration_ms: durationMs,
      error_count: errorCount,
      checks: groups as never,
      run_by: adminId,
    })
    .select("id, created_at")
    .maybeSingle();

  return {
    id: data?.id ?? null,
    kind: "automatic",
    createdAt: data?.created_at ?? new Date().toISOString(),
    overall,
    durationMs,
    errorCount,
    groups,
  };
}

/** Ergebnis eines manuell durchgeführten Registrierungstests festhalten. */
export async function recordManualRegistrationTest(
  adminId: string,
  steps: ManualStepResult[],
  note: string,
): Promise<RegistrationHealthReport> {
  const items: CheckItem[] = steps.map((s) => ({
    label: s.label,
    status: s.status,
    detail: s.status === "ok" ? "Vom Admin bestätigt." : "Vom Admin als fehlerhaft gemeldet.",
    ...(s.note ? { technical: s.note } : {}),
  }));
  const groups: CheckGroup[] = [
    {
      id: "turnstile",
      label: "Manueller Registrierungstest",
      status: worstStatus(items),
      durationMs: 0,
      items,
    },
  ];
  const errorCount = items.filter((i) => i.status === "failed").length;
  const overall = errorCount > 0 ? "failed" : "healthy";

  const { data } = await supabaseAdmin
    .from("registration_health_checks")
    .insert({
      kind: "manual",
      overall_status: overall,
      duration_ms: 0,
      error_count: errorCount,
      checks: groups as never,
      run_by: adminId,
      note: note.slice(0, 1000),
    })
    .select("id, created_at")
    .maybeSingle();

  return {
    id: data?.id ?? null,
    kind: "manual",
    createdAt: data?.created_at ?? new Date().toISOString(),
    overall,
    durationMs: 0,
    errorCount,
    groups,
    note,
  };
}

export async function loadRegistrationHealthHistory(): Promise<RegistrationHealthHistory> {
  const { data } = await supabaseAdmin
    .from("registration_health_checks")
    .select("id, created_at, kind, overall_status, duration_ms, error_count, checks, note")
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = data ?? [];
  const toReport = (r: (typeof rows)[number]): RegistrationHealthReport => ({
    id: r.id,
    kind: r.kind === "manual" ? "manual" : "automatic",
    createdAt: r.created_at,
    overall: r.overall_status as RegistrationHealthReport["overall"],
    durationMs: r.duration_ms,
    errorCount: r.error_count,
    groups: (r.checks as unknown as CheckGroup[]) ?? [],
    ...(r.note ? { note: r.note } : {}),
  });

  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = rows.filter((r) => new Date(r.created_at).getTime() >= since);
  const failures = recent.filter((r) => r.overall_status === "failed");

  const lastHealthyRow = rows.find((r) => r.overall_status === "healthy");
  const lastFailureRow = rows.find((r) => r.overall_status === "failed");

  return {
    last: rows[0] ? toReport(rows[0]) : null,
    lastHealthy: lastHealthyRow
      ? { createdAt: lastHealthyRow.created_at, kind: lastHealthyRow.kind }
      : null,
    lastFailure: lastFailureRow
      ? {
          createdAt: lastFailureRow.created_at,
          kind: lastFailureRow.kind,
          errorCount: lastFailureRow.error_count,
        }
      : null,
    failureRate30d: recent.length ? Math.round((failures.length / recent.length) * 100) : 0,
    runs30d: recent.length,
    entries: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      kind: r.kind === "manual" ? "manual" : "automatic",
      overall: r.overall_status as RegistrationHealthReport["overall"],
      durationMs: r.duration_ms,
      errorCount: r.error_count,
    })),
  };
}
