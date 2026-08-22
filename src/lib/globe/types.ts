/**
 * Slang Globe – Typen.
 *
 * Eigenständiges Modul: keine Abhängigkeit zur bestehenden Y-Dude Plattform.
 * Die Datenquelle ist bewusst hinter `GlobeDataSource` abstrahiert, damit später
 * Live-Daten (Datenbank, Realtime, Zeitreise) ohne Umbau ergänzt werden können.
 */

export type GlobeRange = "today" | "7d" | "30d" | "all";

export type SlangTagStat = {
  name: string;
  plays: number;
  /** Wachstum in Prozent im gewählten Zeitraum. */
  growth: number;
};

export type GlobeRegion = {
  id: string;
  country: string;
  countryCode: string;
  /** Region oder Stadt, falls vorhanden. */
  city?: string;
  lat: number;
  lng: number;
  language: string;
  category: string;
  /** Aktivität 0–1, steuert Heatmap-Farbe und Puls. */
  intensity: number;
  slangTags: number;
  activeUsers: number;
  growth: number;
  trending: SlangTagStat[];
  popular: SlangTagStat[];
};

export type GlobeFilters = {
  range: GlobeRange;
  /**
   * Dokumentiertes Kalenderjahr (Sprach-Jahrgang). Jeder Datensatz im Globe
   * ist eindeutig einem Jahr zugeordnet: `slangtag + region + year`.
   */
  year: number;
  language: string | "all";
  category: string | "all";
  country: string | "all";
};

export type GlobeDataSource = {
  /**
   * `detail` folgt der Zoomstufe: "world" liefert nach Ländern verdichtete
   * Cluster, "region"/"local" die volle Stadtauflösung. Gleiche Argumente
   * liefern immer dieselbe Array-Identität (Cache).
   */
  regions(filters: GlobeFilters, detail?: "world" | "region" | "local"): GlobeRegion[];
  languages(): string[];
  categories(): string[];
  countries(): string[];
};
