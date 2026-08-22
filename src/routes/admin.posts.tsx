import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { adminDeletePost, adminGetPosts } from "@/lib/admin.functions";
import type { AdminPostRow } from "@/lib/admin.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminInput,
  AdminLoading,
  AdminPanel,
  AdminSection,
} from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/posts")({
  head: () => ({
    meta: [
      { title: "Beitragsverwaltung — Y-Dude Admin" },
      { name: "description", content: "Alle Beiträge der Plattform prüfen und entfernen." },
      { property: "og:title", content: "Beitragsverwaltung — Y-Dude Admin" },
      { property: "og:description", content: "Alle Beiträge prüfen und entfernen." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPosts,
});

function AdminPosts() {
  const load = useServerFn(adminGetPosts);
  const del = useServerFn(adminDeletePost);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminPostRow[] | null>(null);

  const refresh = useCallback(
    async (q: string) => {
      setRows(null);
      try {
        setRows(await load({ data: { query: q } }));
      } catch {
        setRows([]);
      }
    },
    [load],
  );

  useEffect(() => {
    void refresh("");
  }, [refresh]);

  return (
    <AdminSection
      title="Beiträge"
      description="Alle Beiträge der Plattform – prüfen und bei Verstößen entfernen."
      actions={
        <>
          <AdminInput
            value={query}
            onChange={setQuery}
            placeholder="Titel suchen…"
            className="w-44"
          />
          <AdminButton onClick={() => void refresh(query)}>
            <Search className="h-3.5 w-3.5" /> Suchen
          </AdminButton>
        </>
      }
    >
      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Keine Beiträge gefunden.</AdminEmpty>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((p) => (
            <AdminPanel key={p.id}>
              <div className="flex gap-3">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-border" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.title || "(ohne Titel)"}</p>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{p.description}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    @{p.username} · {p.region || "—"} · {p.visibility} · ♥ {p.likesCount} · 💬{" "}
                    {p.commentsCount} · {formatDateTime(p.createdAt)}
                  </p>
                </div>
                <AdminButton
                  variant="danger"
                  onClick={() => {
                    if (!window.confirm("Beitrag endgültig löschen?")) return;
                    void del({ data: { id: p.id } })
                      .then(() => {
                        toast.success("Beitrag gelöscht");
                        return refresh(query);
                      })
                      .catch(() => toast.error("Löschen fehlgeschlagen"));
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </AdminButton>
              </div>
            </AdminPanel>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
