import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminGetStats } from "@/lib/admin.functions";
import type { AdminStats } from "@/lib/admin.shared";
import {
  AdminLoading,
  AdminPanel,
  AdminSection,
  BarChart,
  DistributionList,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/stats")({
  head: () => ({
    meta: [
      { title: "Statistiken — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Nutzerentwicklung, Beiträge, SlangTags, Regionen, Sprachen, Werbeeinnahmen und Werbepausen.",
      },
      { property: "og:title", content: "Statistiken — Y-Dude Admin" },
      { property: "og:description", content: "Diagramme zur Entwicklung der Plattform." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminStatsPage,
});

function AdminStatsPage() {
  const load = useServerFn(adminGetStats);
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    void load({})
      .then(setStats)
      .catch(() => setStats(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toBars = (points: { date: string; value: number }[]) =>
    points.map((p) => ({ label: p.date.slice(5), value: p.value }));

  return (
    <AdminSection
      title="Statistiken"
      description="Entwicklung der letzten 30 Tage sowie Regionen und Sprachen."
    >
      {!stats ? (
        <AdminLoading />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Werbeumsatz", value: `${(stats.revenueTotalCents / 100).toFixed(2)} €` },
              { label: "Impressionen", value: stats.impressions.toLocaleString("de-DE") },
              { label: "Klicks", value: stats.clicks.toLocaleString("de-DE") },
              {
                label: "CTR",
                value: stats.impressions
                  ? `${((stats.clicks / stats.impressions) * 100).toFixed(2)} %`
                  : "—",
              },
            ].map((s) => (
              <AdminPanel key={s.label}>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-1 text-sm font-bold text-foreground">{s.value}</p>
              </AdminPanel>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <BarChart label="Nutzerentwicklung" data={toBars(stats.users)} />
            <BarChart label="Beiträge" data={toBars(stats.posts)} />
            <BarChart label="SlangTags" data={toBars(stats.slangTags)} />
            <BarChart label="Werbepausen" data={toBars(stats.adPauses)} />
            <BarChart label="Werbeeinnahmen (Cent)" data={toBars(stats.revenue)} />
            <div className="grid gap-3">
              <DistributionList label="Regionen" data={stats.regions} />
              <DistributionList label="Sprachen" data={stats.languages} />
            </div>
          </div>
        </div>
      )}
    </AdminSection>
  );
}
