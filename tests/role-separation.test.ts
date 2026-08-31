import { describe, expect, it } from "vitest";

import {
  allowsBusinessOnly,
  allowsCreatorOnly,
  roleAreaLabel,
  roleDropLabel,
  roleScope,
  roleSlangTagLabel,
} from "@/lib/role-scope";

const community = { isCreator: false, isBusiness: false };
const creator = { isCreator: true, isBusiness: false };
const business = { isCreator: false, isBusiness: true };
const both = { isCreator: true, isBusiness: true };

describe("Rollentrennung – Erkennung", () => {
  it("erkennt Community, Creator, Unternehmer und Mehrfachrolle", () => {
    expect(roleScope(community)).toBe("community");
    expect(roleScope(creator)).toBe("creator");
    expect(roleScope(business)).toBe("business");
    expect(roleScope(both)).toBe("creator_business");
  });

  it("behandelt Unternehmer nicht als Creator", () => {
    expect(allowsCreatorOnly(business)).toBe(false);
    expect(allowsBusinessOnly(creator)).toBe(false);
    expect(allowsCreatorOnly(creator)).toBe(true);
    expect(allowsBusinessOnly(business)).toBe(true);
  });

  it("gibt Mehrfachrollen beide Funktionsbereiche", () => {
    expect(allowsCreatorOnly(both)).toBe(true);
    expect(allowsBusinessOnly(both)).toBe(true);
  });
});

describe("Rollentrennung – Bezeichnungen", () => {
  it("trennt Bereichsnamen", () => {
    expect(roleAreaLabel(creator)).toBe("Creator");
    expect(roleAreaLabel(business)).toBe("Unternehmer");
    expect(roleAreaLabel(both)).toBe("Creator / Unternehmer");
    expect(roleAreaLabel(community)).toBe("Community");
  });

  it("trennt SlangTag- und Drop-Bezeichnungen", () => {
    expect(roleSlangTagLabel(business)).toBe("Unternehmer-SlangTags");
    expect(roleSlangTagLabel(creator)).toBe("Creator-SlangTags");
    expect(roleDropLabel(business)).toBe("Unternehmer Drops");
    expect(roleDropLabel(creator)).toBe("Creator Drops");
  });

  it("unterstützt EN und EL", () => {
    expect(roleAreaLabel(business, "en")).toBe("Business");
    expect(roleAreaLabel(creator, "el")).toBe("Creator");
  });
});
