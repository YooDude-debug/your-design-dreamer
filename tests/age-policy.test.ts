import { describe, expect, it } from "vitest";
import {
  ADULT_AGE_YEARS,
  MIN_AGE_YEARS,
  allowsAdvertisingProfiling,
  ageStatusFromBirthdate,
  meetsMinAge,
} from "@/lib/age-policy";

const NOW = new Date("2026-06-15T12:00:00Z");

/** Geburtsdatum für ein exaktes Alter am Stichtag. */
function birthdateForAge(years: number, offsetDays = 0): string {
  const d = new Date(
    Date.UTC(NOW.getUTCFullYear() - years, NOW.getUTCMonth(), NOW.getUTCDate() - offsetDays),
  );
  return d.toISOString().slice(0, 10);
}

describe("Altersgrenzen", () => {
  it("verwendet 14 als Mindestalter und 18 als Volljährigkeit", () => {
    expect(MIN_AGE_YEARS).toBe(14);
    expect(ADULT_AGE_YEARS).toBe(18);
  });

  it("lehnt unter 14 ab", () => {
    expect(ageStatusFromBirthdate(birthdateForAge(13), NOW)).toBe("BLOCKED");
    expect(ageStatusFromBirthdate(birthdateForAge(14, -1), NOW)).toBe("BLOCKED");
    expect(meetsMinAge(birthdateForAge(13), NOW)).toBe(false);
  });

  it("stuft 14 bis 17 als Minderjährige ein", () => {
    for (const years of [14, 15, 16, 17]) {
      expect(ageStatusFromBirthdate(birthdateForAge(years), NOW)).toBe("MINOR_14_17");
    }
  });

  it("stuft ab 18 als volljährig ein", () => {
    expect(ageStatusFromBirthdate(birthdateForAge(18), NOW)).toBe("ADULT_18_PLUS");
    expect(ageStatusFromBirthdate(birthdateForAge(40), NOW)).toBe("ADULT_18_PLUS");
  });

  it("gilt ohne oder mit ungültigem Datum als gesperrt (fail-closed)", () => {
    expect(ageStatusFromBirthdate(null, NOW)).toBe("BLOCKED");
    expect(ageStatusFromBirthdate("", NOW)).toBe("BLOCKED");
    expect(ageStatusFromBirthdate("2010-13-40", NOW)).toBe("BLOCKED");
    expect(ageStatusFromBirthdate("morgen", NOW)).toBe("BLOCKED");
  });
});

describe("Werbe-Profiling", () => {
  it("erlaubt Profiling nur ab 18", () => {
    expect(allowsAdvertisingProfiling("ADULT_18_PLUS")).toBe(true);
    expect(allowsAdvertisingProfiling("MINOR_14_17")).toBe(false);
    expect(allowsAdvertisingProfiling("UNKNOWN")).toBe(false);
    expect(allowsAdvertisingProfiling("BLOCKED")).toBe(false);
  });
});
