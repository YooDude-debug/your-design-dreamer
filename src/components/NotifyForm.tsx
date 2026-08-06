import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang-context";
import { subscribeNewsletter } from "@/lib/newsletter.functions";
import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";

const COPY = {
  de: {
    title: "Werde Beta-Tester",
    desc: "Melde dich an und erfahre als Erster, sobald die geschlossene Beta startet. Hilf dabei, Y-Dude mit deinem Feedback weiterzuentwickeln.",
    placeholder: "Deine E-Mail",
    button: "Notify Me",
    consent:
      "Ich stimme zu, dass meine E-Mail-Adresse ausschließlich gespeichert wird, um mich über den Start von Y-Dude zu informieren. Ich habe die Datenschutzerklärung gelesen.",
    privacy: "Datenschutzerklärung",
    ok: "Fast fertig! Bitte bestätige den Link in deiner E-Mail.",
    resent: "Wir haben dir die Bestätigungs-E-Mail erneut geschickt.",
    cooldown: "Bitte warte eine Minute, bevor du es erneut versuchst.",
    already: "Du bist bereits bestätigt dabei ✌️",
    fail: "Etwas ist schiefgelaufen. Versuch's nochmal.",
    invalid: "Bitte gib eine gültige E-Mail-Adresse ein.",
    doi: "Double-Opt-in: Du erhältst eine Bestätigungs-E-Mail. Erst nach dem Klick auf den Link (24 h gültig) wird deine Adresse für Benachrichtigungen genutzt.",
    captcha: "Bitte bestätige die Sicherheitsprüfung und versuche es erneut.",
    mailfail:
      "Deine Anmeldung ist gespeichert, aber die Bestätigungs-E-Mail konnte nicht versendet werden. Bitte versuche es später erneut.",
  },
  en: {
    title: "Become a beta tester",
    desc: "Sign up and be the first to know when the closed beta starts. Help shape Y-Dude with your feedback.",
    placeholder: "Your email",
    button: "Notify Me",
    consent:
      "I agree that my email address will be stored solely to inform me about the launch of Y-Dude. I have read the privacy policy.",
    privacy: "Privacy Policy",
    ok: "Almost done! Please confirm the link in your email.",
    resent: "We sent the confirmation email again.",
    cooldown: "Please wait a minute before trying again.",
    already: "You're already confirmed ✌️",
    fail: "Something went wrong. Try again.",
    invalid: "Please enter a valid email address.",
    doi: "Double opt-in: you will receive a confirmation email. Only after clicking the link (valid 24 h) will your address be used for notifications.",
    captcha: "Please complete the security check and try again.",
    mailfail:
      "Your signup was saved, but the confirmation email could not be sent. Please try again later.",
  },
  el: {
    title: "Γίνε beta tester",
    desc: "Δήλωσε συμμετοχή και μάθε πρώτος πότε ξεκινά η κλειστή beta. Βοήθησε να εξελιχθεί το Y-Dude με το feedback σου.",
    placeholder: "Το email σου",
    button: "Notify Me",
    consent:
      "Συμφωνώ ότι η διεύθυνση email μου αποθηκεύεται αποκλειστικά για να ενημερωθώ για την έναρξη του Y-Dude. Έχω διαβάσει την πολιτική απορρήτου.",
    privacy: "Πολιτική απορρήτου",
    ok: "Σχεδόν έτοιμο! Επιβεβαίωσε τον σύνδεσμο στο email σου.",
    resent: "Ξαναστείλαμε το email επιβεβαίωσης.",
    cooldown: "Περίμενε ένα λεπτό πριν δοκιμάσεις ξανά.",
    already: "Είσαι ήδη επιβεβαιωμένος ✌️",
    fail: "Κάτι πήγε στραβά. Δοκίμασε ξανά.",
    invalid: "Δώσε ένα έγκυρο email.",
    doi: "Double opt-in: θα λάβεις email επιβεβαίωσης. Μόνο μετά το κλικ στον σύνδεσμο (ισχύει 24 ώρες) θα χρησιμοποιηθεί η διεύθυνσή σου.",
    captcha: "Ολοκλήρωσε τον έλεγχο ασφαλείας και δοκίμασε ξανά.",
    mailfail:
      "Η εγγραφή αποθηκεύτηκε, αλλά το email επιβεβαίωσης δεν στάλθηκε. Δοκίμασε ξανά αργότερα.",
  },
} as const;

export function NotifyForm() {
  const { lang } = useLang();
  const c = COPY[lang as keyof typeof COPY] ?? COPY.en;
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<TurnstileHandle | null>(null);
  const subscribe = useServerFn(subscribeNewsletter);

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
    } catch {
      captchaRef.current?.reset();
      setCaptchaToken(null);
      toast.error(c.fail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-brand/20 bg-surface p-5 text-left shadow-[0_0_22px_oklch(0.82_0.24_150/0.15)]">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-lg border border-brand/40 flex items-center justify-center text-brand">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <div className="text-lg font-bold sm:text-xl">{c.title}</div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.desc}</div>
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
