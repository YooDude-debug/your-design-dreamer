import { runUserAction, isOwnerAdmin } from "@/lib/admin.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const OWNER = "5b006914-91da-46a5-86be-89ec4826abe0";
const PW = process.env["MASTER_ADMIN_PASSWORD"]!;

async function roles(id: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", id);
  return (data ?? []).map((r) => r.role);
}
const { data: victim } = await supabaseAdmin.from("profiles").select("id,username").eq("is_test_bot", true).limit(1).single();
const V = victim!.id as string;
const try_ = async (label: string, fn: () => Promise<unknown>) => {
  try { await fn(); console.log("OK  ", label); } catch (e) { console.log("DENY", label, "-", (e as Error).message); }
};
console.log("owner?", await isOwnerAdmin(OWNER), "| target", victim!.username, await roles(V));
await try_("Owner + falsches Passwort", () => runUserAction(OWNER, V, "grant_admin", "", 0, "falsch"));
console.log("  roles:", await roles(V));
await try_("Owner + korrektes Passwort", () => runUserAction(OWNER, V, "grant_admin", "", 0, PW));
console.log("  roles:", await roles(V));
// V ist jetzt normaler Admin (kein Owner) -> darf keinen weiteren Admin machen
const { data: other } = await supabaseAdmin.from("profiles").select("id").eq("is_test_bot", true).neq("id", V).limit(1).single();
await try_("Normaler Admin vergibt Admin (korrektes PW)", () => runUserAction(V, other!.id as string, "grant_admin", "", 0, PW));
console.log("  roles other:", await roles(other!.id as string));
await try_("Owner entzieht Admin", () => runUserAction(OWNER, V, "revoke_admin", "", 0, PW));
console.log("  roles:", await roles(V));
await try_("Owner-Adminrolle entziehen (Selbstschutz)", () => runUserAction(OWNER, "9ce1d1b0-7481-4cb0-aedf-5291dae67297", "revoke_admin", "", 0, PW));
await try_("Normale Adminfunktion (verify)", () => runUserAction(OWNER, V, "verify", "", 0, ""));
await runUserAction(OWNER, V, "unverify", "", 0, "");
console.log("final roles:", await roles(V), await roles("9ce1d1b0-7481-4cb0-aedf-5291dae67297"));
