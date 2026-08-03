import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { adminDeleteCampaign, adminGetCampaigns, adminSaveCampaign } from "@/lib/admin.functions";
import type { AdminCampaignRow } from "@/lib/admin.shared";
import {
  AdminButton,
  AdminEmpty,
  AdminInput,
  AdminLoading,
  AdminPanel,
  AdminSection,
  AdminSelect,
} from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/ads")({
  head: () => ({
    meta: [
      { title: "Werbekern — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Werbekampagnen, Unternehmer- und Creator-SlangTags, Klicks, Impressionen und Umsätze verwalten.",
      },
      { property: "og:title", content: "Werbekern — Y-Dude Admin" },
      { property: "og:description", content: "Kampagnen und $$ SlangTags verwalten." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminAds,
});

type Draft = {
  id?: string;
  name: string;
  kind: AdminCampaignRow["kind"];
  status: AdminCampaignRow["status"];
  region: string;
  budgetEur: string;
  revenueEur: string;
  impressions: string;
  clicks: string;
};

const EMPTY: Draft = {
  name: "",
  kind: "campaign",
  status: "draft",
  region: "",
  budgetEur: "0",
  revenueEur: "0",
  impressions: "0",
  clicks: "0",
};

const euro = (cents: number) => `${(cents / 100).toFixed(2)} €`;

function AdminAds() {
  const load = useServerFn(adminGetCampaigns);
  const save = useServerFn(adminSaveCampaign);
  const del = useServerFn(adminDeleteCampaign);
  const [rows, setRows] = useState<AdminCampaignRow[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

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

  const submit = () => {
    if (!draft) return;
    void save({
      data: {
        id: draft.id,
        name: draft.name,
        kind: draft.kind,
        status: draft.status,
        region: draft.region,
        budgetCents: Math.round(Number(draft.budgetEur || "0") * 100),
        revenueCents: Math.round(Number(draft.revenueEur || "0") * 100),
        impressions: Number(draft.impressions || "0"),
        clicks: Number(draft.clicks || "0"),
      },
    })
      .then(() => {
        toast.success("Kampagne gespeichert");
        setDraft(null);
        return refresh();
      })
      .catch(() => toast.error("Speichern fehlgeschlagen"));
  };

  const totals = (rows ?? []).reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenueCents,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
    }),
    { revenue: 0, impressions: 0, clicks: 0 },
  );

  return (
    <AdminSection
      title="Werbekern"
      description="Werbekampagnen, Unternehmer-SlangTags ($$), Creator-SlangTags ($$), Klicks, Impressionen und Umsätze."
      actions={
        <>
          <AdminButton onClick={() => setDraft({ ...EMPTY })}>
            <Plus className="h-3.5 w-3.5" /> Neue Kampagne
          </AdminButton>
          <AdminButton onClick={() => void refresh()}>
            <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
          </AdminButton>
        </>
      }
    >
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Umsatz", value: euro(totals.revenue) },
          { label: "Impressionen", value: totals.impressions.toLocaleString("de-DE") },
          { label: "Klicks", value: totals.clicks.toLocaleString("de-DE") },
          {
            label: "CTR",
            value: totals.impressions
              ? `${((totals.clicks / totals.impressions) * 100).toFixed(2)} %`
              : "—",
          },
        ].map((s) => (
          <AdminPanel key={s.label}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-sm font-bold text-foreground">{s.value}</p>
          </AdminPanel>
        ))}
      </div>

      {draft && (
        <AdminPanel className="mb-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <AdminInput
              value={draft.name}
              onChange={(v) => setDraft({ ...draft, name: v })}
              placeholder="Name"
            />
            <AdminSelect
              value={draft.kind}
              onChange={(v) => setDraft({ ...draft, kind: v })}
              options={[
                { value: "campaign", label: "Werbekampagne" },
                { value: "company_slang_tag", label: "Unternehmer-SlangTag ($$)" },
                { value: "creator_slang_tag", label: "Creator-SlangTag ($$)" },
              ]}
            />
            <AdminSelect
              value={draft.status}
              onChange={(v) => setDraft({ ...draft, status: v })}
              options={[
                { value: "draft", label: "Entwurf" },
                { value: "active", label: "Aktiv" },
                { value: "paused", label: "Pausiert" },
                { value: "ended", label: "Beendet" },
              ]}
            />
            <AdminInput
              value={draft.region}
              onChange={(v) => setDraft({ ...draft, region: v })}
              placeholder="Region"
            />
            <AdminInput
              value={draft.budgetEur}
              onChange={(v) => setDraft({ ...draft, budgetEur: v })}
              placeholder="Budget €"
            />
            <AdminInput
              value={draft.revenueEur}
              onChange={(v) => setDraft({ ...draft, revenueEur: v })}
              placeholder="Umsatz €"
            />
            <AdminInput
              value={draft.impressions}
              onChange={(v) => setDraft({ ...draft, impressions: v })}
              placeholder="Impressionen"
            />
            <AdminInput
              value={draft.clicks}
              onChange={(v) => setDraft({ ...draft, clicks: v })}
              placeholder="Klicks"
            />
            <div className="flex gap-1.5">
              <AdminButton variant="primary" onClick={submit}>
                <Save className="h-3.5 w-3.5" /> Speichern
              </AdminButton>
              <AdminButton onClick={() => setDraft(null)}>
                <X className="h-3.5 w-3.5" /> Abbrechen
              </AdminButton>
            </div>
          </div>
        </AdminPanel>
      )}

      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Noch keine Kampagnen im Werbekern.</AdminEmpty>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <AdminPanel key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {c.name}
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">
                      {c.kind === "campaign" ? "Kampagne" : "$$ SlangTag"}
                    </span>
                    <span
                      className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        c.status === "active"
                          ? "bg-brand/15 text-brand"
                          : "bg-accent text-accent-foreground"
                      }`}
                    >
                      {c.status}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {c.slangTagName ? `$$${c.slangTagName} · ` : ""}
                    {c.region || "global"} · Budget {euro(c.budgetCents)} · Umsatz{" "}
                    {euro(c.revenueCents)} · {c.impressions.toLocaleString("de-DE")} Impressionen ·{" "}
                    {c.clicks.toLocaleString("de-DE")} Klicks · {formatDateTime(c.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <AdminButton
                    onClick={() =>
                      setDraft({
                        id: c.id,
                        name: c.name,
                        kind: c.kind,
                        status: c.status,
                        region: c.region,
                        budgetEur: (c.budgetCents / 100).toFixed(2),
                        revenueEur: (c.revenueCents / 100).toFixed(2),
                        impressions: String(c.impressions),
                        clicks: String(c.clicks),
                      })
                    }
                  >
                    Bearbeiten
                  </AdminButton>
                  <AdminButton
                    variant="danger"
                    onClick={() => {
                      if (!window.confirm("Kampagne löschen?")) return;
                      void del({ data: { id: c.id } })
                        .then(() => {
                          toast.success("Kampagne gelöscht");
                          return refresh();
                        })
                        .catch(() => toast.error("Löschen fehlgeschlagen"));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </AdminButton>
                </div>
              </div>
            </AdminPanel>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
