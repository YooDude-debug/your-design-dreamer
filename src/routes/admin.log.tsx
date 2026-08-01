import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, ScrollText } from "lucide-react";
import { adminGetAudit } from "@/lib/admin.functions";
import type { AdminAuditRow } from "@/lib/admin.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPanel,
  AdminSection,
  formatDateTime,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/log")({
  head: () => ({
    meta: [
      { title: "Sicherheitsprotokoll — Y-Dude Admin" },
      {
        name: "description",
        content: "Admin-Log: Administrator, Aktion, betroffener Nutzer, Datum und Uhrzeit.",
      },
      { property: "og:title", content: "Sicherheitsprotokoll — Y-Dude Admin" },
      { property: "og:description", content: "Vollständiges Admin-Log aller Moderationsaktionen." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLog,
});

function AdminLog() {
  const load = useServerFn(adminGetAudit);
  const [rows, setRows] = useState<AdminAuditRow[] | null>(null);

  const refresh = useCallback(async () => {
    setRows(null);
    try {
      setRows(await load({ data: { limit: 200 } }));
    } catch {
      setRows([]);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AdminSection
      title="Sicherheitsprotokoll"
      description="Jede Admin-Aktion wird revisionssicher protokolliert."
      actions={
        <AdminButton onClick={() => void refresh()}>
          <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
        </AdminButton>
      }
    >
      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Noch keine Einträge im Admin-Log.</AdminEmpty>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <AdminPanel key={r.id}>
              <div className="flex items-start gap-2">
                <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                <div className="min-w-0">
                  <p className="text-xs text-foreground">
                    <span className="font-semibold">@{r.adminUsername}</span> · {r.action}
                    {r.targetLabel ? ` → ${r.targetLabel}` : ""}
                    {r.targetType ? ` (${r.targetType})` : ""}
                  </p>
                  {r.details && <p className="text-[10px] text-muted-foreground">{r.details}</p>}
                  <p className="text-[10px] text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                </div>
              </div>
            </AdminPanel>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
