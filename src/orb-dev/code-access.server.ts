/**
 * ORB Developer Environment – READ-ONLY Codezugriff.
 *
 * Nur lesend, nur innerhalb enger Wurzeln, ohne Secrets. Keine Schreib- oder
 * Löschoperation, kein Shell-Zugriff, kein Git.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, normalize, relative, sep } from "node:path";

/** Ausschliesslich diese Wurzeln sind lesbar. */
export const ALLOWED_ROOTS = [
  "src/orb-core",
  "src/orb-dev",
  "src/orb-sdk",
  "src/integrations",
  "src/routes",
  "src/lib",
  "tests",
  "docs",
  "supabase/config.toml",
] as const;

/** Dateien, die nie gelesen werden dürfen (Secrets, Schlüssel, Umgebung). */
const DENY_PATTERNS = [
  /(^|\/)\.env/i,
  /(^|\/)\.git(\/|$)/i,
  /secret/i,
  /credential/i,
  /\.pem$|\.key$|\.p12$/i,
  /(^|\/)node_modules(\/|$)/,
];

/** Zeilen mit schlüsselartigen Inhalten werden unkenntlich gemacht. */
const REDACT_RE =
  /(sb_secret_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9._-]{20,}|SERVICE_ROLE_KEY\s*[:=]\s*\S+|(API|SECRET|TOKEN|PASSWORD)[A-Z_]*\s*[:=]\s*["']?[^\s"']{8,})/g;

const MAX_FILE_BYTES = 200_000;
const MAX_MATCHES = 120;
const READABLE_EXT = /\.(ts|tsx|js|jsx|sql|md|json|toml|css)$/i;

export class CodeAccessError extends Error {}

/** Normalisiert und prüft einen projektrelativen Pfad gegen die Allowlist. */
export function resolveReadablePath(input: string): string {
  const clean = normalize(input.replace(/^\/+/, "")).split(sep).join("/");
  if (clean.startsWith("..") || clean.includes("../"))
    throw new CodeAccessError("Pfad ausserhalb des Projekts");
  if (DENY_PATTERNS.some((re) => re.test(clean)))
    throw new CodeAccessError("Datei ist gesperrt (Secrets/Umgebung)");
  const allowed = ALLOWED_ROOTS.some((root) => clean === root || clean.startsWith(`${root}/`));
  if (!allowed) throw new CodeAccessError(`Pfad nicht freigegeben: ${clean}`);
  return clean;
}

export function redactSecrets(text: string): string {
  return text.replace(REDACT_RE, "[REDACTED]");
}

const projectRoot = process.cwd();

async function readText(rel: string): Promise<string> {
  const info = await stat(join(projectRoot, rel));
  if (!info.isFile()) throw new CodeAccessError("Kein Dateipfad");
  if (info.size > MAX_FILE_BYTES) throw new CodeAccessError("Datei zu gross für die Diagnose");
  return redactSecrets(await readFile(join(projectRoot, rel), "utf8"));
}

/* ----------------------------------------------------------------- Lesen */

export type FileView = { path: string; lines: number; content: string };

export async function readCodeFile(path: string, maxLines = 400): Promise<FileView> {
  const rel = resolveReadablePath(path);
  const all = (await readText(rel)).split("\n");
  return { path: rel, lines: all.length, content: all.slice(0, maxLines).join("\n") };
}

async function walk(rel: string, out: string[]): Promise<void> {
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = await readdir(join(projectRoot, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const child = `${rel}/${e.name}`;
    if (DENY_PATTERNS.some((re) => re.test(child))) continue;
    if (e.isDirectory()) await walk(child, out);
    else if (READABLE_EXT.test(e.name)) out.push(child);
  }
}

/** Alle lesbaren Dateien der freigegebenen Wurzeln. */
export async function listReadableFiles(): Promise<string[]> {
  const out: string[] = [];
  for (const root of ALLOWED_ROOTS) {
    if (root.includes(".")) {
      out.push(root);
      continue;
    }
    await walk(root, out);
  }
  return out.sort();
}

/* ---------------------------------------------------------------- Suchen */

export type CodeMatch = { path: string; line: number; text: string };

export async function searchCode(query: string, limit = MAX_MATCHES): Promise<CodeMatch[]> {
  const needle = query.trim();
  if (needle.length < 2) throw new CodeAccessError("Suchbegriff zu kurz");
  const files = await listReadableFiles();
  const out: CodeMatch[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = await readText(file);
    } catch {
      continue;
    }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i]!.includes(needle)) continue;
      out.push({ path: file, line: i + 1, text: lines[i]!.trim().slice(0, 240) });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Definitionsstellen eines Symbols (Funktion, Konstante, Typ). */
export async function findSymbolDefinitions(symbol: string): Promise<CodeMatch[]> {
  const hits = await searchCode(symbol);
  const defRe = new RegExp(
    `(export\\s+)?(async\\s+)?(function|const|let|class|type|interface|enum)\\s+${symbol}\\b`,
  );
  return hits.filter((h) => defRe.test(h.text));
}

/** Aufrufer eines Symbols (ohne die Definitionszeilen selbst). */
export async function findCallers(symbol: string): Promise<CodeMatch[]> {
  const hits = await searchCode(symbol);
  const defs = new Set((await findSymbolDefinitions(symbol)).map((d) => `${d.path}:${d.line}`));
  return hits.filter((h) => !defs.has(`${h.path}:${h.line}`));
}

/** Importierte Module einer Datei (statische Abhängigkeiten). */
export async function fileDependencies(path: string): Promise<string[]> {
  const view = await readCodeFile(path, 5_000);
  const out = new Set<string>();
  for (const m of view.content.matchAll(/from\s+["']([^"']+)["']/g)) out.add(m[1]!);
  for (const m of view.content.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) out.add(m[1]!);
  return [...out].sort();
}

/** Tests, die eine Datei oder ein Symbol berühren. */
export async function findRelatedTests(symbolOrPath: string): Promise<CodeMatch[]> {
  const base = symbolOrPath.split("/").pop()?.replace(/\.[jt]sx?$/, "") ?? symbolOrPath;
  const hits = await searchCode(base);
  return hits.filter((h) => h.path.startsWith("tests/"));
}

/** Nur lesende Sicht auf relevante SQL-/Schema-Dateien. */
export async function findSchemaReferences(query: string): Promise<CodeMatch[]> {
  const hits = await searchCode(query);
  return hits.filter((h) => h.path.endsWith(".sql") || h.path.includes("supabase/"));
}

export function relativeToProject(absolute: string): string {
  return relative(projectRoot, absolute).split(sep).join("/");
}
