import hotelGreece from "@/assets/ads/hotel-greece.jpg";
import doenerBerlin from "@/assets/ads/doener-berlin.jpg";
import flightTokyo from "@/assets/ads/flight-tokyo.jpg";
import languageLondon from "@/assets/ads/language-london.jpg";
import tourParis from "@/assets/ads/tour-paris.jpg";
import festivalBerlin from "@/assets/ads/festival-berlin.jpg";
import carMallorca from "@/assets/ads/car-mallorca.jpg";
import insuranceTravel from "@/assets/ads/insurance-travel.jpg";
import slangDrop from "@/assets/moinmoin.m4a.asset.json";

/** Filterkategorien am oberen Rand des Werbefeeds. */
export const AD_FILTERS = [
  "all",
  "travel",
  "hotels",
  "food",
  "events",
  "language",
  "shopping",
] as const;
export type AdFilter = (typeof AD_FILTERS)[number];

export type SponsoredAd = {
  id: string;
  company: string;
  /** Logo als Initialen-Monogramm (kein externes Asset nötig). */
  logo: string;
  headline: string;
  body: string;
  category: string;
  /** Zuordnung zu den Filtern oben. */
  filters: AdFilter[];
  location: string;
  /** Land/Region für regionale Empfehlungen. */
  regionCode: string;
  rating?: number;
  ratingCount?: number;
  cta: string;
  image: string;
  url: string;
  slangDrop: {
    name: string;
    audio: string;
    duration: string;
    text: string;
    translation: string;
  };
};

const AUDIO = slangDrop.url;

export const SPONSORED_ADS: SponsoredAd[] = [
  {
    id: "hotel-greece",
    company: "Aegean Blue Resorts",
    logo: "AB",
    headline: "Sunset-Suite auf Santorin",
    body: "Infinity-Pool über der Caldera, Frühstück inklusive. Frühbucher sparen 25 %.",
    category: "Hotel",
    filters: ["travel", "hotels"],
    location: "Santorin, Griechenland",
    regionCode: "GR",
    rating: 4.8,
    ratingCount: 1264,
    cta: "Jetzt buchen",
    image: hotelGreece,
    url: "https://example.com/aegean-blue",
    slangDrop: {
      name: "kalimera",
      audio: AUDIO,
      duration: "0:02",
      text: "Kalimera!",
      translation: "Guten Morgen!",
    },
  },
  {
    id: "doener-berlin",
    company: "Kreuzberg Grill",
    logo: "KG",
    headline: "Döner wie früher – nur besser",
    body: "Handgeschnittenes Kalbfleisch, frisches Fladenbrot. Heute 2 für 1 ab 18 Uhr.",
    category: "Restaurant",
    filters: ["food"],
    location: "Berlin-Kreuzberg, Deutschland",
    regionCode: "DE",
    rating: 4.6,
    ratingCount: 892,
    cta: "Route öffnen",
    image: doenerBerlin,
    url: "https://example.com/kreuzberg-grill",
    slangDrop: {
      name: "mitalles",
      audio: AUDIO,
      duration: "0:02",
      text: "Einmal mit alles!",
      translation: "One with everything, please!",
    },
  },
  {
    id: "flight-tokyo",
    company: "SkyNori Airlines",
    logo: "SN",
    headline: "Nonstop nach Tokio ab 489 €",
    body: "Direktflüge ab Frankfurt, 30 kg Gepäck inklusive. Nur diese Woche.",
    category: "Flug",
    filters: ["travel"],
    location: "Tokio, Japan",
    regionCode: "JP",
    rating: 4.4,
    ratingCount: 3120,
    cta: "Angebot ansehen",
    image: flightTokyo,
    url: "https://example.com/skynori",
    slangDrop: {
      name: "yoroshiku",
      audio: AUDIO,
      duration: "0:02",
      text: "Yoroshiku!",
      translation: "Freut mich, auf gute Zusammenarbeit!",
    },
  },
  {
    id: "language-london",
    company: "Thames Language Lab",
    logo: "TL",
    headline: "Englisch lernen in 4 Wochen",
    body: "Kleine Gruppen, Muttersprachler, Zertifikat. Wohnen im Campus möglich.",
    category: "Sprachschule",
    filters: ["language"],
    location: "London, UK",
    regionCode: "GB",
    rating: 4.9,
    ratingCount: 431,
    cta: "Mehr erfahren",
    image: languageLondon,
    url: "https://example.com/thames-lab",
    slangDrop: {
      name: "innit",
      audio: AUDIO,
      duration: "0:02",
      text: "Proper good, innit?",
      translation: "Richtig gut, oder?",
    },
  },
  {
    id: "tour-paris",
    company: "Bonjour Walks",
    logo: "BW",
    headline: "Montmartre bei Sonnenuntergang",
    body: "Drei Stunden versteckte Gassen, Street Art und Crêpes mit lokalem Guide.",
    category: "Tourismus",
    filters: ["travel", "events"],
    location: "Paris, Frankreich",
    regionCode: "FR",
    rating: 4.7,
    ratingCount: 2075,
    cta: "Jetzt entdecken",
    image: tourParis,
    url: "https://example.com/bonjour-walks",
    slangDrop: {
      name: "onyva",
      audio: AUDIO,
      duration: "0:02",
      text: "On y va!",
      translation: "Los geht's!",
    },
  },
  {
    id: "festival-berlin",
    company: "Green Pulse Festival",
    logo: "GP",
    headline: "3 Tage, 20 Bühnen, 100+ Acts",
    body: "Open Air an der Spree mit Camping-Option. Frühbucher-Tickets ab 79 €.",
    category: "Event",
    filters: ["events"],
    location: "Berlin, Deutschland",
    regionCode: "DE",
    rating: 4.5,
    ratingCount: 5680,
    cta: "Jetzt buchen",
    image: festivalBerlin,
    url: "https://example.com/green-pulse",
    slangDrop: {
      name: "vollkrass",
      audio: AUDIO,
      duration: "0:02",
      text: "Voll krass!",
      translation: "Absolutely wild!",
    },
  },
  {
    id: "car-mallorca",
    company: "Isla Drive",
    logo: "ID",
    headline: "Cabrio auf Mallorca ab 19 €/Tag",
    body: "Ohne Kaution, unbegrenzte Kilometer, Abholung direkt am Flughafen.",
    category: "Mietwagen",
    filters: ["travel", "shopping"],
    location: "Palma de Mallorca, Spanien",
    regionCode: "ES",
    rating: 4.3,
    ratingCount: 744,
    cta: "Angebot ansehen",
    image: carMallorca,
    url: "https://example.com/isla-drive",
    slangDrop: {
      name: "vamos",
      absent: undefined,
      duration: "0:02",
      audio: AUDIO,
      text: "¡Vamos!",
      translation: "Auf geht's!",
    } as SponsoredAd["slangDrop"],
  },
  {
    id: "insurance-travel",
    company: "SafeTrip Care",
    logo: "SC",
    headline: "Reiseschutz in 2 Minuten",
    body: "Weltweit versichert inklusive Gepäck und Rücktritt. Monatlich kündbar.",
    category: "Versicherung",
    filters: ["travel", "shopping"],
    location: "Weltweit",
    regionCode: "*",
    cta: "Mehr erfahren",
    image: insuranceTravel,
    url: "https://example.com/safetrip",
    slangDrop: {
      name: "allesgut",
      audio: AUDIO,
      duration: "0:02",
      text: "Alles gut!",
      translation: "All good!",
    },
  },
];
