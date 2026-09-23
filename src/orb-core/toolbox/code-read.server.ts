/**
 * P21 – begrenzter, rein lesender Zugriff auf den Projekt-Code.
 *
 * Harte Grenzen dieser Datei:
 *  · sie schreibt nichts: kein `writeFile`, kein `mkdir`, kein `rm`,
 *  · sie liest ausschliesslich innerhalb von `CODE_ANALYSIS_SCOPE`,
 *  · sie entfernt mögliche Zugangsdaten aus jedem gelesenen Inhalt,
 *  · sie kennt Obergrenzen für Dateigrösse, Dateizahl und Treffer,
 *  · sie wirft `CodeAccessUnavailableError`, wenn weder Projektdateien noch
 *    Lesebestand existieren – der Aufrufer meldet CODE_ACCESS_UNAVAILABLE.
 */

import { readFile, readdir, stat } from "node:fs/promises";

import {
  CODE_ANALYSIS_DENY_PATTERNS,
  CODE_ANALYSIS_SCOPE,
  normalizeCodeTarget,
  redactSecrets,
} from "@/orb-core/toolbox/code-contract";
import { loadCodeSnapshot } from "@/orb-core/toolbox/code-snapshot.server";

export const MAX_FILE_BYTES = 240_000;
export const MAX_DIRECTORY_ENTRIES = 300;
export const MAX_SEARCH_FILES = 600;
export const MAX_SEARCH_MATCHES = 80;
export const MAX_EXCERPT_CHARS = 240;

export class CodeAccessUnavailableError extends Error {
  constructor(message = "Kein Codezugang im aktuellen Laufzeitumfeld.") {
    super(message);
    this.name = "CodeAccessUnavailableError";
  }
}

export type DirectoryEntry = { path: string; kind: "file" | "directory" };

/**
 * P25 – Quelle des lesenden Zugriffs. Genau zwei Quellen, beide read-only:
 *  · `filesystem`: echte Projektdateien (Entwicklungsumgebung),
 *  · `snapshot`: serverseitiger, maskierter Lesebestand (gehostete Laufzeit).
 * Fehlen beide, wird CodeAccessUnavailableError geworfen – nie still leer.
 */
export type CodeSource = {
  kind: "filesystem" | "snapshot";
  kindOf(rel: string): Promise<"file" | "directory" | null>;
  size(rel: string): Promise<number>;
  read(rel: string): Promise<string>;
  list(rel: string): Promise<DirectoryEntry[]>;
};

function isMissing(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

function filesystemSource(root: string): CodeSource {
  const abs = (rel: string) => `${root}/${rel}`;
  return {
    kind: "filesystem",
    async kindOf(rel) {
      try {
        const info = await stat(abs(rel));
        return info.isFile() ? "file" : info.isDirectory() ? "directory" : null;
      } catch (error) {
        if (isMissing(error)) return null;
        throw new CodeAccessUnavailableError();
      }
    },
    async size(rel) {
      return (await stat(abs(rel))).size;
    },
    async read(rel) {
      return readFile(abs(rel), "utf8");
    },
    async list(rel) {
      const raw = await readdir(abs(rel), { withFileTypes: true });
      return raw.map((e) => ({
        path: `${rel}/${e.name}`,
        kind: e.isDirectory() ? ("directory" as const) : ("file" as const),
      }));
    },
  };
}

/** Lesebestand als Quelle – rein lesend, nur vorhandene Schlüssel. */
export function createSnapshotSource(files: Record<string, string>): CodeSource {
  const keys = Object.keys(files).sort();
  const isDir = (rel: string) => keys.some((k) => k.startsWith(`${rel}/`));
  return {
    kind: "snapshot",
    async kindOf(rel) {
      if (Object.prototype.hasOwnProperty.call(files, rel)) return "file";
      return isDir(rel) ? "directory" : null;
    },
    async size(rel) {
      return (files[rel] ?? "").length;
    },
    async read(rel) {
      const text = files[rel];
      if (text === undefined) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return text;
    },
    async list(rel) {
      const seen = new Map<string, DirectoryEntry>();
      for (const k of keys) {
        if (!k.startsWith(`${rel}/`)) continue;
        const [head, ...rest] = k.slice(rel.length + 1).split("/");
        const p = `${rel}/${head}`;
        if (!seen.has(p)) seen.set(p, { path: p, kind: rest.length > 0 ? "directory" : "file" });
      }
      return Array.from(seen.values());
    },
  };
}

let sourceOverride: CodeSource | "none" | null = null;

/** Nur für Tests: Quelle erzwingen oder („none“) Codezugang entziehen. */
export function __setCodeSourceForTests(source: CodeSource | "none" | null): void {
  sourceOverride = source;
}

/** Aktive Quelle bestimmen: echte Projektdateien vor Lesebestand. */
export async function getCodeSource(): Promise<CodeSource> {
  if (sourceOverride === "none")
    throw new CodeAccessUnavailableError("Projektdateien absichtlich nicht vorhanden (Test).");
  if (sourceOverride) return sourceOverride;
  const cwd = typeof process !== "undefined" ? process.cwd?.() : undefined;
  if (cwd) {
    const root = cwd.replace(/\/+$/, "");
    try {
      if ((await stat(`${root}/src/orb-core`)).isDirectory()) return filesystemSource(root);
    } catch {
      /* keine Projektdateien hier – Lesebestand prüfen */
    }
  }
  const snapshot = await loadCodeSnapshot();
  if (snapshot) return createSnapshotSource(snapshot.files);
  throw new CodeAccessUnavailableError(
    "Weder Projektdateien noch serverseitiger Lesebestand im Laufzeitumfeld vorhanden.",
  );
}

export type ReadResult =
  | { ok: true; path: string; lines: string[] }
  | { ok: false; reason: string };

/** Eine Datei lesen – maskiert, begrenzt, nur im Lesebereich. */
export async function readCodeFile(target: string): Promise<ReadResult> {
  const scope = normalizeCodeTarget(target);
  if (!scope.ok) return { ok: false, reason: scope.reason };
  const source = await getCodeSource();
  const kind = await source.kindOf(scope.path);
  if (kind === null) return { ok: false, reason: "Datei existiert nicht." };
  if (kind !== "file") return { ok: false, reason: "Ziel ist keine Datei." };
  try {
    if ((await source.size(scope.path)) > MAX_FILE_BYTES)
      return { ok: false, reason: `Datei überschreitet die Obergrenze von ${MAX_FILE_BYTES} Byte.` };
    const raw = await source.read(scope.path);
    return { ok: true, path: scope.path, lines: redactSecrets(raw).split("\n") };
  } catch (error) {
    if (isMissing(error)) return { ok: false, reason: "Datei existiert nicht." };
    throw new CodeAccessUnavailableError();
  }
}

export type ListResult =
  | { ok: true; path: string; entries: DirectoryEntry[] }
  | { ok: false; reason: string };

/** Verzeichnisstruktur lesen (eine Ebene), ausgeschlossene Pfade entfallen. */
export async function listCodeDirectory(target: string): Promise<ListResult> {
  const scope = normalizeCodeTarget(target);
  if (!scope.ok) return { ok: false, reason: scope.reason };
  const source = await getCodeSource();
  const kind = await source.kindOf(scope.path);
  if (kind !== "directory") return { ok: false, reason: "Verzeichnis existiert nicht." };
  let raw: DirectoryEntry[];
  try {
    raw = await source.list(scope.path);
  } catch {
    throw new CodeAccessUnavailableError();
  }
  const entries: DirectoryEntry[] = [];
  for (const entry of raw) {
    if (CODE_ANALYSIS_DENY_PATTERNS.some((re) => re.test(entry.path))) continue;
    entries.push(entry);
    if (entries.length >= MAX_DIRECTORY_ENTRIES) break;
  }
  return { ok: true, path: scope.path, entries };
}

/**
 * Alle lesbaren Dateien unterhalb eines Ziels – mit Obergrenze.
 * Fehlt der Codezugang ganz, wird geworfen (CODE_ACCESS_UNAVAILABLE);
 * existiert nur das Ziel nicht, ist das Ergebnis leer (NO_FILES_FOUND).
 */
export async function collectCodeFiles(
  target: string,
  limit = MAX_SEARCH_FILES,
): Promise<string[]> {
  const scope = normalizeCodeTarget(target);
  if (!scope.ok) return [];
  const source = await getCodeSource();
  const out: string[] = [];
  const queue: string[] = [scope.path];
  while (queue.length > 0 && out.length < limit) {
    const current = queue.shift() as string;
    const kind = await source.kindOf(current);
    if (kind === null) continue;
    if (kind === "file") {
      out.push(current);
      continue;
    }
    const listed = await listCodeDirectory(current);
    if (!listed.ok) continue;
    for (const entry of listed.entries) {
      if (entry.kind === "directory") queue.push(entry.path);
      else if (out.length + queue.length < limit * 4) queue.push(entry.path);
    }
  }
  return out.slice(0, limit);
}

export type CodeMatch = { file: string; line: number; excerpt: string };

/**
 * Textsuche im Lesebereich. Kein Volltextindex, keine Modellsuche: einfache
 * zeilenweise Suche mit harter Obergrenze für Dateien und Treffer.
 */
export async function searchCode(
  pattern: RegExp | string,
  opts?: {
    target?: string;
    maxMatches?: number;
    maxFiles?: number;
    extensions?: readonly string[];
  },
): Promise<CodeMatch[]> {
  const target = opts?.target ?? CODE_ANALYSIS_SCOPE[0];
  const maxMatches = opts?.maxMatches ?? MAX_SEARCH_MATCHES;
  const files = await collectCodeFiles(target, opts?.maxFiles ?? MAX_SEARCH_FILES);
  const exts = opts?.extensions ?? [".ts", ".tsx", ".md", ".sql", ".json", ".css"];
  const re =
    typeof pattern === "string"
      ? new RegExp(escapeRegExp(pattern), "i")
      : new RegExp(pattern.source, pattern.flags.replace("g", ""));
  const matches: CodeMatch[] = [];
  for (const file of files) {
    if (!exts.some((e) => file.endsWith(e))) continue;
    const read = await readCodeFile(file);
    if (!read.ok) continue;
    for (let i = 0; i < read.lines.length; i += 1) {
      const line = read.lines[i] ?? "";
      if (!re.test(line)) continue;
      matches.push({ file, line: i + 1, excerpt: excerpt(line) });
      if (matches.length >= maxMatches) return matches;
    }
  }
  return matches;
}

/** Referenzen verfolgen: wer importiert ein Modul? */
export async function findImporters(modulePath: string, target = "src"): Promise<CodeMatch[]> {
  const base = modulePath.replace(/^src\//, "@/").replace(/\.(ts|tsx)$/, "");
  const name = base.split("/").pop() ?? base;
  return searchCode(new RegExp(`from\\s+["'][^"']*${escapeRegExp(name)}["']`), {
    target,
    maxMatches: MAX_SEARCH_MATCHES,
  });
}

export function excerpt(line: string): string {
  const clean = redactSecrets(line).trim();
  return clean.length > MAX_EXCERPT_CHARS ? `${clean.slice(0, MAX_EXCERPT_CHARS)}…` : clean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Nächstliegender Funktions-/Symbolname oberhalb einer Zeile (1-basiert). */
export function symbolAt(lines: readonly string[], line: number): string | null {
  for (let i = Math.min(line, lines.length) - 1; i >= 0; i -= 1) {
    const m =
      /^\s*(?:export\s+)?(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_$]+)/.exec(
        lines[i] ?? "",
      );
    if (m) return m[1] ?? null;
  }
  return null;
}
