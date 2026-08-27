import { CloseButton } from "@/components/ui/nav-buttons";
import { useCallback, useState } from "react";
import { Lock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { SlangTagName } from "@/components/SlangTagName";
import { slangTagLabel } from "@/lib/slangtag-rules";
import { closeUnlockPrompt, useUnlockTarget } from "@/lib/unlock-prompt";

/** Wird einmal im internen Bereich gemountet. */
export function CreatorUnlockHost() {
  const tag = useUnlockTarget();
  const { t } = useLang();
  const { follow, profiles } = useData();
  const [busy, setBusy] = useState(false);

  const onFollow = useCallback(async () => {
    if (!tag) return;
    setBusy(true);
    const ok = await follow(tag.ownerId);
    setBusy(false);
    if (!ok) return toast.error(t.unlockFailed);
    toast.success(`${slangTagLabel(tag)} ${t.slangTagUnlocked}`);
    closeUnlockPrompt();
  }, [tag, follow, t]);

  if (!tag) return null;
  const owner = profiles[tag.ownerId];

  return (
    <div
      className="fixed inset-0 z-[10000] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={closeUnlockPrompt}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-brand-cyan/40 bg-surface/95 p-5 shadow-glow"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand-cyan/50 bg-brand-cyan/10 text-brand-cyan">
            <Lock className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black tracking-tight">
              <SlangTagName tag={tag} showLock={false} />
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t.unlockCreatorTag}
            </p>
            {(tag.company || owner) && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {tag.company || `@${owner?.username ?? tag.creator}`}
              </p>
            )}
          </div>
          <CloseButton onClick={closeUnlockPrompt} label={t.close} />
        </div>

        <button
          type="button"
          onClick={() => void onFollow()}
          disabled={busy}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" /> {t.followNow}
        </button>
      </div>
    </div>
  );
}
