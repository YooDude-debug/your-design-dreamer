import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, MessageSquarePlus, Bell } from "lucide-react";
import { adminFeedbackList, adminFeedbackUpdate } from "@/lib/feedback.functions";
import {
  categoryLabel,
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  statusLabel,
  type FeedbackCategory,
  type FeedbackRow,
  type FeedbackStatus,
} from "@/lib/feedback.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminLoading,
  AdminPanel,
  AdminSection,
  AdminSelect,
  AdminTabs,
} from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback & Verbesserungen — Y-Dude Admin" },
      {
        name: "description",
        content: "Nutzer-Feedback sichten, bewerten und den Bearbeitungsstatus setzen.",
      },
      { property: "og:title", content: "Feedback & Verbesserungen — Y-Dude Admin" },
      { property: "og:description", content: "Rückmeldungen der Community verwalten." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminFeedback,
});

const STATUS_TABS: { value: FeedbackStatus | "all"; label: string }[] = [
  { value: "all", label: "Alle" },
  ...FEEDBACK_STATUSES.map((s) => ({ value: s.value as FeedbackStatus, label: s.label })),
];

function AdminFeedback() {
  const load = useServerFn(adminFeedbackList);
  const update = useServerFn(adminFeedbackUpdate);

  const [status, setStatus] = useState<FeedbackStatus | "all">("all");
  const [category, setCategory] = useState<FeedbackCategory | "all">("all");
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notify, setNotify] = useState(true);

  const refresh = useCallback(() => {
    setRows(null);
    void load({ data: { status, category } })
      .then((res) => {
        setRows(res.rows);
        setCounts(res.counts);
      })
      .catch(() => setRows([]));
  }, [load, status, category]);

  useEffect(refresh, [refresh]);

  async function setRowStatus(row: FeedbackRow, next: FeedbackStatus) {
    setBusy(row.id);
    try {
      const updated = await update({
        data: { id: row.id, status: next, adminNote: notes[row.id] ?? row.adminNote, notify },
      });
      setRows((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
      toast.success(`Status: ${statusLabel(next)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aktualisierung fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <AdminSection
        title="Feedback & Verbesserungen"
        description="Rückmeldungen aller Rollen. Bei „Erledigt“ oder „Abgelehnt“ wird der Nutzer benachrichtigt."
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AdminTabs
            value={status}
            onChange={setStatus}
            tabs={STATUS_TABS.map((t) => ({
              value: t.value,
              label: t.label,
              badge: counts[t.value] ?? 0,
            }))}
          />
          <div className="flex items-center gap-2">
            <AdminSelect
              value={category}
              onChange={setCategory}
              options={[
                { value: "all" as const, label: "Alle Kategorien" },
                ...FEEDBACK_CATEGORIES.map((c) => ({
                  value: c.value,
                  label: `${c.emoji} ${c.label}`,
                })),
              ]}
            />
            <AdminButton onClick={refresh}>
              <RefreshCw className="h-3.5 w-3.5" /> Neu laden
            </AdminButton>
          </div>
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--color-brand)]"
          />
          <Bell className="h-3.5 w-3.5" /> Nutzer bei Abschluss benachrichtigen
        </label>

        <div className="mt-4 space-y-3">
          {rows === null && <AdminLoading />}
          {rows?.length === 0 && <AdminEmpty>Kein Feedback in dieser Auswahl.</AdminEmpty>}
          {rows?.map((row) => (
            <AdminPanel key={row.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-brand">
                  <MessageSquarePlus className="h-3.5 w-3.5" /> {categoryLabel(row.category)}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {statusLabel(row.status)}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{row.message}</p>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>@{row.username || "—"}</span>
                <span>Rollen: {row.roles.length ? row.roles.join(", ") : "user"}</span>
                <span>Bereich: {row.area || "—"}</span>
                <span>{row.device || "—"}</span>
                <span>{row.browser || "—"}</span>
                <span>{row.os || "—"}</span>
                <span>{formatDateTime(row.createdAt)}</span>
                <span className="font-mono">ID {row.userId.slice(0, 8)}</span>
              </div>

              <textarea
                value={notes[row.id] ?? row.adminNote}
                onChange={(e) => setNotes((p) => ({ ...p, [row.id]: e.target.value }))}
                rows={2}
                placeholder="Interne Notiz / Antwort an den Nutzer"
                className="mt-3 w-full resize-y rounded-lg border border-border bg-background/60 p-2 text-xs focus:border-brand/60 focus:outline-none"
              />

              <div className="mt-2 flex flex-wrap gap-2">
                {FEEDBACK_STATUSES.map((s) => (
                  <AdminButton
                    key={s.value}
                    onClick={() => void setRowStatus(row, s.value)}
                    disabled={busy === row.id || row.status === s.value}
                    variant={
                      s.value === "done" ? "primary" : s.value === "rejected" ? "danger" : "default"
                    }
                  >
                    {s.label}
                  </AdminButton>
                ))}
              </div>
            </AdminPanel>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}
