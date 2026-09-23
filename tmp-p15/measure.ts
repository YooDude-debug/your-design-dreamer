import { topicOf, contentTokens, similarity } from "../src/orb-core/memory";
import { questionIntentOf, infoDomainOf, topicAffinity } from "../src/orb-core/recall";
const mem = { age:"Ich bin 36 Jahre.", city:"Der Nutzer wohnt in Leipzig.", gpu:"Der Nutzer besitzt eine RTX 5070 OC.", food:"Der Nutzer isst am liebsten Schnitzel und Brokkoli.", walk:"Der Nutzer war letzte Woche wandern." };
for (const q of ["Wie alt bin ich?","Wo wohne ich?","Welche Grafikkarte habe ich?","Was esse ich gerne?","Wer bin ich?","Warum bin ich müde?","Wann habe ich Geburtstag?","Wie heißt mein Projekt?","Ich mag Pizza."]) {
  console.log("\nQ:", q, "| intent:", questionIntentOf(q), "| topic:", topicOf(q), "| tokens:", contentTokens(q).join(",")||"-");
  for (const [k,m] of Object.entries(mem)) {
    const ov = Math.max(similarity(q,m), topicAffinity(q,m));
    console.log("   ", k, "domain:", infoDomainOf(m), "overlap:", ov.toFixed(3), ov>0?"KEPT→Modell":"DROPPED");
  }
}
