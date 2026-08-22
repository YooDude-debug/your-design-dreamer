/**
 * Read-only Inventur der Bildvarianten.
 *
 * Zählt, für wie viele gespeicherte Bilder `__t.webp` bzw. `__m.webp` fehlen,
 * und beziffert den Speicherbedarf. Verändert oder löscht nichts.
 */

const BUCKET = "media";

type AdminLike = {
  from: (table: string) => {
    select: (cols: string) => {
      not: (
        col: string,
        op: string,
        val: null,
      ) => Promise<{ data: Record<string, unknown>[] | null }>;
    };
  };
  storage: {
    from: (bucket: string) => {
      list: (
        prefix: string,
        opts: { limit: number },
      ) => Promise<{
        data: { name: string; metadata?: { size?: number } | null }[] | null;
      }>;
    };
  };
};

export type MissingEntry = {
  path: string;
  ownerId: string;
  missingThumb: boolean;
  missingMedium: boolean;
  originalBytes: number;
};

export type VariantInventory = {
  total: number;
  complete: number;
  missingThumb: number;
  missingMedium: number;
  missingAny: number;
  originalBytesMissing: number;
  estimatedExtraBytes: number;
  missingPaths: MissingEntry[];
};

function ownerOf(path: string) {
  const slash = path.indexOf("/");
  return slash > 0 ? path.slice(0, slash) : "";
}

function folderOf(path: string) {
  const slash = path.lastIndexOf("/");
  return slash > 0 ? path.slice(0, slash) : "";
}

function baseOf(path: string) {
  const dot = path.lastIndexOf(".");
  return dot > 0 ? path.slice(0, dot) : path;
}

/** Sammelt alle Bildpfade aus Beiträgen und Profilen (ohne GIFs und Varianten). */
async function collectPaths(admin: AdminLike): Promise<string[]> {
  const out = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== "string" || !value || value.startsWith("http")) return;
    if (value.endsWith(".gif")) return;
    const base = baseOf(value);
    if (base.endsWith("__t") || base.endsWith("__m") || base.endsWith("__s")) return;
    out.add(value);
  };

  const posts = await admin.from("posts").select("image_url").not("image_url", "is", null);
  (posts.data ?? []).forEach((row) => add(row["image_url"]));

  const avatars = await admin.from("profiles").select("avatar_url").not("avatar_url", "is", null);
  (avatars.data ?? []).forEach((row) => add(row["avatar_url"]));

  const covers = await admin.from("profiles").select("cover_url").not("cover_url", "is", null);
  (covers.data ?? []).forEach((row) => add(row["cover_url"]));

  return [...out];
}

export async function collectVariantInventory(admin: AdminLike): Promise<VariantInventory> {
  const paths = await collectPaths(admin);

  // Ordnerinhalte einmal pro Ordner lesen statt einmal pro Datei.
  const folders = new Map<string, Map<string, number>>();
  for (const folder of new Set(paths.map(folderOf))) {
    const { data } = await admin.storage.from(BUCKET).list(folder, { limit: 1000 });
    const names = new Map<string, number>();
    (data ?? []).forEach((entry) => names.set(entry.name, entry.metadata?.size ?? 0));
    folders.set(folder, names);
  }

  const inventory: VariantInventory = {
    total: paths.length,
    complete: 0,
    missingThumb: 0,
    missingMedium: 0,
    missingAny: 0,
    originalBytesMissing: 0,
    estimatedExtraBytes: 0,
    missingPaths: [],
  };

  for (const path of paths) {
    const names = folders.get(folderOf(path)) ?? new Map<string, number>();
    const file = path.slice(folderOf(path).length + 1);
    const base = baseOf(file);
    const missingThumb = !names.has(`${base}__t.webp`);
    const missingMedium = !names.has(`${base}__m.webp`);

    if (!missingThumb && !missingMedium) {
      inventory.complete += 1;
      continue;
    }
    if (missingThumb) inventory.missingThumb += 1;
    if (missingMedium) inventory.missingMedium += 1;
    inventory.missingAny += 1;

    const originalBytes = names.get(file) ?? 0;
    inventory.originalBytesMissing += originalBytes;
    // Erfahrungswerte: Thumbnail ~30 KB, Medium ~180 KB.
    inventory.estimatedExtraBytes += (missingThumb ? 30_000 : 0) + (missingMedium ? 180_000 : 0);

    inventory.missingPaths.push({
      path,
      ownerId: ownerOf(path),
      missingThumb,
      missingMedium,
      originalBytes,
    });
  }

  return inventory;
}
