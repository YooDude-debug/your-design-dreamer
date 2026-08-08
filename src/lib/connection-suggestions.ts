import { supabase } from "@/integrations/supabase/client";

/** Grund, warum ein Profil vorgeschlagen wird (serverseitig berechnet). */
export type SuggestionReason =
  | "mutual"
  | "language"
  | "region"
  | "hashtags"
  | "slangtags"
  | "interests"
  | "active";

export type ConnectionSuggestion = {
  userId: string;
  score: number;
  /** Anzahl gemeinsamer, bestätigter Verbindungen. */
  mutualCount: number;
  reasons: SuggestionReason[];
  computedAt: number;
};

/**
 * Liest die gecachten Freundevorschläge des angemeldeten Kontos.
 * Die Berechnung (inkl. Sichtbarkeits- und Datenschutzregeln) läuft
 * ausschliesslich in der Datenbank – hier wird nur gelesen.
 *
 * Sortierung: Freunde von Freunden zuerst (Priorität 1), danach Score.
 */
export async function fetchConnectionSuggestions(): Promise<ConnectionSuggestion[]> {
  const { data, error } = await supabase
    .from("connection_suggestions")
    .select("suggested_id,score,mutual_count,reasons,computed_at")
    .order("score", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return data
    .map((r) => ({
      userId: r.suggested_id,
      score: Number(r.score ?? 0),
      mutualCount: r.mutual_count ?? 0,
      reasons: (r.reasons ?? []) as SuggestionReason[],
      computedAt: r.computed_at ? new Date(r.computed_at).getTime() : 0,
    }))
    .sort((a, b) =>
      b.mutualCount - a.mutualCount !== 0 ? b.mutualCount - a.mutualCount : b.score - a.score,
    );
}

/**
 * Startet die Neuberechnung im Hintergrund. Ohne `force` rechnet die
 * Datenbank nur, wenn der Cache älter als 10 Minuten ist – dadurch
 * entstehen keine unnötigen Abfragen.
 */
export async function refreshConnectionSuggestions(force = false): Promise<void> {
  await supabase.rpc("refresh_connection_suggestions", { _force: force });
}
