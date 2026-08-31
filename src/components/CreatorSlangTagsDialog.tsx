import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Pause, Play, Sparkles, Users, CreditCard, BadgeCheck, Download } from "lucide-react";
import { toast } from "sonner";
import { CloseButton } from "@/components/ui/nav-buttons";
import { useLang } from "@/lib/lang-context";
import { getAudio } from "@/lib/autoplay";
import { paymentsConfigured, getStripeEnvironment } from "@/lib/stripe";
import { CreatorSubscribeDialog } from "@/components/CreatorSubscribeDialog";
import {
  listCreatorSlangTags,
  setCreatorSlangTagTier,
  type CreatorSlangTagList,
  type CreatorSlangTagView,
  type CreatorTagTier,
} from "@/lib/creator-slangtags.functions";
import {
  claimCreatorSlangTag,
  setCreatorSubscriptionPrice,
  setCreatorSubscriptionCancellation,
  CREATOR_MIN_PRICE_CENTS,
  CREATOR_MAX_PRICE_CENTS,
} from "@/lib/creator-subscription.functions";

const TXT = {
  de: {
    title: "Creator SlangTags",
    empty: "Dieser Creator hat noch keine Creator-SlangTags veröffentlicht.",
    loading: "SlangTags werden geladen …",
    failed: "SlangTags konnten nicht geladen werden.",
    preview: "Probeanhören",
    free: "Kostenlos",
    follower: "Für Follower",
    subscriber: "Für Abonnenten",
    locked: "Gesperrt",
    unlocked: "Freigeschaltet",
    hintFollow: "Folge diesem Creator, um diesen SlangTag zu nutzen.",
    hintSub: "Nur mit aktivem Creator-Abo übernehmbar.",
    subSoon: "Dieser Creator bietet noch kein Abo an.",
    manage: "Einstufung",
    access: "Zugriff",
    tierHintFree: "Ohne Follow und ohne Abo übernehmbar.",
    tierHintFollower: "Nur für Follower dieses Creators.",
    tierHintSub: "Nur für aktive Creator-Abonnenten",
    tierHintExclusive: "Exclusive Drop – spezielle 3-Monats-Regel",
    saved: "Einstufung gespeichert.",
    saveFailed: "Einstufung konnte nicht gespeichert werden.",
    close: "Schließen",
    subscribe: "Creator abonnieren",
    perMonth: "/ Monat",
    from: "Ab",
    subscribed: "Abo aktiv",
    cancel: "Abo kündigen",
    resume: "Kündigung zurücknehmen",
    cancelled: "Kündigung zum Periodenende vorgemerkt.",
    resumed: "Kündigung zurückgenommen.",
    cancelFailed: "Aktion nicht möglich.",
    claim: "In meine Bibliothek",
    inLibrary: "Dauerhaft in deiner Bibliothek",
    claimed: "Dauerhaft in deiner Bibliothek gesichert.",
    claimFailed: "Übernahme nicht möglich.",
    priceTitle: "Dein Abopreis",
    priceHint: "Zwischen 2,99 € und 99,99 € pro Monat.",
    priceSave: "Preis speichern",
    priceSaved: "Preis gespeichert.",
    priceFailed: "Preis konnte nicht gespeichert werden.",
    priceMin: "Erlaubt sind 2,99 € bis 99,99 € pro Monat.",
    exclusive: "EXCLUSIVE",
    exclusiveOnly: "Nur für aktive Abonnenten",
    dropPending: "Läuft – dauerhaft ab",
    dropRemaining: "Exemplare übrig",
    dropManage: "Exclusive Drop",
    dropOn: "Als Exclusive Drop markieren",
    dropOff: "Exclusive Drop entfernen",
    dropSaved: "Exclusive Drop gespeichert.",
    dropFailed: "Exclusive Drop konnte nicht gespeichert werden.",
    dropLimit: "Limit",
    permanentNote: "Einmal übernommene SlangTags bleiben dauerhaft in deiner Bibliothek.",
  },
  en: {
    title: "Creator SlangTags",
    empty: "This creator has not published any creator SlangTags yet.",
    loading: "Loading SlangTags …",
    failed: "SlangTags could not be loaded.",
    preview: "Preview",
    free: "Free",
    follower: "For followers",
    subscriber: "For subscribers",
    locked: "Locked",
    unlocked: "Unlocked",
    hintFollow: "Follow this creator to use this SlangTag.",
    hintSub: "Requires an active creator subscription.",
    subSoon: "This creator does not offer a subscription yet.",
    manage: "Tier",
    access: "Access",
    tierHintFree: "Claimable without follow and without subscription.",
    tierHintFollower: "Followers of this creator only.",
    tierHintSub: "Active creator subscribers only",
    tierHintExclusive: "Exclusive drop – special 3-month rule",
    saved: "Tier saved.",
    saveFailed: "Tier could not be saved.",
    close: "Close",
    subscribe: "Subscribe to creator",
    perMonth: "/ month",
    from: "From",
    subscribed: "Subscription active",
    cancel: "Cancel subscription",
    resume: "Resume subscription",
    cancelled: "Cancellation scheduled for period end.",
    resumed: "Cancellation withdrawn.",
    cancelFailed: "Action not possible.",
    claim: "Add to my library",
    inLibrary: "Permanently in your library",
    claimed: "Permanently secured in your library.",
    claimFailed: "Could not add this SlangTag.",
    priceTitle: "Your subscription price",
    priceHint: "Between 2.99 € and 99.99 € per month.",
    priceSave: "Save price",
    priceSaved: "Price saved.",
    priceFailed: "Price could not be saved.",
    priceMin: "Allowed range is 2.99 € to 99.99 € per month.",
    exclusive: "EXCLUSIVE",
    exclusiveOnly: "Active subscribers only",
    dropPending: "Pending – permanent from",
    dropRemaining: "copies left",
    dropManage: "Exclusive drop",
    dropOn: "Mark as exclusive drop",
    dropOff: "Remove exclusive drop",
    dropSaved: "Exclusive drop saved.",
    dropFailed: "Exclusive drop could not be saved.",
    dropLimit: "Limit",
    permanentNote: "SlangTags you claim stay in your library permanently.",
  },
  el: {
    title: "Creator SlangTags",
    empty: "Αυτός ο creator δεν έχει δημοσιεύσει ακόμη creator SlangTags.",
    loading: "Φόρτωση SlangTags …",
    failed: "Δεν ήταν δυνατή η φόρτωση των SlangTags.",
    preview: "Δοκιμή",
    free: "Δωρεάν",
    follower: "Για followers",
    subscriber: "Για συνδρομητές",
    locked: "Κλειδωμένο",
    unlocked: "Ξεκλειδωμένο",
    hintFollow: "Ακολούθησε αυτόν τον creator για να το χρησιμοποιήσεις.",
    hintSub: "Απαιτεί ενεργή συνδρομή creator.",
    subSoon: "Αυτός ο creator δεν προσφέρει ακόμη συνδρομή.",
    manage: "Κατηγορία",
    access: "Πρόσβαση",
    tierHintFree: "Διαθέσιμο χωρίς follow και χωρίς συνδρομή.",
    tierHintFollower: "Μόνο για ακόλουθους αυτού του creator.",
    tierHintSub: "Μόνο για ενεργούς συνδρομητές",
    tierHintExclusive: "Exclusive drop – ειδικός κανόνας 3 μηνών",
    saved: "Αποθηκεύτηκε.",
    saveFailed: "Δεν αποθηκεύτηκε.",
    close: "Κλείσιμο",
    subscribe: "Συνδρομή στον creator",
    perMonth: "/ μήνα",
    from: "Από",
    subscribed: "Ενεργή συνδρομή",
    cancel: "Ακύρωση συνδρομής",
    resume: "Ανάκληση ακύρωσης",
    cancelled: "Η ακύρωση προγραμματίστηκε.",
    resumed: "Η ακύρωση ανακλήθηκε.",
    cancelFailed: "Δεν είναι δυνατό.",
    claim: "Στη βιβλιοθήκη μου",
    inLibrary: "Μόνιμα στη βιβλιοθήκη σου",
    claimed: "Αποθηκεύτηκε μόνιμα στη βιβλιοθήκη σου.",
    claimFailed: "Δεν ήταν δυνατή η προσθήκη.",
    priceTitle: "Η τιμή συνδρομής σου",
    priceHint: "Από 2,99 € έως 99,99 € τον μήνα.",
    priceSave: "Αποθήκευση τιμής",
    priceSaved: "Η τιμή αποθηκεύτηκε.",
    priceFailed: "Η τιμή δεν αποθηκεύτηκε.",
    priceMin: "Επιτρεπτό εύρος: 2,99 € έως 99,99 € τον μήνα.",
    exclusive: "EXCLUSIVE",
    exclusiveOnly: "Μόνο για ενεργούς συνδρομητές",
    dropPending: "Σε εξέλιξη – μόνιμο από",
    dropRemaining: "αντίτυπα διαθέσιμα",
    dropManage: "Exclusive drop",
    dropOn: "Σήμανση ως exclusive drop",
    dropOff: "Αφαίρεση exclusive drop",
    dropSaved: "Αποθηκεύτηκε.",
    dropFailed: "Δεν αποθηκεύτηκε.",
    dropLimit: "Όριο",
    permanentNote: "Τα SlangTags που αποκτάς μένουν μόνιμα στη βιβλιοθήκη σου.",
  },
} as const;

type Txt = { [K in keyof (typeof TXT)["de"]]: string };

function formatPrice(cents: number, currency: string, lang: string): string {
  return new Intl.NumberFormat(lang === "en" ? "en-GB" : lang === "el" ? "el-GR" : "de-DE", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function tierLabel(tier: CreatorTagTier, txt: Txt) {
  if (tier === "free") return `🟢 ${txt.free}`;
  if (tier === "follower") return `🔵 ${txt.follower}`;
  if (tier === "subscriber") return `🟣 ${txt.subscriber}`;
  return `🔥 ${txt.exclusive}`;
}

function TierBadge({ tier, txt }: { tier: CreatorTagTier; txt: Txt }) {
  const cls =
    tier === "free"
      ? "border-brand/50 bg-brand/10 text-brand"
      : tier === "follower"
        ? "border-brand-cyan/50 bg-brand-cyan/10 text-brand-cyan"
        : tier === "subscriber"
          ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-300"
          : "border-amber-400/50 bg-amber-400/10 text-amber-300";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
      {tierLabel(tier, txt)}
    </span>
  );
}

function TagRow({
  tag,
  txt,
  manage,
  onTier,
  onClaim,
}: {
  tag: CreatorSlangTagView;
  txt: Txt;
  manage: boolean;
  onTier: (tagId: string, tier: CreatorTagTier) => void;
  onClaim: (tagId: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = () => {
    if (!tag.previewUrl) return;
    if (!audioRef.current) {
      audioRef.current = getAudio(tag.previewUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <li
      className={`rounded-2xl border border-border bg-background p-3 ${
        tag.unlocked ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!tag.previewUrl}
          aria-label={txt.preview}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand/60 bg-black/40 text-brand disabled:opacity-40"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-black text-brand-cyan">$${tag.name}</span>
            <TierBadge tier={tag.tier} txt={txt} />
            {tag.inLibrary && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand/50 bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                <BadgeCheck className="h-3 w-3" /> {txt.inLibrary}
              </span>
            )}
            {!tag.unlocked && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                <Lock className="h-3 w-3" /> {txt.locked}
              </span>
            )}
          </div>
          {tag.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{tag.description}</p>
          )}
          {!tag.unlocked && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {tag.isDrop
                ? txt.exclusiveOnly
                : tag.tier === "subscriber"
                  ? txt.hintSub
                  : txt.hintFollow}
            </p>
          )}
          {tag.isDrop && tag.dropRemaining != null && !tag.inLibrary && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {tag.dropRemaining} {txt.dropRemaining}
            </p>
          )}
          {tag.dropPending && tag.permanentAfter && (
            <p className="mt-1 text-[11px] text-amber-300">
              {txt.dropPending} {new Date(tag.permanentAfter).toLocaleDateString()}
            </p>
          )}
          {tag.claimable && (
            <button
              type="button"
              onClick={() => onClaim(tag.id)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand/10 px-3 py-1 text-[11px] font-bold text-brand"
            >
              <Download className="h-3 w-3" /> {txt.claim}
            </button>
          )}
        </div>
      </div>

      {manage && (
        <div className="mt-2">
          <label
            htmlFor={`tier-${tag.id}`}
            className="block text-[11px] font-bold text-muted-foreground"
          >
            {txt.access}:
          </label>
          <select
            id={`tier-${tag.id}`}
            value={tag.tier}
            onChange={(e) => onTier(tag.id, e.target.value as CreatorTagTier)}
            className="mt-1 w-full max-w-[16rem] rounded-xl border border-border bg-background px-2 py-1.5 text-[12px] font-bold text-foreground"
          >
            <option value="free">{tierLabel("free", txt)}</option>
            <option value="follower">{tierLabel("follower", txt)}</option>
            <option value="subscriber">{tierLabel("subscriber", txt)}</option>
            <option value="exclusive">{tierLabel("exclusive", txt)}</option>
          </select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {tag.tier === "subscriber"
              ? txt.tierHintSub
              : tag.tier === "exclusive"
                ? txt.tierHintExclusive
                : tag.tier === "free"
                  ? txt.tierHintFree
                  : txt.tierHintFollower}
          </p>
        </div>
      )}
    </li>
  );
}

/**
 * Geteilter Inhalt der Creator-SlangTags (Liste, Abo-Box, Preis-Verwaltung).
 * Wird sowohl im Dialog als auch inline im Profilbereich verwendet.
 */
function CreatorSlangTagsContent({ creatorId, isSelf }: { creatorId: string; isSelf: boolean }) {
  const { lang } = useLang();
  const txt = TXT[lang] ?? TXT.de;
  const roleFlags = useOwnerRoleFlags(creatorId);
  const [state, setState] = useState<CreatorSlangTagList | null>(null);
  const [error, setError] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [priceInput, setPriceInput] = useState("");

  const environment = paymentsConfigured() ? getStripeEnvironment() : ("sandbox" as const);

  const load = useCallback(() => {
    setError(false);
    void listCreatorSlangTags({ data: { creatorId, environment } })
      .then((next) => {
        setState(next);
        if (next.priceCents) setPriceInput((next.priceCents / 100).toFixed(2));
      })
      .catch(() => setError(true));
  }, [creatorId, environment]);

  useEffect(load, [load]);

  const onTier = async (tagId: string, tier: CreatorTagTier) => {
    try {
      await setCreatorSlangTagTier({ data: { tagId, tier } });
      toast.success(txt.saved);
      load();
    } catch {
      toast.error(txt.saveFailed);
    }
  };

  const onClaim = async (tagId: string) => {
    const result = await claimCreatorSlangTag({ data: { tagId, environment } }).catch(() => null);
    if (!result || "error" in result || !result.ok) {
      toast.error(txt.claimFailed);
      return;
    }
    toast.success(txt.claimed);
    load();
  };

  const onSavePrice = async () => {
    const cents = Math.round(Number(priceInput.replace(",", ".")) * 100);
    if (
      !Number.isFinite(cents) ||
      cents < CREATOR_MIN_PRICE_CENTS ||
      cents > CREATOR_MAX_PRICE_CENTS
    ) {
      toast.error(txt.priceMin);
      return;
    }
    const result = await setCreatorSubscriptionPrice({
      data: { priceCents: cents, active: true },
    }).catch(() => null);
    if (!result || "error" in result) {
      toast.error(txt.priceFailed);
      return;
    }
    toast.success(txt.priceSaved);
    load();
  };

  const onCancel = async (resume: boolean) => {
    const result = await setCreatorSubscriptionCancellation({
      data: { creatorId, environment, resume },
    }).catch(() => null);
    if (!result || "error" in result) {
      toast.error(txt.cancelFailed);
      return;
    }
    toast.success(resume ? txt.resumed : txt.cancelled);
    load();
  };

  const priceLabel =
    state?.priceCents != null ? formatPrice(state.priceCents, state.currency, lang) : null;

  return (
    <>
      {state && !isSelf && (
        <div className="mt-3 rounded-2xl border border-border bg-background p-3">
          {state.subscribed ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand">
                <BadgeCheck className="h-4 w-4" /> {txt.subscribed}
                {priceLabel ? ` · ${priceLabel} ${txt.perMonth}` : ""}
              </span>
              <button
                type="button"
                onClick={() => onCancel(state.cancelAtPeriodEnd)}
                className="ml-auto rounded-full border border-border px-3 py-1 text-[11px] font-bold text-muted-foreground"
              >
                {state.cancelAtPeriodEnd ? txt.resume : txt.cancel}
              </button>
            </div>
          ) : state.subscriptionAvailable ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                {priceLabel ?? `${txt.from} 2,99 €`} {txt.perMonth}
              </span>
              <button
                type="button"
                onClick={() => setCheckout(true)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand/10 px-3 py-1.5 text-[11px] font-black text-brand"
              >
                <CreditCard className="h-3.5 w-3.5" /> {txt.subscribe}
              </button>
            </div>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CreditCard className="h-3 w-3" /> {txt.subSoon}
            </p>
          )}
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {state.following ? <Users className="h-3 w-3 text-brand" /> : null}
            {txt.permanentNote}
          </p>
        </div>
      )}

      {/*
       * Creator-Abo ist Creator-only: reine Unternehmerkonten sehen die
       * Preisverwaltung nicht (der Server lehnt sie zusätzlich ab).
       */}
      {state && isSelf && roleFlags.isCreator && (
        <div className="mt-3 rounded-2xl border border-border bg-background p-3">
          <p className="text-xs font-bold text-foreground">{txt.priceTitle}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{txt.priceHint}</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="2.99"
              aria-label={txt.priceTitle}
              className="w-24 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
            <span className="text-xs text-muted-foreground">€ {txt.perMonth}</span>
            <button
              type="button"
              onClick={onSavePrice}
              className="ml-auto rounded-full border border-brand bg-brand/10 px-3 py-1.5 text-[11px] font-black text-brand"
            >
              {txt.priceSave}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-xs text-muted-foreground">{txt.failed}</p>}
      {!error && !state && <p className="mt-4 text-xs text-muted-foreground">{txt.loading}</p>}
      {state && state.tags.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">{txt.empty}</p>
      )}

      {state && state.tags.length > 0 && (
        <ul className="mt-3 space-y-2">
          {state.tags.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              txt={txt}
              manage={isSelf}
              onTier={onTier}
              onClaim={onClaim}
            />
          ))}
        </ul>
      )}

      {checkout && (
        <CreatorSubscribeDialog
          creatorId={creatorId}
          lang={lang in TXT ? (lang as keyof typeof TXT) : "de"}
          onClose={() => {
            setCheckout(false);
            load();
          }}
        />
      )}
    </>
  );
}

/** Dialog-Variante (mobil Bottom-Sheet, Desktop zentriert). */
export function CreatorSlangTagsDialog({
  creatorId,
  isSelf,
  onClose,
}: {
  creatorId: string;
  isSelf: boolean;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const txt = TXT[lang] ?? TXT.de;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={txt.title}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-brand-cyan/40 bg-surface/95 p-4 shadow-glow sm:rounded-2xl"
      >
        <div className="flex items-start gap-2">
          <h2 className="flex flex-1 items-center gap-2 text-sm font-black tracking-tight">
            <Sparkles className="h-4 w-4 text-brand-cyan" /> {txt.title}
          </h2>
          <CloseButton onClick={onClose} label={txt.close} />
        </div>
        <CreatorSlangTagsContent creatorId={creatorId} isSelf={isSelf} />
      </div>
    </div>
  );
}

/**
 * Inline-Bereich für den vorderen, direkt sichtbaren Teil des Creator-Profils.
 * Zeigt dieselben Daten und denselben Status wie der Dialog – ohne Untermenü.
 */
export function CreatorSlangTagsSection({
  creatorId,
  isSelf,
}: {
  creatorId: string;
  isSelf: boolean;
}) {
  const { lang } = useLang();
  const txt = TXT[lang] ?? TXT.de;

  return (
    <section
      aria-label={txt.title}
      className="rounded-2xl border border-brand-cyan/30 bg-surface/60 p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-black tracking-tight">
        <Sparkles className="h-4 w-4 text-brand-cyan" /> {txt.title}
      </h2>
      <CreatorSlangTagsContent creatorId={creatorId} isSelf={isSelf} />
    </section>
  );
}
