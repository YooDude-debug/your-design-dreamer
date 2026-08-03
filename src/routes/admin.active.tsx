import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { adminGetActiveUsers } from "@/lib/admin.functions";
import type { AdminActiveUserRow } from "@/lib/admin.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPanel,
  AdminSection,
} from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/active")({
  head: () => ({
    meta: [
      { title: "Aktive Nutzer — Y-Dude Admin" },
      { name: "description", content: "Zuletzt aktive Nutzer der Plattform mit Online-Status." },
      { property: "og:title", content: "Aktive Nutzer — Y-Dude Admin" },
      { property: "og:description", content: "Zuletzt aktive Nutzer mit Online-Status." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminActive,
});

function AdminActive() {
  const load = useServerFn(adminGetActiveUsers);
  const [rows, setRows] = useState<AdminActiveUserRow[] | null>(null);

  const refresh = useCallback(async () => {
    setRows(null);
    try {
      setRows(await load({}));
    } catch {
      setRows([]);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AdminSection
      title="Aktive Nutzer"
      description="Nutzer mit Aktivität in den letzten 7 Tagen."
      actions={
        <AdminButton onClick={() => void refresh()}>
          <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
        </AdminButton>
      }
    >
      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Keine aktiven Nutzer gefunden.</AdminEmpty>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((u) => (
            <AdminPanel key={u.id}>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${u.online ? "bg-brand shadow-glow" : "bg-muted"}`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">@{u.username}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {u.location || "—"} · {u.posts} Beiträge · {formatDateTime(u.lastSeenAt)}
                  </p>
                </div>
              </div>
            </AdminPanel>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
