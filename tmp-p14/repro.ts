import { topicOf, topicsOf, contentTokens, similarity, memoryRelevance } from "../src/orb-core/memory";
import { questionIntentOf, infoDomainOf, topicAffinity } from "../src/orb-core/recall";
const mem = { age: "Ich bin 36 Jahre.", gpu: "Der Nutzer besitzt eine RTX 5070 OC.", food:"Der Nutzer isst am liebsten Schnitzel und Brokkoli." };
const qs = ["Wie alt bin ich?","Welche Grafikkarte habe ich?","Was esse ich gerne?","Warum bin ich müde?","Wo wohne ich?","Wer bin ich?","Wie heißt mein Projekt?","Wann habe ich Geburtstag?"];
for (const q of qs) {
  console.log("Q:", q, "| topicOf:", topicOf(q), "| intent:", questionIntentOf(q), "| tokens:", contentTokens(q).join(","));
  for (const [k,m] of Object.entries(mem)) {
    const ov = Math.max(similarity(q,m), topicAffinity(q,m));
    console.log("   mem", k, "topicOf:", topicOf(m), "domain:", infoDomainOf(m), "sim:", similarity(q,m).toFixed(3), "aff:", topicAffinity(q,m).toFixed(3), "overlap:", ov.toFixed(3), ov>0?"KEPT":"DROPPED");
  }
}
console.log("topicsOf(age mem):", topicsOf(mem.age).join(","));
console.log("relevance with sim 0.12:", memoryRelevance({similarity:0.12,weight:0.5,importance:0.4,lastAccessedAt:0,activationCount:1,now:0}));
