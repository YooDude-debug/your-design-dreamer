import { runUserAction, isOwnerAdmin } from "@/lib/admin.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const OWNER = "5b006914-91da-46a5-86be-89ec4826abe0";
const OWNER2 = "9ce1d1b0-7481-4cb0-aedf-5291dae67297";
const PW = process.env["MASTER_ADMIN_PASSWORD"]!;

const roles = async (id: string) =>
  ((await supabaseAdmin.from("user_roles").select("role").eq("user_id", id)).data ?? []).map((r) => r.role);

const mk = async (n: string) => {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: `rolecheck-${n}-${Date.now()}@example.com`, password: "Tmp!Passw0rd#2026", email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
};
const try_ = async (label: string, fn: () => Promise<unknown>) => {
  try { await fn(); console.log("OK   ", label); } catch (e) { console.log("DENY ", label, "->", (e as Error).message); }
};

const A = await mk("a");
const B = await mk("b");
console.log("owner?", await isOwnerAdmin(OWNER), "| A ist Owner?", await isOwnerAdmin(A));

await try_("1 Owner + falsches Master-Passwort", () => runUserAction(OWNER, A, "grant_admin", "", 0, "falsch"));
console.log("   Rollen A:", await roles(A));
await try_("2 Owner + korrektes Master-Passwort", () => runUserAction(OWNER, A, "grant_admin", "", 0, PW));
console.log("   Rollen A:", await roles(A));
await try_("3 Normaler Admin (A) vergibt Admin an B", () => runUserAction(A, B, "grant_admin", "", 0, PW));
console.log("   Rollen B:", await roles(B));
await try_("4 Nutzer ohne Adminrechte (B) vergibt Admin", () => runUserAction(B, A, "grant_admin", "", 0, PW));
await try_("5 Normaler Admin (A) macht sich zum Owner", async () => {
  const { error } = await supabaseAdmin.rpc("owner_set_admin_role", { _actor: A, _target: A, _grant: true });
  if (error) throw new Error(error.message);
});
await try_("6 Owner entzieht Admin (A)", () => runUserAction(OWNER, A, "revoke_admin", "", 0, PW));
console.log("   Rollen A:", await roles(A));
await try_("7 Owner-Adminrolle entziehen", () => runUserAction(OWNER, OWNER2, "revoke_admin", "", 0, PW));
console.log("   Rollen Owner2:", await roles(OWNER2));
await try_("8 Normale Adminfunktion (verwarnen)", () => runUserAction(OWNER, A, "warn", "Test", 0, ""));

const { data: log } = await supabaseAdmin.from("admin_audit_log")
  .select("action,details").order("created_at", { ascending: false }).limit(6);
console.log("Audit:", JSON.stringify(log));

await supabaseAdmin.auth.admin.deleteUser(A);
await supabaseAdmin.auth.admin.deleteUser(B);
