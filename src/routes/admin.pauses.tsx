import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { adminGetAdPauses } from "@/lib/admin.functions";
import type { AdminAdPauseRow } from "@/lib/admin.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPanel,
  AdminSection,
} from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/pauses")({
  head: () => ({
    meta: [
      { title: "Werbepausen — Y-Dude Admin" },
      {
        name: "description",
        content: "Aktivierte Werbepausen je Nutzer, Monat und Zeitzone einsehen.",
      },
      { property: "og:title", content: "Werbepausen — Y-Dude Admin" },
      { property: "og:description", content: "Aktivierte Werbepausen je Nutzer und Monat." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPauses,
});

function AdminPauses() {
  const load = useServerFn(adminGetAdPauses);
  const [rows, setRows] = useState<AdminAdPauseRow[] | null>(null);

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

  const now = Date.now();

  return (
    <AdminSection
      title="Werbepausen"
      description="Jeder Nutzer hat 3 Werbepausen pro Kalendermonat. Hier siehst du alle Aktivierungen."
      actions={
        <AdminButton onClick={() => void refresh()}>
          <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
        </AdminButton>
      }
    >
      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Noch keine Werbepausen aktiviert.</AdminEmpty>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => {
            const active = new Date(p.endsAt).getTime() > now;
            return (
              <AdminPanel key={p.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      @{p.username}
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          active ? "bg-brand/15 text-brand" : "bg-accent text-accent-foreground"
                        }`}
                      >
                        {active ? "AKTIV" : "ABGELAUFEN"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Tag {p.localDate} · Monat {p.monthKey} · {p.timezone} · endet{" "}
                      {formatDateTime(p.endsAt)} · aktiviert {formatDateTime(p.createdAt)}
                    </p>
                  </div>
                </div>
              </AdminPanel>
            );
          })}
        </div>
      )}
    </AdminSection>
  );
}
