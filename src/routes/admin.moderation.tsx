import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Flag,
  Music2,
  RefreshCw,
  Search,
  ShieldBan,
  Trash2,
} from "lucide-react";
import { adminGetModerationQueue, adminModerationDecision } from "@/lib/moderation.functions";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  type ModerationDecision,
  type ModerationQueueFilter,
  type ModerationQueueRow,
} from "@/lib/moderation.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminInput,
  AdminLoading,
  AdminPanel,
  AdminSection,
  formatDateTime,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/moderation")({
  head: () => ({
    meta: [
      { title: "Audio-Moderation — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Gesperrte, gemeldete und zu prüfende SlangTags mit Transkript, KI-Bewertung und Entscheidungsverlauf.",
      },
      { property: "og:title", content: "Audio-Moderation — Y-Dude Admin" },
      {
        property: "og:description",
        content: "SlangTags anhören, Transkript und KI-Bewertung prüfen, entscheiden.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminModeration,
});

const FILTERS: { id: ModerationQueueFilter; label: string }[] = [
  { id: "open", label: "Zu prüfen" },
  { id: "blocked", label: "Gesperrt" },
  { id: "reported", label: "Gemeldet" },
  { id: "all", label: "Alle" },
];

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-brand/15 text-brand",
  blocked: "bg-destructive/15 text-destructive",
  review: "bg-amber-500/15 text-amber-400",
  pending: "bg-white/10 text-muted-foreground",
};

function label(key: string) {
  return CATEGORY_LABELS[key] ?? key;
}

function ModerationCard({
  row,
  onDecide,
}: {
  row: ModerationQueueRow;
  onDecide: (tagId: string, decision: ModerationDecision, note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ModerationDecision | null>(null);
  const [showAi, setShowAi] = useState(false);

  const decide = async (decision: ModerationDecision) => {
    if (decision === "delete" && !window.confirm("SlangTag löschen und sperren?")) return;
    setBusy(decision);
    await onDecide(row.id, decision, note);
    setBusy(null);
  };

  return (
    <AdminPanel className={row.deletedAt ? "opacity-70" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            <span>
              {row.kind === "creator" ? "$$" : "$"}
              {row.name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                STATUS_STYLE[row.status] ?? STATUS_STYLE.pending
              }`}
            >
              {STATUS_LABELS[row.status]}
            </span>
            {row.isMusic && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                <Music2 className="h-3 w-3" /> Musik/Gesang
              </span>
            )}
            {row.reports.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                <Flag className="h-3 w-3" /> {row.reports.length} Meldung(en)
              </span>
            )}
            {row.deletedAt && (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                GELÖSCHT
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            @{row.ownerUsername || "unbekannt"} · Upload {formatDateTime(row.createdAt)} ·{" "}
            {row.duration}
            {row.moderatedAt ? ` · geprüft ${formatDateTime(row.moderatedAt)}` : ""}
          </p>
        </div>
        {row.audioUrl ? (
          <audio controls preload="none" src={row.audioUrl} className="h-8 w-56 max-w-full" />
        ) : (
          <span className="text-[11px] text-muted-foreground">Kein Audio</span>
        )}
      </div>

      <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Transkript
        </p>
        <p className="mt-0.5 text-[12px] text-foreground">
          {row.transcript || <span className="text-muted-foreground">— kein Transkript —</span>}
        </p>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Grund / KI-Bewertung
          </p>
          <p className="mt-0.5 text-[11px] text-foreground">{row.reason || "—"}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Konfidenz {(row.confidence * 100).toFixed(0)}%
          </p>
          {row.labels.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {row.labels.map((l) => (
                <span
                  key={l}
                  className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-foreground"
                >
                  {label(l)}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowAi((v) => !v)}
            className="mt-1 text-[10px] text-brand underline"
          >
            {showAi ? "KI-Rohdaten ausblenden" : "KI-Rohdaten anzeigen"}
          </button>
          {showAi && (
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/40 p-2 text-[9px] leading-tight text-muted-foreground">
              {row.ai}
            </pre>
          )}
        </div>

        <div>
          {row.reports.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Meldungen
              </p>
              <ul className="mt-0.5 space-y-1">
                {row.reports.map((r) => (
                  <li key={r.id} className="text-[11px] text-foreground">
                    <span className="text-destructive">{r.reason || "Meldung"}</span> ·{" "}
                    <span className="text-muted-foreground">
                      @{r.reporterUsername || "?"} · {formatDateTime(r.createdAt)} · {r.status}
                    </span>
                    {r.details && (
                      <span className="block text-[10px] text-muted-foreground">{r.details}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Entscheidungsverlauf
          </p>
          {row.events.length === 0 ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">Noch keine Einträge.</p>
          ) : (
            <ul className="mt-0.5 max-h-40 space-y-1 overflow-auto">
              {row.events.map((e) => (
                <li key={e.id} className="text-[10px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{e.action}</span> ·{" "}
                  {e.actorType === "moderator" ? `@${e.actorUsername || "Moderator"}` : e.actorType}{" "}
                  · {e.fromStatus ? STATUS_LABELS[e.fromStatus] : "—"} →{" "}
                  {e.toStatus ? STATUS_LABELS[e.toStatus] : "—"} · {formatDateTime(e.createdAt)}
                  {e.reason && <span className="block">{e.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <AdminInput
          value={note}
          onChange={setNote}
          placeholder="Notiz zur Entscheidung…"
          className="w-48"
        />
        <AdminButton variant="primary" disabled={busy !== null} onClick={() => void decide("approve")}>
          <Check className="h-3.5 w-3.5" /> Freigeben
        </AdminButton>
        <AdminButton disabled={busy !== null} onClick={() => void decide("recheck")}>
          <RefreshCw className="h-3.5 w-3.5" /> Erneut prüfen
        </AdminButton>
        <AdminButton variant="danger" disabled={busy !== null} onClick={() => void decide("block")}>
          <ShieldBan className="h-3.5 w-3.5" /> Dauerhaft sperren
        </AdminButton>
        <AdminButton variant="danger" disabled={busy !== null} onClick={() => void decide("delete")}>
          <Trash2 className="h-3.5 w-3.5" /> Löschen
        </AdminButton>
      </div>
    </AdminPanel>
  );
}

function AdminModeration() {
  const load = useServerFn(adminGetModerationQueue);
  const decideFn = useServerFn(adminModerationDecision);

  const [filter, setFilter] = useState<ModerationQueueFilter>("open");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ModerationQueueRow[] | null>(null);

  const refresh = useCallback(
    async (f: ModerationQueueFilter, q: string) => {
      setRows(null);
      try {
        setRows(await load({ data: { filter: f, query: q } }));
      } catch {
        setRows([]);
        toast.error("Moderationsliste konnte nicht geladen werden");
      }
    },
    [load],
  );

  useEffect(() => {
    void refresh("open", "");
  }, [refresh]);

  const onDecide = async (tagId: string, decision: ModerationDecision, note: string) => {
    try {
      await decideFn({ data: { tagId, decision, note } });
      toast.success(
        decision === "approve"
          ? "SlangTag freigegeben"
          : decision === "recheck"
            ? "Erneute KI-Prüfung abgeschlossen"
            : decision === "block"
              ? "SlangTag dauerhaft gesperrt"
              : "SlangTag gelöscht",
      );
      await refresh(filter, query);
    } catch {
      toast.error("Entscheidung fehlgeschlagen");
    }
  };

  return (
    <AdminSection
      title="Audio-Moderation"
      description="Speech-to-Text, KI-Inhaltsprüfung und Musikerkennung für alle SlangTags. Unsichere und gemeldete Inhalte landen hier."
      actions={
        <>
          <AdminInput
            value={query}
            onChange={setQuery}
            placeholder="SlangTag suchen…"
            className="w-40"
          />
          <AdminButton onClick={() => void refresh(filter, query)}>
            <Search className="h-3.5 w-3.5" /> Suchen
          </AdminButton>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <AdminButton
            key={f.id}
            variant={f.id === filter ? "primary" : "default"}
            onClick={() => {
              setFilter(f.id);
              void refresh(f.id, query);
            }}
          >
            {f.id === "blocked" ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
            {f.label}
          </AdminButton>
        ))}
      </div>

      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Keine Einträge in dieser Ansicht.</AdminEmpty>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <ModerationCard key={row.id} row={row} onDecide={onDecide} />
          ))}
        </div>
      )}
    </AdminSection>
  );
}
