import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { translateMessageForViewer } from "@/lib/translate-message.server";
import { detectAndTranslate } from "@/lib/translate.server";
import { certainlySameLanguage, guessLanguage } from "@/lib/lang-detect";

const cases = [
  { id: "60983384-aa41-4764-8bda-477cb71a9f97", to: "en" as const },
  { id: "60983384-aa41-4764-8bda-477cb71a9f97", to: "el" as const },
  { id: "60983384-aa41-4764-8bda-477cb71a9f97", to: "de" as const },
  { id: "0eaae426-6d8f-4421-ac5c-5f364a3931a5", to: "en" as const },
  { id: "e57df5fe-713a-4d09-a7db-661ccebf7154", to: "en" as const },
];

console.log("guess:", guessLanguage("Alter, das ist ja richtig krass geworden"), guessLanguage("Yo bro, this is really cool"), guessLanguage("Καλημέρα, τι κάνεις σήμερα"));
console.log("same-lang skip:", certainlySameLanguage("ich bin nicht müde und das ist gut", "de"));

console.log("direct slang:", await detectAndTranslate("Alda, das ist ja mal richtig fett geworden, ne?", "el"));
console.log("greek slang:", await detectAndTranslate("Ρε μαλάκα, τα σπάσαμε σήμερα!", "de"));

for (const c of cases) {
  const t0 = Date.now();
  const res = await translateMessageForViewer(supabaseAdmin, c.id, c.to);
  console.log(c.to, `${Date.now() - t0}ms`, JSON.stringify(res));
  const t1 = Date.now();
  const again = await translateMessageForViewer(supabaseAdmin, c.id, c.to);
  console.log("  cached", `${Date.now() - t1}ms`, JSON.stringify(again));
}
