/**
 * Kategorie-Auswahl fuer Channels (Erstellen und Bearbeiten).
 *
 * Datenquelle ist ausschliesslich `channel_categories` (ueber
 * `listChannelCategories`) – es gibt keine hartcodierten Kategorien im
 * Frontend. Die Hierarchie ergibt sich aus `parentCategoryId` und ist
 * beliebig tief; die Auswahl arbeitet auf der Kette
 * Kategorie → Unterkategorie und speichert immer die tiefste gewaehlte
 * Kategorie-ID. Freitext ist nicht moeglich.
 */

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export type PickerCategory = {
  id: string;
  name: string;
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
  labelCategory = "Kategorie",
  labelSub = "Unterkategorie",
}: {
  categories: PickerCategory[];
  /** Gespeicherte Kategorie-ID des Channels (Haupt- oder Unterkategorie). */
  value: string | null;
  onChange: (categoryId: string | null) => void;
  labelCategory?: string;
  labelSub?: string;
}) {
  const [q, setQ] = useState("");

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const roots = useMemo(
    () => categories.filter((c) => !c.parentCategoryId),
    [categories],
  );

  /** Aktuell gewaehlte Haupt- und Unterkategorie aus dem gespeicherten Wert. */
  const selected = value ? byId.get(value) ?? null : null;
  const parentId = selected ? selected.parentCategoryId ?? selected.id : "";
  const subId = selected && selected.parentCategoryId ? selected.id : "";

  const subs = useMemo(
    () => (parentId ? categories.filter((c) => c.parentCategoryId === parentId) : []),
    [categories, parentId],
  );

  const term = norm(q);

  /** Treffer aus der Suche – Unterkategorien zuerst, sie sind praeziser. */
  const matches = useMemo(() => {
    if (!term) return [];
    return categories
      .filter((c) => norm(c.name).includes(term))
      .sort((a, b) => {
        const depth = (x: PickerCategory) => (x.parentCategoryId ? 0 : 1);
        return depth(a) - depth(b) || a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  }, [categories, term]);

  const pathLabel = (c: PickerCategory) => {
    const parent = c.parentCategoryId ? byId.get(c.parentCategoryId) : null;
    return parent ? `${parent.name} → ${c.name}` : c.name;
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kategorie suchen…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      {term.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-background p-1">
          {matches.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">Keine Kategorie gefunden.</p>
          ) : (
            matches.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setQ("");
                }}
                className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {c.icon ? `${c.icon} ` : ""}
                {pathLabel(c)}
              </button>
            ))
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {labelCategory}
          </span>
          <select
            value={parentId}
            onChange={(e) => onChange(e.target.value || null)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand/60"
          >
            <option value="">Ohne Kategorie</option>
            {roots.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {labelSub}
          </span>
          <select
            value={subId}
            onChange={(e) => onChange(e.target.value || parentId || null)}
            disabled={subs.length === 0}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand/60 disabled:opacity-50"
          >
            <option value="">Keine</option>
            {subs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected && (
        <p className="text-[11px] text-muted-foreground">Gewählt: {pathLabel(selected)}</p>
      )}
    </div>
  );
}
