/**
 * Kategorie-Auswahl fuer Channels (Erstellen und Bearbeiten).
 *
 * Datenquelle ist ausschliesslich `channel_categories` (ueber
 * `listChannelCategories`) – es gibt keine hartcodierten Kategorien im
 * Frontend. Die Hierarchie ergibt sich aus `parentCategoryId` und ist
 * beliebig tief; die Auswahl arbeitet auf der Kette
 * Kategorie → Unterkategorie und speichert immer die tiefste gewaehlte
 * Kategorie-ID. Freitext ist nicht moeglich.
 *
 * Anzeigenamen sind sprachabhaengig (de/en/el), Slug und ID bleiben stabil.
 */

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { categoryLabel, channelTexts } from "@/lib/i18n-channels";

export type PickerCategory = {
  id: string;
  name: string;
  nameEn?: string | null;
  nameEl?: string | null;
  icon?: string | null;
  parentCategoryId: string | null;
  sortOrder?: number;
};

function norm(v: string) {
  return v.trim().toLowerCase();
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  labelCategory,
  labelSub,
}: {
  categories: PickerCategory[];
  /** Gespeicherte Kategorie-ID des Channels (Haupt- oder Unterkategorie). */
  value: string | null;
  onChange: (categoryId: string | null) => void;
  labelCategory?: string;
  labelSub?: string;
}) {
  const { lang } = useLang();
  const c = channelTexts[lang];
  const [q, setQ] = useState("");

  const byId = useMemo(() => new Map(categories.map((x) => [x.id, x])), [categories]);
  const roots = useMemo(() => categories.filter((x) => !x.parentCategoryId), [categories]);

  /** Aktuell gewaehlte Haupt- und Unterkategorie aus dem gespeicherten Wert. */
  const selected = value ? byId.get(value) ?? null : null;
  const parentId = selected ? selected.parentCategoryId ?? selected.id : "";
  const subId = selected && selected.parentCategoryId ? selected.id : "";

  const subs = useMemo(
    () => (parentId ? categories.filter((x) => x.parentCategoryId === parentId) : []),
    [categories, parentId],
  );

  const label = (x: PickerCategory) => categoryLabel(lang, x);
  const term = norm(q);

  /**
   * Treffer aus der Suche – Unterkategorien zuerst, sie sind praeziser.
   * Gesucht wird in allen drei Sprachvarianten, angezeigt in der aktiven.
   */
  const matches = useMemo(() => {
    if (!term) return [];
    return categories
      .filter((x) =>
        [x.name, x.nameEn ?? "", x.nameEl ?? ""].some((n) => norm(n).includes(term)),
      )
      .sort((a, b) => {
        const depth = (x: PickerCategory) => (x.parentCategoryId ? 0 : 1);
        return depth(a) - depth(b) || label(a).localeCompare(label(b));
      })
      .slice(0, 12);
  }, [categories, term, lang]);

  const pathLabel = (x: PickerCategory) => {
    const parent = x.parentCategoryId ? byId.get(x.parentCategoryId) : null;
    return parent ? `${label(parent)} → ${label(x)}` : label(x);
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={c.categorySearchPlaceholder}
          aria-label={c.categorySearchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      {term.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-background p-1">
          {matches.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">{c.noCategoryFound}</p>
          ) : (
            matches.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  onChange(x.id);
                  setQ("");
                }}
                className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {x.icon ? `${x.icon} ` : ""}
                {pathLabel(x)}
              </button>
            ))
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {labelCategory ?? c.categoryLabel}
          </span>
          <select
            value={parentId}
            onChange={(e) => onChange(e.target.value || null)}
            aria-label={labelCategory ?? c.categoryLabel}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand/60"
          >
            <option value="">{c.noCategory}</option>
            {roots.map((x) => (
              <option key={x.id} value={x.id}>
                {x.icon ? `${x.icon} ` : ""}
                {label(x)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {labelSub ?? c.subcategoryLabel}
          </span>
          <select
            value={subId}
            onChange={(e) => onChange(e.target.value || parentId || null)}
            disabled={subs.length === 0}
            aria-label={labelSub ?? c.subcategoryLabel}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand/60 disabled:opacity-50"
          >
            <option value="">{c.noneOption}</option>
            {subs.map((x) => (
              <option key={x.id} value={x.id}>
                {label(x)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected && (
        <p className="text-[11px] text-muted-foreground">
          {c.selectedLabel}: {pathLabel(selected)}
        </p>
      )}
    </div>
  );
}
