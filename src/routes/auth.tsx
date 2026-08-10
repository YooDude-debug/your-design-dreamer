import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Lock, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRedirectWhenSignedIn } from "@/lib/use-session";
import { ensureProfile, isUsernameAvailable, USERNAME_RE } from "@/lib/account.functions";
import {
  requestPasswordResetWithCaptcha,
  signInWithCaptcha,
  signUpWithCaptcha,
} from "@/lib/auth.functions";
import { MIN_AGE_YEARS, isValidBirthdate, meetsMinAge } from "@/lib/age-policy";
import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";

const CAPTCHA_ERROR = "Bitte bestätige die Sicherheitsprüfung und versuche es erneut.";

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
  const { denied, mode } = Route.useSearch();
  useRedirectWhenSignedIn("/dev");

  const [tab, setTab] = useState<"login" | "register">(mode === "register" ? "register" : "login");
  const [forgot, setForgot] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
          <div className="flex items-center justify-end">
            <Link
              to="/"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-brand"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Startseite
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-border p-1">
            {(["login", "register"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                  tab === key
                    ? "bg-gradient-brand text-primary-foreground"
                    : "text-muted-foreground hover:text-brand"
                }`}
              >
                {key === "login" ? "Anmelden" : "Registrieren"}
              </button>
            ))}
          </div>

          {denied && (
            <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Kein Admin-Zugang für diesen Account.
            </p>
          )}

          {tab === "login" ? (
            forgot ? (
              <ForgotForm onBack={() => setForgot(false)} />
            ) : (
              <LoginForm
                onDone={(to) => navigate({ to, replace: true })}
                onForgot={() => setForgot(true)}
              />
            )
          ) : (
            <RegisterForm onDone={(to) => navigate({ to, replace: true })} />
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand";

function LoginForm({ onDone, onForgot }: { onDone: (to: string) => void; onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle | null>(null);

  const resetCaptcha = () => {
    captchaRef.current?.reset();
    setCaptchaToken(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      toast.error(CAPTCHA_ERROR);
      return;
    }
    setLoading(true);
    // Die Anmeldung läuft über eine Server-Funktion, die zuerst das
    // Turnstile-Token prüft und erst danach authentifiziert.
    let res: Awaited<ReturnType<typeof signInWithCaptcha>>;
    try {
      res = await signInWithCaptcha({
        data: { email: email.trim().toLowerCase(), password, captchaToken },
      });
    } catch {
      setLoading(false);
      resetCaptcha();
      toast.error("Login fehlgeschlagen. Bitte versuche es erneut.");
      return;
    }
    if (res.status !== "ok") {
      setLoading(false);
      resetCaptcha();
      toast.error(
        res.status === "captcha"
          ? CAPTCHA_ERROR
          : "Login fehlgeschlagen. Bitte prüfe deine Zugangsdaten.",
      );
      return;
    }
    const { error } = await supabase.auth.setSession({
      access_token: res.accessToken,
      refresh_token: res.refreshToken,
    });
    if (error) {
      setLoading(false);
      resetCaptcha();
      toast.error("Login fehlgeschlagen. Bitte versuche es erneut.");
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

  return (
    <>
      <h1 className="mt-6 text-2xl font-black tracking-tight">
        Y-Dude <span className="text-gradient-green">Login</span>
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">Melde dich mit deinem Y-Dude Account an.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail"
          className={inputClass}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Passwort"
          className={inputClass}
        />
        <Turnstile onToken={setCaptchaToken} handleRef={captchaRef} />
        <button
          type="submit"
          disabled={loading || !captchaToken}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Lock className="h-4 w-4" />
          {loading ? "…" : "Anmelden"}
        </button>
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onForgot}
            className="text-xs font-semibold text-brand underline underline-offset-2 hover:opacity-80"
          >
            Passwort vergessen?
          </button>
        </div>
      </form>
    </>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 255) {
      toast.error("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    if (!captchaToken) {
      toast.error(CAPTCHA_ERROR);
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
          captchaToken,
        },
      });
      setLoading(false);
      if (res.status === "captcha") {
        captchaRef.current?.reset();
        setCaptchaToken(null);
        toast.error(CAPTCHA_ERROR);
        return;
      }
      setSent(true);
    } catch {
      setLoading(false);
      captchaRef.current?.reset();
      setCaptchaToken(null);
      toast.error("Es hat nicht geklappt. Bitte versuche es erneut.");
    }
  };

  if (sent) {
    return (
      <div className="mt-6">
        <h1 className="text-2xl font-black tracking-tight">
          E-Mail <span className="text-gradient-green">unterwegs</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir einen Link zum Zurücksetzen
          des Passworts verschickt. Der Link ist zeitlich begrenzt gültig und kann nur einmal
          verwendet werden. Prüfe auch deinen Spam-Ordner.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-semibold hover:border-brand"
        >
          Zurück zum Login
        </button>
      </div>
    );
  }

  return (
    <>
      <h1 className="mt-6 text-2xl font-black tracking-tight">
        Passwort <span className="text-gradient-green">vergessen</span>
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Gib deine registrierte E-Mail-Adresse ein – wir schicken dir einen sicheren Link zum
        Zurücksetzen.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail"
          aria-label="E-Mail-Adresse"
          className={inputClass}
        />
        <Turnstile onToken={setCaptchaToken} handleRef={captchaRef} />
        <button
          type="submit"
          disabled={loading || !captchaToken}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Mail className="h-4 w-4" />
          {loading ? "…" : "Link senden"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs text-muted-foreground hover:text-brand"
        >
          Zurück zum Login
        </button>
      </form>
    </>
  );
}

function RegisterForm({ onDone }: { onDone: (to: string) => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!USERNAME_RE.test(name)) {
      toast.error("Benutzername: 3–24 Zeichen, nur Buchstaben, Zahlen, _ . -");
      return;
    }
    if (password.length < 8) {
      toast.error("Das Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    if (password !== password2) {
      toast.error("Die Passwörter stimmen nicht überein.");
      return;
    }
    // Jugendschutz: Mindestalter wird zusätzlich serverseitig geprüft.
    if (!isValidBirthdate(birthdate)) {
      toast.error("Bitte gib dein Geburtsdatum an.");
      return;
    }
    if (!meetsMinAge(birthdate)) {
      toast.error(`Die Nutzung von Y-Dude ist erst ab ${MIN_AGE_YEARS} Jahren möglich.`);
      return;
    }
    if (!accepted) {
      toast.error("Bitte bestätige AGB, Community-Richtlinien und Datenschutzerklärung.");
      return;
    }

    if (!captchaToken) {
      toast.error(CAPTCHA_ERROR);
      return;
    }

    setLoading(true);
    try {
      const { available } = await isUsernameAvailable({ data: { username: name } });
      if (!available) {
        toast.error("Dieser Benutzername ist bereits vergeben.");
        setLoading(false);
        return;
      }
    } catch {
      /* Prüfung optional – Eindeutigkeit erzwingt die Datenbank */
    }

    // Die Registrierung läuft über eine Server-Funktion: erst Turnstile
    // prüfen, dann den Account anlegen.
    let res: Awaited<ReturnType<typeof signUpWithCaptcha>>;
    try {
      res = await signUpWithCaptcha({
        data: {
          email: email.trim().toLowerCase(),
          password,
          username: name,
          birthdate,
          redirectTo: window.location.origin,
          captchaToken,
        },
      });
    } catch {
      setLoading(false);
      captchaRef.current?.reset();
      setCaptchaToken(null);
      toast.error("Registrierung fehlgeschlagen. Bitte versuche es erneut.");
      return;
    }

    if (res.status === "underage") {
      setLoading(false);
      captchaRef.current?.reset();
      setCaptchaToken(null);
      toast.error(`Die Nutzung von Y-Dude ist erst ab ${MIN_AGE_YEARS} Jahren möglich.`);
      return;
    }

    if (res.status === "captcha" || res.status === "failed") {
      setLoading(false);
      captchaRef.current?.reset();
      setCaptchaToken(null);
      toast.error(
        res.status === "captcha"
          ? CAPTCHA_ERROR
          : "Registrierung fehlgeschlagen. Bitte versuche es erneut.",
      );
      return;
    }

    if (res.status === "confirm") {
      setLoading(false);
      setInfo(
        "Fast fertig! Wir haben dir eine E-Mail geschickt – bitte bestätige den Link, um deinen Account zu aktivieren.",
      );
      return;
    }

    await supabase.auth.setSession({
      access_token: res.accessToken,
      refresh_token: res.refreshToken,
    });
    try {
      await ensureProfile({ data: { username: name } });
    } catch {
      /* Profil wird beim nächsten Login nachgezogen */
    }
    setLoading(false);
    onDone(await routeAfterLogin(res.userId));
  };

  if (info) {
    return (
      <div className="mt-6">
        <h1 className="text-2xl font-black tracking-tight">
          <span className="text-gradient-green">E-Mail bestätigen</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{info}</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="mt-6 text-2xl font-black tracking-tight">
        Rein in den <span className="text-gradient-green">Vibe</span>
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">Die geschlossene Beta startet in Kürze.</p>

      <div className="mt-4 rounded-xl border border-brand/40 bg-brand/10 px-3 py-3 text-xs leading-relaxed">
        <p className="font-semibold">
          🚧 Die Registrierung befindet sich aktuell noch in Entwicklung.
        </p>
        <p className="mt-1.5 text-muted-foreground">
          Die geschlossene Beta startet in Kürze. Nutze bis dahin die Notify&nbsp;Me-Funktion und
          sichere dir einen Platz als Beta-Tester.
        </p>
        <Link
          to="/"
          hash="notify"
          className="mt-2 inline-flex text-brand underline underline-offset-2"
        >
          Zur Notify Me-Funktion
        </Link>
      </div>

      <form
        onSubmit={onSubmit}
        aria-disabled
        className="mt-5 space-y-3 opacity-60 cursor-not-allowed"
      >
        <input
          type="text"
          disabled
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Benutzername"
          maxLength={24}
          className={`${inputClass} cursor-not-allowed`}
        />
        <input
          type="email"
          disabled
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail"
          className={`${inputClass} cursor-not-allowed`}
        />
        <input
          type="password"
          disabled
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Passwort (min. 8 Zeichen)"
          className={`${inputClass} cursor-not-allowed`}
        />
        <input
          type="password"
          disabled
          autoComplete="new-password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="Passwort wiederholen"
          className={`${inputClass} cursor-not-allowed`}
        />
        <label className="block px-1 text-[11px] text-muted-foreground">
          Geburtsdatum (Nutzung ab {MIN_AGE_YEARS} Jahren)
          <input
            type="date"
            disabled
            autoComplete="bday"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className={`mt-1 ${inputClass} cursor-not-allowed`}
          />
        </label>
        <label className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-muted-foreground cursor-not-allowed">
          <input
            type="checkbox"
            disabled
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-not-allowed accent-[oklch(0.82_0.24_150)]"
          />
          <span>
            Ich bin mindestens {MIN_AGE_YEARS} Jahre alt und akzeptiere die{" "}
            <Link to="/agb" className="text-brand underline underline-offset-2">
              AGB
            </Link>
            , die{" "}
            <Link to="/richtlinien" className="text-brand underline underline-offset-2">
              Community-Richtlinien
            </Link>{" "}
            und die{" "}
            <Link to="/datenschutz" className="text-brand underline underline-offset-2">
              Datenschutzerklärung
            </Link>
            .
          </span>
        </label>

        <Turnstile onToken={setCaptchaToken} handleRef={captchaRef} />
        <button
          type="submit"
          disabled
          title="Registrierung noch nicht verfügbar"
          className="w-full inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-full border border-border bg-muted px-6 py-2.5 text-sm font-semibold text-muted-foreground opacity-60"
        >
          <UserPlus className="h-4 w-4" />
          {loading ? "…" : "Registrierung bald verfügbar"}
        </button>
      </form>
    </>
  );
}
