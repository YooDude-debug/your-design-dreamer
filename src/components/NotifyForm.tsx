import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Mail } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

const COPY = {
  de: {
    title: "Bleib im Vibe",
    desc: "Wir melden uns, sobald Y-Dude startet.",
    placeholder: "Deine E-Mail",
    button: "Notify Me",
    consent:
      "Ich stimme zu, dass meine E-Mail-Adresse ausschließlich gespeichert wird, um mich über den Start von Y-Dude zu informieren. Ich habe die Datenschutzerklärung gelesen.",
    privacy: "Datenschutzerklärung",
    ok: "Willkommen im Vibe! 🎧",
    already: "Du bist bereits dabei ✌️",
    fail: "Etwas ist schiefgelaufen. Versuch's nochmal.",
    invalid: "Bitte gib eine gültige E-Mail-Adresse ein.",
  },
  en: {
    title: "Stay in the vibe",
    desc: "We'll let you know as soon as Y-Dude launches.",
    placeholder: "Your email",
    button: "Notify Me",
    consent:
      "I agree that my email address will be stored solely to inform me about the launch of Y-Dude. I have read the privacy policy.",
    privacy: "Privacy Policy",
    ok: "Welcome to the vibe! 🎧",
    already: "You're already in ✌️",
    fail: "Something went wrong. Try again.",
    invalid: "Please enter a valid email address.",
  },
  el: {
    title: "Μείνε στο vibe",
    desc: "Θα σε ενημερώσουμε μόλις ξεκινήσει το Y-Dude.",
    placeholder: "Το email σου",
    button: "Notify Me",
    consent:
      "Συμφωνώ ότι η διεύθυνση email μου αποθηκεύεται αποκλειστικά για να ενημερωθώ για την έναρξη του Y-Dude. Έχω διαβάσει την πολιτική απορρήτου.",
    privacy: "Πολιτική απορρήτου",
    ok: "Καλωσόρισες στο vibe! 🎧",
    already: "Είσαι ήδη μέσα ✌️",
    fail: "Κάτι πήγε στραβά. Δοκίμασε ξανά.",
    invalid: "Δώσε ένα έγκυρο email.",
  },
} as const;

export function NotifyForm() {
  const { lang } = useLang();
  const c = COPY[lang as keyof typeof COPY] ?? COPY.en;
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!consent) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 255) {
      toast.error(c.invalid);
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("newsletter_subscribers" as never)
      .insert({ email: value, language: lang, consent_at: new Date().toISOString() } as never);
    setLoading(false);
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        toast.success(c.already);
        setDone(true);
        setEmail("");
        return;
      }
      toast.error(c.fail);
      return;
    }
    toast.success(c.ok);
    setDone(true);
    setEmail("");
  };

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-surface p-5 text-left">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-lg border border-brand/40 flex items-center justify-center text-brand">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">{c.title}</div>
          <div className="text-xs text-muted-foreground">{c.desc}</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            maxLength={255}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={c.placeholder}
            disabled={loading}
            className="flex-1 rounded-full bg-background border border-border px-4 py-2.5 text-sm outline-none focus:border-brand disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !consent}
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
      </form>
    </div>
  );
}
