import { useCallback, useState, useSyncExternalStore } from "react";
import { Lock, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { SlangTagName } from "@/components/SlangTagName";
import { slangTagLabel } from "@/lib/slangtag-rules";
import type { SlangTag } from "@/lib/types";

/**
 * Kleiner globaler Store für die Freischalt-Abfrage. Dadurch kann jede
 * Komponente `openUnlockPrompt(tag)` aufrufen, ohne Props durchzureichen –
 * spätere Freischaltmethoden (Challenge, Event, Premium) lassen sich hier
 * modular ergänzen.
 */
let current: SlangTag | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openUnlockPrompt(tag: SlangTag) {
  current = tag;
  emit();
}
export function closeUnlockPrompt() {
  current = null;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function useUnlockTarget() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

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
          <button
            type="button"
            onClick={closeUnlockPrompt}
            aria-label={t.close}
            className="text-muted-foreground hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
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
