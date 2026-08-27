import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageSquarePlus,
  Users,
  FileText,
  Tag,
  MessageSquare,
  Flag,
  Megaphone,
  Activity,
  PauseCircle,
  BarChart3,
  ScrollText,
  ShieldAlert,
  Rocket,
  ImageOff,
  ShoppingBag,
} from "lucide-react";
import { adminGetOverview } from "@/lib/admin.functions";
import type { AdminOverview } from "@/lib/admin.shared";
import { AdminCard, AdminLoading } from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin-Cockpit — Y-Dude Moderation" },
      {
        name: "description",
        content:
          "Internes Moderations-Dashboard von Y-Dude: Nutzer, Inhalte, Meldungen, Werbekern.",
      },
      { property: "og:title", content: "Admin-Cockpit — Y-Dude Moderation" },
      { property: "og:description", content: "Internes Moderations-Dashboard von Y-Dude." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const load = useServerFn(adminGetOverview);
  const [data, setData] = useState<AdminOverview | null>(null);

  useEffect(() => {
    void load({})
      .then(setData)
      .catch(() => setData(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <h1 className="text-xl font-bold tracking-tight">Moderations-Dashboard</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Jeder Bereich öffnet sich erst beim Anklicken. Alle Admin-Aktionen werden protokolliert.
      </p>

      {!data ? (
        <AdminLoading />
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <AdminCard
            to="/admin/market"
            icon={ShoppingBag}
            label="Market"
            value="→"
            hint="Hervorhebungen, Kennzahlen"
          />
          <AdminCard
            to="/admin/users"
            icon={Users}
            label="Nutzer"
            value={data.users}
            hint="Suchen, sperren, Rollen"
          />
          <AdminCard
            to="/admin/posts"
            icon={FileText}
            label="Beiträge"
            value={data.posts}
            hint="Alle Beiträge verwalten"
          />
          <AdminCard
            to="/admin/slangtags"
            icon={Tag}
            label="SlangTags"
            value={data.slangTags}
            hint="Anhören, bearbeiten, löschen"
          />
          <AdminCard
            to="/admin/comments"
            icon={MessageSquare}
            label="Kommentare"
            value={data.comments}
            hint="Kommentare moderieren"
          />
          <AdminCard
            to="/admin/reports"
            icon={Flag}
            label="Meldungen"
            value={data.reportsOpen}
            hint={`${data.reportsTotal} insgesamt`}
            accent={data.reportsOpen > 0}
          />
          <AdminCard
            to="/admin/ads"
            icon={Megaphone}
            label="Werbekern"
            value={data.campaigns}
            hint="Kampagnen & $$ SlangTags"
          />
          <AdminCard
            to="/admin/active"
            icon={Activity}
            label="Aktive Nutzer"
            value={data.activeUsers}
            hint="Letzte 7 Tage"
          />
          <AdminCard
            to="/admin/pauses"
            icon={PauseCircle}
            label="Werbepausen"
            value={data.adPausesMonth}
            hint="Diesen Monat"
          />
          <AdminCard
            to="/admin/beta"
            icon={Rocket}
            label="Open-Beta-Start"
            value="Startmail"
            hint="Aktivierung & Benachrichtigung"
            accent
          />
          <AdminCard
            to="/admin/feedback"
            icon={MessageSquarePlus}
            label="Feedback"
            value={data.feedbackOpen}
            hint="Verbesserungen & Fehler"
            accent={data.feedbackOpen > 0}
          />
          <AdminCard
            to="/admin/stats"
            icon={BarChart3}
            label="Statistiken"
            value="Diagramme"
            hint="Entwicklung & Regionen"
          />
          <AdminCard
            to="/admin/livetest"
            icon={Activity}
            label="Werbe-Testmodus"
            value="Werbung & Feed"
            hint="Testwerbung & Messungen"
          />

          <AdminCard
            to="/admin/media"
            icon={ImageOff}
            label="Medien ohne Varianten"
            value="Inventur"
            hint="Fehlende __t / __m reparieren"
          />
          <AdminCard
            to="/admin/usernames"
            icon={ShieldAlert}
            label="Gesperrte Usernames"
            value="Sperrliste"
            hint="System, Marken & Impersonation"
          />
          <AdminCard
            to="/admin/health"
            icon={Activity}
            label="Systemzustand"
            value="Überwachung"
            hint="Fehler, Antwortzeiten, Vorfälle"
            accent
          />
          <AdminCard
            to="/admin/log"
            icon={ScrollText}
            label="Sicherheitsprotokoll"
            value={data.auditEntries}
            hint="Admin-Log"
          />
        </div>
      )}
    </div>
  );
}
