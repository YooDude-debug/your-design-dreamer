export type TestAccount = {
  id: string;
  userId: string;
  username: string;
  email: string;
  initialPassword: string;
  region: string;
  language: string;
  registeredAt: string;
};

export const TEST_ACCOUNT_SEED = [
  { username: "lina_hh", region: "Hamburg, DE", language: "Deutsch" },
  { username: "deniz_b", region: "Berlin, DE", language: "Deutsch" },
  { username: "yannis_ath", region: "Athen, GR", language: "Ελληνικά" },
  { username: "mia_koeln", region: "Köln, DE", language: "Deutsch" },
  { username: "sam_ldn", region: "London, UK", language: "English" },
];

export function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return `Yd!${out}`;
}
