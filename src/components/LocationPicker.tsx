import { CloseButton } from "@/components/ui/nav-buttons";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Loader2, RotateCcw, ListFilter, Eye } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { formatPlace, type GeoPlace } from "@/lib/geo";

async function reverseGeocode(lat: number, lon: number, lang: string): Promise<GeoPlace> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("geocode failed");
  const d = (await res.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
    countryName?: string;
  };
  const city = d.city || d.locality || "";
  if (!city && !d.countryName) throw new Error("no place");
  return { city, region: d.principalSubdivision ?? "", country: d.countryName ?? "" };
}

type State = "idle" | "loading" | "ok" | "denied" | "error";

/**
 * Automatische Standorterkennung (HTML5 Geolocation + Reverse Geocoding).
 * Fragt die Berechtigung nur an, wenn sie noch nicht erteilt wurde;
 * bereits erteilte Berechtigungen werden automatisch genutzt.
 */
export function LocationPicker({
  value,
  onChange,
  manualOptions,
}: {
  value: string;
  onChange: (v: string) => void;
  manualOptions: string[];
}) {
  const { t, lang } = useLang();
  const tx = t as unknown as Record<string, string>;
  const [state, setState] = useState<State>("idle");
  const [place, setPlace] = useState<GeoPlace | null>(null);
  const [cityOnly, setCityOnly] = useState(false);
  const [manual, setManual] = useState(false);
  const asked = useRef(false);

  const locate = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 300000,
        }),
      );
      const p = await reverseGeocode(pos.coords.latitude, pos.coords.longitude, lang);
      setPlace(p);
      setState("ok");
      setManual(false);
      onChange(formatPlace(p, cityOnly));
    } catch (err) {
      const code = (err as GeolocationPositionError | undefined)?.code;
      setState(code === 1 ? "denied" : "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, cityOnly]);

  // Bereits erteilte Berechtigung sofort nutzen, sonst erst auf Nutzeraktion fragen.
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const perms = navigator.permissions;
    if (!perms?.query) return;
    perms
      .query({ name: "geolocation" as PermissionName })
      .then((s) => {
        if (s.state === "granted") void locate();
        else if (s.state === "denied") setState("denied");
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCityOnly = () => {
    const next = !cityOnly;
    setCityOnly(next);
    if (place) onChange(formatPlace(place, next));
  };

  const clear = () => {
    setPlace(null);
    setManual(false);
    setState("idle");
    onChange("");
  };

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";
  const pill =
    "inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-brand/60 hover:text-brand";

  return (
    <div className="text-xs text-muted-foreground">
      {tx.region}
      <div className="mt-1 space-y-1.5">
        {manual ? (
          <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">{tx.locationNone ?? "—"}</option>
            {Array.from(new Set([value, ...manualOptions].filter(Boolean))).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : state === "loading" ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
            <span className="truncate">{tx.locationLoading ?? "Standort wird ermittelt…"}</span>
          </div>
        ) : value ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate text-foreground">{value}</span>
            <CloseButton onClick={clear} label={tx.locationRemove ?? "Standort entfernen"} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void locate()}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm hover:border-brand/60"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
            <span className="truncate">{tx.locationDetect ?? "Standort automatisch erkennen"}</span>
          </button>
        )}

        {(state === "denied" || state === "error") && (
          <p className="text-[11px] font-semibold text-brand">
            {state === "denied"
              ? (tx.locationDenied ?? "Standort nicht freigegeben.")
              : (tx.locationError ??
                "Standort konnte nicht ermittelt werden. Bitte erneut versuchen.")}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => void locate()} className={pill}>
            <RotateCcw className="h-3 w-3" /> {tx.locationRetry ?? "Erneut versuchen"}
          </button>
          <button type="button" onClick={() => setManual((m) => !m)} className={pill}>
            <ListFilter className="h-3 w-3" /> {tx.locationManual ?? "Manuell auswählen"}
          </button>
          {place && (
            <button
              type="button"
              onClick={toggleCityOnly}
              aria-pressed={cityOnly}
              className={`${pill} ${cityOnly ? "border-brand/60 text-brand" : ""}`}
            >
              <Eye className="h-3 w-3" /> {tx.locationCityOnly ?? "Nur Stadt anzeigen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
