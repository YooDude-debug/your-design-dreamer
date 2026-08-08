import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { resetFeedAlgorithm } from "@/lib/feed.functions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useLang } from "@/lib/lang-context";
import { useSession } from "@/lib/use-session";

type Copy = {
  heading: string;
  description: string;
  button: string;
  title: string;
  message: string;
  confirm: string;
  done: string;
};

const COPY: Record<string, Copy> = {
  de: {
    heading: "Personalisierter Feed",
    description:
      "Der Feed-Algorithmus lernt aus deinem Nutzungsverhalten, um dir passende Inhalte anzuzeigen. Du kannst diese Lerndaten jederzeit zurücksetzen. Deine Beiträge, Likes, Kommentare, Follower, Slangtags und Einstellungen bleiben dabei erhalten.",
    button: "🔄 Feed-Algorithmus zurücksetzen",
    title: "Feed-Algorithmus zurücksetzen?",
    message:
      "Dadurch werden alle vom Feed-Algorithmus erlernten Präferenzen gelöscht. Dein Konto, Beiträge, Likes, Kommentare, Follower, Slangtags sowie deine freiwillig ausgewählten Interessen bleiben erhalten. Der Feed wird anschließend anhand deiner ausgewählten Interessen neu aufgebaut und lernt dein zukünftiges Nutzungsverhalten erneut.",
    confirm: "Feed zurücksetzen",
    done: "Der Feed-Algorithmus wurde erfolgreich zurückgesetzt. Dein Feed wird nun anhand deiner ausgewählten Interessen neu aufgebaut und lernt dein Nutzungsverhalten erneut.",
  },
  en: {
    heading: "Personalized feed",
    description:
      "The feed algorithm learns from how you use the app to show you relevant content. You can reset this learning data at any time. Your posts, likes, comments, followers, slangtags and settings stay untouched.",
    button: "🔄 Reset feed algorithm",
    title: "Reset feed algorithm?",
    message:
      "This deletes all preferences learned by the feed algorithm. Your account, posts, likes, comments, followers, slangtags and your voluntarily chosen interests remain. The feed is then rebuilt from your chosen interests and starts learning again.",
    confirm: "Reset feed",
    done: "The feed algorithm was reset successfully. Your feed is now rebuilt from your chosen interests and starts learning again.",
  },
  el: {
    heading: "Εξατομικευμένη ροή",
    description:
      "Ο αλγόριθμος ροής μαθαίνει από τη χρήση σου για να σου δείχνει σχετικό περιεχόμενο. Μπορείς να επαναφέρεις αυτά τα δεδομένα όποτε θέλεις. Οι δημοσιεύσεις, τα likes, τα σχόλια, οι ακόλουθοι, τα slangtags και οι ρυθμίσεις σου παραμένουν.",
    button: "🔄 Επαναφορά αλγορίθμου ροής",
    title: "Επαναφορά αλγορίθμου ροής;",
    message:
      "Διαγράφονται όλες οι προτιμήσεις που έμαθε ο αλγόριθμος. Ο λογαριασμός, οι δημοσιεύσεις, τα likes, τα σχόλια, οι ακόλουθοι, τα slangtags και τα ενδιαφέροντα που επέλεξες παραμένουν. Η ροή ξαναχτίζεται από τα επιλεγμένα ενδιαφέροντά σου.",
    confirm: "Επαναφορά ροής",
    done: "Ο αλγόριθμος ροής επαναφέρθηκε. Η ροή ξαναχτίζεται από τα επιλεγμένα ενδιαφέροντά σου και μαθαίνει εκ νέου.",
  },
};

/**
 * Abschnitt "Personalisierter Feed" auf der Datenschutzseite.
 * Nutzt die bestehende Reset-Logik (`resetFeedAlgorithm`) unverändert und wird
 * nur angemeldeten Nutzern angezeigt.
 */
export function FeedResetSection() {
  const { lang } = useLang();
  const copy = COPY[lang] ?? COPY.de;
  const { isSignedIn } = useSession();
  const reset = useServerFn(resetFeedAlgorithm);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!isSignedIn) return null;

  const confirmReset = async () => {
    setBusy(true);
    try {
      await reset();
      setOpen(false);
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface/40 p-5">
      <h2 className="text-base font-semibold sm:text-lg">{copy.heading}</h2>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{copy.description}</p>

      <button
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand bg-brand/15 px-4 py-2 text-sm font-bold text-brand transition-colors hover:bg-brand/25"
      >
        <RotateCcw className="h-4 w-4 shrink-0" />
        {copy.button}
      </button>

      {done && (
        <p role="status" className="mt-3 text-[15px] leading-7 text-brand">
          {copy.done}
        </p>
      )}

      <ConfirmDialog
        open={open}
        title={copy.title}
        message={copy.message}
        confirmLabel={copy.confirm}
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={() => void confirmReset()}
      />
    </section>
  );
}
