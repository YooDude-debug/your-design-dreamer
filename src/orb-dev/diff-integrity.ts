/**
 * ORB Developer / Repair Environment – Phase 3: Patch- und Diff-Integrität (rein).
 *
 * Kein Dateizugriff, keine Prozessausführung. Die Datei liest ausschliesslich
 * Patch-Text und vergleicht erwartete mit tatsächlicher Änderung.
 *
 * Grundregel: EXPECTED DIFF == ACTUAL DIFF. Jede zusätzliche Änderung führt zu
 * UNEXPECTED_CHANGE – die Ausführung gilt dann als fehlgeschlagen.
 */

export type PatchFile = {
  path: string;
  /** Neue Datei (kein Vorgängerinhalt). */
  isNew: boolean;
  /** Vollständiger Inhalt, nur bei neuen Dateien bekannt. */
  newContent: string | null;
  /** Roher Abschnitt des Patches für diese Datei. */
  section: string;
};

const FILE_HEADER_RE = /^diff --git a\/(.+?) b\/(.+)$/;

/** Patch in Dateiabschnitte zerlegen (nur `diff --git`-Form). */
export function parsePatch(diff: string): PatchFile[] {
  const lines = (diff ?? "").split("\n");
  const out: PatchFile[] = [];
  let current: { path: string; isNew: boolean; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const section = current.lines.join("\n");
    const newContent = current.isNew
      ? current.lines
          .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
          .map((l) => l.slice(1))
          .join("\n")
      : null;
    out.push({ path: current.path, isNew: current.isNew, newContent, section });
    current = null;
  };

  for (const line of lines) {
    const header = FILE_HEADER_RE.exec(line);
    if (header) {
      flush();
      current = { path: header[2] ?? header[1] ?? "", isNew: false, lines: [line] };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("new file mode")) current.isNew = true;
    if (line.startsWith("--- /dev/null")) current.isNew = true;
    current.lines.push(line);
  }
  flush();
  return out;
}

export function patchPaths(diff: string): string[] {
  return parsePatch(diff).map((f) => f.path);
}

/** Nur die neu angelegten Testdateien – für die Fehlerreproduktion vor dem Fix. */
export function newTestFiles(diff: string): { path: string; content: string }[] {
  return parsePatch(diff)
    .filter((f) => f.isNew && f.path.startsWith("tests/") && f.newContent !== null)
    .map((f) => ({ path: f.path, content: `${f.newContent as string}\n`.replace(/\n+$/, "\n") }));
}

/** Vergleichsform: ohne Index-Zeilen, ohne Zeilenende-Rauschen. */
export function normalizeDiff(diff: string): string {
  return (diff ?? "")
    .split("\n")
    .filter((l) => !l.startsWith("index ") && !l.startsWith("similarity index"))
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.length > 0)
    .join("\n");
}

export type IntegrityResult =
  | { ok: true; files: string[] }
  | { ok: false; reason: string; unexpected: string[]; missing: string[] };

/**
 * Prüft, ob die tatsächlich veränderten Dateien exakt den vom genehmigten
 * Patch erwarteten Dateien entsprechen.
 */
export function compareChangedFiles(expected: string[], actual: string[]): IntegrityResult {
  const exp = new Set(expected);
  const act = new Set(actual);
  const unexpected = [...act].filter((p) => !exp.has(p)).sort();
  const missing = [...exp].filter((p) => !act.has(p)).sort();
  if (unexpected.length === 0 && missing.length === 0) return { ok: true, files: [...act].sort() };
  return {
    ok: false,
    reason:
      unexpected.length > 0
        ? `Änderungen außerhalb des genehmigten Diff: ${unexpected.join(", ")}`
        : `Genehmigte Änderungen fehlen: ${missing.join(", ")}`,
    unexpected,
    missing,
  };
}

/** Erwarteter und tatsächlicher Patch-Text müssen inhaltlich gleich sein. */
export function compareDiffText(
  expected: string,
  actual: string,
): { ok: boolean; reason?: string } {
  if (normalizeDiff(expected) === normalizeDiff(actual)) return { ok: true };
  return { ok: false, reason: "Tatsächlicher Diff weicht vom genehmigten Diff ab." };
}
