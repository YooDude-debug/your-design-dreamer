import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, RefreshCw, RotateCcw, X } from "lucide-react";
import {
  adminDecideAppeal,
  adminListAppeals,
  type AdminAppealRow,
} from "@/lib/moderation-dsa.functions";
import {
  actionLabel,
  appealStatusLabel,
  reasonLabel,
} from "@/lib/moderation-reasons";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPanel,
  AdminSection,
} from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/appeals")({
  head: () => ({
    meta: [
      { title: "Einsprüche — Y-Dude Admin" },
      {
        name: "description",
        content: "Einsprüche gegen Moderationsentscheidungen prüfen und entscheiden.",
      },
      { property: "og:title", content: "Einsprüche — Y-Dude Admin" },
      { property: "og:description", content: "Internes Beschwerdemanagement nach DSA Art. 20." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminAppeals,
});

function AdminAppeals() {
  const load = useServerFn(adminListAppeals);
  const decide = useServerFn(adminDecideAppeal);
  const [rows, setRows] = useState<AdminAppealRow[] | null>(null);
  const [openOnly, setOpenOnly] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const refresh = useCallback(
    async (open: boolean) => {
      setRows(null);
      try {
        setRows(await load({ data: { openOnly: open } }));
      } catch {
        setRows([]);
      }
    },
    [load],
  );

  useEffect(() => {
    void refresh(openOnly);
  }, [refresh, openOnly]);

  const act = (
    id: string,
    decision: "in_review" | "upheld" | "overturned" | "rejected",
    label: string,
  ) => {
    void decide({ data: { appealId: id, decision, note: notes[id] ?? "" } })
      .then(() => {
        toast.success(label);
        return refresh(openOnly);
      })
      .catch(() => toast.error("Aktion fehlgeschlagen"));
  };

  return (
    <AdminSection
      title="Einsprüche"
      description="Internes Beschwerdemanagement gegen Moderationsentscheidungen (DSA Art. 20)."
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
          <AdminButton onClick={() => void refresh(openOnly)}>
            <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
          </AdminButton>
        </>
      }
    >
      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Keine Einsprüche.</AdminEmpty>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <AdminPanel key={r.id}>
              <p className="text-sm font-semibold text-foreground">
                @{r.username} · {appealStatusLabel(r.status)}
              </p>
              {r.action && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {actionLabel(r.action.actionKind)} · {reasonLabel(r.action.reasonCode)} ·{" "}
                  {r.action.targetLabel || r.action.targetType} ·{" "}
                  {formatDateTime(r.action.createdAt)}
                  {r.action.automated ? " · automatisiert" : ""}
                </p>
              )}
              {r.action && (
                <p className="mt-1.5 rounded-lg border border-border bg-background/50 p-2 text-[11px] text-muted-foreground">
                  Begründung an den Nutzer: {r.action.publicReason}
                </p>
              )}
              <p className="mt-1.5 rounded-lg border border-brand/25 bg-brand/5 p-2 text-[11px] text-foreground">
                Einspruch ({formatDateTime(r.createdAt)}): {r.message}
              </p>

              {r.status === "submitted" || r.status === "in_review" ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    rows={2}
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                    placeholder="Ergebnis für den Nutzer (wird als Benachrichtigung zugestellt)"
                    className="w-full rounded-lg border border-border bg-background p-2 text-[11px] text-foreground outline-none focus:border-brand/60"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <AdminButton onClick={() => act(r.id, "in_review", "Als in Prüfung markiert")}>
                      <RefreshCw className="h-3.5 w-3.5" /> In Prüfung
                    </AdminButton>
                    <AdminButton onClick={() => act(r.id, "upheld", "Entscheidung bestätigt")}>
                      <Check className="h-3.5 w-3.5" /> Bestätigen
                    </AdminButton>
                    <AdminButton onClick={() => act(r.id, "overturned", "Maßnahme aufgehoben")}>
                      <RotateCcw className="h-3.5 w-3.5" /> Aufheben
                    </AdminButton>
                    <AdminButton variant="danger" onClick={() => act(r.id, "rejected", "Einspruch abgelehnt")}>
                      <X className="h-3.5 w-3.5" /> Ablehnen
                    </AdminButton>
                  </div>
                </div>
              ) : (
                r.decisionNote && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Ergebnis: {r.decisionNote}
                    {r.decidedAt ? ` · ${formatDateTime(r.decidedAt)}` : ""}
                  </p>
                )
              )}
            </AdminPanel>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
