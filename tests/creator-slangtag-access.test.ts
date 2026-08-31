import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Creator SlangTag Access Configuration V1 – Vertragstests (statisch).
 * Geprüft wird, dass die vier Zugriffsstufen eindeutig getrennt sind und
 * ausschliesslich serverseitig entschieden werden.
 */
const fn = readFileSync("src/lib/creator-slangtags.functions.ts", "utf8");
const ui = readFileSync("src/components/CreatorSlangTagsDialog.tsx", "utf8");
const sub = readFileSync("src/lib/creator-subscription.functions.ts", "utf8");

describe("Creator SlangTag Zugriffsstufen", () => {
  it("T1 – vier eindeutig unterscheidbare Stufen", () => {
    expect(fn).toContain('"free" | "follower" | "subscriber" | "exclusive"');
  });

  it("T2/T3 – kostenlose Tags lösen keine Abo-Prüfung aus", () => {
    expect(fn).toContain('tier === "free"');
    // In der Berechtigung steht `free` unabhängig neben Follow/Abo.
    expect(fn).toMatch(/tier === "free" \|\|\s*\(tier === "follower" && following\)/);
  });

  it("T4/T5/T6 – Follower-Tags prüfen das bestehende Follow", () => {
    expect(fn).toContain('(tier === "follower" && following)');
    expect(fn).toContain('supabase.rpc("is_following"');
  });

  it("T7/T8/T9 – Subscriber-Tags prüfen das aktive Creator-Abo", () => {
    expect(fn).toContain('(tier === "subscriber" && subscribed)');
    expect(fn).toContain("getCreatorSubscription");
  });

  it("T10/T11 – Exclusive Drops nutzen unverändert die bestehende Drop-Logik", () => {
    expect(fn).toContain('drop ? "exclusive"');
    expect(fn).toContain("slang_tag_drops");
    // Claim/Reifung liegen weiterhin in der Datenbankfunktion.
    expect(sub).toContain("claim_creator_slang_tag");
  });

  it("T12 – dauerhafte Bibliotheksrechte bleiben unabhängig von der Stufe", () => {
    expect(fn).toContain("const unlocked = permanent ||");
    expect(fn).toContain("const inLibrary = permanent;");
  });

  it("T13/T14 – nur eigene Tags, serverseitig geprüft", () => {
    expect(fn).toContain("Kein Zugriff auf diesen SlangTag");
    expect(fn).toMatch(/tagRow\.owner_id === userId \|\| tagRow\.creator_id === userId/);
    expect(fn).toContain("requireSupabaseAuth");
  });

  it("T14 – ungültige Stufen werden abgelehnt", () => {
    expect(fn).toContain("Ungültige Einstufung");
  });

  it("T15 – bestehender Trigger wird respektiert, nicht umgangen", () => {
    expect(fn).toContain("enforce_slang_tag_kind");
    // 'free' wird nicht mehr pauschal für $$-SlangTags abgelehnt.
    expect(fn).not.toContain("Kostenlos ist für $$-SlangTags durch die bestehende Follow-Regel");
  });

  it("T16 – $$ + free setzt open/ohne Follow-Pflicht", () => {
    expect(fn).toMatch(/data\.tier === "follower" \? "follow" : "open"/);
    expect(fn).toContain('follow_required: data.tier === "follower"');
  });

  it("UI – Kostenlos ist wählbar (kein disabled-Zustand)", () => {
    expect(ui).toContain('<option value="free">');
    expect(ui).not.toContain("freeBlocked");
    expect(ui).toContain("tierHintFree");
  });

  it("UI – Zugriffsauswahl mit vier beschrifteten Optionen", () => {
    expect(ui).toContain('value="free"');
    expect(ui).toContain('value="follower"');
    expect(ui).toContain('value="subscriber"');
    expect(ui).toContain('value="exclusive"');
    expect(ui).toContain("tierHintSub");
    expect(ui).toContain("tierHintExclusive");
  });

  it("UI – Stufen sind im Creator-Profil farblich/ikonisch unterscheidbar", () => {
    for (const icon of ["🟢", "🔵", "🟣", "🔥"]) expect(ui).toContain(icon);
  });
});
