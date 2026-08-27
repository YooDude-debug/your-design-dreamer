import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { ArrowLeft, Lock, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRedirectWhenSignedIn } from "@/lib/use-session";
import { ensureProfile, USERNAME_RE } from "@/lib/account.functions";

import { useUsernameCheck } from "@/lib/use-username-check";
import {
  requestPasswordResetWithCaptcha,
  resendConfirmationEmail,
  signInWithCaptcha,
  signUpWithCaptcha,
} from "@/lib/auth.functions";
import { MIN_AGE_YEARS, isValidBirthdate, meetsMinAge } from "@/lib/age-policy";
import {
  DEFAULT_DISPLAY_NAME_MODE,
  DISPLAY_NAME_MODES,
  previewPublicName,
  type DisplayNameMode,
} from "@/lib/profile-extra";
import { Turnstile } from "@/components/Turnstile";
import { useCaptchaGate } from "@/lib/use-captcha-gate";
import { useLang } from "@/lib/lang-context";
import { authTexts } from "@/lib/i18n-auth";
import { trackChallenge } from "@/lib/challenge-tracking";
import type { Lang } from "@/lib/i18n-dict";

type AuthSearch = { denied?: boolean; mode?: "register" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    ...(search.denied === true || search.denied === "true" ? { denied: true } : {}),
    ...(search.mode === "register" ? { mode: "register" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Login & Registrierung — Y-Dude" },
      {
        name: "description",
        content: "Melde dich bei Y-Dude an oder registriere dich kostenlos für den Vibe.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Login & Registrierung — Y-Dude" },
      {
        property: "og:description",
        content: "Melde dich bei Y-Dude an oder registriere dich kostenlos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

/** Nach dem Login: Admins in das Cockpit, alle anderen in die App. */
async function routeAfterLogin(userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  return isAdmin === true ? "/admin" : "/dev";
}

function AuthPage() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const t = authTexts[lang].auth;
  const { denied, mode } = Route.useSearch();
  useRedirectWhenSignedIn("/dev");

  const [tab, setTab] = useState<"login" | "register">(mode === "register" ? "register" : "login");
  const [forgot, setForgot] = useState(false);

  // Der Tab steht zusätzlich in der URL: Wenn die Seite (langsame Verbindung,
  // Neuladen, Zurück-Taste) neu aufgebaut wird, bleibt die Registrierung offen.
  const selectTab = (key: "login" | "register") => {
    setTab(key);
    setForgot(false);
    void navigate({
      to: "/auth",
      search: (prev) => ({ ...prev, mode: key === "register" ? "register" : undefined }),
      replace: true,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
          <div className="flex items-center justify-end">
            <BackButton to="/" label={t.backHome} className="shrink-0" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-border p-1">
            {(["login", "register"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => selectTab(key)}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                  tab === key
                    ? "bg-gradient-brand text-primary-foreground"
                    : "text-muted-foreground hover:text-brand"
                }`}
              >
                {key === "login" ? t.tabLogin : t.tabRegister}
              </button>
            ))}
          </div>

          {denied && (
            <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {t.deniedNoAdmin}
            </p>
          )}

          {tab === "login" ? (
            forgot ? (
              <ForgotForm onBack={() => setForgot(false)} lang={lang} />
            ) : (
              <LoginForm
                onDone={(to) => navigate({ to, replace: true })}
                onForgot={() => setForgot(true)}
                lang={lang}
              />
            )
          ) : (
            <RegisterForm onDone={(to) => navigate({ to, replace: true })} lang={lang} />
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand";

function LoginForm({
  onDone,
  onForgot,
  lang,
}: {
  onDone: (to: string) => void;
  onForgot: () => void;
  lang: import("@/lib/i18n-dict").Lang;
}) {
  const t = authTexts[lang].auth;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Das Client-Widget blockiert das Absenden nicht (Race Condition auf mobilen
  // Netzen). Verbindlich prueft der Server das Token.
  const captcha = useCaptchaGate();
  const [unconfirmed, setUnconfirmed] = useState(false);
  const resend = useServerFn(resendConfirmationEmail);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Die Anmeldung läuft über eine Server-Funktion, die zuerst das
    // Turnstile-Token prüft und erst danach authentifiziert.
    let res: Awaited<ReturnType<typeof signInWithCaptcha>>;
    try {
      res = await signInWithCaptcha({
        data: {
          email: email.trim().toLowerCase(),
          password,
          captchaToken: await captcha.waitForToken(),
        },
      });
    } catch {
      setLoading(false);
      captcha.reset();
      toast.error(t.login.loginFailed);
      return;
    }
    if (res.status !== "ok") {
      setLoading(false);
      captcha.reset();
      setUnconfirmed(res.status === "unconfirmed");
      toast.error(
        res.status === "captcha"
          ? t.captchaError
          : res.status === "unconfirmed"
            ? t.login.loginUnconfirmed
            : t.login.loginFailedCreds,
      );
      return;
    }
    setUnconfirmed(false);
    const { error } = await supabase.auth.setSession({
      access_token: res.accessToken,
      refresh_token: res.refreshToken,
    });
    if (error) {
      setLoading(false);
      captcha.reset();
      toast.error(t.login.loginFailed);
      return;
    }
    try {
      await ensureProfile({ data: {} });
    } catch {
      /* Profil existiert bereits oder wird später angelegt */
    }
    const to = await routeAfterLogin(res.userId);
    setLoading(false);
    onDone(to);
  };

  const onResend = async () => {
    setLoading(true);
    try {
      const r = await resend({
        data: {
          email: email.trim().toLowerCase(),
          redirectTo: window.location.origin,
          captchaToken: await captcha.waitForToken(),
        },
      });
      if (r.status === "ok") toast.success(t.register.resendOk);
      else if (r.status === "cooldown") toast.info(t.register.resendCooldown);
      else if (r.status === "captcha") toast.error(t.captchaError);
      else toast.error(t.register.resendFail);
    } catch {
      toast.error(t.register.resendFail);
    } finally {
      setLoading(false);
      captcha.reset();
    }
  };

  return (
    <>
      <h1 className="mt-6 text-2xl font-black tracking-tight">
        Y-Dude <span className="text-gradient-green">{t.login.heading}</span>
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">{t.login.subtitle}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.login.emailPh}
          className={inputClass}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t.login.passwordPh}
          className={inputClass}
        />
        <Turnstile
          onToken={captcha.setToken}
          onUnavailable={captcha.setBlocked}
          handleRef={captcha.handleRef}
        />
        {unconfirmed && (
          <div className="rounded-xl border border-brand/40 bg-brand/10 px-3 py-3 text-xs leading-relaxed">
            <p>{t.login.loginUnconfirmed}</p>
            <button
              type="button"
              onClick={onResend}
              disabled={loading}
              className="mt-2 inline-flex items-center gap-1.5 text-brand underline underline-offset-2 disabled:opacity-50"
            >
              <Mail className="h-3.5 w-3.5" /> {t.login.resendConfirm}
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Lock className="h-4 w-4" />
          {loading ? "…" : captcha.pending ? t.captchaPending : t.login.submit}
        </button>
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onForgot}
            className="text-xs font-semibold text-brand underline underline-offset-2 hover:opacity-80"
          >
            {t.login.forgotPassword}
          </button>
        </div>
      </form>
    </>
  );
}

function ForgotForm({
  onBack,
  lang,
}: {
  onBack: () => void;
  lang: import("@/lib/i18n-dict").Lang;
}) {
  const t = authTexts[lang].auth;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // Das Client-Widget blockiert das Absenden nicht (Race Condition auf mobilen
  // Netzen). Verbindlich prueft der Server das Token.
  const captcha = useCaptchaGate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 255) {
      toast.error(t.forgot.invalidEmail);
      return;
    }
    setLoading(true);
    // Neutrale Rückmeldung: Der Server prüft zuerst Turnstile und versendet
    // erst danach die E-Mail. Konto-Existenz wird nie preisgegeben.
    try {
      const res = await requestPasswordResetWithCaptcha({
        data: {
          email: value,
          redirectTo: `${window.location.origin}/reset-password`,
          captchaToken: await captcha.waitForToken(),
        },
      });
      setLoading(false);
      if (res.status === "captcha") {
        captcha.reset();
        toast.error(t.captchaError);
        return;
      }
      setSent(true);
    } catch {
      setLoading(false);
      captcha.reset();
      toast.error(t.forgot.genericFail);
    }
  };

  if (sent) {
    return (
      <div className="mt-6">
        <h1 className="text-2xl font-black tracking-tight">
          {t.forgot.sentHeadingPrefix}{" "}
          <span className="text-gradient-green">{t.forgot.sentHeadingSuffix}</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.forgot.sentBody}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-semibold hover:border-brand"
        >
          {t.forgot.back}
        </button>
      </div>
    );
  }

  return (
    <>
      <h1 className="mt-6 text-2xl font-black tracking-tight">
        {t.forgot.headingPrefix} <span className="text-gradient-green">{t.forgot.heading}</span>
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">{t.forgot.subtitle}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.forgot.emailPh}
          aria-label={t.forgot.emailAria}
          className={inputClass}
        />
        <Turnstile
          onToken={captcha.setToken}
          onUnavailable={captcha.setBlocked}
          handleRef={captcha.handleRef}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Mail className="h-4 w-4" />
          {loading ? "…" : captcha.pending ? t.captchaPending : t.forgot.submit}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs text-muted-foreground hover:text-brand"
        >
          {t.forgot.back}
        </button>
      </form>
    </>
  );
}

function RegisterForm({ onDone, lang }: { onDone: (to: string) => void; lang: Lang }) {
  const t = authTexts[lang].auth;
  const r = t.register;
  const u = authTexts[lang].username;
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  // Datenschutz-Standard: nur der Username ist oeffentlich sichtbar.
  const [displayNameMode, setDisplayNameMode] =
    useState<DisplayNameMode>(DEFAULT_DISPLAY_NAME_MODE);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Das Client-Widget blockiert das Absenden nicht (Race Condition auf mobilen
  // Netzen). Verbindlich prueft der Server das Token.
  const captcha = useCaptchaGate();
  // Live-Prüfung (Komfort); verbindlich entscheidet der Server beim Absenden.
  const nameCheck = useUsernameCheck(username, { firstName, lastName });
  const resend = useServerFn(resendConfirmationEmail);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.info("[auth] register_button_pressed");
    console.info("[auth] register_validation_started");
    setValidationError(null);
    const failValidation = (message: string) => {
      console.info("[auth] register_validation_failed");
      setValidationError(message);
      toast.error(message);
    };
    const name = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail) || normalizedEmail.length > 255) {
      failValidation(r.errEmailInvalid);
      return;
    }
    if (!USERNAME_RE.test(name)) {
      failValidation(r.errUsernameInvalid);
      return;
    }
    if (nameCheck.status === "taken" || nameCheck.status === "reserved") {
      failValidation(nameCheck.status === "taken" ? r.errUsernameTaken : r.errUsernameBlocked);
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      failValidation(r.errNamesRequired);
      return;
    }
    if (password.length < 8) {
      failValidation(r.errPasswordTooShort);
      return;
    }
    if (password !== password2) {
      failValidation(r.errPasswordsMismatch);
      return;
    }
    // Jugendschutz: Mindestalter wird zusätzlich serverseitig geprüft.
    if (!isValidBirthdate(birthdate)) {
      failValidation(r.errBirthdateRequired);
      return;
    }
    if (!meetsMinAge(birthdate)) {
      failValidation(r.errUnderage(MIN_AGE_YEARS));
      return;
    }
    if (!accepted) {
      failValidation(r.errConsentRequired);
      return;
    }

    setLoading(true);
    console.info("[auth] register_submit_started");
    trackChallenge("signup_started");

    // Die Registrierung läuft über eine Server-Funktion: erst Turnstile
    // prüfen, dann den Account anlegen.
    let res: Awaited<ReturnType<typeof signUpWithCaptcha>>;
    try {
      res = await signUpWithCaptcha({
        data: {
          email: normalizedEmail,
          password,
          username: name,
          birthdate,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayNameMode,
          redirectTo: `${window.location.origin}/auth`,
          captchaToken: await captcha.waitForToken(),
        },
      });
    } catch {
      console.info("[auth] register_submit_error");
      setLoading(false);
      captcha.reset();
      toast.error(r.errGenericFail);
      return;
    }

    if (res.status === "underage") {
      setLoading(false);
      captcha.reset();
      toast.error(r.errUnderage(MIN_AGE_YEARS));
      return;
    }

    if (res.status === "username_blocked" || res.status === "username_taken") {
      setLoading(false);
      captcha.reset();
      toast.error(res.status === "username_taken" ? r.errUsernameTaken : r.errUsernameBlocked);
      return;
    }

    if (
      res.status === "captcha" ||
      res.status === "weak_password" ||
      res.status === "email_taken" ||
      res.status === "rate_limited" ||
      res.status === "failed"
    ) {
      setLoading(false);
      captcha.reset();
      toast.error(
        res.status === "captcha"
          ? t.captchaError
          : res.status === "weak_password"
            ? r.errWeakPassword
            : res.status === "email_taken"
              ? r.errEmailTaken
              : res.status === "rate_limited"
                ? r.errRateLimit
                : r.errGenericFail,
      );
      return;
    }

    if (res.status === "confirm") {
      setLoading(false);
      console.info("[auth] register_submit_success");
      trackChallenge("signup_completed", { step: "email_confirm_pending" });
      setInfo(r.confirmInfo);
      return;
    }

    await supabase.auth.setSession({
      access_token: res.accessToken,
      refresh_token: res.refreshToken,
    });
    try {
      await ensureProfile({
        data: {
          username: name,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayNameMode,
        },
      });
    } catch {
      /* Profil wird beim nächsten Login nachgezogen */
    }
    setLoading(false);
    console.info("[auth] register_submit_success");
    trackChallenge("signup_completed", { step: "session_active" });
    onDone(await routeAfterLogin(res.userId));
  };

  const onResend = async () => {
    setLoading(true);
    try {
      const res = await resend({
        data: {
          email: email.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/auth`,
          captchaToken: await captcha.waitForToken(),
        },
      });
      if (res.status === "ok") toast.success(r.resendOk);
      else if (res.status === "cooldown") toast.info(r.resendCooldown);
      else if (res.status === "captcha") toast.error(t.captchaError);
      else toast.error(r.resendFail);
    } catch {
      toast.error(r.resendFail);
    } finally {
      setLoading(false);
      captcha.reset();
    }
  };

  if (info) {
    return (
      <div className="mt-6">
        <h1 className="text-2xl font-black tracking-tight">
          <span className="text-gradient-green">{r.confirmHeading}</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{info}</p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{r.confirmSpam}</p>
        <div className="mt-4 space-y-3">
          <Turnstile
            onToken={captcha.setToken}
            onUnavailable={captcha.setBlocked}
            handleRef={captcha.handleRef}
          />
          <button
            type="button"
            onClick={onResend}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-brand/50 px-4 py-2 text-xs font-semibold text-brand disabled:opacity-50"
          >
            <Mail className="h-3.5 w-3.5" /> {r.resendButton}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="mt-6 text-2xl font-black tracking-tight">
        {r.headingPrefix} <span className="text-gradient-green">{r.headingSuffix}</span>
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">{r.subtitle}</p>

      <form onSubmit={onSubmit} noValidate className="mt-5 space-y-3">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={r.emailPh}
          className={`${inputClass}`}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={r.passwordPh}
          className={`${inputClass}`}
        />
        <input
          type="password"
          autoComplete="new-password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder={r.password2Pl}
          className={`${inputClass}`}
        />
        <input
          type="text"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder={r.firstNamePl}
          maxLength={60}
          className={`${inputClass}`}
        />
        <input
          type="text"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder={r.lastNamePl}
          maxLength={60}
          className={`${inputClass}`}
        />
        <label className="block px-1 text-[11px] text-muted-foreground">
          {r.birthdateLabel(MIN_AGE_YEARS)}
          <input
            type="date"
            autoComplete="bday"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <div>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={r.usernamePl}
            maxLength={24}
            className={`${inputClass}`}
          />
          {nameCheck.state === "checking" && (
            <p className="mt-1 px-1 text-[11px] text-muted-foreground">{r.usernameChecking}</p>
          )}
          {nameCheck.state === "done" && nameCheck.status && (
            <p
              className={`mt-1 px-1 text-[11px] ${
                nameCheck.status === "available" ? "text-brand" : "text-destructive"
              }`}
            >
              {nameCheck.status === "available" ? "✓" : "✕"} {u.status[nameCheck.status]}
            </p>
          )}
          {nameCheck.suggestions.length > 0 && (
            <div className="mt-1 px-1">
              <p className="text-[11px] text-muted-foreground">{r.suggestionsLabel}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {nameCheck.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setUsername(s)}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-brand/60 hover:text-brand"
                  >
                    @{s} <span className="text-brand">✓</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <fieldset className="rounded-xl border border-border px-3 py-3">
          <legend className="px-1 text-[11px] font-semibold text-muted-foreground">
            {r.displayNameLegend}
          </legend>
          <div className="space-y-1.5">
            {DISPLAY_NAME_MODES.map((m) => (
              <label
                key={m}
                className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground cursor-pointer"
              >
                <input
                  type="radio"
                  name="displayNameMode"
                  value={m}
                  checked={displayNameMode === m}
                  onChange={() => setDisplayNameMode(m)}
                  className="h-4 w-4 shrink-0 accent-[oklch(0.82_0.24_150)]"
                />
                <span>
                  {m === "username"
                    ? r.displayNameUsername
                    : m === "real_name"
                      ? r.displayNameReal
                      : r.displayNameBoth}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            {r.publicPreviewLabel}{" "}
            <span className="font-semibold text-foreground">
              {previewPublicName(username, firstName, lastName, displayNameMode)}
            </span>
          </p>
        </fieldset>

        <label className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[oklch(0.82_0.24_150)]"
          />
          <span>
            {r.consentPrefix(MIN_AGE_YEARS)}{" "}
            <Link to="/agb" className="text-brand underline underline-offset-2">
              {r.consentTerms}
            </Link>
            , {r.consentMid1}{" "}
            <Link to="/richtlinien" className="text-brand underline underline-offset-2">
              {r.consentGuidelines}
            </Link>{" "}
            {r.consentMid2}{" "}
            <Link to="/datenschutz" className="text-brand underline underline-offset-2">
              {r.consentPrivacy}
            </Link>
            .
          </span>
        </label>

        <Turnstile
          onToken={captcha.setToken}
          onUnavailable={captcha.setBlocked}
          handleRef={captcha.handleRef}
        />
        {validationError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {validationError}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="relative z-10 w-full min-h-11 touch-manipulation pointer-events-auto inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          {loading ? "…" : captcha.pending ? t.captchaPending : r.submitLabel}
        </button>
      </form>
    </>
  );
}
