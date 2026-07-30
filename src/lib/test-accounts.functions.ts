import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const SEED = [
  { username: "lina_hh", region: "Hamburg, DE", language: "Deutsch" },
  { username: "deniz_b", region: "Berlin, DE", language: "Deutsch" },
  { username: "yannis_ath", region: "Athen, GR", language: "Ελληνικά" },
  { username: "mia_koeln", region: "Köln, DE", language: "Deutsch" },
  { username: "sam_ldn", region: "London, UK", language: "English" },
];

/** Prüft über die RLS-Sicht des Aufrufers, ob er Admin ist. */
async function assertAdmin(supabase: {
  rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => Promise<{ data: unknown; error: unknown }>;
}, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Forbidden");
}

function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return `Yd!${out}`;
}

export const listTestAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; accounts: TestAccount[] }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) return { isAdmin: false, accounts: [] };

    const { data, error } = await context.supabase
      .from("test_accounts")
      .select("id,user_id,username,email,initial_password,region,language,registered_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return {
      isAdmin: true,
      accounts: (data ?? []).map((r) => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        email: r.email,
        initialPassword: r.initial_password,
        region: r.region,
        language: r.language,
        registeredAt: r.registered_at,
      })),
    };
  });

export const seedTestAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const created: string[] = [];
    for (const entry of SEED) {
      const email = `${entry.username}@testaccount.y-dude.com`;
      const { data: existing } = await supabaseAdmin
        .from("test_accounts")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existing) continue;

      const password = randomPassword();
      const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: entry.username, test_account: true },
      });
      if (userError || !user.user) throw new Error(userError?.message ?? "createUser failed");

      const uid = user.user.id;
      await supabaseAdmin.from("profiles").upsert({
        id: uid,
        username: entry.username,
        display_name: entry.username,
        bio: "",
        location: entry.region,
        language: entry.language,
      });
      const { error: rowError } = await supabaseAdmin.from("test_accounts").insert({
        user_id: uid,
        username: entry.username,
        email,
        initial_password: password,
        region: entry.region,
        language: entry.language,
      });
      if (rowError) throw new Error(rowError.message);
      created.push(entry.username);
    }
    return { created };
  });

export const deleteTestAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data } = await supabaseAdmin.from("test_accounts").select("user_id");
    for (const row of data ?? []) {
      await supabaseAdmin.auth.admin.deleteUser(row.user_id);
      await supabaseAdmin.from("test_accounts").delete().eq("user_id", row.user_id);
    }
    return { deleted: (data ?? []).length };
  });
