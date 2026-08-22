import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { adminDeleteComment, adminGetComments } from "@/lib/admin.functions";
import type { AdminCommentRow } from "@/lib/admin.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminInput,
  AdminLoading,
  AdminPanel,
  AdminSection,
} from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/comments")({
  head: () => ({
    meta: [
      { property: "og:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
      { name: "twitter:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
      { title: "Kommentarverwaltung — Y-Dude Admin" },
      { name: "description", content: "Kommentare der Plattform durchsuchen und moderieren." },
      { property: "og:title", content: "Kommentarverwaltung — Y-Dude Admin" },
      { property: "og:description", content: "Kommentare durchsuchen und moderieren." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminComments,
});

function AdminComments() {
  const load = useServerFn(adminGetComments);
  const del = useServerFn(adminDeleteComment);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminCommentRow[] | null>(null);

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
      title="Kommentare"
      description="Kommentare durchsuchen und bei Verstößen entfernen."
      actions={
        <>
          <AdminInput
            value={query}
            onChange={setQuery}
            placeholder="Text suchen…"
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
        <AdminEmpty>Keine Kommentare gefunden.</AdminEmpty>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <AdminPanel key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-foreground">{c.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    @{c.username} · zu „{c.postTitle || "—"}" · {formatDateTime(c.createdAt)}
                  </p>
                </div>
                <AdminButton
                  variant="danger"
                  onClick={() => {
                    if (!window.confirm("Kommentar löschen?")) return;
                    void del({ data: { id: c.id } })
                      .then(() => {
                        toast.success("Kommentar gelöscht");
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
