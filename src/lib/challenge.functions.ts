import { createServerFn } from "@tanstack/react-start";

export type ChallengeTagPreview = {
  name: string;
  region: string | null;
  language: string | null;
  up: number;
  down: number;
};

export type ChallengeRegion = { region: string; count: number };

export type ChallengeSnapshot = {
  /** Echte, bereits im Globe gelandete SlangTags (kann leer sein). */
  trending: ChallengeTagPreview[];
  /** Regionen mit echten Einreichungen (kann leer sein). */
  regions: ChallengeRegion[];
};

/**
 * Öffentliche Vorschau für den Challenge-Bereich der Landingpage.
 * Liest ausschließlich die anonym lesbaren Globe-Einträge – keine
 * erfundenen Zahlen, keine Platzhalter-Nutzer. Ist noch nichts vorhanden,
 * kommen leere Listen zurück und die UI blendet die Bereiche aus.
 */
export const getChallengeSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<ChallengeSnapshot> => {
    const { createPublicServerClient } = await import("./auth-public.server");
    const supabase = createPublicServerClient();

    const { data, error } = await supabase
      .from("globe_entries")
      .select("normalized_name, region, language, up_count, down_count")
      .order("up_count", { ascending: false })
      .limit(60);

    if (error || !data) return { trending: [], regions: [] };

    const trending: ChallengeTagPreview[] = data.slice(0, 6).map((row) => ({
      name: row.normalized_name,
      region: row.region ?? null,
      language: row.language ?? null,
      up: row.up_count ?? 0,
      down: row.down_count ?? 0,
    }));

    const counts = new Map<string, number>();
    for (const row of data) {
      const region = (row.region ?? "").trim();
      if (!region) continue;
      counts.set(region, (counts.get(region) ?? 0) + 1);
    }
    const regions = [...counts.entries()]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { trending, regions };
  },
);
