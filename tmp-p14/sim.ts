// Scratch-Simulation des Kandidaten-Patches – KEINE Produktionsänderung.
import { contentTokens, similarity, topicOf } from "../src/orb-core/memory";
import { topicAffinity } from "../src/orb-core/recall";

const QW = new Set(["wie","was","wer","wen","wem","wann","wieso","warum","weshalb","woher","wohin","womit","wozu","wieviel","welche","welcher","welches","welchen","welchem","wo"]);
const EXTRA: [string, RegExp][] = [
  ["alter", /\b(alt|alter|jahre|jahren|jahr|geburtstag|geboren|jahrgang|lebensjahr)\b/i],
  ["wohnort", /\b(wohne|wohnort|wohnst|lebe|lebst|stadt|heimatstadt|adresse|umgezogen)\b/i],
];
const dom = (t: string) => EXTRA.find(([, re]) => re.test(t))?.[0] ?? null;
const isQ = (t: string) => /(\?|\bwelche[rnms]?\b|\bwas\b|\bwie\b|\bwo\b|\bwann\b|\bwoher\b|\bwomit\b|\bwer\b)/i.test(t);
const tokensAfter = (t: string) => contentTokens(t).filter((w) => !QW.has(w));
const topicAfter = (t: string) => { const tk = tokensAfter(t); const base = topicOf(t); return base && !QW.has(base) ? base : (tk[0] ?? null); };
const affAfter = (q: string, m: string) => {
  const a = topicAffinity(q, m); if (a > 0) return a;
  if (!isQ(q)) return 0; const d = dom(q); return d && dom(m) === d ? 0.12 : 0;
};
const mem: Record<string,string> = { age:"Ich bin 36 Jahre.", gpu:"Der Nutzer besitzt eine RTX 5070 OC.", food:"Der Nutzer isst am liebsten Schnitzel und Brokkoli.", city:"Der Nutzer wohnt in Leipzig.", walk:"Der Nutzer war letzte Woche wandern." };
for (const q of ["Wie alt bin ich?","Wann habe ich Geburtstag?","Wo wohne ich?","Wer bin ich?","Warum bin ich müde?","Welche Grafikkarte habe ich?","Was esse ich gerne?","Ich mag Pizza."]) {
  console.log("\nQ:", q, "| topic vorher:", topicOf(q), "→ nachher:", topicAfter(q), "| tokens:", contentTokens(q).join(",")||"-", "→", tokensAfter(q).join(",")||"-");
  for (const [k,m] of Object.entries(mem)) {
    const before = Math.max(similarity(q,m), topicAffinity(q,m));
    const after = Math.max(similarity(q,m), affAfter(q,m));
    if (before>0 || after>0) console.log("   ", k, before.toFixed(3), before>0?"KEPT":"DROP", "→", after.toFixed(3), after>0?"KEPT":"DROP");
  }
}
