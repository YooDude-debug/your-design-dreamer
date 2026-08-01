import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Trash2, EyeOff, RefreshCw } from "lucide-react";
import {
  adminDeleteReportedContent,
  adminGetReports,
  adminResolveReport,
} from "@/lib/admin.functions";
import type { AdminReportRow, ReportTargetType } from "@/lib/admin.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPanel,
  AdminSection,
  formatDateTime,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Moderation & Meldungen — Y-Dude Admin" },
      {
        name: "description",
        content: "Gemeldete Beiträge, SlangTags, Kommentare, Profile und Nachrichten bearbeiten.",
      },
      { property: "og:title", content: "Moderation & Meldungen — Y-Dude Admin" },
      { property: "og:description", content: "Gemeldete Inhalte prüfen und entscheiden." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminReports,
});

const TABS: { id: ReportTargetType | "all"; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "post", label: "Beiträge" },
  { id: "slang_tag", label: "SlangTags" },
  { id: "comment", label: "Kommentare" },
  { id: "profile", label: "Profile" },
  { id: "message", label: "Nachrichten" },
];

function AdminReports() {
  const load = useServerFn(adminGetReports);
  const resolve = useServerFn(adminResolveReport);
  const removeContent = useServerFn(adminDeleteReportedContent);
  const [tab, setTab] = useState<ReportTargetType | "all">("all");
  const [openOnly, setOpenOnly] = useState(true);
  const [rows, setRows] = useState<AdminReportRow[] | null>(null);

  const refresh = useCallback(
    async (t: ReportTargetType | "all", open: boolean) => {
      setRows(null);
      try {
        setRows(await load({ data: { targetType: t, status: open ? "open" : "all" } }));
      } catch {
        setRows([]);
      }
    },
    [load],
  );

  useEffect(() => {
    void refresh(tab, openOnly);
  }, [refresh, tab, openOnly]);

  const act = (id: string, action: "dismiss" | "resolve" | "remove_content", label: string) => {
    const run =
      action === "remove_content"
        ? removeContent({ data: { id } })
        : resolve({ data: { id, status: action === "dismiss" ? "dismissed" : "resolved" } });
    void run
      .then(() => {
        toast.success(label);
        return refresh(tab, openOnly);
      })
      .catch(() => toast.error("Aktion fehlgeschlagen"));
  };

  return (
    <AdminSection
      title="Moderation"
      description="Gemeldete Beiträge, SlangTags, Kommentare, Profile und Nachrichten."
      actions={
        <>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
              className="accent-brand"
            />
            Nur offene
          </label>
          <AdminButton onClick={() => void refresh(tab, openOnly)}>
            <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
          </AdminButton>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
              tab === t.id
                ? "border-brand/50 bg-brand/15 text-brand"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Keine Meldungen in diesem Bereich.</AdminEmpty>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <AdminPanel key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize text-foreground">
                    {r.targetType.replace("_", " ")} · {r.reason}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.details || "Keine weiteren Angaben"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Gemeldet von @{r.reporterUsername} · {formatDateTime(r.createdAt)} · Status{" "}
                    <span className={r.status === "open" ? "text-brand" : ""}>{r.status}</span>
                  </p>
                  {r.targetLabel && (
                    <p className="mt-1 rounded-lg border border-border bg-background/50 p-2 text-[11px] text-muted-foreground">
                      {r.targetLabel}
                      {r.targetUsername ? ` · @${r.targetUsername}` : ""}
                    </p>
                  )}
                </div>
                {r.status === "open" && (
                  <div className="flex flex-wrap gap-1.5">
                    <AdminButton onClick={() => act(r.id, "dismiss", "Meldung verworfen")}>
                      <EyeOff className="h-3.5 w-3.5" /> Verwerfen
                    </AdminButton>
                    <AdminButton onClick={() => act(r.id, "resolve", "Meldung erledigt")}>
                      <Check className="h-3.5 w-3.5" /> Erledigt
                    </AdminButton>
                    <AdminButton
                      variant="danger"
                      onClick={() => {
                        if (window.confirm("Gemeldeten Inhalt entfernen?"))
                          act(r.id, "remove_content", "Inhalt entfernt");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Inhalt entfernen
                    </AdminButton>
                  </div>
                )}
              </div>
            </AdminPanel>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
