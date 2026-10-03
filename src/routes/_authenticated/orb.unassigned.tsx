import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive } from "lucide-react";

import { BackButton } from "@/components/ui/nav-buttons";
import { adminCheckAccess } from "@/lib/admin.functions";
import { goBackOr } from "@/lib/back-nav";
import {
  getOrbUnassignedPage,
  UNASSIGNED_KINDS,
  UNASSIGNED_PAGE_SIZE,
  type UnassignedKind,
} from "@/lib/orb-unassigned.functions";

export const Route = createFileRoute("/_authenticated/orb/unassigned")({
  head: () => ({
    meta: [
      { title: "ORB – Nicht zugeordnet (historische Daten) — Y-Dude" },
      {
        name: "description",
        content: "Nur lesende Admin-Ansicht der ORB-Altdaten ohne Bereichszuordnung.",
      },
      { property: "og:title", content: "ORB – Nicht zugeordnet (historische Daten)" },
      { property: "og:description", content: "Nur lesende Ansicht der ORB-Altdaten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnassignedPageView,
});

const LABEL: Record<UnassignedKind, string> = {
  memories: "Erinnerungen",
  connections: "Verbindungen",
  threads: "Threads",
  messages: "Nachrichten",
};

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "–";
  if (Array.isArray(v)) return `${v.length} Einträge`;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

function UnassignedPageView() {
  const router = useRouter();
  const check = useServerFn(adminCheckAccess);
  const load = useServerFn(getOrbUnassignedPage);
  const [kind, setKind] = useState<UnassignedKind>("memories");
  const [page, setPage] = useState(0);

  const access = useQuery({ queryKey: ["admin-check-access"], queryFn: () => check(), staleTime: 300_000 });
  const isAdmin = !!access.data?.isAdmin;
  const q = useQuery({
    queryKey: ["orb", "unassigned", kind, page],
    queryFn: () => load({ data: { kind, page } }),
    enabled: isAdmin,
  });

  const rows = q.data?.rows ?? [];
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const total = q.data?.total ?? null;
  const lastPage = total !== null ? Math.max(0, Math.ceil(total / UNASSIGNED_PAGE_SIZE) - 1) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <BackButton onClick={() => goBackOr(router, "/orb/knowledge-graph")} />
      <div className="mt-3 flex items-center gap-2">
        <Archive className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-lg font-bold">Nicht zugeordnet – historische Daten</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Nur lesend. Diese Daten stammen aus der Zeit vor den Bereichen Normal, ORB Core und
        Y-Dude, sind keinem Bereich zugeordnet und fließen in keinen Chat ein.
      </p>

      {access.isPending && <p className="mt-6 text-sm text-muted-foreground">Prüfe Zugriff …</p>}
      {access.isSuccess && !isAdmin && (
        <p className="mt-6 text-sm text-muted-foreground">Nur für Admins.</p>
      )}

      {isAdmin && (
        <>
          <div role="tablist" className="mt-4 flex flex-wrap gap-2">
            {UNASSIGNED_KINDS.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={kind === k}
                onClick={() => {
                  setKind(k);
                  setPage(0);
                }}
                className={`rounded-full border border-border px-3 py-1 text-xs font-semibold ${
                  kind === k ? "bg-brand text-primary-foreground" : "bg-background"
                }`}
              >
                {LABEL[k]}
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {total !== null ? `${total} Einträge` : "Anzahl nicht verfügbar"} · Seite {page + 1}
            {total !== null ? ` von ${lastPage + 1}` : ""}
          </p>

          {q.isPending && <p className="mt-4 text-sm text-muted-foreground">Lade …</p>}
          {q.isError && (
            <p className="mt-4 text-sm text-muted-foreground">Daten konnten nicht geladen werden.</p>
          )}

          {rows.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    {cols.map((c) => (
                      <th key={c} className="px-2 py-1.5 font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={String(r["id"])} className="border-t border-border align-top">
                      {cols.map((c) => (
                        <td
                          key={c}
                          className={`px-2 py-1.5 ${
                            c === "content" || c === "body" ? "min-w-[18rem] whitespace-pre-wrap" : "whitespace-nowrap"
                          } ${c.endsWith("id") ? "font-mono text-[10px] text-muted-foreground" : ""}`}
                        >
                          {fmt(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-40"
            >
              Zurück
            </button>
            <button
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-border px-3 py-1 text-xs disabled:opacity-40"
            >
              Weiter
            </button>
          </div>
        </>
      )}
    </div>
  );
}
