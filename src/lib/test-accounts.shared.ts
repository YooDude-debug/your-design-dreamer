export type TestAccount = {
  id: string;
  userId: string;
  username: string;
  email: string;
  initialPassword: string;
  region: string;
  language: string;
  registeredAt: string;
  /** Interne Testrolle: `user`, `creator` oder `business` (Unternehmer). */
  role: TestAccountRole;
};

/** Rollen, die per Testaccount abgedeckt werden. */
export type TestAccountRole = "user" | "creator" | "business";

export const TEST_ACCOUNT_SEED = [
  { username: "lina_hh", region: "Hamburg, DE", language: "Deutsch" },
  { username: "deniz_b", region: "Berlin, DE", language: "Deutsch" },
  { username: "yannis_ath", region: "Athen, GR", language: "Ελληνικά" },
  { username: "mia_koeln", region: "Köln, DE", language: "Deutsch" },
  { username: "sam_ldn", region: "London, UK", language: "English" },
  // Interne Testkonten fuer die neuen Rollen (volle Creator-/Unternehmer-Rechte).
  { username: "creator_test", region: "Berlin, DE", language: "Deutsch", role: "creator" },
  { username: "business_test", region: "München, DE", language: "Deutsch", role: "business" },
] satisfies { username: string; region: string; language: string; role?: TestAccountRole }[];

export function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return `Yd!${out}`;
}
