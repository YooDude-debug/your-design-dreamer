import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { DataContext, type DataCtx } from "@/lib/data-context";
import type { SlangTag, SlangTagPlacement } from "@/lib/types";

/**
 * Öffentliche Mini-Vorschau der Slang Box für die Landingpage.
 *
 * Es wird ausschließlich die echte Composer-Technik verwendet:
 * `SlangTagCanvas` (Verschieben, Skalieren, Rotieren, Touch-Gesten) mit dem
 * echten `SlangTagChip` (Darstellung + Audio-Wiedergabe).
 *
 * Da die Landingpage öffentlich ist und keinen `AppDataProvider` besitzt,
 * stellt diese Komponente einen minimalen, rein lesenden DataContext bereit:
 * kein Schreiben, keine Statistik, keine Datenbank.
 */

const stats = {
  plays: 0,
  likes: 0,
  uses: 0,
  shares: 0,
  saves: 0,
  comments: 0,
  clicks: 0,
  conversions: 0,
  reach: 0,
};

/** Baut aus einem gelesenen/aufgenommenen Audio einen Anzeige-SlangTag. */
export function makePreviewTag(input: {
  id: string;
  name: string;
  kind: "community" | "creator";
  audio: string | null;
  region?: string;
  duration?: string;
}): SlangTag {
  return {
    id: input.id,
    name: input.name,
    audio: input.audio,
    audioPath: null,
    duration: input.duration ?? "0:03",
    creatorId: "preview",
    creator: "Y-Dude",
    createdAt: Date.now(),
    region: input.region ?? "",
    language: "de",
    meaning: "",
    transcript: "",
    examples: [],
    stats,
    kind: input.kind,
    ownerId: "preview",
    communityShared: false,
    ownerType: "user",
    company: "",
    verificationStatus: "none",
    unlockType: "open",
    followRequired: false,
    sponsored: false,
    companyInfo: null,
    releasedAt: Date.now(),
    drop: { releaseDate: null, limit: null, expires: null, rarity: null },
  };
}

const startPlacement = (tagId: string): SlangTagPlacement => ({
  id: `preview-${tagId}`,
  tagId,
  x: 50,
  y: 58,
  scale: 0.95,
  rotation: 0,
  variant: "dot",
});

export function PublicSlangTagPreview({
  tag,
  image,
  hint,
  placeLabel,
}: {
  tag: SlangTag;
  /** Aktuelles Testbild – wird vom Tester vorgegeben und bleibt stabil. */
  image: string;
  hint?: string;
  placeLabel: string;
}) {
  const [placements, setPlacements] = useState<SlangTagPlacement[]>(() => [
    startPlacement(tag.id),
  ]);

  useEffect(() => setPlacements([startPlacement(tag.id)]), [tag.id]);

  /** Nur lesender Kontext – der echte Chip braucht `getTag`/`isTagLocked`. */
  const ctx = useMemo(
    () =>
      ({
        getTag: (idOrName: string) =>
          idOrName === tag.id || idOrName.toLowerCase() === tag.name.toLowerCase()
            ? tag
            : undefined,
        isTagLocked: () => false,
        registerPlay: async () => {},
      }) as unknown as DataCtx,
    [tag],
  );

  return (
    <DataContext.Provider value={ctx}>
      <div className="mt-2">
        <SlangTagCanvas
          image={image}
          placements={placements}
          editable
          onChange={setPlacements}
          className="mx-auto h-24 w-full sm:h-24"
        />

        {placements.length === 0 && (
          <button
            type="button"
            onClick={() => setPlacements([startPlacement(tag.id)])}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-brand/60 px-3 py-1.5 text-[11px] font-semibold text-brand transition-all hover:bg-brand/10"
          >
            <Plus className="h-3.5 w-3.5" />
            {placeLabel}
          </button>
        )}

        {hint && (
          <p className="mt-2 text-center text-[10px] leading-snug text-muted-foreground">{hint}</p>
        )}
      </div>
    </DataContext.Provider>
  );
}
