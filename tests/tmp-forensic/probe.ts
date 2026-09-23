import { contentTokens, topicOf, normKey, similarity, memoryRelevance } from "../../src/orb-core/memory";
import { questionIntentOf, topicAffinity, infoDomainOf } from "../../src/orb-core/recall";
const food = "Ich esse gerne Brokkoli, Schnitzel. Trinke Alkoholfreies Bier. Habe Schuhgröße 42, mein gaming pc hat eine RTX 5070";
const name = "Korrekt aber mein Name ist Mario, das kannst du dir gerne merken, und ich nenne dich nur core";
for (const qs of ["Mein Lieblingsessen","Welche hab ich","Wie heiße ich?","Was esse ich gerne?","Welche Schuhgröße habe ich?"]) {
  console.log("Q:", qs, "| tokens:", contentTokens(qs).slice(0,3), "| topicOf:", topicOf(qs), "| intent:", questionIntentOf(qs));
  for (const [lbl, mem] of [["food",food],["name",name]] as const) {
    const ov = Math.max(similarity(qs, mem), topicAffinity(qs, mem));
    console.log("   ", lbl, "domain:", infoDomainOf(mem), "overlap:", ov.toFixed(3), "kept:", ov > 0);
  }
}
console.log("topicOf(food)=", topicOf(food), " topicOf(name)=", topicOf(name));
