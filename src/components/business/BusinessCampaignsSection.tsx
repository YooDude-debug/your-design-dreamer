/**
 * Business-Kampagnen – kompakte Übersicht im Unternehmerbereich.
 *
 * Die Sektion zeigt nur eine Zusammenfassung und führt in den vollständigen
 * Kampagnenbereich `/business/campaigns`. Der Editor ist dort auch ohne
 * aktives Business-Abo nutzbar; das Abo entscheidet ausschliesslich über die
 * tatsächliche Schaltung. Alle Rechte werden serverseitig geprüft.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";

import { useLang } from "@/lib/lang-context";
import type { Lang } from "@/lib/i18n-dict";
import { getMyCampaigns } from "@/lib/business-campaigns.functions";
import { campaignGate } from "@/lib/business-campaigns.shared";

const copy: Record<
  Lang,
  Record<"title" | "subtitle" | "open" | "none" | "limit" | "noPlanHint" | "choosePlan", string>
> = {
  de: {
    title: "Kampagnen",
    subtitle: "Werbung im Y-Dude Feed – klar als Kampagne gekennzeichnet.",
    open: "Kampagnenbereich öffnen",
    none: "Noch keine Kampagne angelegt.",
    limit: "aktive Kampagnen",
    noPlanHint:
      "Kampagnen kannst du jederzeit anlegen, bearbeiten und in der Vorschau prüfen. Für die Veröffentlichung benötigst du einen Business-Tarif.",
    choosePlan: "Business-Tarif auswählen",
  },
  en: {
    title: "Campaigns",
    subtitle: "Ads in the Y-Dude feed – always clearly labelled.",
    open: "Open campaign area",
    none: "No campaign yet.",
    limit: "active campaigns",
    noPlanHint:
      "You can create, edit and preview campaigns at any time. Publishing requires a business plan.",
    choosePlan: "Choose business plan",
  },
  el: {
    title: "Καμπάνιες",
    subtitle: "Διαφημίσεις στο feed – πάντα με σαφή σήμανση.",
    open: "Άνοιγμα περιοχής καμπανιών",
    none: "Καμία καμπάνια ακόμη.",
    limit: "ενεργές καμπάνιες",
    noPlanHint:
      "Μπορείς να δημιουργείς και να επεξεργάζεσαι καμπάνιες ανά πάσα στιγμή. Για δημοσίευση χρειάζεσαι επιχειρηματικό πακέτο.",
    choosePlan: "Επιλογή πακέτου",
  },
};

export function BusinessCampaignsSection({ onChoosePlan }: { onChoosePlan?: () => void } = {}) {
  const { lang } = useLang();
  const c = copy[lang];
  const load = useServerFn(getMyCampaigns);
  const { data } = useQuery({ queryKey: ["business-campaigns"], queryFn: () => load({}) });

  if (!data) return null;
  // Kein Unternehmerkonto: die Sektion gehört nicht in diese Ansicht.
  if (campaignGate(data) === "no_role") return null;

  return (
    <section className="mt-4 rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Megaphone className="h-4 w-4 text-brand" /> {c.title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{c.subtitle}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {data.activeCount} / {data.limit} {c.limit}
        </p>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {data.campaigns.length === 0 ? c.none : null}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/business/campaigns"
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground"
        >
          <Megaphone className="h-3.5 w-3.5" /> {c.open}
        </Link>
        {data.limit <= 0 && onChoosePlan ? (
          <button
            type="button"
            onClick={onChoosePlan}
            className="rounded-xl border border-brand/50 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand"
          >
            {c.choosePlan}
          </button>
        ) : null}
      </div>

      {data.limit <= 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{c.noPlanHint}</p>
      ) : null}
    </section>
  );
}
