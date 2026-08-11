import type { Lang } from "@/lib/i18n-dict";

/**
 * Globe – Bedeutungen der angezeigten SlangTags in der Profilsprache.
 *
 * Genutzt wird ausschließlich das bestehende Sprachsystem (`Lang` aus
 * `i18n-dict`). Der Originalbegriff bleibt immer erhalten; hier liegt nur die
 * kurze Bedeutung je unterstützter Sprache. Weitere Sprachen lassen sich
 * ergänzen, indem der jeweilige Schlüssel in den Tupeln erweitert wird.
 */

type Row = readonly [name: string, de: string, en: string, el: string];

const ROWS: readonly Row[] = [
  ["abi", "Alter, Kumpel", "bro, mate", "ρε φίλε"],
  ["agurk", "Gurke – für etwas Langweiliges", "cucumber – something dull", "αγγούρι – κάτι βαρετό"],
  ["ahlie", "echt jetzt?", "for real?", "σοβαρά;"],
  ["akan", "stark, echt gut", "solid, really good", "δυνατό, πολύ καλό"],
  ["anjay", "wow, krass", "wow, damn", "ουάου, τρελό"],
  ["aroi", "lecker", "tasty", "νόστιμο"],
  ["arvo", "Nachmittag", "afternoon", "απόγευμα"],
  ["asg", "ich lach mich weg", "laughing out loud", "κλαίω από τα γέλια"],
  ["azonto", "Tanzstil, abtanzen", "dance style, to dance", "χορευτικό στιλ"],
  ["bacano", "cool, angenehm", "cool, nice", "κουλ, ωραίο"],
  ["bacán", "richtig cool", "really cool", "πολύ κουλ"],
  ["bakwas", "Blödsinn", "nonsense", "ανοησίες"],
  ["bare", "sehr viel, voll", "loads, a lot", "πάρα πολύ"],
  ["bella", "hey, alles gut", "hey, all good", "γεια, όλα καλά"],
  ["bet", "abgemacht, klar", "bet, deal", "σύμφωνοι"],
  ["bg", "sehr gut", "very good", "πολύ καλό"],
  ["bhai", "Bruder", "brother", "αδερφέ"],
  ["bindaas", "entspannt, sorgenfrei", "carefree, chill", "χαλαρός, ανέμελος"],
  ["boh", "keine Ahnung", "no idea", "δεν ξέρω"],
  ["boludo", "Alter (freundschaftlich)", "dude (friendly)", "ρε μεγάλε"],
  ["boží", "göttlich, super", "divine, awesome", "θεϊκό, τέλειο"],
  ["brick", "eiskalt", "freezing cold", "παγωμένο"],
  ["brotzeit", "Zwischenmahlzeit", "snack break", "κολατσιό"],
  ["bussin", "richtig gut (Essen)", "really good (food)", "πολύ καλό (φαγητό)"],
  ["bué", "sehr viel", "a lot", "πολύ"],
  ["bützen", "küssen", "to kiss", "φιλάω"],
  ["büx", "Hose", "trousers", "παντελόνι"],
  ["cachai", "verstehst du?", "you get it?", "κατάλαβες;"],
  ["cap", "Lüge", "a lie", "ψέμα"],
  ["caraca", "Wahnsinn!", "wow, damn!", "απίστευτο!"],
  ["causa", "Kumpel", "buddy", "φιλαράκι"],
  ["chale", "schade, echt jetzt", "aw man, come on", "άσε ρε"],
  ["chaval", "Junge, Kumpel", "kid, mate", "μικρέ, φίλε"],
  ["chido", "cool", "cool", "κουλ"],
  ["chill", "entspannt", "relaxed", "χαλαρά"],
  ["chill-kar", "entspann dich", "chill out", "χαλάρωσε"],
  ["chimba", "super, geil", "awesome", "τέλειο"],
  ["choice", "top, klasse", "great, excellent", "τέλειο"],
  ["chuchichäschtli", "Küchenschrank", "kitchen cupboard", "ντουλάπι κουζίνας"],
  ["chum", "komm", "come on", "έλα"],
  ["chur", "danke, alles klar", "thanks, cheers", "ευχαριστώ, οκ"],
  ["chévere", "cool, super", "cool, great", "κουλ, τέλειο"],
  ["copado", "cool, stark", "cool, awesome", "κουλ, τέλειο"],
  ["craic", "Spaß, gute Stimmung", "fun, good times", "κέφι, πλάκα"],
  ["cria", "Kumpel, Junge", "mate, kid", "φιλαράκι"],
  ["csá", "hi, tschau", "hi, ciao", "γεια"],
  ["daebak", "der Hammer", "awesome", "φοβερό"],
  ["daje", "los geht’s!", "let’s go!", "πάμε!"],
  ["deadass", "ganz ernst", "dead serious", "σοβαρά τώρα"],
  ["deadly", "super, klasse", "brilliant", "τέλειο"],
  ["deadset", "im Ernst", "seriously", "σοβαρά"],
  ["degun", "niemand", "nobody", "κανείς"],
  ["digga", "Kumpel, Alter", "bro, mate", "ρε φίλε"],
  ["drill", "harter Rap-Stil", "hard rap style", "σκληρό στιλ ραπ"],
  ["eish", "oh je!", "oh no!", "αμάν!"],
  ["elo", "hallo", "hello", "γεια"],
  ["faka", "hi, was geht", "hey, what’s up", "γεια, τι λέει"],
  ["fiesta", "Party", "party", "πάρτι"],
  ["figata", "voll cool", "super cool", "πολύ κουλ"],
  ["fixe", "cool, super", "cool, great", "κουλ"],
  ["flipo", "ich flippe aus", "I’m freaking out", "τρελαίνομαι"],
  ["gamed", "reingelegt", "got played", "τη πάτησα"],
  ["gassed", "übertreiben, aufgeblasen", "hyped up", "υπερβολή"],
  ["gbedu", "Beat, Musik", "beat, music", "ρυθμός, μουσική"],
  ["gell", "nicht wahr?", "right?", "έτσι δεν είναι;"],
  ["gezellig", "gemütlich", "cosy", "ζεστό, ευχάριστο"],
  ["giggerig", "kribbelig, aufgeregt", "jittery, eager", "ανυπόμονος"],
  ["gokil", "verrückt gut", "crazy good", "τρελά καλό"],
  ["grand", "alles gut", "all good", "όλα καλά"],
  ["guay", "cool", "cool", "κουλ"],
  ["habibi", "mein Lieber", "my dear", "αγαπητέ μου"],
  ["hawara", "Kumpel", "mate", "φιλαράκι"],
  ["heaps", "ganz viel", "loads", "πάρα πολύ"],
  ["helal", "Respekt!", "respect!", "σεβασμός!"],
  ["hoi", "hallo", "hi", "γεια"],
  ["hul", "verrückt, krass", "crazy, wild", "τρελό"],
  ["hustý", "krass, stark", "wicked, cool", "τρελό, δυνατό"],
  ["hygge", "Gemütlichkeit", "cosiness", "ζεστασιά, άνεση"],
  ["hyna", "Mädchen", "girl", "κοπέλα"],
  ["innit", "oder?", "isn’t it?", "έτσι;"],
  ["japa", "abhauen, auswandern", "to bail, emigrate", "την κάνω"],
  ["jetzt-ävver", "jetzt aber!", "come on now!", "έλα τώρα!"],
  ["jhakaas", "fantastisch", "fantastic", "φανταστικό"],
  ["jing-jing", "wirklich, echt", "really, truly", "στα αλήθεια"],
  ["jinjja", "echt jetzt", "for real", "σοβαρά"],
  ["joe", "Kumpel", "mate", "φίλε"],
  ["juejuezi", "absolut spitze", "absolutely top", "απόλυτα κορυφή"],
  ["jugaad", "kreative Notlösung", "clever workaround", "πατέντα"],
  ["kanka", "Bruder, Kumpel", "bro", "αδερφέ"],
  ["keen", "voll dabei", "keen, up for it", "μέσα"],
  ["khalas", "genug, Schluss", "enough, done", "αρκετά, τέλος"],
  ["kiva", "nett, schön", "nice", "ωραίο"],
  ["kruto", "krass, cool", "cool, wicked", "τρελό, κουλ"],
  ["kult", "kultig", "iconic", "κλασικό, θρύλος"],
  ["kölle", "Köln", "Cologne", "Κολωνία"],
  ["lauch", "schwacher Typ", "weakling", "αδύναμος τύπος"],
  ["leiwand", "super, klasse", "great", "τέλειο"],
  ["lodi", "Chef, Idol", "boss, idol", "αρχηγός"],
  ["maccas", "Fast-Food-Laden", "McDonald’s", "φαστφουντάδικο"],
  ["mad", "richtig krass", "really wild", "τρελό"],
  ["maji", "wirklich, Wasser", "really, water", "αλήθεια, νερό"],
  ["malade", "wahnsinnig gut", "insanely good", "τρελά καλό"],
  ["malaka", "Alter (derb)", "dude (rude)", "μαλάκα (φιλικά)"],
  ["mambo", "was geht?", "what’s up?", "τι λέει;"],
  ["mano", "Bruder", "bro", "αδερφέ"],
  ["mans", "Leute, ich", "mates, me", "τα παιδιά, εγώ"],
  ["masakra", "Wahnsinn, Chaos", "madness", "χαμός"],
  ["meccha", "sehr, mega", "super, very", "πάρα πολύ"],
  ["mint", "top, wie neu", "mint, great", "άριστο"],
  ["moinmoin", "hallo (norddeutsch)", "hello (North German)", "γεια (Β. Γερμανία)"],
  ["mopped", "Fahrrad, Moped", "bike, moped", "μοτοποδήλατο"],
  ["nandeyanen", "was soll das?!", "what the heck?!", "τι λέμε τώρα;"],
  ["nen", "Alter, Kumpel", "dude", "ρε φίλε"],
  ["niubi", "richtig stark", "badass", "πολύ δυνατό"],
  ["no-huh", "ach echt?", "oh really?", "α, σοβαρά;"],
  ["no-manches", "das gibt’s nicht!", "no way!", "δεν το πιστεύω!"],
  ["no-wahala", "kein Problem", "no problem", "κανένα πρόβλημα"],
  ["nu", "na klar", "well, sure", "βέβαια"],
  ["oai", "hey, hallo", "hey, hi", "γεια"],
  ["oida", "Alter!", "dude!", "ρε φίλε!"],
  ["opp", "Gegner, Rivale", "opponent", "αντίπαλος"],
  ["our-kid", "Bruder, Kumpel", "our kid, mate", "αδερφέ"],
  ["parce", "Kumpel", "buddy", "φιλαράκι"],
  ["pata", "Kumpel", "mate", "φίλος"],
  ["peak", "übel, Pech", "rough, unlucky", "άσχημα"],
  ["petmalu", "beeindruckend", "impressive", "εντυπωσιακό"],
  ["po", "höfliches Anhängsel", "polite particle", "μόριο ευγένειας"],
  ["poa", "alles cool", "all cool", "όλα κουλ"],
  ["posta", "im Ernst", "for real", "σοβαρά"],
  ["pá", "Alter, hey", "man, hey", "ρε"],
  ["quilla", "chill, ruhig", "chill, easy", "χαλαρά"],
  ["raga", "Leute", "guys", "παιδιά"],
  ["re", "hey du", "hey you", "ρε"],
  ["reckon", "meinen, denken", "to reckon", "νομίζω"],
  ["sabai", "entspannt, gut", "relaxed, fine", "χαλαρά, καλά"],
  ["safi", "klar, fertig", "alright, done", "εντάξει"],
  ["santuy", "chillig", "chilled", "χαλαρά"],
  ["scene", "Szene, Sache", "scene, thing", "σκηνή, θέμα"],
  ["schnacken", "plaudern", "to chat", "κουβεντιάζω"],
  ["serr", "sehr, stark", "very, a lot", "πολύ"],
  ["servus", "hallo / tschüss", "hello / bye", "γεια"],
  ["sgu", "was geht?", "what’s good?", "τι λέει;"],
  ["shara", "Sache, Ding", "thing, matter", "θέμα, πράγμα"],
  ["sharp", "alles klar, scharf", "all good, sharp", "εντάξει"],
  ["sharp-sharp", "sofort, top", "quickly, all good", "αμέσως, τέλεια"],
  ["sheesh", "wow!", "sheesh, wow!", "ουάου!"],
  ["sheng", "Straßenslang", "street slang", "αργκό του δρόμου"],
  ["shuno", "Kumpel", "mate", "φίλε"],
  ["sika", "Geld", "money", "λεφτά"],
  ["sinistro", "unheimlich, krass", "creepy, wild", "ανατριχιαστικό"],
  ["slatt", "Zeichen für Zusammenhalt", "sign of loyalty", "σημάδι αλληλεγγύης"],
  ["sound", "verlässlich, nett", "sound, decent", "εντάξει τύπος"],
  ["sugoi", "toll, super", "amazing", "καταπληκτικό"],
  ["sus", "verdächtig", "suspicious", "ύποπτο"],
  ["sweet-as", "alles bestens", "sweet, all good", "όλα τέλεια"],
  ["sztos", "der Hammer", "banger", "φοβερό"],
  ["tesó", "Bruder, Kumpel", "bro", "αδερφέ"],
  ["tiguidou", "alles in Ordnung", "all set", "όλα καλά"],
  ["top", "spitze", "top, great", "κορυφή"],
  ["treta", "Streit, Drama", "beef, drama", "τσακωμός"],
  ["troi-oi", "oh mein Gott", "oh my god", "θεέ μου"],
  ["tsakise", "hau ab", "get lost", "τσακίσου"],
  ["wa3ra", "krass, heftig", "intense, wild", "τρελό"],
  ["wagwan", "was geht?", "what’s going on?", "τι λέει;"],
  ["walla", "echt, ich schwöre", "I swear", "τ’ ορκίζομαι"],
  ["wasteman", "Nichtsnutz", "waste of space", "άχρηστος"],
  ["werpa", "Kraft, Power", "power", "δύναμη"],
  ["wesh", "hey, was geht", "hey, what’s up", "γεια, τι λέει"],
  ["wey", "Alter, Typ", "dude", "ρε φίλε"],
  ["wildern", "wild feiern", "to go wild", "τα σπάω"],
  ["wollah", "ich schwöre", "I swear", "τ’ ορκίζομαι"],
  ["xin", "bitte, hallo", "please, hey", "παρακαλώ"],
  ["yaar", "Kumpel", "buddy", "φιλαράκι"],
  ["yabai", "krass (gut/schlecht)", "crazy (good/bad)", "τρελό"],
  ["yalla", "los geht’s", "let’s go", "πάμε"],
  ["yoh", "wow!", "wow!", "ουάου!"],
  ["yyds", "für immer der Beste", "the eternal GOAT", "ο κορυφαίος πάντα"],
  ["zbeul", "Chaos, Party", "chaos, mayhem", "χαμός"],
  ["zbs", "einfach top", "simply great", "απλά τέλειο"],
  ["zio", "Alter, Kumpel", "dude", "ρε φίλε"],
  ["zsír", "fett, super", "sick, great", "τέλειο"],
  ["zwin", "clever, schlau", "clever, sharp", "πονηρός, έξυπνος"],
  ["ça-caille", "es ist eiskalt", "it’s freezing", "κάνει παγωνιά"],
  ["čau", "hallo / tschüss", "hi / bye", "γεια"],
];

const TABLE: Record<string, Record<Lang, string>> = Object.fromEntries(
  ROWS.map(([name, de, en, el]) => [name, { de, en, el }]),
);

/** Reihenfolge für den Rückfall, falls eine Sprache fehlt. */
const FALLBACK: Lang[] = ["en", "de", "el"];

/**
 * Bedeutung eines SlangTags in der gewünschten Sprache.
 * `stored` ist eine bereits vorhandene Bedeutung (z. B. aus der Datenbank) und
 * hat Vorrang, wenn keine Übersetzung für die Zielsprache existiert.
 */
export function tagMeaning(name: string, lang: Lang, stored?: string): string | null {
  const row = TABLE[name.toLowerCase()];
  const hit = row?.[lang];
  if (hit) return hit;
  if (stored && stored.trim()) return stored.trim();
  for (const l of FALLBACK) {
    const alt = row?.[l];
    if (alt) return alt;
  }
  return null;
}

/**
 * Profilsprache → Sprachcode des bestehenden i18n-Systems.
 * Die im Profil gespeicherte Sprache ist maßgeblich; erst wenn sie unbekannt
 * ist, greift die Oberflächensprache als Rückfall.
 */
export function profileLang(profileLanguage: string | null | undefined, fallback: Lang): Lang {
  const v = (profileLanguage ?? "").trim().toLowerCase();
  if (!v) return fallback;
  if (v.startsWith("de") || v.includes("deutsch") || v.includes("german")) return "de";
  if (v.startsWith("en") || v.includes("english") || v.includes("englisch")) return "en";
  if (v.startsWith("el") || v.startsWith("gr") || v.includes("ελλην") || v.includes("griech") || v.includes("greek"))
    return "el";
  return fallback;
}
