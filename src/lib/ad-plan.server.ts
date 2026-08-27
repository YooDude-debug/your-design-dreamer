/**
 * Serverseitige Werbeauswahl fuer den normalen Feed.
 *
 * Erzeugt einen Werbeplan: variable Abstaende und dynamisch gemischte
 * Werbearten (Bild/Video). Der Zufall entsteht serverseitig, damit nicht jedes
 * Geraet dieselbe Reihenfolge erhaelt. Personalisierung erfolgt ueber die
 * vorhandenen Interessen-Daten (`interest_confidence` / `user_interests`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  IMAGE_AD_CATALOG,
  VIDEO_AD_CATALOG,
  type AdCatalogEntry,
  type AdKind,
  type AdPlan,
  type AdPlanSlot,
} from "./ad-catalog.shared";
import { isDemoInventoryAllowedFor } from "./ads/demo-inventory.server";
import {
  EMPTY_AD_TARGETING,
  filterAdEntries,
  targetingFromLabels,
  type AdTargeting,
} from "./ads/ad-targeting.shared";

/** Erster Werbeplatz: frueh, aber nicht direkt am Feed-Anfang. */
const FIRST_GAP = [6, 12] as const;
/** Folgende Abstaende variieren deutlich (keine festen Intervalle). */
const NEXT_GAP = [8, 18] as const;
/** Grundwahrscheinlichkeit fuer Videowerbung. */
const VIDEO_SHARE = 0.35;
const SLOTS = 14;

const pick = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

type Viewer = { interests: string[]; region: string };

/**
 * Werbefeed-Einstellung des Nutzers laden (API-fertige Struktur).
 * Leere Auswahl = keine Einschraenkung.
 */
async function loadTargeting(supabase: SupabaseClient, userId: string): Promise<AdTargeting> {
  const { data } = await supabase
    .from("ad_preferences")
    .select("interests")
    .eq("user_id", userId)
    .maybeSingle();
  return targetingFromLabels(data?.interests ?? []);
}

async function loadViewer(supabase: SupabaseClient, userId: string): Promise<Viewer> {
  const [conf, chosen, profile] = await Promise.all([
    supabase
      .from("interest_confidence")
      .select("confidence, interest_categories(slug)")
      .eq("user_id", userId)
      .gte("confidence", 0.2)
      .order("confidence", { ascending: false })
      .limit(20),
    supabase
      .from("user_interests")
      .select("interest_categories(slug)")
      .eq("user_id", userId)
      .limit(20),
    supabase.from("profiles").select("location").eq("id", userId).maybeSingle(),
  ]);

  const slugs = new Set<string>();
  const add = (rows: unknown) => {
    for (const row of (rows as { interest_categories?: { slug?: string } | null }[] | null) ?? []) {
      const slug = row.interest_categories?.slug;
      if (slug) slugs.add(slug.toLowerCase());
    }
  };
  add(conf.data);
  add(chosen.data);

  const location = (profile.data?.location ?? "").toLowerCase();
  const region = /deutsch|berlin|hamburg|münchen|munich|germany/.test(location) ? "DE" : "";
  return { interests: [...slugs], region };
}

/** Personalisierungs-Gewicht einer Werbung fuer diesen Nutzer. */
function weightFor(entry: AdCatalogEntry, viewer: Viewer, seen: Set<string>) {
  let w = 1;
  for (const f of entry.filters) {
    if (viewer.interests.some((slug) => slug.includes(f) || f.includes(slug))) w += 3;
  }
  if (entry.regionCode !== "*" && entry.regionCode === viewer.region) w += 2;
  if (seen.has(entry.id)) w = Math.max(0.35, w * 0.35);
  return w;
}

function weightedPick(pool: AdCatalogEntry[], viewer: Viewer, seen: Set<string>, recent: string[]) {
  const usable = pool.filter((e) => !recent.includes(e.id));
  const list = usable.length > 0 ? usable : pool;
  const weights = list.map((e) => weightFor(e, viewer, seen));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i += 1) {
    r -= weights[i]!;
    if (r <= 0) return list[i]!;
  }
  return list[list.length - 1]!;
}

/** Werbeart waehlen: zufaellig gemischt, aber nie mehr als zwei gleiche in Folge. */
function nextKind(history: AdKind[]): AdKind {
  const last = history.slice(-2);
  if (last.length === 2 && last[0] === last[1]) return last[0] === "video" ? "image" : "video";
  return Math.random() < VIDEO_SHARE ? "video" : "image";
}

export async function buildFeedAdPlan(
  supabase: SupabaseClient,
  userId: string,
  seenIds: string[] = [],
): Promise<AdPlan> {
  // Quellen des Kernels (eigene Kampagnen, Market-Promotions, AdSense, …).
  // Jede Quelle prueft selbst, ob sie einsatzbereit ist.
  const providers = adProviders();
  const readiness = await Promise.all(
    providers.map((p) => Promise.resolve(p.available()).catch(() => false)),
  );
  const providerReady = readiness.some(Boolean);
  // Demo-/Testbestand ist keine echte Werbung: ohne Freigabe (Admin +
  // Testmodus) faellt er weg. Sind zusaetzlich keine echten Quellen bereit,
  // bleibt der Plan leer – der Kernel selbst bleibt unveraendert.
  const demoAllowed = await isDemoInventoryAllowedFor(userId);
  if (!demoAllowed && !providerReady) {
    return { slots: [], createdAt: new Date().toISOString() };
  }
  const viewer = await loadViewer(supabase, userId).catch(() => ({ interests: [], region: "" }));
  const targeting = await loadTargeting(supabase, userId).catch(() => EMPTY_AD_TARGETING);
  // Einstellung → erlaubter Pool → bestehender Algorithmus (unveraendert).
  const imagePool = demoAllowed ? filterAdEntries(IMAGE_AD_CATALOG, targeting) : [];
  const videoPool = demoAllowed ? filterAdEntries(VIDEO_AD_CATALOG, targeting) : [];
  const seen = new Set(seenIds);
  const slots: AdPlanSlot[] = [];
  const kinds: AdKind[] = [];
  const recent: string[] = [];

  let cursor = pick(FIRST_GAP[0], FIRST_GAP[1]);
  for (let i = 0; i < SLOTS; i += 1) {
    let kind = videoPool.length === 0 ? "image" : (nextKind(kinds) as AdKind);
    if (kind === "image" && imagePool.length === 0) kind = "video";
    const afterIndex = cursor - 1;
    // Zuerst echte Werbequellen; nur wenn keine liefert, greift der Demobestand.
    const external = await fillSlot(providers, {
      kind,
      afterIndex,
      interests: viewer.interests,
      region: viewer.region,
      seen: [...seen],
    });
    if (external) {
      slots.push(external);
      kinds.push(external.kind);
      cursor += pick(NEXT_GAP[0], NEXT_GAP[1]);
      continue;
    }
    const pool = kind === "video" ? videoPool : imagePool;
    if (pool.length === 0) break;
    const entry = weightedPick(pool, viewer, seen, recent);
    slots.push({ afterIndex, kind, adId: entry.id, source: "demo" });
    kinds.push(kind);
    recent.push(entry.id);
    if (recent.length > 3) recent.shift();
    cursor += pick(NEXT_GAP[0], NEXT_GAP[1]);
  }

  return { slots, createdAt: new Date().toISOString() };
}
