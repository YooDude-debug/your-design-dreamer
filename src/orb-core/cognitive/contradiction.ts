/**
 * ORB Core – Phase 8: Cognitive Contradiction (neutrale Primitive).
 *
 * Beantwortet nur: "Widersprechen sich diese zwei Aussagen nach der
 * primitiven Regel?" – NICHT, welche wahr ist oder verwendet werden soll.
 *
 * Regel: gleiches Subject + gleiches Predicate + anderer Value = direct.
 * Normalisierung nur trim + case-insensitive. Keine Semantik, keine
 * Synonyme, keine Quellen- oder Zeithierarchie, kein Memory-Zugriff,
 * kein Learning, keine DB/API/LLM, keine Uhr, kein Zufall.
 *
 * Wird von keinem Modul importiert. Die eigenen Regeln in novelty.ts und
 * uncertainty.ts bleiben unverändert.
 */
import type { OrbInformationSource } from "@/orb-core/cognitive/foundation";

export type OrbStatement = {
  id?: string | null;
  subject: string;
  predicate: string;
  value: string;
  source?: OrbInformationSource;
  /** Reines Metadatum – nie zur Wahrheitsentscheidung verwendet. */
  observedAt?: string | null;
};

export type OrbContradictionType = "direct" | "none" | "unknown";

export type OrbContradictionResult = {
  detected: boolean;
  type: OrbContradictionType;
  left: OrbStatement;
  right: OrbStatement;
  confidence: number | null;
};

function norm(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLocaleLowerCase("de-DE");
  return t.length > 0 ? t : null;
}

function copy(s: OrbStatement): OrbStatement {
  const out: OrbStatement = { ...s };
  if (s.source) {
    out.source =
      s.source.type === "inference"
        ? { type: "inference", sourceIds: [...s.source.sourceIds] }
        : { ...s.source };
  }
  return out;
}

export function detectContradiction(
  left: OrbStatement,
  right: OrbStatement,
): OrbContradictionResult {
  const l = copy(left);
  const r = copy(right);
  const parts = [
    norm(left?.subject),
    norm(left?.predicate),
    norm(left?.value),
    norm(right?.subject),
    norm(right?.predicate),
    norm(right?.value),
  ];
  if (parts.some((p) => p === null)) {
    return { detected: false, type: "unknown", left: l, right: r, confidence: null };
  }
  const [ls, lp, lv, rs, rp, rv] = parts as string[];
  if (ls === rs && lp === rp && lv !== rv) {
    return { detected: true, type: "direct", left: l, right: r, confidence: 1 };
  }
  return { detected: false, type: "none", left: l, right: r, confidence: 1 };
}
