import { describe, expect, it } from "vitest";
import { planCandidateContradiction, protectionGroupCandidate } from "@/orb-core/brain-integration";
import { isRecallableLifecycle } from "@/orb-core/memory-lifecycle";

describe("Phase 3 integration", () => {
  it("ruhend/ausgelaufen nie abrufbar, unbekannt bleibt abrufbar", () => {
    expect(isRecallableLifecycle("dormant")).toBe(false);
    expect(isRecallableLifecycle("expired")).toBe(false);
    expect(isRecallableLifecycle("protected")).toBe(true);
    expect(isRecallableLifecycle("active")).toBe(true);
    expect(isRecallableLifecycle(null)).toBe(true);
  });

  it("Schutzgruppe aus Analyse ist nie bestätigt", () => {
    expect(protectionGroupCandidate({ category: "identity", temporalScope: "persistent" })).toEqual(
      { group: "identity", confirmed: false },
    );
    expect(
      protectionGroupCandidate({ category: "preference", temporalScope: "long_term" }).group,
    ).toBe("long_term_preference");
    expect(
      protectionGroupCandidate({ category: "preference", temporalScope: "temporary" }).group,
    ).toBeNull();
    expect(
      protectionGroupCandidate({ category: "fact", temporalScope: "persistent" }).group,
    ).toBeNull();
  });

  it("Korrektur ohne Beleg ist Vermutung und überschreibt nie", () => {
    const p = planCandidateContradiction(
      { id: "n1", content: "Firmaalpha" },
      { key: "arbeitgeber", value: "Firmabeta", sourceReference: "" },
    );
    expect(p.overwriteExisting).toBe(false);
    expect(p.newClass).toBe("inferred");
    expect(p.current).not.toBe("new");
  });

  it("belegte Zeitänderung wird als zeitliche Veränderung erkannt", () => {
    const p = planCandidateContradiction(
      { id: "n1", content: "Firmaalpha" },
      {
        key: "arbeitgeber",
        value: "Firmabeta",
        sourceReference: "ich arbeite jetzt bei Firmabeta",
      },
    );
    expect(p.kind).toBe("temporal_change");
    expect(p.overwriteExisting).toBe(false);
  });
});
