import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang-context";
import { authTexts } from "@/lib/i18n-auth";
import { getBetaTesterCount, subscribeNewsletter } from "@/lib/newsletter.functions";
import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";


export function NotifyForm() {
  const { lang } = useLang();
  const c = authTexts[lang].notify;
  const counterLabel = c.counter;
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle | null>(null);
  const subscribe = useServerFn(subscribeNewsletter);
  const fetchCount = useServerFn(getBetaTesterCount);
  const [betaCount, setBetaCount] = useState<number | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetchCount();
      setBetaCount(res.betaTesterCount);
    } catch {
      /* Zähler ist optional – Anmeldung bleibt nutzbar */
    }
  }, [fetchCount]);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);


  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!consent) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 255) {
      toast.error(c.invalid);
      return;
    }
    if (!captchaToken) {
      toast.error(c.captcha);
      return;
    }
    setLoading(true);
    try {
      const res = await subscribe({
        data: {
          email: value,
          language: lang as "de" | "en" | "el",
          consent: true,
          captchaToken,
        },
      });
      if (res.status === "captcha") {
        captchaRef.current?.reset();
        setCaptchaToken(null);
        toast.error(c.captcha);
        return;
      }
      const mailFailed =
        (res.status === "pending" || res.status === "resent") && res.emailSent === false;
      if (res.status === "already_verified") toast.success(c.already);
      else if (res.status === "cooldown") toast.info(c.cooldown);
      else if (mailFailed) toast.error(c.mailfail);
      else if (res.status === "resent") toast.success(c.resent);
      else toast.success(c.ok);
      if (res.status !== "cooldown" && !mailFailed) {
        setDone(true);
        setEmail("");
      }
      captchaRef.current?.reset();
      setCaptchaToken(null);
      // Bestätigte Anmeldungen ändern den Zähler – Wert ohne Reload neu holen.
      void refreshCount();

    } catch {
      captchaRef.current?.reset();
      setCaptchaToken(null);
      toast.error(c.fail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-brand/20 bg-surface p-3 text-left shadow-[0_0_22px_oklch(0.82_0.24_150/0.15)] sm:p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-lg border border-brand/40 flex items-center justify-center text-brand">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <div className="text-lg font-bold sm:text-xl">{c.title}</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.desc}</div>
          {betaCount !== null && (
            <p
              aria-live="polite"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand sm:text-xs"
            >
              {counterLabel(betaCount)}
            </p>
          )}
        </div>

      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            aria-label={c.placeholder}
            maxLength={255}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={c.placeholder}
            disabled={loading}
            className="flex-1 rounded-full bg-background border border-border px-4 py-2.5 text-sm outline-none focus:border-brand disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !consent || !captchaToken}
            className="rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "…" : done ? <Check className="h-4 w-4" /> : c.button}
          </button>
        </div>

        <label className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[oklch(0.82_0.24_150)]"
          />
          <span>
            {c.consent}{" "}
            <Link to="/datenschutz" className="text-brand underline underline-offset-2">
              {c.privacy}
            </Link>
          </span>
        </label>

        <Turnstile onToken={setCaptchaToken} handleRef={captchaRef} />

        <p className="text-[11px] leading-relaxed text-muted-foreground/80">{c.doi}</p>
      </form>
    </div>
  );
}
