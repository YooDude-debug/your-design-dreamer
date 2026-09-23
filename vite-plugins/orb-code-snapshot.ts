/**
 * P25 – serverseitiger, nicht öffentlicher Read-only-Lesebestand für
 * `orb.code_analysis`.
 *
 * Erzeugt beim Build/Start reproduzierbar das virtuelle Modul
 * `virtual:orb-code-snapshot` mit den Textdateien aus src/, tests/, docs/.
 *
 * Harte Grenzen:
 *  · gleiche Scope-/Sperrregeln wie P21 (`normalizeCodeTarget`),
 *  · Zugangsdaten werden VOR dem Einbetten maskiert (`redactSecrets`),
 *  · nur Textquellen (.ts/.tsx/.md/.sql/.css), Obergrenze je Datei,
 *    keine JSON-Datenbestände, keine Bilder, keine Build-Artefakte,
 *  · das Modul darf ausschliesslich in die Server-Umgebung gelangen:
 *    ein Import aus dem Browser-Bundle bricht den Build ab,
 *  · keine Zeitstempel ⇒ gleicher Stand ergibt denselben Inhalt/Hash.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

import {
  CODE_ANALYSIS_SCOPE,
  normalizeCodeTarget,
  redactSecrets,
} from "../src/orb-core/toolbox/code-contract";

export const ORB_CODE_SNAPSHOT_ID = "virtual:orb-code-snapshot";
const RESOLVED_ID = `\0${ORB_CODE_SNAPSHOT_ID}`;
const TEXT_EXTENSIONS = [".ts", ".tsx", ".md", ".sql", ".css"];
const MAX_SNAPSHOT_FILE_BYTES = 240_000;

export function buildOrbCodeSnapshot(root: string): {
  files: Record<string, string>;
  meta: { fileCount: number; bytes: number; sha256: string };
} {
  const collected: string[] = [];
  const walk = (rel: string) => {
    if (!normalizeCodeTarget(rel).ok) return;
    const abs = path.join(root, rel);
    let info;
    try {
      info = statSync(abs);
    } catch {
      return;
    }
    if (info.isDirectory()) {
      for (const name of readdirSync(abs).sort()) walk(`${rel}/${name}`);
      return;
    }
    if (!info.isFile() || info.size > MAX_SNAPSHOT_FILE_BYTES) return;
    if (!TEXT_EXTENSIONS.some((ext) => rel.endsWith(ext))) return;
    collected.push(rel);
  };
  for (const dir of CODE_ANALYSIS_SCOPE) walk(dir);
  collected.sort();

  const files: Record<string, string> = {};
  const hash = createHash("sha256");
  let bytes = 0;
  for (const rel of collected) {
    const text = redactSecrets(readFileSync(path.join(root, rel), "utf8"));
    files[rel] = text;
    bytes += text.length;
    hash.update(rel).update("\0").update(text).update("\0");
  }
  return { files, meta: { fileCount: collected.length, bytes, sha256: hash.digest("hex") } };
}

export function orbCodeSnapshotPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: "orb-code-snapshot",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === ORB_CODE_SNAPSHOT_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const env = (this as { environment?: { config?: { consumer?: string } } }).environment;
      if (env?.config?.consumer === "client")
        throw new Error(
          "orb-code-snapshot darf nicht in das Browser-Bundle gelangen (nur serverseitig).",
        );
      const { files, meta } = buildOrbCodeSnapshot(root);
      return `export const meta = ${JSON.stringify(meta)};\nexport default ${JSON.stringify(files)};\n`;
    },
  };
}
