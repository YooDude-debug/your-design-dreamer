import { useEffect, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";
import { reverseGeoPoint, searchGeoPoints, type GeoPoint } from "@/lib/geo";
import type { SlangDefinition } from "@/lib/slang-definitions";

export type GlobeGeoInput = {
  country: string;
  region: string;
  city: string;
  placeDetail: string;
  language: string;
  latitude: number | null;
  longitude: number | null;
};

function readable(d: SlangDefinition | null) {
  if (!d) return "";
  return [d.city, d.regionName, d.country].filter(Boolean).join(", ");
}

/**
 * „Standort für Globe“ – Geodaten des SlangTag-Namens (nicht der Audio-Variante).
 * Wiederverwendet die bestehende Standortlogik (HTML5-Geolocation + Reverse
 * Geocoding) und speichert zusätzlich echte Koordinaten.
 */
export function GlobeVoteGeo({
  definition,
  canEdit,
  fallbackLanguage,
  onSave,
}: {
  definition: SlangDefinition | null;
  canEdit: boolean;
  fallbackLanguage: string;
  onSave: (geo: GlobeGeoInput) => Promise<void>;
}) {
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoPoint[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [detail, setDetail] = useState(definition?.placeDetail ?? "");
  const [point, setPoint] = useState<GeoPoint | null>(
    definition?.latitude != null && definition?.longitude != null
      ? {
          city: definition.city,
          region: definition.regionName,
          country: definition.country,
          latitude: definition.latitude,
          longitude: definition.longitude,
        }
      : null,
  );

  useEffect(() => {
    if (editing) return;
    setDetail(definition?.placeDetail ?? "");
    setPoint(
      definition?.latitude != null && definition?.longitude != null
        ? {
            city: definition.city,
            region: definition.regionName,
            country: definition.country,
            latitude: definition.latitude,
            longitude: definition.longitude,
          }
        : null,
    );
  }, [definition, editing]);

  const hasGeo = definition?.latitude != null && definition?.longitude != null;

  const runSearch = async () => {
    setBusy(true);
    try {
      setResults(await searchGeoPoints(query, lang));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  const locate = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setPoint(await reverseGeoPoint(pos.coords.latitude, pos.coords.longitude, lang));
          setResults(null);
        } catch {
          /* ignoriert – Nutzer kann suchen */
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  };

  const save = async () => {
    if (!point) return;
    setBusy(true);
    try {
      await onSave({
        country: point.country,
        region: point.region,
        city: point.city,
        placeDetail: detail.trim(),
        language: definition?.sourceLanguage || fallbackLanguage,
        latitude: point.latitude,
        longitude: point.longitude,
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const pill =
    "tap-safe inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[9px] font-bold text-muted-foreground hover:border-brand/50 hover:text-brand";

  if (!editing) {
    return (
      <div className="space-y-1">
        {hasGeo ? (
          <>
            <p className="flex items-center gap-1.5 text-[10px]">
              <MapPin className="h-3 w-3 shrink-0 text-brand" />
              <span className="min-w-0 truncate">
                {[definition!.placeDetail, readable(definition)].filter(Boolean).join(" · ")}
              </span>
            </p>
            <p className="text-[9px] text-muted-foreground">
              {at.geoCoordsLabel}: {definition!.latitude!.toFixed(6)} /{" "}
              {definition!.longitude!.toFixed(6)}
            </p>
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground">{at.geoMissing}</p>
        )}
        <p className="text-[9px] text-muted-foreground">{at.geoHint}</p>
        {canEdit ? (
          <button type="button" onClick={() => setEditing(true)} className={pill}>
            <MapPin className="h-3 w-3" /> {hasGeo ? at.geoEditBtn : at.geoAddBtn}
          </button>
        ) : (
          !hasGeo && <p className="text-[9px] text-muted-foreground">{at.geoOwnerOnlyHint}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="control-field flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5">
          <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runSearch();
              }
            }}
            placeholder={at.geoSearchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runSearch()}
          className="tap-safe shrink-0 rounded-full border border-brand/50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-brand disabled:opacity-50"
        >
          {at.geoSearchBtn}
        </button>
      </div>

      <button type="button" onClick={locate} disabled={locating} className={pill}>
        {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}{" "}
        {at.geoDetectBtn}
      </button>

      {results && (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
          {results.length === 0 ? (
            <li className="px-2 py-1.5 text-[10px] text-muted-foreground">{at.geoNoResults}</li>
          ) : (
            results.map((r) => (
              <li key={`${r.latitude},${r.longitude}`}>
                <button
                  type="button"
                  onClick={() => {
                    setPoint(r);
                    setResults(null);
                  }}
                  className="tap-safe block w-full px-2 py-1.5 text-left text-[10px] hover:bg-brand/10"
                >
                  <span className="font-bold">{r.city || r.region || r.country}</span>
                  <span className="ml-1.5 text-muted-foreground">
                    {[r.region, r.country].filter(Boolean).join(", ")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {point && (
        <div className="rounded-xl border border-brand/40 bg-brand/5 px-2 py-1.5">
          <p className="flex items-center gap-1.5 text-[10px]">
            <MapPin className="h-3 w-3 shrink-0 text-brand" />
            <span className="min-w-0 truncate">
              {[point.city, point.region, point.country].filter(Boolean).join(", ")}
            </span>
          </p>
          <p className="text-[9px] text-muted-foreground">
            {at.geoCoordsLabel}: {point.latitude.toFixed(6)} / {point.longitude.toFixed(6)}
          </p>
        </div>
      )}

      <input
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder={at.geoPlaceDetailPlaceholder}
        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-brand/60"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || !point}
          onClick={() => void save()}
          className="tap-safe rounded-full border border-brand/50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand disabled:opacity-50"
        >
          {at.geoSaveBtn}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing(false)}
          className="tap-safe rounded-full border border-border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground disabled:opacity-50"
        >
          {at.geoCancelBtn}
        </button>
      </div>
    </div>
  );
}
