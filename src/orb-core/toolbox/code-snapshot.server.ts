/**
 * P25 – Zugang zum serverseitigen Read-only-Lesebestand (nur Server).
 * Liefert `null`, wenn der Bestand im aktuellen Laufzeitumfeld fehlt.
 */

export type CodeSnapshot = {
  files: Record<string, string>;
  meta: { fileCount: number; bytes: number; sha256: string };
};

let cached: CodeSnapshot | null | undefined;

export async function loadCodeSnapshot(): Promise<CodeSnapshot | null> {
  if (cached !== undefined) return cached;
  try {
    const mod = await import("virtual:orb-code-snapshot");
    cached =
      mod.default && Object.keys(mod.default).length > 0
        ? { files: mod.default, meta: mod.meta }
        : null;
  } catch {
    cached = null;
  }
  return cached;
}
