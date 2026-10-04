import { describe, expect, it } from "vitest";
import { planCandidateContradiction } from "@/orb-core/brain-integration";
import { planLifecycleWrite, planMemoryWrite, planUsageWrites } from "@/orb-core/brain-persistence";

const now = "2026-10-04T00:00:00.000Z";

describe("Phase 4A persistence plan", () => {
  it("Widerspruch: neue Aussage eigenständig, alte unverändert, Vermutung bleibt Vermutung", () => {
    const p = planMemoryWrite(
      "n1",
      planCandidateContradiction(
        { id: "n1", content: "Firmaalpha" },
        { key: "arbeitgeber", value: "Firmabeta", sourceReference: "" },
      ),
    );
    expect(p).toMatchObject({ kind: "insert_new", source: "inferred", existingUnchanged: true });
  });

  it("zeitliche Veränderung wird verknüpft", () => {
    const p = planMemoryWrite(
      "n1",
      planCandidateContradiction(
        { id: "n1", content: "Firmaalpha" },
        {
          key: "arbeitgeber",
          value: "Firmabeta",
          sourceReference: "ich arbeite jetzt bei Firmabeta",
        },
      ),
    );
    expect(p).toMatchObject({
      kind: "insert_new",
      source: "user_stated",
      link: { targetId: "n1", relation: "supersedes_in_time" },
    });
  });

  it("Duplikat → nur verstärken", () => {
    const p = planMemoryWrite(
      "n1",
      planCandidateContradiction(
        { id: "n1", content: "Firmaalpha" },
        { key: "arbeitgeber", value: "Firmaalpha", sourceReference: "Firmaalpha" },
      ),
    );
    expect(p).toEqual({ kind: "reinforce_existing", existingId: "n1" });
  });

  it("Nutzung: nur belegte Beiträge, nur ID + Zeit", () => {
    const w = planUsageWrites(
      [
        { id: "a", status: "contributed", reason: "exclusive_verbatim_reference" },
        { id: "b", status: "supplied", reason: "no_reference_in_reply" },
        { id: "c", status: "unknown", reason: "reference_echoes_user_input" },
      ],
      now,
    );
    expect(w).toEqual([{ id: "a", last_contributed_at: now }]);
  });

  it("Lebenszyklus: nur bei Änderung, Ruhebeginn gesetzt/gelöscht", () => {
    expect(
      planLifecycleWrite({ next: "active", changed: false, reason: "still_relevant" }, now),
    ).toBeNull();
    expect(
      planLifecycleWrite({ next: "dormant", changed: true, reason: "relevance_declined" }, now),
    ).toEqual({ lifecycle: "dormant", dormant_since: now });
    expect(
      planLifecycleWrite({ next: "active", changed: true, reason: "reactivated" }, now),
    ).toEqual({ lifecycle: "active", dormant_since: null });
    expect(
      planLifecycleWrite(
        { next: "protected", changed: true, reason: "protected_category" },
        now,
        "medical",
      ),
    ).toEqual({ lifecycle: "protected", protection_group: "medical" });
  });
});
