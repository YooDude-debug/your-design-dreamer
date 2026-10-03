/**
 * Visual Memory in der Erinnerungs-Detailansicht: nur gespeicherte, echte
 * Verknüpfungen. Manuelles Zuordnen/Aufheben und Löschen nicht zugeordneter
 * Bilder. Keine simulierten Verbindungen oder Aktivierungen.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  deleteOrbVisualAsset,
  getOrbMemoryImages,
  linkOrbMemoryImage,
  unlinkOrbMemoryImage,
} from "@/integrations/y-dude-orb/visual-memory.functions";

const ORIGIN = {
  user_upload: "Upload",
  orb_generated: "ORB-generiert",
  unknown: "unbekannt",
} as const;

type View = {
  id: string;
  sourceType: keyof typeof ORIGIN;
  status: string;
  createdAt: string;
  url: string | null;
};

export function OrbMemoryImages({ memoryId }: { memoryId: string }) {
  const qc = useQueryClient();
  const load = useServerFn(getOrbMemoryImages);
  const link = useServerFn(linkOrbMemoryImage);
  const unlink = useServerFn(unlinkOrbMemoryImage);
  const remove = useServerFn(deleteOrbVisualAsset);
  const key = ["orb-memory-images", memoryId];
  const q = useQuery({ queryKey: key, queryFn: () => load({ data: { memoryId } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const linkM = useMutation({
    mutationFn: (assetId: string) => link({ data: { memoryId, assetId } }),
    onSuccess: (r) => {
      if (!r.ok) toast.error("Zuordnung abgelehnt.");
      void refresh();
    },
  });
  const unlinkM = useMutation({
    mutationFn: (assetId: string) => unlink({ data: { memoryId, assetId } }),
    onSuccess: () => void refresh(),
  });
  const deleteM = useMutation({
    mutationFn: (assetId: string) =>
      remove({ data: { assetId, scope: q.data?.scope ?? "normal" } }),
    onSuccess: (r) => {
      if (!r.ok) toast.error("Bild konnte nicht gelöscht werden.");
      void refresh();
    },
  });

  if (q.isLoading) return <p className="mt-3 text-muted-foreground">Bilder werden geladen …</p>;
  if (q.isError || !q.data)
    return <p className="mt-3 text-muted-foreground">Bilder nicht verfügbar.</p>;
  const { linked, unassigned } = q.data as { linked: View[]; unassigned: View[] };

  return (
    <div data-testid="orb-memory-images">
      <h3 className="mb-1 mt-3 font-bold">Bilder ({linked.length})</h3>
      {linked.length === 0 && <p className="text-muted-foreground">Kein Bild verknüpft.</p>}
      <ul className="grid grid-cols-3 gap-2">
        {linked.map((img) => (
          <Thumb key={img.id} img={img}>
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-brand"
              onClick={() => unlinkM.mutate(img.id)}
            >
              Lösen
            </button>
          </Thumb>
        ))}
      </ul>
      {unassigned.length > 0 && (
        <>
          <h3 className="mb-1 mt-3 font-bold">Nicht zugeordnet ({unassigned.length})</h3>
          <ul className="grid grid-cols-3 gap-2">
            {unassigned.map((img) => (
              <Thumb key={img.id} img={img}>
                {img.status === "stored" && (
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground hover:text-brand"
                    onClick={() => linkM.mutate(img.id)}
                  >
                    Zuordnen
                  </button>
                )}
                <button
                  type="button"
                  className="text-[10px] text-destructive hover:underline"
                  onClick={() => deleteM.mutate(img.id)}
                >
                  Löschen
                </button>
              </Thumb>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Thumb({ img, children }: { img: View; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-0.5">
      {img.url ? (
        <img
          src={img.url}
          alt="Gespeichertes Bild"
          className="aspect-square w-full rounded border border-border object-cover"
        />
      ) : (
        <div className="grid aspect-square place-content-center rounded border border-border text-[10px] text-muted-foreground">
          {img.status}
        </div>
      )}
      <span className="text-[10px] text-muted-foreground">
        {ORIGIN[img.sourceType] ?? "unbekannt"} · {img.status}
      </span>
      <span className="flex gap-2">{children}</span>
    </li>
  );
}
