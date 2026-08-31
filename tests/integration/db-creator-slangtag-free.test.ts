import { describe, expect, it } from "vitest";

import { dbAvailable, scalar } from "./db-client";

/**
 * $$ Creator-SlangTag „Kostenlos“ – lesende Vertragsprüfung des angepassten
 * Triggers `enforce_slang_tag_kind` und der serverseitigen Claim-Logik.
 * Es werden keine Daten erzeugt, geändert oder gelöscht.
 */
const run = dbAvailable() ? describe : describe.skip;

function def(name: string): string {
  return (
    scalar(
      `select regexp_replace(replace(pg_get_functiondef(oid), chr(10), ' '), '\\s+', ' ', 'g')
         from pg_proc where proname='${name}' and pronamespace='public'::regnamespace`,
    ) ?? ""
  );
}

run("$$ Creator-SlangTag – Zugriffsstufe free", () => {
  const trigger = def("enforce_slang_tag_kind");
  const claim = def("claim_creator_slang_tag");

  it("T1 – Trigger erzwingt für kind='creator' keine Follow-Bindung mehr", () => {
    expect(trigger).not.toContain("NEW.unlock_type = CASE WHEN NEW.unlock_type = 'open' THEN");
    expect(trigger).toContain("NEW.follow_required := (NEW.unlock_type = 'follow')");
  });

  it("T14/T15/T16 – Konsistenzprüfungen des Triggers bleiben erhalten", () => {
    expect(trigger).toContain("has_role(NEW.owner_id, 'creator')");
    expect(trigger).toContain("has_role(NEW.owner_id, 'business')");
    expect(trigger).toContain("NEW.verification_status := 'verified'");
    // Normale SlangTags unverändert: open + kein Follow.
    expect(trigger).toContain("NEW.unlock_type := 'open'");
    expect(trigger).toContain("NEW.follow_required := false");
  });

  it("T2/T3 – Claim bei unlock_type='open' ohne Follow und ohne Abo", () => {
    expect(claim).toContain("ELSE allowed := true");
  });

  it("T4/T5/T6 – Follow-, Abo- und Drop-Prüfung unverändert", () => {
    expect(claim).toContain("is_following(uid, t.owner_id)");
    expect(claim).toContain("has_active_creator_subscription(uid, t.owner_id, _environment)");
    expect(claim).toContain("slang_tag_drops");
    expect(claim).toContain("drop_sold_out");
    expect(claim).toContain("interval '3 months'");
  });

  it("T7 – unberechtigter Claim wird serverseitig abgelehnt", () => {
    expect(claim).toContain("IF NOT allowed THEN RAISE EXCEPTION 'not_entitled'");
    expect(claim).toContain("IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'");
  });

  it("T10/T12/T13 – Bibliothekseintrag bleibt eindeutig und dauerhaft", () => {
    expect(claim).toContain("ON CONFLICT (user_id, tag_id) DO NOTHING");
    const unique = scalar(
      `select count(*) from pg_indexes where schemaname='public'
         and tablename='slang_tag_library' and indexdef ilike '%UNIQUE%'
         and indexdef ilike '%user_id%' and indexdef ilike '%tag_id%'`,
    );
    expect(Number(unique)).toBeGreaterThan(0);
  });
});
