/**
 * Kampagnen-Messung: nutzt ausschliesslich die bereits vorhandenen Zähler
 * `ad_campaigns.impressions` und `ad_campaigns.clicks`. Kein neues
 * Analytics-System, keine personenbezogene Speicherung von Verhalten.
 *
 * Härtung (F1): Die Datenbankfunktion `increment_campaign_metric` prüft
 * serverseitig Ereignisart, Existenz der Kampagne, Status, Umgebung und
 * Zeitfenster und lässt je Person, Kampagne, Ereignisart und Stunde genau
 * ein gezähltes Ereignis zu. Der Aufrufer kann weder Zählerstände setzen
 * noch fremde Ereignisse beliebig wiederholen.
 */

import type { CampaignEventKind } from "./business-campaigns.shared";

export async function recordCampaignEvent(
  campaignId: string,
  kind: CampaignEventKind,
  actorId: string,
  environment: string,
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("increment_campaign_metric", {
    _id: campaignId,
    _kind: kind,
    _actor: actorId,
    _environment: environment,
  });
  if (error) return false;
  return data === true;
}
