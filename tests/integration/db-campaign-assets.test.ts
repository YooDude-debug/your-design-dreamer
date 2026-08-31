import { describe, expect, it } from "vitest";

import { dbAvailable, scalar } from "./db-client";

/**
 * Business Campaigns V1 – F6 (Kampagnen-SlangTag / Drop / CTA).
 *
 * Lesende Vertragsprüfung: Referenzen, Fremdschlüssel, Löschverhalten,
 * CTA-Bedingung und serverseitige Eigentumsprüfung im bestehenden Trigger.
 * Es werden keine Daten erzeugt, geändert oder gelöscht.
 */
const run = dbAvailable() ? describe : describe.skip;

function constraintDef(name: string): string {
  return (
    scalar(
      `select pg_get_constraintdef(oid) from pg_constraint
        where conrelid = 'public.ad_campaigns'::regclass and conname = '${name}'`,
    ) ?? ""
  );
}

run("Kampagnen-Werbemittel – Datenmodell und Eigentumsprüfung", () => {
  const trigger =
    scalar(
      `select regexp_replace(replace(pg_get_functiondef(oid), chr(10), ' '), '\\s+', ' ', 'g')
         from pg_proc where proname='enforce_campaign_slang_tag_owner'
          and pronamespace='public'::regnamespace`,
    ) ?? "";

  it("T1 – Kampagne referenziert einen eigenen SlangTag über Fremdschlüssel", () => {
    expect(constraintDef("ad_campaigns_slang_tag_id_fkey")).toContain("REFERENCES slang_tags(id)");
  });

  it("T2 – Kampagne referenziert einen eigenen Drop über Fremdschlüssel", () => {
    const def = scalar(
      `select pg_get_constraintdef(oid) from pg_constraint
        where conrelid = 'public.ad_campaigns'::regclass
          and conname = 'ad_campaigns_slang_tag_drop_id_fkey'`,
    );
    expect(def).toContain("REFERENCES slang_tag_drops(tag_id)");
  });

  it("T3/T5 – fremder oder manipulierter SlangTag wird serverseitig abgelehnt", () => {
    expect(trigger).toContain("slang_tag_not_owned");
    expect(trigger).toContain("FROM public.slang_tags WHERE id = NEW.slang_tag_id");
  });

  it("T4/T6 – fremder oder manipulierter Drop wird serverseitig abgelehnt", () => {
    expect(trigger).toContain("slang_tag_drop_not_owned");
    expect(trigger).toContain("_drop_creator IS DISTINCT FROM NEW.owner_id");
    expect(trigger).toContain("_drop_tag_owner IS DISTINCT FROM NEW.owner_id");
  });

  it("T7 – Kampagne ohne Werbemittel bleibt erlaubt (nullable Referenzen)", () => {
    const nullable = scalar(
      `select string_agg(column_name || ':' || is_nullable, ',' order by column_name)
         from information_schema.columns
        where table_schema='public' and table_name='ad_campaigns'
          and column_name in ('slang_tag_id','slang_tag_drop_id','cta')`,
    );
    expect(nullable).toBe("cta:YES,slang_tag_drop_id:YES,slang_tag_id:YES");
  });

  it("T10 – CTA erlaubt ausschliesslich vorhandene Y-Dude-Ziele", () => {
    const def = constraintDef("ad_campaigns_cta_chk");
    expect(def).toContain("'listen'");
    expect(def).toContain("'slangtag'");
    expect(def).toContain("'profile'");
  });

  it("T12 – Löschen eines Werbemittels löscht keine Kampagne", () => {
    expect(constraintDef("ad_campaigns_slang_tag_id_fkey")).toContain("ON DELETE SET NULL");
    const dropFk =
      scalar(
        `select pg_get_constraintdef(oid) from pg_constraint
          where conrelid = 'public.ad_campaigns'::regclass
            and conname = 'ad_campaigns_slang_tag_drop_id_fkey'`,
      ) ?? "";
    expect(dropFk).toContain("ON DELETE SET NULL");
  });
});
