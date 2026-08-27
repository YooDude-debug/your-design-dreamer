import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Wrench } from "lucide-react";
import { mediaVariantInventory, repairMissingVariants } from "@/lib/media-variants.functions";
import { AdminSection, AdminLoading } from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/media")({
  head: () => ({
    meta: [
      { title: "Medien ohne Varianten — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Inventur der Bildvarianten: welche Beitrags- und Profilbilder ohne Thumbnail oder mittlere Auflösung ausgeliefert werden.",
      },
      { property: "og:title", content: "Medien ohne Varianten — Y-Dude Admin" },
      { property: "og:description", content: "Inventur und Reparatur fehlender Bildvarianten." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminMediaVariants,
});

type Inventory = Awaited<ReturnType<typeof mediaVariantInventory>>;
type RepairResult = Awaited<ReturnType<typeof repairMissingVariants>>;

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AdminMediaVariants() {
  const loadInventory = useServerFn(mediaVariantInventory);
  const repair = useServerFn(repairMissingVariants);

  const [data, setData] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadInventory({}));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inventur fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runRepair = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await repair({ data: { limit: 20 } }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reparatur fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminSection
      title="Medien ohne Varianten"
      description="Fehlende __t / __m Varianten zwingen den Feed, MB-große Originale zu laden. Die Reparatur läuft in Stapeln von 20 Dateien und ist beliebig wiederholbar."
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refresh()}
            disabled={loading || busy}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Neu prüfen
          </button>
          <button
            onClick={() => void runRepair()}
            disabled={busy || loading || (data?.missingAny ?? 0) === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/50 bg-brand/10 px-3 py-1.5 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/20 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wrench className="h-3.5 w-3.5" />
            )}
            20 reparieren
          </button>
        </div>
      }
    >
      {error && (
        <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {result && (
        <p className="mt-4 rounded-xl border border-brand/40 bg-brand/5 px-3 py-2 text-xs text-foreground">
          {result.processed} geprüft · {result.repaired} repariert · {result.failed} fehlgeschlagen
          · {result.remaining} verbleibend
        </p>
      )}

      {loading && !data ? (
        <AdminLoading />
      ) : !data ? null : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Bilder gesamt" value={data.total} />
            <Stat label="Vollständig" value={data.complete} />
            <Stat label="Ohne Thumbnail" value={data.missingThumb} accent={data.missingThumb > 0} />
            <Stat label="Ohne Medium" value={data.missingMedium} accent={data.missingMedium > 0} />
            <Stat
              label="Unnötige Last"
              value={mb(data.originalBytesMissing)}
              hint={`Varianten ≈ ${mb(data.estimatedExtraBytes)} Speicher`}
            />
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-bold">Pfad</th>
                  <th className="px-3 py-2 font-bold">Fehlt</th>
                  <th className="px-3 py-2 font-bold">Original</th>
                </tr>
              </thead>
              <tbody>
                {data.missingPaths.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      Alle Bilder haben Thumbnail und mittlere Auflösung.
                    </td>
                  </tr>
                ) : (
                  data.missingPaths.slice(0, 100).map((entry) => (
                    <tr key={entry.path} className="border-t border-border/60">
                      <td className="max-w-[320px] truncate px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {entry.path}
                      </td>
                      <td className="px-3 py-2 text-brand">
                        {[entry.missingThumb && "__t", entry.missingMedium && "__m"]
                          .filter(Boolean)
                          .join(" · ")}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{mb(entry.originalBytes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminSection>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${accent ? "border-brand/50 bg-brand/5" : "border-border"}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <p className="mt-1 text-xl font-bold leading-none text-foreground">{value}</p>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
