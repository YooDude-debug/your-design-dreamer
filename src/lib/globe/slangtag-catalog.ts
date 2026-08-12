/**
 * Slang Globe – Demo-Katalog (KI-recherchierte Testdaten).
 *
 * WICHTIG: Alle Einträge hier sind ausdrücklich Demo-/Testdaten
 * (`source: "demo"`). Sie sind bewusst NICHT in der Globe-Komponente
 * eingebaut, sondern liegen in dieser eigenständigen Datenschicht.
 *
 * Später liefert die Slang Arena echte User-SlangTags in derselben Struktur
 * (`source: "user"`), die die Demo-Einträge Stück für Stück ersetzen – ohne
 * dass der Globe umgebaut werden muss.
 *
 * Audio: Demo-Einträge haben bewusst KEINE Audiodatei (`audio: null`,
 * `audioStatus: "demo-pending"`). Es wird kein fremdes Audio vorgetäuscht;
 * die bestehende Audio-Logik greift weiterhin, sobald ein echtes User-Audio
 * am gleichen SlangTag hängt.
 */

/** Herkunft eines SlangTags – erlaubt späteren Austausch Demo → User. */
export type SlangTagSource = "demo" | "user";

export type SlangTagAudioStatus = "demo-pending" | "user-audio";

/** Einheitliche Struktur für Demo- und spätere User-SlangTags. */
export type GlobeSlangTag = {
  id: string;
  /** Originalbegriff – bleibt immer erhalten. */
  tag: string;
  language: string;
  country: string;
  countryCode: string;
  /** Region oder Stadt. */
  region: string;
  lat: number;
  lng: number;
  /** Bedeutung auf Deutsch. */
  meaningDe: string;
  /** Kurze Erklärung zur Verwendung. */
  explanation: string;
  category: string;
  source: SlangTagSource;
  /** Demo-Kennzeichnung – niemals als Userdaten ausgeben. */
  isDemo: boolean;
  audio: string | null;
  audioStatus: SlangTagAudioStatus;
};

/** [Begriff, Kategorie, Bedeutung (DE), kurze Erklärung] */
type TagRow = readonly [string, string, string, string];

type CityRow = {
  country: string;
  code: string;
  city: string;
  lat: number;
  lng: number;
  language: string;
  tags: readonly TagRow[];
};

const CITIES: readonly CityRow[] = [
  // ── Europa: Deutschsprachiger Raum ─────────────────────────────────────
  { country: "Deutschland", code: "DE", city: "Berlin", lat: 52.52, lng: 13.4, language: "Deutsch", tags: [
    ["digga", "Freundschaft", "Kumpel, Alter", "Direkte Anrede unter Freunden, sehr verbreitet in der Jugendsprache."],
    ["sheesh", "Erstaunen", "Wow, krass", "Ausruf, wenn etwas beeindruckt oder übertrieben wirkt."],
    ["lauch", "Humor", "schwächlicher Typ", "Spöttisch für jemanden ohne Kraft oder Durchsetzung."],
  ]},
  { country: "Deutschland", code: "DE", city: "Hamburg", lat: 53.55, lng: 9.99, language: "Deutsch", tags: [
    ["moinmoin", "Begrüßung", "Hallo (zu jeder Tageszeit)", "Norddeutscher Gruß, morgens wie abends verwendbar."],
    ["schnacken", "Alltag", "reden, plaudern", "Für lockere Gespräche unter Bekannten."],
    ["büx", "Alltag", "Hose", "Plattdeutsch geprägter Alltagsbegriff."],
  ]},
  { country: "Deutschland", code: "DE", city: "München", lat: 48.14, lng: 11.58, language: "Deutsch", tags: [
    ["servus", "Begrüßung", "Hallo / Tschüss", "Bairischer Gruß beim Kommen und Gehen."],
    ["brotzeit", "Essen", "Zwischenmahlzeit", "Deftige Pause mit Brot, Wurst und Käse."],
    ["passt-scho", "Zustimmung", "ist in Ordnung", "Entspannte Bestätigung, oft mit Achselzucken."],
  ]},
  { country: "Deutschland", code: "DE", city: "Köln", lat: 50.94, lng: 6.96, language: "Deutsch", tags: [
    ["kölle", "Regional", "Köln", "Lokale Selbstbezeichnung, besonders im Karneval."],
    ["bützen", "Liebe", "küssen", "Der freundschaftliche Karnevalskuss auf die Wange."],
    ["et-hätt-noch-immer-jot-jejange", "Alltag", "Es ist noch immer gut gegangen", "Kölsches Lebensmotto bei Problemen."],
  ]},
  { country: "Deutschland", code: "DE", city: "Leipzig", lat: 51.34, lng: 12.37, language: "Deutsch", tags: [
    ["gell", "Zustimmung", "nicht wahr?", "Rückfrage am Satzende, sucht Bestätigung."],
    ["nu", "Zustimmung", "ja, klar", "Sächsisches Ja, kurz und trocken."],
    ["fetzt", "Emotion", "macht Spaß", "Wenn etwas richtig gut läuft."],
  ]},
  { country: "Deutschland", code: "DE", city: "Frankfurt am Main", lat: 50.11, lng: 8.68, language: "Deutsch", tags: [
    ["äppler", "Essen", "Apfelwein", "Das Frankfurter Nationalgetränk."],
    ["gude", "Begrüßung", "Hallo", "Hessischer Kurzgruß."],
    ["babbeln", "Alltag", "quatschen", "Für ausgiebiges Reden."],
  ]},
  { country: "Deutschland", code: "DE", city: "Stuttgart", lat: 48.78, lng: 9.18, language: "Deutsch", tags: [
    ["grüß-gottle", "Begrüßung", "Guten Tag", "Schwäbische, leicht verniedlichte Begrüßung."],
    ["schaffe", "Arbeit", "arbeiten", "Zentrales Wort der schwäbischen Arbeitsmoral."],
    ["hano", "Erstaunen", "na so was", "Ausruf der Überraschung."],
  ]},
  { country: "Österreich", code: "AT", city: "Wien", lat: 48.21, lng: 16.37, language: "Deutsch", tags: [
    ["oida", "Freundschaft", "Alter", "Universelle Anrede und Ausruf zugleich."],
    ["leiwand", "Zustimmung", "super, klasse", "Wienerisch für richtig gut."],
    ["hawara", "Freundschaft", "Kumpel", "Enger Freund, vertrauter Bekannter."],
  ]},
  { country: "Österreich", code: "AT", city: "Graz", lat: 47.07, lng: 15.44, language: "Deutsch", tags: [
    ["baba", "Verabschiedung", "Tschüss", "Lockeres Auf Wiedersehen."],
    ["fesch", "Alltag", "hübsch, schick", "Kompliment für Aussehen oder Kleidung."],
    ["gschissen", "Ablehnung", "mies, schlecht", "Derb für etwas Unangenehmes."],
  ]},
  { country: "Schweiz", code: "CH", city: "Zürich", lat: 47.37, lng: 8.54, language: "Deutsch", tags: [
    ["hoi", "Begrüßung", "Hallo", "Standardgruß in der Deutschschweiz."],
    ["chuchichäschtli", "Regional", "Küchenschrank", "Klassisches Schibboleth des Schweizerdeutschen."],
    ["giggerig", "Emotion", "kribbelig, ungeduldig", "Wenn man etwas kaum erwarten kann."],
  ]},
  { country: "Schweiz", code: "CH", city: "Bern", lat: 46.95, lng: 7.45, language: "Deutsch", tags: [
    ["gäbig", "Zustimmung", "praktisch, angenehm", "Für etwas, das bequem funktioniert."],
    ["sackstark", "Zustimmung", "sehr stark", "Lob für eine Leistung."],
    ["hopp", "Party", "los geht's", "Anfeuerung, besonders im Sport."],
  ]},

  // ── Europa: West / Nord ────────────────────────────────────────────────
  { country: "Vereinigtes Königreich", code: "GB", city: "London", lat: 51.51, lng: -0.13, language: "Englisch", tags: [
    ["innit", "Zustimmung", "oder?", "Bestätigungsfrage am Satzende."],
    ["peng", "Zustimmung", "richtig gut, attraktiv", "Lob für Essen, Kleidung oder Menschen."],
    ["bare", "Alltag", "sehr viel", "Mengenverstärker im Londoner Slang."],
  ]},
  { country: "Vereinigtes Königreich", code: "GB", city: "Liverpool", lat: 53.41, lng: -2.98, language: "Englisch", tags: [
    ["boss", "Zustimmung", "top, klasse", "Scouse-Lob für etwas Gelungenes."],
    ["la", "Freundschaft", "Kumpel", "Kurzform von 'lad', typische Anrede."],
    ["sound", "Zustimmung", "alles gut", "Antwort auf Danke oder Zusage."],
  ]},
  { country: "Vereinigtes Königreich", code: "GB", city: "Manchester", lat: 53.48, lng: -2.24, language: "Englisch", tags: [
    ["mint", "Zustimmung", "richtig gut", "Positive Bewertung im Nordwesten."],
    ["mad-fer-it", "Party", "voll dabei", "Begeisterte Zustimmung zum Ausgehen."],
    ["our-kid", "Freundschaft", "Bruder, enger Freund", "Vertrauliche Bezeichnung."],
  ]},
  { country: "Vereinigtes Königreich", code: "GB", city: "Glasgow", lat: 55.86, lng: -4.25, language: "Englisch", tags: [
    ["gallus", "Humor", "frech, selbstbewusst", "Für jemanden mit forschem Auftreten."],
    ["braw", "Zustimmung", "schön, gut", "Schottisches Lob."],
    ["wee", "Alltag", "klein", "Allgegenwärtiges Verkleinerungswort."],
  ]},
  { country: "Irland", code: "IE", city: "Dublin", lat: 53.35, lng: -6.26, language: "Englisch", tags: [
    ["craic", "Humor", "Spaß, gute Stimmung", "Kern der irischen Geselligkeit."],
    ["grand", "Zustimmung", "alles gut", "Beruhigende Standardantwort."],
    ["deadly", "Zustimmung", "super", "Starkes Lob trotz düsterem Wortbild."],
  ]},
  { country: "Frankreich", code: "FR", city: "Paris", lat: 48.86, lng: 2.35, language: "Französisch", tags: [
    ["wesh", "Begrüßung", "hey, na?", "Straßensprachlicher Gruß."],
    ["chelou", "Emotion", "komisch, seltsam", "Verlan für 'louche'."],
    ["stylé", "Zustimmung", "stylisch, cool", "Lob für Auftreten oder Sachen."],
  ]},
  { country: "Frankreich", code: "FR", city: "Marseille", lat: 43.3, lng: 5.37, language: "Französisch", tags: [
    ["degun", "Alltag", "niemand", "Typisch marseillanisch für 'keiner'."],
    ["zbeul", "Party", "Chaos, wildes Treiben", "Für ausgelassene Unordnung."],
    ["oai", "Party", "Trubel", "Lärmende, ausgelassene Stimmung."],
  ]},
  { country: "Belgien", code: "BE", city: "Brüssel", lat: 50.85, lng: 4.35, language: "Französisch", tags: [
    ["une-fois", "Regional", "mal, halt", "Typische belgische Satzfüllung."],
    ["chique", "Zustimmung", "schick, gut", "Lob im belgischen Alltag."],
    ["fieu", "Freundschaft", "Junge, Kumpel", "Vertrauliche Anrede."],
  ]},
  { country: "Niederlande", code: "NL", city: "Amsterdam", lat: 52.37, lng: 4.9, language: "Niederländisch", tags: [
    ["gezellig", "Emotion", "gemütlich, schön", "Zentrales niederländisches Lebensgefühl."],
    ["faka", "Begrüßung", "was geht?", "Aus dem Sranantongo in die Jugendsprache."],
    ["chill", "Alltag", "entspannt", "Für ruhige, angenehme Situationen."],
  ]},
  { country: "Niederlande", code: "NL", city: "Rotterdam", lat: 51.92, lng: 4.48, language: "Niederländisch", tags: [
    ["mattie", "Freundschaft", "Kumpel", "Enger Freund im Straßenslang."],
    ["doekoe", "Arbeit", "Geld", "Slangwort für Bezahlung."],
    ["patta", "Alltag", "Sneaker", "Für Turnschuhe."],
  ]},
  { country: "Spanien", code: "ES", city: "Madrid", lat: 40.42, lng: -3.7, language: "Spanisch", tags: [
    ["guay", "Zustimmung", "cool", "Allgemeines Lob."],
    ["chaval", "Freundschaft", "Junge, Kumpel", "Lockere Anrede."],
    ["flipar", "Erstaunen", "ausflippen, staunen", "Wenn etwas völlig überrascht."],
  ]},
  { country: "Spanien", code: "ES", city: "Barcelona", lat: 41.39, lng: 2.17, language: "Katalanisch", tags: [
    ["nen", "Freundschaft", "Junge, Kleiner", "Katalanische Anrede."],
    ["flipant", "Erstaunen", "unglaublich", "Starke Begeisterung."],
    ["quilla", "Freundschaft", "Mädchen, Alte", "Freundschaftliche Anrede."],
  ]},
  { country: "Portugal", code: "PT", city: "Lissabon", lat: 38.72, lng: -9.14, language: "Portugiesisch", tags: [
    ["fixe", "Zustimmung", "cool, super", "Portugals Standardlob."],
    ["bué", "Alltag", "sehr viel", "Verstärker aus dem Angolanischen."],
    ["saudade", "Emotion", "Sehnsucht", "Wehmütige Sehnsucht nach etwas Fernem."],
  ]},
  { country: "Portugal", code: "PT", city: "Porto", lat: 41.15, lng: -8.61, language: "Portugiesisch", tags: [
    ["gajo", "Alltag", "Typ, Kerl", "Bezeichnung für eine männliche Person."],
    ["bora", "Party", "los geht's", "Aufforderung loszuziehen."],
    ["tuga", "Regional", "Portugiese", "Selbstbezeichnung, salopp."],
  ]},
  { country: "Italien", code: "IT", city: "Rom", lat: 41.9, lng: 12.5, language: "Italienisch", tags: [
    ["daje", "Party", "los geht's!", "Römische Anfeuerung."],
    ["ma-che", "Ablehnung", "ach was!", "Ungläubige Zurückweisung."],
    ["mortacci", "Emotion", "verdammt!", "Kräftiger römischer Ausruf."],
  ]},
  { country: "Italien", code: "IT", city: "Neapel", lat: 40.85, lng: 14.27, language: "Italienisch", tags: [
    ["jamme", "Party", "komm, los", "Neapolitanische Aufforderung."],
    ["guaglione", "Freundschaft", "Junge", "Typische Anrede."],
    ["sfizio", "Essen", "Gelüst, kleiner Genuss", "Etwas, das man sich gönnt."],
  ]},
  { country: "Italien", code: "IT", city: "Mailand", lat: 45.46, lng: 9.19, language: "Italienisch", tags: [
    ["figata", "Zustimmung", "voll cool", "Begeisterung über etwas."],
    ["bella", "Begrüßung", "hey, alles gut", "Kurzgruß unter Jüngeren."],
    ["boh", "Alltag", "keine Ahnung", "Achselzucken in Wortform."],
  ]},
  { country: "Griechenland", code: "GR", city: "Athen", lat: 37.98, lng: 23.73, language: "Griechisch", tags: [
    ["malaka", "Freundschaft", "Alter (derb, freundschaftlich)", "Unter Freunden extrem verbreitet."],
    ["re-file", "Begrüßung", "hey Kumpel", "Vertraute Anrede."],
    ["kamaki", "Humor", "anbaggern", "Flirtversuch, oft ironisch."],
  ]},
  { country: "Griechenland", code: "GR", city: "Thessaloniki", lat: 40.64, lng: 22.94, language: "Griechisch", tags: [
    ["tsiftetelli", "Party", "Tanz, Feierlaune", "Steht für ausgelassene Nächte."],
    ["kalimera", "Begrüßung", "Guten Morgen", "Standardgruß am Vormittag."],
    ["gamato", "Zustimmung", "geil, stark", "Derbes Lob."],
  ]},
  { country: "Dänemark", code: "DK", city: "Kopenhagen", lat: 55.68, lng: 12.57, language: "Dänisch", tags: [
    ["hygge", "Emotion", "Gemütlichkeit", "Kerngefühl dänischer Alltagskultur."],
    ["agurk", "Humor", "Gurke – etwas Langweiliges", "Für Belangloses oder Flaues."],
    ["fedt", "Zustimmung", "cool, super", "Alltägliches Lob."],
  ]},
  { country: "Schweden", code: "SE", city: "Stockholm", lat: 59.33, lng: 18.07, language: "Schwedisch", tags: [
    ["lagom", "Alltag", "genau richtig", "Nicht zu viel, nicht zu wenig."],
    ["asg", "Humor", "ich lach mich weg", "Chat-Kurzform für lautes Lachen."],
    ["fika", "Essen", "Kaffeepause", "Soziale Pause mit Kaffee und Gebäck."],
  ]},
  { country: "Norwegen", code: "NO", city: "Oslo", lat: 59.91, lng: 10.75, language: "Norwegisch", tags: [
    ["kult", "Zustimmung", "cool", "Standardlob."],
    ["koselig", "Emotion", "gemütlich", "Warme, angenehme Stimmung."],
    ["schpaa", "Zustimmung", "richtig gut", "Oslo-Jugendslang."],
  ]},
  { country: "Finnland", code: "FI", city: "Helsinki", lat: 60.17, lng: 24.94, language: "Finnisch", tags: [
    ["sisu", "Emotion", "Zähigkeit, Durchhaltekraft", "Finnische Kernhaltung bei Widerstand."],
    ["moi", "Begrüßung", "Hallo", "Kurzer Alltagsgruß."],
    ["kiva", "Zustimmung", "nett, schön", "Freundliche Bewertung."],
  ]},
  { country: "Island", code: "IS", city: "Reykjavík", lat: 64.15, lng: -21.94, language: "Isländisch", tags: [
    ["þetta-reddast", "Alltag", "wird schon klappen", "Isländisches Lebensmotto."],
    ["nice", "Zustimmung", "gut, cool", "Lehnwort im Alltag."],
    ["blessađ", "Verabschiedung", "mach's gut", "Freundlicher Abschied."],
  ]},

  // ── Europa: Mittel / Ost / Südost ──────────────────────────────────────
  { country: "Polen", code: "PL", city: "Warschau", lat: 52.23, lng: 21.01, language: "Polnisch", tags: [
    ["siema", "Begrüßung", "Hi, was geht", "Kurzgruß unter Jüngeren."],
    ["spoko", "Zustimmung", "alles gut, entspannt", "Beruhigende Zustimmung."],
    ["masakra", "Erstaunen", "Wahnsinn", "Ausruf bei Extremem, positiv wie negativ."],
  ]},
  { country: "Polen", code: "PL", city: "Krakau", lat: 50.06, lng: 19.94, language: "Polnisch", tags: [
    ["ziomek", "Freundschaft", "Kumpel", "Enger Freund aus der Gegend."],
    ["nara", "Verabschiedung", "tschüss", "Lockeres Auf Wiedersehen."],
    ["sztos", "Zustimmung", "top, klasse", "Starkes Lob."],
  ]},
  { country: "Tschechien", code: "CZ", city: "Prag", lat: 50.08, lng: 14.44, language: "Tschechisch", tags: [
    ["čau", "Begrüßung", "hallo / tschüss", "Universeller Gruß."],
    ["hustý", "Zustimmung", "krass, stark", "Anerkennung für Beeindruckendes."],
    ["boží", "Zustimmung", "göttlich, super", "Höchstes Lob."],
  ]},
  { country: "Slowakei", code: "SK", city: "Bratislava", lat: 48.15, lng: 17.11, language: "Slowakisch", tags: [
    ["ahoj", "Begrüßung", "Hallo", "Alltagsgruß."],
    ["super", "Zustimmung", "super", "Direkte Zustimmung."],
    ["fajn", "Alltag", "in Ordnung", "Neutral positive Bewertung."],
  ]},
  { country: "Ungarn", code: "HU", city: "Budapest", lat: 47.5, lng: 19.04, language: "Ungarisch", tags: [
    ["csá", "Begrüßung", "hi, tschau", "Kurzgruß."],
    ["zsír", "Zustimmung", "fett, super", "Jugendsprachliches Lob."],
    ["haver", "Freundschaft", "Kumpel", "Vertrauter Freund."],
  ]},
  { country: "Rumänien", code: "RO", city: "Bukarest", lat: 44.43, lng: 26.11, language: "Rumänisch", tags: [
    ["salut", "Begrüßung", "Hallo", "Alltagsgruß."],
    ["misto", "Zustimmung", "cool, super", "Verbreitetes Lob."],
    ["bă", "Freundschaft", "hey du", "Direkte, saloppe Anrede."],
  ]},
  { country: "Bulgarien", code: "BG", city: "Sofia", lat: 42.7, lng: 23.32, language: "Bulgarisch", tags: [
    ["zdravei", "Begrüßung", "Hallo", "Freundlicher Gruß."],
    ["mnogo-qko", "Zustimmung", "richtig cool", "Starkes Lob."],
    ["ayde", "Party", "los, komm", "Aufforderung."],
  ]},
  { country: "Kroatien", code: "HR", city: "Zagreb", lat: 45.81, lng: 15.98, language: "Kroatisch", tags: [
    ["bok", "Begrüßung", "Hallo", "Zagreber Standardgruß."],
    ["ekipa", "Freundschaft", "Clique, Gruppe", "Für die eigene Runde."],
    ["fora", "Humor", "Witz, Gag", "Für einen guten Spruch."],
  ]},
  { country: "Serbien", code: "RS", city: "Belgrad", lat: 44.79, lng: 20.45, language: "Serbisch", tags: [
    ["brate", "Freundschaft", "Bruder", "Häufigste Anrede unter Freunden."],
    ["kul", "Zustimmung", "cool", "Direkt entlehnt."],
    ["ludilo", "Erstaunen", "Wahnsinn", "Für ausgelassene oder krasse Momente."],
  ]},
  { country: "Slowenien", code: "SI", city: "Ljubljana", lat: 46.06, lng: 14.51, language: "Slowenisch", tags: [
    ["živjo", "Begrüßung", "Hallo", "Freundlicher Gruß."],
    ["kul", "Zustimmung", "cool", "Alltägliches Lob."],
    ["ful", "Alltag", "sehr, total", "Verstärker."],
  ]},
  { country: "Ukraine", code: "UA", city: "Kyjiw", lat: 50.45, lng: 30.52, language: "Ukrainisch", tags: [
    ["pryvit", "Begrüßung", "Hallo", "Alltagsgruß."],
    ["klas", "Zustimmung", "klasse", "Kurzes Lob."],
    ["shchyro", "Emotion", "aufrichtig", "Betont Ehrlichkeit."],
  ]},

  // ── Nahost / Türkei ────────────────────────────────────────────────────
  { country: "Türkei", code: "TR", city: "Istanbul", lat: 41.01, lng: 28.98, language: "Türkisch", tags: [
    ["kanka", "Freundschaft", "Bruder, Kumpel", "Beste-Freund-Anrede."],
    ["helal", "Zustimmung", "Respekt!", "Anerkennung für eine Leistung."],
    ["yok-artik", "Erstaunen", "das gibt's doch nicht", "Ungläubiges Staunen."],
  ]},
  { country: "Türkei", code: "TR", city: "Izmir", lat: 38.42, lng: 27.14, language: "Türkisch", tags: [
    ["abi", "Freundschaft", "großer Bruder", "Respektvolle, warme Anrede."],
    ["cok-iyi", "Zustimmung", "sehr gut", "Klares Lob."],
    ["hadi-be", "Erstaunen", "ach komm!", "Ungläubige Reaktion."],
  ]},
  { country: "Israel", code: "IL", city: "Tel Aviv", lat: 32.08, lng: 34.78, language: "Hebräisch", tags: [
    ["sababa", "Zustimmung", "alles cool", "Allgegenwärtiges Okay."],
    ["achla", "Zustimmung", "super", "Positive Bewertung."],
    ["yalla", "Party", "los geht's", "Aufforderung, weiterzumachen."],
  ]},
  { country: "Ägypten", code: "EG", city: "Kairo", lat: 30.04, lng: 31.24, language: "Arabisch", tags: [
    ["yalla", "Party", "los, komm", "Universelle Aufforderung."],
    ["habibi", "Liebe", "mein Lieber", "Warme Anrede unter Nahestehenden."],
    ["khalas", "Ablehnung", "Schluss, fertig", "Beendet eine Diskussion."],
  ]},
  { country: "Vereinigte Arabische Emirate", code: "AE", city: "Dubai", lat: 25.2, lng: 55.27, language: "Arabisch", tags: [
    ["wallah", "Zustimmung", "echt jetzt, ich schwöre", "Bekräftigt eine Aussage."],
    ["shu-fi", "Alltag", "was ist los?", "Nachfrage im Gespräch."],
    ["tamam", "Zustimmung", "in Ordnung", "Kurze Bestätigung."],
  ]},
  { country: "Iran", code: "IR", city: "Teheran", lat: 35.69, lng: 51.39, language: "Persisch", tags: [
    ["dam-et-garm", "Zustimmung", "danke, stark von dir", "Warmes Lob für Hilfsbereitschaft."],
    ["che-khabar", "Begrüßung", "was gibt's Neues?", "Übliche Einstiegsfrage."],
    ["aali", "Zustimmung", "ausgezeichnet", "Klares Lob."],
  ]},
  { country: "Saudi-Arabien", code: "SA", city: "Riad", lat: 24.71, lng: 46.68, language: "Arabisch", tags: [
    ["kayf-halak", "Begrüßung", "wie geht's dir?", "Höfliche Begrüßungsfrage."],
    ["mashallah", "Erstaunen", "wie schön!", "Anerkennung mit Segenswunsch."],
    ["shukran", "Alltag", "danke", "Standarddank."],
  ]},

  // ── Afrika ─────────────────────────────────────────────────────────────
  { country: "Marokko", code: "MA", city: "Casablanca", lat: 33.57, lng: -7.59, language: "Arabisch", tags: [
    ["zwin", "Zustimmung", "schön, gut", "Lob für Aussehen und Dinge."],
    ["safi", "Zustimmung", "okay, passt", "Beendet oder bestätigt etwas."],
    ["bezzaf", "Alltag", "sehr viel", "Mengenverstärker."],
  ]},
  { country: "Nigeria", code: "NG", city: "Lagos", lat: 6.52, lng: 3.38, language: "Englisch", tags: [
    ["wahala", "Emotion", "Ärger, Stress", "Für Probleme aller Art."],
    ["japa", "Reisen", "abhauen, auswandern", "Steht für Auswanderung."],
    ["gbedu", "Party", "Beat, Musik", "Für treibende Musik."],
  ]},
  { country: "Ghana", code: "GH", city: "Accra", lat: 5.6, lng: -0.19, language: "Englisch", tags: [
    ["chale", "Freundschaft", "Kumpel", "Häufigste Anrede in Ghana."],
    ["azonto", "Party", "Tanzstil", "Bekannter ghanaischer Tanz."],
    ["charley-wote", "Alltag", "Flip-Flops", "Alltagsschuh, Kultobjekt."],
  ]},
  { country: "Kenia", code: "KE", city: "Nairobi", lat: -1.29, lng: 36.82, language: "Swahili", tags: [
    ["mambo", "Begrüßung", "was geht?", "Sheng-Begrüßung."],
    ["poa", "Zustimmung", "cool, alles gut", "Standardantwort auf 'mambo'."],
    ["sawa", "Zustimmung", "okay", "Bestätigung."],
  ]},
  { country: "Tansania", code: "TZ", city: "Daressalam", lat: -6.79, lng: 39.21, language: "Swahili", tags: [
    ["mzuri", "Zustimmung", "gut", "Freundliche Bewertung."],
    ["hakuna-matata", "Alltag", "kein Problem", "Entspannte Haltung."],
    ["bwana", "Freundschaft", "Mann, Kumpel", "Saloppe Anrede."],
  ]},
  { country: "Südafrika", code: "ZA", city: "Kapstadt", lat: -33.92, lng: 18.42, language: "Afrikaans", tags: [
    ["lekker", "Zustimmung", "geil, lecker", "Für Essen, Wetter, Erlebnisse."],
    ["howzit", "Begrüßung", "na, wie geht's?", "Standardgruß."],
    ["braai", "Essen", "Grillen", "Soziales Grillevent."],
  ]},
  { country: "Südafrika", code: "ZA", city: "Johannesburg", lat: -26.2, lng: 28.05, language: "Zulu", tags: [
    ["sharp-sharp", "Zustimmung", "alles klar", "Bestätigung und Abschied."],
    ["eish", "Erstaunen", "oh je", "Reaktion auf Ärger oder Staunen."],
    ["yebo", "Zustimmung", "ja", "Zulu-Ja im Alltag."],
  ]},
  { country: "Äthiopien", code: "ET", city: "Addis Abeba", lat: 9.03, lng: 38.74, language: "Amharisch", tags: [
    ["selam", "Begrüßung", "Hallo, Frieden", "Alltagsgruß."],
    ["konjo", "Zustimmung", "schön", "Kompliment."],
    ["ishi", "Zustimmung", "okay", "Kurze Bestätigung."],
  ]},
  { country: "Senegal", code: "SN", city: "Dakar", lat: 14.72, lng: -17.47, language: "Wolof", tags: [
    ["nangadef", "Begrüßung", "wie geht's?", "Wolof-Begrüßung."],
    ["baax-na", "Zustimmung", "das ist gut", "Positive Bewertung."],
    ["dëgg-dëgg", "Zustimmung", "echt wahr", "Bekräftigung."],
  ]},

  // ── Asien: Süd ─────────────────────────────────────────────────────────
  { country: "Indien", code: "IN", city: "Mumbai", lat: 19.08, lng: 72.88, language: "Marathi", tags: [
    ["jhakaas", "Zustimmung", "fantastisch", "Bollywood-geprägtes Lob."],
    ["bindaas", "Emotion", "sorgenfrei, locker", "Für entspannte Menschen."],
    ["jugaad", "Arbeit", "kreative Notlösung", "Improvisierte, clevere Lösung."],
  ]},
  { country: "Indien", code: "IN", city: "Delhi", lat: 28.61, lng: 77.21, language: "Hindi", tags: [
    ["yaar", "Freundschaft", "Kumpel", "Häufigste freundschaftliche Anrede."],
    ["bakwas", "Ablehnung", "Blödsinn", "Für Unsinn oder schlechte Qualität."],
    ["chal-na", "Party", "komm schon", "Aufforderung mitzukommen."],
  ]},
  { country: "Indien", code: "IN", city: "Chennai", lat: 13.08, lng: 80.27, language: "Tamil", tags: [
    ["semma", "Zustimmung", "richtig stark", "Häufiges tamilisches Lob."],
    ["machan", "Freundschaft", "Kumpel", "Vertraute Anrede."],
    ["vera-level", "Erstaunen", "nächstes Level", "Für Außergewöhnliches."],
  ]},
  { country: "Indien", code: "IN", city: "Hyderabad", lat: 17.39, lng: 78.49, language: "Telugu", tags: [
    ["bagundi", "Zustimmung", "das ist gut", "Alltagslob."],
    ["arey", "Erstaunen", "hey, ach was", "Ausruf der Überraschung."],
    ["mast", "Zustimmung", "geil, super", "Verbreitetes Lob."],
  ]},
  { country: "Indien", code: "IN", city: "Kolkata", lat: 22.57, lng: 88.36, language: "Bengali", tags: [
    ["dada", "Freundschaft", "großer Bruder", "Respektvolle Anrede."],
    ["darun", "Zustimmung", "wunderbar", "Starkes Lob."],
    ["adda", "Freundschaft", "gemütliches Quatschen", "Typische bengalische Gesprächsrunde."],
  ]},
  { country: "Pakistan", code: "PK", city: "Karatschi", lat: 24.86, lng: 67.01, language: "Urdu", tags: [
    ["yaar", "Freundschaft", "Kumpel", "Alltägliche Anrede."],
    ["bhai", "Freundschaft", "Bruder", "Respektvoll und vertraut."],
    ["zabardast", "Zustimmung", "großartig", "Starkes Lob."],
  ]},
  { country: "Bangladesch", code: "BD", city: "Dhaka", lat: 23.81, lng: 90.41, language: "Bengali", tags: [
    ["bhaiya", "Freundschaft", "Bruder", "Höfliche Anrede."],
    ["osthir", "Erstaunen", "krass, wild", "Für Aufregendes."],
    ["thik-ache", "Zustimmung", "in Ordnung", "Bestätigung."],
  ]},
  { country: "Sri Lanka", code: "LK", city: "Colombo", lat: 6.93, lng: 79.86, language: "Singhalesisch", tags: [
    ["machan", "Freundschaft", "Kumpel", "Sehr verbreitete Anrede."],
    ["patta", "Zustimmung", "super", "Jugendsprachliches Lob."],
    ["ela", "Zustimmung", "top, passt", "Kurze Zustimmung."],
  ]},

  // ── Asien: Ost / Südost ────────────────────────────────────────────────
  { country: "Japan", code: "JP", city: "Tokio", lat: 35.68, lng: 139.69, language: "Japanisch", tags: [
    ["yabai", "Erstaunen", "krass (gut oder schlimm)", "Kontextabhängiger Ausruf."],
    ["maji", "Zustimmung", "echt jetzt", "Nachfrage oder Bekräftigung."],
    ["kawaii", "Emotion", "süß, niedlich", "Zentraler Begriff der Popkultur."],
  ]},
  { country: "Japan", code: "JP", city: "Osaka", lat: 34.69, lng: 135.5, language: "Japanisch", tags: [
    ["meccha", "Alltag", "total, sehr", "Kansai-Verstärker."],
    ["nande-yanen", "Humor", "was soll das?!", "Klassischer Kansai-Konter."],
    ["ookini", "Alltag", "danke", "Osaka-Dank."],
  ]},
  { country: "Südkorea", code: "KR", city: "Seoul", lat: 37.57, lng: 126.98, language: "Koreanisch", tags: [
    ["daebak", "Erstaunen", "der Hammer", "Ausruf bei Überraschendem."],
    ["jinjja", "Zustimmung", "echt jetzt", "Nachfrage oder Betonung."],
    ["hwaiting", "Emotion", "du schaffst das", "Anfeuerung."],
  ]},
  { country: "Südkorea", code: "KR", city: "Busan", lat: 35.18, lng: 129.08, language: "Koreanisch", tags: [
    ["gimi", "Regional", "Alter, du", "Busan-Dialekt-Anrede."],
    ["mukja", "Essen", "lass essen", "Einladung zum Essen."],
    ["wae", "Alltag", "warum?", "Kurze Rückfrage."],
  ]},
  { country: "China", code: "CN", city: "Peking", lat: 39.9, lng: 116.4, language: "Chinesisch", tags: [
    ["niubi", "Zustimmung", "krass stark", "Umgangssprachliches Höchstlob."],
    ["yyds", "Zustimmung", "der/die Beste aller Zeiten", "Internet-Abkürzung."],
    ["zan", "Zustimmung", "Daumen hoch", "Zustimmung im Netz."],
  ]},
  { country: "China", code: "CN", city: "Shanghai", lat: 31.23, lng: 121.47, language: "Chinesisch", tags: [
    ["juejuezi", "Zustimmung", "absolut spitze", "Trendbegriff für Perfektes."],
    ["neijuan", "Arbeit", "sinnloser Wettbewerbsdruck", "Beschreibt Überarbeitung."],
    ["saga", "Regional", "was?", "Shanghaier Dialektfrage."],
  ]},
  { country: "Hongkong", code: "HK", city: "Hongkong", lat: 22.32, lng: 114.17, language: "Kantonesisch", tags: [
    ["hou-ging", "Zustimmung", "beeindruckend", "Kantonesisches Lob."],
    ["chi-sin", "Erstaunen", "verrückt", "Für Unglaubliches."],
    ["yum-cha", "Essen", "Tee trinken, Dim Sum", "Soziales Essen am Vormittag."],
  ]},
  { country: "Taiwan", code: "TW", city: "Taipeh", lat: 25.03, lng: 121.57, language: "Chinesisch", tags: [
    ["ganga", "Humor", "peinlich, awkward", "Für unangenehme Momente."],
    ["chao-qiang", "Zustimmung", "super stark", "Starkes Lob."],
    ["haochi", "Essen", "lecker", "Für gutes Essen."],
  ]},
  { country: "Vietnam", code: "VN", city: "Hanoi", lat: 21.03, lng: 105.85, language: "Vietnamesisch", tags: [
    ["xin-chao", "Begrüßung", "Hallo", "Höflicher Gruß."],
    ["dinh", "Zustimmung", "top, klasse", "Jugendsprachliches Lob."],
    ["troi-oi", "Erstaunen", "oh mein Gott", "Häufiger Ausruf."],
  ]},
  { country: "Vietnam", code: "VN", city: "Ho-Chi-Minh-Stadt", lat: 10.82, lng: 106.63, language: "Vietnamesisch", tags: [
    ["quá-dã", "Emotion", "richtig befriedigend", "Wenn etwas voll aufgeht."],
    ["nhau", "Party", "gemeinsam trinken", "Geselliges Beisammensein."],
    ["ok-luon", "Zustimmung", "passt sofort", "Schnelle Zusage."],
  ]},
  { country: "Thailand", code: "TH", city: "Bangkok", lat: 13.76, lng: 100.5, language: "Thai", tags: [
    ["aroi", "Essen", "lecker", "Standardlob für Essen."],
    ["sabai", "Emotion", "entspannt, wohl", "Angenehmes Lebensgefühl."],
    ["mai-pen-rai", "Alltag", "kein Problem", "Gelassene Standardantwort."],
  ]},
  { country: "Indonesien", code: "ID", city: "Jakarta", lat: -6.21, lng: 106.85, language: "Indonesisch", tags: [
    ["anjay", "Erstaunen", "wow, krass", "Ausruf des Staunens."],
    ["gokil", "Zustimmung", "verrückt gut", "Für Beeindruckendes."],
    ["santuy", "Emotion", "entspannt", "Slangform von 'santai'."],
  ]},
  { country: "Indonesien", code: "ID", city: "Bali", lat: -8.65, lng: 115.22, language: "Indonesisch", tags: [
    ["om-swastiastu", "Begrüßung", "Grüße dich", "Balinesischer Gruß."],
    ["asik", "Zustimmung", "cool, angenehm", "Positive Bewertung."],
    ["nongkrong", "Freundschaft", "rumhängen", "Zeit mit Freunden verbringen."],
  ]},
  { country: "Malaysia", code: "MY", city: "Kuala Lumpur", lat: 3.14, lng: 101.69, language: "Malaiisch", tags: [
    ["lah", "Alltag", "Betonungspartikel", "Hängt an fast jedem Satz."],
    ["syok", "Zustimmung", "geil, angenehm", "Für Genuss und Spaß."],
    ["makan", "Essen", "essen", "Zentrales Alltagswort."],
  ]},
  { country: "Singapur", code: "SG", city: "Singapur", lat: 1.35, lng: 103.82, language: "Englisch", tags: [
    ["shiok", "Emotion", "herrlich, geil", "Für Genussmomente."],
    ["kiasu", "Humor", "Angst zu kurz zu kommen", "Beschreibt Ellbogenmentalität."],
    ["can-lah", "Zustimmung", "klar, geht", "Singlish-Zusage."],
  ]},
  { country: "Philippinen", code: "PH", city: "Manila", lat: 14.6, lng: 120.98, language: "Tagalog", tags: [
    ["lodi", "Zustimmung", "Idol, Vorbild", "Umgedrehtes 'idol'."],
    ["petmalu", "Zustimmung", "außergewöhnlich", "Silbendreher von 'malupet'."],
    ["kilig", "Liebe", "Schmetterlinge im Bauch", "Verliebtes Kribbeln."],
  ]},

  // ── Nordamerika ────────────────────────────────────────────────────────
  { country: "USA", code: "US", city: "New York", lat: 40.71, lng: -74.01, language: "Englisch", tags: [
    ["deadass", "Zustimmung", "ganz im Ernst", "Betont, dass man es ernst meint."],
    ["brick", "Alltag", "eiskalt", "Für extremes Winterwetter."],
    ["mad", "Alltag", "sehr, total", "Verstärker im NYC-Slang."],
  ]},
  { country: "USA", code: "US", city: "Los Angeles", lat: 34.05, lng: -118.24, language: "Englisch", tags: [
    ["hella", "Alltag", "richtig viel", "Kalifornischer Verstärker."],
    ["bet", "Zustimmung", "abgemacht", "Kurze Zusage."],
    ["no-cap", "Zustimmung", "ohne Lüge", "Bekräftigt Ehrlichkeit."],
  ]},
  { country: "USA", code: "US", city: "Chicago", lat: 41.88, lng: -87.63, language: "Englisch", tags: [
    ["bogus", "Ablehnung", "unfair, mies", "Für schlechte Situationen."],
    ["the-l", "Regional", "Hochbahn", "Chicagos Nahverkehr."],
    ["jit", "Jugend", "junger Typ", "Für einen Jüngeren."],
  ]},
  { country: "USA", code: "US", city: "Atlanta", lat: 33.75, lng: -84.39, language: "Englisch", tags: [
    ["bussin", "Essen", "richtig gut (Essen)", "Lob für starkes Essen."],
    ["slime", "Freundschaft", "enger Kumpel", "Aus dem Atlanta-Rap."],
    ["lit", "Party", "abgehend", "Für gute Stimmung."],
  ]},
  { country: "USA", code: "US", city: "Miami", lat: 25.76, lng: -80.19, language: "Spanisch", tags: [
    ["dale", "Zustimmung", "los, mach", "Miami-Kultruf."],
    ["que-bola", "Begrüßung", "was geht?", "Kubanisch geprägter Gruß."],
    ["chonga", "Jugend", "auffälliger Style", "Lokaler Modebegriff."],
  ]},
  { country: "USA", code: "US", city: "San Francisco", lat: 37.77, lng: -122.42, language: "Englisch", tags: [
    ["hyphy", "Party", "wild, ausgelassen", "Bay-Area-Kultur."],
    ["yee", "Zustimmung", "yes, geht klar", "Kurze Zustimmung."],
    ["ship-it", "Arbeit", "raus damit", "Tech-Jargon fürs Veröffentlichen."],
  ]},
  { country: "USA", code: "US", city: "New Orleans", lat: 29.95, lng: -90.07, language: "Englisch", tags: [
    ["lagniappe", "Alltag", "kleine Draufgabe", "Etwas gratis obendrauf."],
    ["where-yat", "Begrüßung", "wie geht's?", "Lokaler Gruß."],
    ["second-line", "Party", "Straßenparade", "Musikalischer Umzug."],
  ]},
  { country: "Kanada", code: "CA", city: "Toronto", lat: 43.65, lng: -79.38, language: "Englisch", tags: [
    ["mans", "Freundschaft", "der Typ / ich", "Toronto-Slang für Person."],
    ["wasteman", "Ablehnung", "Nichtsnutz", "Abwertung für Unzuverlässige."],
    ["ahlie", "Zustimmung", "echt jetzt, oder?", "Bestätigungsfrage."],
  ]},
  { country: "Kanada", code: "CA", city: "Vancouver", lat: 49.28, lng: -123.12, language: "Englisch", tags: [
    ["skookum", "Zustimmung", "stark, solide", "Aus dem Chinook Jargon."],
    ["toque", "Alltag", "Wollmütze", "Kanadisches Alltagswort."],
    ["eh", "Zustimmung", "oder?", "Typische Rückfrage."],
  ]},
  { country: "Kanada", code: "CA", city: "Montreal", lat: 45.5, lng: -73.57, language: "Französisch", tags: [
    ["tabarnak", "Emotion", "verdammt", "Kräftiger Québec-Ausruf."],
    ["chum", "Freundschaft", "Kumpel, Freund", "Für Freund oder Partner."],
    ["magasiner", "Alltag", "einkaufen gehen", "Québec-Variante für Shopping."],
  ]},
  { country: "Mexiko", code: "MX", city: "Mexiko-Stadt", lat: 19.43, lng: -99.13, language: "Spanisch", tags: [
    ["chido", "Zustimmung", "cool", "Mexikanisches Standardlob."],
    ["no-manches", "Erstaunen", "nicht dein Ernst", "Ungläubiger Ausruf."],
    ["chale", "Ablehnung", "schade, echt jetzt", "Enttäuschung."],
  ]},
  { country: "Mexiko", code: "MX", city: "Guadalajara", lat: 20.67, lng: -103.35, language: "Spanisch", tags: [
    ["cuh", "Freundschaft", "Kumpel", "Kurzform von 'compa'."],
    ["padre", "Zustimmung", "super", "Positives Urteil."],
    ["antro", "Party", "Club", "Ort zum Feiern."],
  ]},
  { country: "Kuba", code: "CU", city: "Havanna", lat: 23.11, lng: -82.37, language: "Spanisch", tags: [
    ["asere", "Freundschaft", "Kumpel", "Typisch kubanische Anrede."],
    ["que-vola", "Begrüßung", "was geht?", "Straßengruß."],
    ["jama", "Essen", "Essen", "Umgangssprachlich für Mahlzeit."],
  ]},
  { country: "Jamaika", code: "JM", city: "Kingston", lat: 17.97, lng: -76.79, language: "Englisch", tags: [
    ["irie", "Emotion", "alles bestens", "Positiver Grundzustand."],
    ["bredren", "Freundschaft", "Bruder", "Enger Freund."],
    ["big-up", "Zustimmung", "Respekt", "Anerkennung aussprechen."],
  ]},

  // ── Südamerika ─────────────────────────────────────────────────────────
  { country: "Brasilien", code: "BR", city: "São Paulo", lat: -23.55, lng: -46.63, language: "Portugiesisch", tags: [
    ["mano", "Freundschaft", "Bruder, Alter", "Häufigste Anrede."],
    ["treta", "Emotion", "Stress, Streit", "Für Konflikte."],
    ["daora", "Zustimmung", "cool", "Positive Bewertung."],
  ]},
  { country: "Brasilien", code: "BR", city: "Rio de Janeiro", lat: -22.91, lng: -43.17, language: "Portugiesisch", tags: [
    ["caraca", "Erstaunen", "Wahnsinn!", "Ausruf der Überraschung."],
    ["maneiro", "Zustimmung", "klasse", "Carioca-Lob."],
    ["gato", "Liebe", "attraktive Person", "Kompliment."],
  ]},
  { country: "Argentinien", code: "AR", city: "Buenos Aires", lat: -34.6, lng: -58.38, language: "Spanisch", tags: [
    ["boludo", "Freundschaft", "Alter (freundschaftlich)", "Zentrale Anrede unter Freunden."],
    ["copado", "Zustimmung", "cool, stark", "Positive Bewertung."],
    ["posta", "Zustimmung", "echt wahr", "Bekräftigung."],
  ]},
  { country: "Chile", code: "CL", city: "Santiago", lat: -33.45, lng: -70.67, language: "Spanisch", tags: [
    ["cachai", "Alltag", "verstehst du?", "Chiles Rückversicherungsfrage."],
    ["bacán", "Zustimmung", "richtig cool", "Alltagslob."],
    ["po", "Alltag", "halt, eben", "Satzpartikel."],
  ]},
  { country: "Kolumbien", code: "CO", city: "Bogotá", lat: 4.71, lng: -74.07, language: "Spanisch", tags: [
    ["parce", "Freundschaft", "Kumpel", "Kolumbianische Anrede."],
    ["chimba", "Zustimmung", "super, geil", "Sehr positiv gemeint."],
    ["bacano", "Zustimmung", "angenehm, cool", "Für gute Dinge."],
  ]},
  { country: "Peru", code: "PE", city: "Lima", lat: -12.05, lng: -77.04, language: "Spanisch", tags: [
    ["causa", "Freundschaft", "Kumpel", "Vertrauliche Anrede."],
    ["chévere", "Zustimmung", "cool, super", "Positive Bewertung."],
    ["pata", "Freundschaft", "Kumpel", "Enger Freund."],
  ]},
  { country: "Venezuela", code: "VE", city: "Caracas", lat: 10.48, lng: -66.9, language: "Spanisch", tags: [
    ["pana", "Freundschaft", "Kumpel", "Typisch venezolanisch."],
    ["chamo", "Jugend", "Junge, Typ", "Anrede unter Jüngeren."],
    ["burda", "Alltag", "sehr viel", "Verstärker."],
  ]},
  { country: "Uruguay", code: "UY", city: "Montevideo", lat: -34.9, lng: -56.16, language: "Spanisch", tags: [
    ["bo", "Freundschaft", "hey du", "Typische Anrede."],
    ["ta", "Zustimmung", "okay, passt", "Kurze Bestätigung."],
    ["championes", "Alltag", "Turnschuhe", "Uruguayisches Alltagswort."],
  ]},

  // ── Ozeanien ───────────────────────────────────────────────────────────
  { country: "Australien", code: "AU", city: "Sydney", lat: -33.87, lng: 151.21, language: "Englisch", tags: [
    ["arvo", "Alltag", "Nachmittag", "Typische Kurzform."],
    ["heaps", "Alltag", "ganz viel", "Verstärker."],
    ["deadset", "Zustimmung", "im Ernst", "Bekräftigung."],
  ]},
  { country: "Australien", code: "AU", city: "Melbourne", lat: -37.81, lng: 144.96, language: "Englisch", tags: [
    ["maccas", "Essen", "McDonald's", "Landesweite Kurzform."],
    ["sanga", "Essen", "Sandwich", "Alltagswort."],
    ["bogan", "Humor", "einfacher Typ", "Halb spöttische Beschreibung."],
  ]},
  { country: "Neuseeland", code: "NZ", city: "Auckland", lat: -36.85, lng: 174.76, language: "Englisch", tags: [
    ["chur", "Zustimmung", "danke, alles klar", "Kiwi-Standardantwort."],
    ["choice", "Zustimmung", "top, klasse", "Positive Bewertung."],
    ["sweet-as", "Zustimmung", "alles bestens", "Entspannte Zusage."],
  ]},
  { country: "Fidschi", code: "FJ", city: "Suva", lat: -18.14, lng: 178.44, language: "Fidschianisch", tags: [
    ["bula", "Begrüßung", "Hallo, Leben", "Zentraler Gruß."],
    ["vinaka", "Alltag", "danke", "Höflicher Dank."],
    ["kerekere", "Freundschaft", "bitte, teilen", "Bitte um Gefallen."],
  ]},
];

/** Kategorie „Fußball“ – Kategoriename bleibt exakt so wie im Filter angezeigt. */
export const FOOTBALL_CATEGORY = "Fußball";

/**
 * Bestehende Demo-SlangTags, die inhaltlich in die Kategorie „Fußball“ gehören
 * und deshalb umgeordnet werden (Schlüssel: `CODE|Stadt|begriff`).
 */
const FOOTBALL_RECATEGORIZED: readonly string[] = [
  "IT|Rom|daje",
  "IT|Neapel|jamme",
  "GB|Manchester|mad-fer-it",
  "GB|Liverpool|boss",
  "AR|Buenos Aires|copado",
];

/** Zusätzliche internationale Fußball-SlangTags je bestehender Stadt. */
const FOOTBALL_ADDITIONS: Record<string, readonly TagRow[]> = {
  "DE|Dortmund": [
    ["echte-liebe", "Fußball", "echte Liebe (zum Verein)", "Fan-Bekenntnis zum eigenen Klub, unabhängig von Ergebnissen."],
    ["buli", "Fußball", "Bundesliga", "Kurzform für die Liga im Alltagsgespräch."],
  ],
  "DE|Berlin": [
    ["bratkartoffelverhältnis", "Fußball", "Auswärtsfahrt zum Pflichtspiel", "Ironisch für die feste Fan-Routine am Spieltag."],
  ],
  "DE|München": [
    ["mia-san-mia", "Fußball", "wir sind wir", "Selbstbewusstes Motto der Münchner Fußballszene."],
  ],
  "DE|Köln": [
    ["effzeh", "Fußball", "der Kölner Klub", "Fan-Kurzform, gesprochen wie die Initialen."],
  ],
  "GB|London": [
    ["derby-day", "Fußball", "Stadtderby", "Spieltag zwischen zwei Klubs derselben Stadt."],
    ["nutmeg", "Fußball", "Tunnel (Ball durch die Beine)", "Trickreiches Vorbeispielen am Gegner."],
  ],
  "GB|Liverpool": [
    ["ynwa", "Fußball", "You'll Never Walk Alone", "Fangesang und Leitspruch der Anfield-Kurve."],
  ],
  "GB|Glasgow": [
    ["old-firm", "Fußball", "Glasgower Stadtderby", "Das traditionsreichste Derby Schottlands."],
  ],
  "ES|Madrid": [
    ["hala", "Fußball", "auf geht's!", "Anfeuerungsruf im Stadion."],
    ["chilena", "Fußball", "Fallrückzieher", "Spektakulärer Torschuss über Kopfhöhe."],
  ],
  "ES|Barcelona": [
    ["culé", "Fußball", "Fan des Klubs", "Selbstbezeichnung der Anhänger."],
    ["caño", "Fußball", "Tunnel", "Ball durch die Beine des Gegners."],
  ],
  "IT|Rom": [
    ["tifoso", "Fußball", "leidenschaftlicher Fan", "Wer seinen Klub bei jedem Spiel begleitet."],
  ],
  "IT|Neapel": [
    ["forza", "Fußball", "los, kämpft!", "Ruf von der Tribüne."],
  ],
  "IT|Mailand": [
    ["catenaccio", "Fußball", "extrem defensive Taktik", "Klassischer italienischer Abwehrriegel."],
  ],
  "BR|Rio de Janeiro": [
    ["gol-de-placa", "Fußball", "Tor für die Ewigkeit", "Ein Treffer, der auf eine Gedenktafel gehört."],
    ["torcida", "Fußball", "Fanblock", "Die singende, treibende Kurve."],
  ],
  "BR|São Paulo": [
    ["craque", "Fußball", "überragender Spieler", "Der klare Unterschiedsspieler im Team."],
    ["frango", "Fußball", "Torwartfehler", "Wörtlich „Huhn“ – ein haltbarer Gegentreffer."],
  ],
  "AR|Buenos Aires": [
    ["hinchada", "Fußball", "Fangemeinde", "Die Anhänger eines Klubs als Gruppe."],
    ["caño", "Fußball", "Tunnel", "Ball durch die Beine des Gegners."],
  ],
  "CO|Bogotá": [
    ["hincha", "Fußball", "Fan", "Wer den Klub mit Herz begleitet."],
  ],
  "MX|Mexiko-Stadt": [
    ["chilena", "Fußball", "Fallrückzieher", "Sehenswerter Torabschluss in der Luft."],
  ],
  "FR|Marseille": [
    ["allez", "Fußball", "los geht's!", "Standardruf der französischen Kurven."],
  ],
  "FR|Paris": [
    ["lucarne", "Fußball", "Tor ins kurze Eck oben", "Treffer direkt unter die Latte."],
  ],
  "NL|Amsterdam": [
    ["panna", "Fußball", "Tunnel im Straßenfußball", "Höchste Demütigung beim Eins-gegen-eins."],
  ],
  "TR|Istanbul": [
    ["üçlük", "Fußball", "Dreierpack", "Drei Tore eines Spielers in einem Spiel."],
  ],
  "GR|Athen": [
    ["gkol", "Fußball", "Tor", "Jubelruf im Stadion."],
  ],
  "EG|Kairo": [
    ["goon", "Fußball", "Tor", "Ausruf beim Treffer in der Kurve."],
  ],
  "NG|Lagos": [
    ["baller", "Fußball", "starker Kicker", "Wer auf dem Platz überzeugt."],
  ],
  "GH|Accra": [
    ["gbeke", "Fußball", "Aufregung im Spiel", "Wenn eine Partie kippt."],
  ],
  "SN|Dakar": [
    ["tekki", "Fußball", "Dribbling", "Der Weg durch die Abwehr."],
  ],
  "ZA|Johannesburg": [
    ["shibobo", "Fußball", "Tunnel", "Der Ball durch die Beine des Gegners."],
    ["laduma", "Fußball", "es donnert – Tor!", "Klassischer Torschrei in Südafrika."],
  ],
  "JP|Tokio": [
    ["sapo", "Fußball", "Supporter", "Kurzform für die Fanszene."],
  ],
  "KR|Seoul": [
    ["daehanminguk", "Fußball", "Korea-Sprechchor", "Der Ruf der Nationalmannschafts-Fans."],
  ],
  "US|New York": [
    ["footy", "Fußball", "Fußball (locker)", "Alltagswort für das Spiel."],
  ],
};

/** Neue Städte, die für die Kategorie „Fußball“ ergänzt werden. */
const FOOTBALL_CITIES: readonly CityRow[] = [
  { country: "Deutschland", code: "DE", city: "Dortmund", lat: 51.51, lng: 7.47, language: "Deutsch", tags: [] },
  { country: "Deutschland", code: "DE", city: "Gelsenkirchen", lat: 51.52, lng: 7.1, language: "Deutsch", tags: [
    ["malocher", "Fußball", "Arbeiter-Fan", "Ruhrgebiets-Selbstbild der Kurve."],
    ["schalke-nord", "Fußball", "Nordkurve", "Der Stehplatzblock der treuen Fans."],
  ]},
  { country: "Spanien", code: "ES", city: "Sevilla", lat: 37.39, lng: -5.98, language: "Spanisch", tags: [
    ["remontada", "Fußball", "Aufholjagd", "Rückstand noch in einen Sieg drehen."],
  ]},
  { country: "Portugal", code: "PT", city: "Lissabon", lat: 38.72, lng: -9.14, language: "Portugiesisch", tags: [
    ["bicicleta", "Fußball", "Fallrückzieher", "Wörtlich „Fahrrad“ – Schuss in der Luft."],
  ]},
  { country: "Uruguay", code: "UY", city: "Montevideo", lat: -34.9, lng: -56.16, language: "Spanisch", tags: [
    ["garra-charrúa", "Fußball", "Kampfgeist bis zum Schluss", "Nationales Fußball-Selbstbild Uruguays."],
  ]},
  { country: "Marokko", code: "MA", city: "Casablanca", lat: 33.57, lng: -7.59, language: "Arabisch", tags: [
    ["ultras", "Fußball", "organisierte Fangruppe", "Trägt Gesänge und Choreos im Stadion."],
  ]},
];

/**
 * Zusammengeführter Städte-Bestand: bestehende Städte + Fußball-Ergänzungen.
 * Struktur, Reihenfolge und Verankerung der bisherigen Einträge bleiben gleich.
 */
const ALL_CITIES: readonly CityRow[] = (() => {
  const merged = CITIES.map((c) => {
    const extra = FOOTBALL_ADDITIONS[`${c.code}|${c.city}`] ?? [];
    const tags = c.tags.map<TagRow>((row) =>
      FOOTBALL_RECATEGORIZED.includes(`${c.code}|${c.city}|${row[0]}`)
        ? [row[0], FOOTBALL_CATEGORY, row[2], row[3]]
        : row,
    );
    return extra.length ? { ...c, tags: [...tags, ...extra] } : { ...c, tags };
  });
  const known = new Set(merged.map((c) => `${c.code}|${c.city}`));
  const added = FOOTBALL_CITIES.filter((c) => !known.has(`${c.code}|${c.city}`)).map((c) => ({
    ...c,
    tags: [...c.tags, ...(FOOTBALL_ADDITIONS[`${c.code}|${c.city}`] ?? [])],
  }));
  return [...merged, ...added.filter((c) => c.tags.length > 0)];
})();

/** Alle Demo-SlangTags – flach, mit fester geografischer Verankerung. */
export const DEMO_SLANG_TAGS: readonly GlobeSlangTag[] = ALL_CITIES.flatMap((c) =>

  c.tags.map<GlobeSlangTag>(([tag, category, meaningDe, explanation]) => ({
    id: `demo:${c.code}:${c.city}:${tag}`.toLowerCase().replace(/\s+/g, "-"),
    tag,
    language: c.language,
    country: c.country,
    countryCode: c.code,
    region: c.city,
    lat: c.lat,
    lng: c.lng,
    meaningDe,
    explanation,
    category,
    source: "demo",
    isDemo: true,
    audio: null,
    audioStatus: "demo-pending",
  })),
);

/** Nach Region gruppierte Demo-SlangTags (Reihenfolge bleibt stabil). */
export type DemoRegionGroup = {
  key: string;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  language: string;
  tags: GlobeSlangTag[];
};

export const DEMO_REGION_GROUPS: readonly DemoRegionGroup[] = CITIES.map((c) => ({
  key: `${c.code}-${c.city}`.toLowerCase().replace(/\s+/g, "-"),
  country: c.country,
  countryCode: c.code,
  city: c.city,
  lat: c.lat,
  lng: c.lng,
  language: c.language,
  tags: DEMO_SLANG_TAGS.filter((t) => t.region === c.city && t.countryCode === c.code),
}));

/** Deutsche Bedeutung eines Demo-Begriffs (Fallback für die Anzeige). */
const MEANING_BY_TAG = new Map<string, string>(
  DEMO_SLANG_TAGS.map((t) => [t.tag.toLowerCase(), t.meaningDe]),
);

export function demoMeaningDe(name: string): string | null {
  return MEANING_BY_TAG.get(name.trim().toLowerCase()) ?? null;
}
