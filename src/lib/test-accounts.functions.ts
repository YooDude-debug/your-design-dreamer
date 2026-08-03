import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TEST_ACCOUNT_SEED, randomPassword, type TestAccount } from "@/lib/test-accounts.shared";

export type { TestAccount };

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
      .select("id,user_id,username,email,initial_password,region,language,role,registered_at")
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
        role: (r.role as TestAccount["role"]) ?? "user",
      })),
    };
  });

export const seedTestAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created: string[] = [];

    for (const entry of TEST_ACCOUNT_SEED) {
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
      const role = ("role" in entry ? entry.role : "user") as TestAccount["role"];
      await supabaseAdmin.from("profiles").upsert({
        id: uid,
        username: entry.username,
        display_name: entry.username,
        bio: "",
        location: entry.region,
        language: entry.language,
        // Creator-/Unternehmer-Testkonten gelten als verifiziert.
        verified: role !== "user",
      });
      if (role !== "user") {
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: uid, role })
          .select("id")
          .maybeSingle();
      }
      const { error: rowError } = await supabaseAdmin.from("test_accounts").insert({
        user_id: uid,
        username: entry.username,
        email,
        initial_password: password,
        region: entry.region,
        language: entry.language,
        role,
      });
      if (rowError) throw new Error(rowError.message);
      created.push(entry.username);
    }
    return { created };
  });

export const deleteTestAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("test_accounts").select("user_id");
    for (const row of data ?? []) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", row.user_id);
      await supabaseAdmin.auth.admin.deleteUser(row.user_id);
      await supabaseAdmin.from("test_accounts").delete().eq("user_id", row.user_id);
    }
    return { deleted: (data ?? []).length };
  });
