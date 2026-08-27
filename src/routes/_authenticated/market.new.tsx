/**
 * Y-Dude Market – Artikel einstellen (Phase 1).
 *
 * Bilder werden wie überall in Y-Dude über `uploadDataUrl` in den bestehenden
 * Medienspeicher geladen (inklusive Thumbnail/Medium-Varianten). Erst danach
 * legt die Server-Function den Artikel an; scheitert das, werden die Uploads
 * zurückgerollt.
 */

import { CloseButton } from "@/components/ui/nav-buttons";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Loader2, LocateFixed, Search } from "lucide-react";

import { goBackOr } from "@/lib/back-nav";
import { useLang } from "@/lib/lang-context";
import { marketCategoryLabel, marketTexts } from "@/lib/i18n-market";
import { createMarketItem, listMarketCategories } from "@/lib/market.functions";
import { MarketSlangTagField } from "@/components/market/MarketSlangTagField";
import { MarketChannelSuggest } from "@/components/market/MarketChannelSuggest";
import type { MarketDelivery, MarketItemCondition } from "@/lib/market.server";
import { removeUploads, uploadDataUrl } from "@/lib/media";
import { formatPlace, reverseGeoPoint, searchGeoPoints, type GeoPoint } from "@/lib/geo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/market/new")({
  head: () => ({
    meta: [
      { title: "Artikel einstellen — Y-Dude Market" },
      {
        name: "description",
        content:
          "Artikel bei Y-Dude Market einstellen: Bilder, Preis, Beschreibung, Kategorie und Standort.",
      },
      { property: "og:title", content: "Artikel einstellen — Y-Dude Market" },
      { property: "og:description", content: "Lokal verkaufen mit Y-Dude Market." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => <Notice kind="error" />,
  notFoundComponent: () => <Notice kind="notFound" />,
  component: NewMarketItem,
});

function Notice({ kind }: { kind: "error" | "notFound" }) {
  const { lang } = useLang();
  const m = marketTexts[lang];
  return (
    <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
      {kind === "error" ? m.loadFailed : m.notFound}
    </div>
  );
}

const MAX_IMAGES = 8;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function NewMarketItem() {
  const { lang } = useLang();
  const m = marketTexts[lang];
  const router = useRouter();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [negotiable, setNegotiable] = useState(true);
  const [categoryId, setCategoryId] = useState<string>("");
  const [condition, setCondition] = useState<MarketItemCondition>("good");
  const [delivery, setDelivery] = useState<MarketDelivery>("pickup");
  const [images, setImages] = useState<string[]>([]);
  const [slangTagIds, setSlangTagIds] = useState<string[]>([]);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<GeoPoint[]>([]);
  const [place, setPlace] = useState<GeoPoint | null>(null);

  const loadCategories = useServerFn(listMarketCategories);
  const create = useServerFn(createMarketItem);

  const { data: categories = [] } = useQuery({
    queryKey: ["market-categories"],
    queryFn: () => loadCategories(),
    staleTime: 10 * 60_000,
  });

  // Ortssuche entprellt (350 ms), gleicher Dienst wie im Slang Globe.
  useEffect(() => {
    const q = placeQuery.trim();
    if (q.length < 2) {
      setPlaceResults([]);
      return;
    }
    const id = window.setTimeout(() => {
      void searchGeoPoints(q, lang)
        .then(setPlaceResults)
        .catch(() => setPlaceResults([]));
    }, 350);
    return () => window.clearTimeout(id);
  }, [placeQuery, lang]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const point = await reverseGeoPoint(pos.coords.latitude, pos.coords.longitude, lang);
          setPlace(point);
          setPlaceQuery("");
          setPlaceResults([]);
        } catch {
          /* Ort bleibt leer – der Nutzer kann ihn manuell suchen. */
        }
      },
      () => undefined,
      { timeout: 8000 },
    );
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(0, room));
    const urls = await Promise.all(picked.map(fileToDataUrl));
    setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
  };

  const submit = async () => {
    if (title.trim().length < 3) {
      toast.error(m.needTitle);
      return;
    }
    if (!categoryId) {
      toast.error(m.needCategory);
      return;
    }
    setBusy(true);
    let uploaded: string[] = [];
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("no session");

      for (const dataUrl of images) {
        const path = await uploadDataUrl(uid, dataUrl, "images");
        if (path) uploaded.push(path);
      }

      const cents = Math.max(0, Math.round(Number(price.replace(",", ".")) * 100) || 0);
      const res = await create({
        data: {
          title: title.trim(),
          description: description.trim(),
          priceCents: cents,
          negotiable,
          categoryId,
          condition,
          delivery,
          place: place ? formatPlace(place, false) : null,
          postalCode: null,
          lat: place?.latitude ?? null,
          lon: place?.longitude ?? null,
          imagePaths: uploaded,
          slangTagIds,
          channelIds,
        },
      });
      uploaded = [];
      toast.success(m.created);
      void navigate({ to: "/market/$itemId", params: { itemId: res.id }, replace: true });
    } catch (e) {
      console.error("[market] create failed", (e as Error).message);
      if (uploaded.length > 0) await removeUploads(uploaded);
      toast.error(m.createFailed);
    } finally {
      setBusy(false);
    }
  };

  const conditions: { value: MarketItemCondition; label: string }[] = [
    { value: "new", label: m.condNew },
    { value: "like_new", label: m.condLikeNew },
    { value: "good", label: m.condGood },
    { value: "used", label: m.condUsed },
  ];
  const deliveries: { value: MarketDelivery; label: string }[] = [
    { value: "pickup", label: m.delPickup },
    { value: "shipping", label: m.delShipping },
    { value: "both", label: m.delBoth },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-28 pt-3 sm:px-4">
      <button
        onClick={() => goBackOr(router, "/market")}
        className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" />
        {m.back}
      </button>

      <h1 className="mb-4 text-xl font-bold text-foreground">{m.createHeading}</h1>

      <div className="space-y-4">
        {/* Bilder */}
        <section className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{m.imagesLabel}</p>
          <div className="grid grid-cols-4 gap-2">
            {images.map((src, i) => (
              <div
                key={`${src.slice(-16)}-${i}`}
                className="relative aspect-square overflow-hidden rounded-xl border border-border/60"
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
                <CloseButton onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))} label={m.cancel} size="sm" className="absolute right-2 top-2" />
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                onClick={() => fileRef.current?.click()}
                className="grid aspect-square place-items-center rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand"
                aria-label={m.addImages}
              >
                <ImagePlus className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">{m.imagesHint}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </section>

        {/* Titel & Beschreibung */}
        <label className="block text-xs text-muted-foreground">
          {m.titleLabel}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={m.titlePlaceholder}
            maxLength={120}
            className="mt-1 w-full rounded-xl border border-border bg-card/60 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand/60"
          />
        </label>

        <label className="block text-xs text-muted-foreground">
          {m.descriptionLabel}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={m.descriptionPlaceholder}
            rows={5}
            maxLength={4000}
            className="mt-1 w-full resize-y rounded-xl border border-border bg-card/60 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand/60"
          />
        </label>

        {/* Preis */}
        <div className="flex items-end gap-3">
          <label className="flex-1 text-xs text-muted-foreground">
            {m.priceLabel}
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="mt-1 w-full rounded-xl border border-border bg-card/60 px-3 py-2 text-sm text-foreground outline-none focus:border-brand/60"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={negotiable}
              onChange={(e) => setNegotiable(e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--brand))]"
            />
            {m.negotiable}
          </label>
        </div>

        {/* Kategorie */}
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{m.categoryLabel}</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryId(cat.id)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  categoryId === cat.id
                    ? "border-brand/60 bg-brand/10 text-brand"
                    : "border-border text-muted-foreground hover:border-brand/50"
                }`}
              >
                {marketCategoryLabel(cat, lang)}
              </button>
            ))}
          </div>
        </div>

        {/* Zustand & Übergabe */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">{m.conditionLabel}</p>
            <div className="flex flex-wrap gap-2">
              {conditions.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCondition(c.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    condition === c.value
                      ? "border-brand/60 bg-brand/10 text-brand"
                      : "border-border text-muted-foreground hover:border-brand/50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">{m.deliveryLabel}</p>
            <div className="flex flex-wrap gap-2">
              {deliveries.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDelivery(d.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    delivery === d.value
                      ? "border-brand/60 bg-brand/10 text-brand"
                      : "border-border text-muted-foreground hover:border-brand/50"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SlangTags & Channels */}
        <MarketSlangTagField tagIds={slangTagIds} onChange={setSlangTagIds} />
        <MarketChannelSuggest
          title={title}
          description={description}
          categoryName={
            categories.find((c) => c.id === categoryId)
              ? marketCategoryLabel(categories.find((c) => c.id === categoryId)!, lang)
              : ""
          }
          value={channelIds}
          onChange={setChannelIds}
        />

        {/* Standort */}
        <section className="space-y-2">
          <p className="text-xs text-muted-foreground">{m.locationLabel}</p>
          {place ? (
            <div className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/5 px-3 py-2 text-sm text-foreground">
              <span className="truncate">{formatPlace(place, false)}</span>
              <CloseButton onClick={() => setPlace(null)} label={m.cancel} className="ml-auto" />
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    placeholder={m.locationPlaceholder}
                    className="w-full rounded-xl border border-border bg-card/60 py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand/60"
                  />
                </div>
                <button
                  onClick={useCurrentLocation}
                  aria-label={m.useMyLocation}
                  title={m.useMyLocation}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
                >
                  <LocateFixed className="h-4 w-4" />
                </button>
              </div>
              {placeResults.length > 0 && (
                <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-card/60">
                  {placeResults.map((p) => (
                    <li key={`${p.latitude},${p.longitude}`}>
                      <button
                        onClick={() => {
                          setPlace(p);
                          setPlaceQuery("");
                          setPlaceResults([]);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-foreground hover:text-brand"
                      >
                        {formatPlace(p, false)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? m.publishing : m.publish}
          </button>
          <button
            onClick={() => goBackOr(router, "/market")}
            className="rounded-full border border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-brand/50 hover:text-brand"
          >
            {m.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
