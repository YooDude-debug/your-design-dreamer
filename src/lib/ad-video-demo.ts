/**
 * Videowerbung-Pool.
 *
 * Struktur bewusst analog zu `SPONSORED_ADS`, aber mit Videoquelle und Poster.
 */

import hotelGreece from "@/assets/ads/hotel-greece.jpg";
import festivalBerlin from "@/assets/ads/festival-berlin.jpg";
import flightTokyo from "@/assets/ads/flight-tokyo.jpg";
import videoHotelGreece from "@/assets/ads/video-hotel-greece.mp4.asset.json";
import videoFestivalBerlin from "@/assets/ads/video-festival-berlin.mp4.asset.json";
import videoFlightTokyo from "@/assets/ads/video-flight-tokyo.mp4.asset.json";
import videoYdudeSelftest from "@/assets/ads/video-ydude-selftest.mp4.asset.json";
import ydudeSelftestPoster from "@/assets/ads/video-ydude-selftest.jpg";

export type VideoAd = {
  id: string;
  company: string;
  logo: string;
  headline: string;
  body: string;
  category: string;
  location: string;
  cta: string;
  url: string;
  /** Standbild vor dem Start. */
  poster: string;
  video: string;
  /** Seitenverhaeltnis des Clips. Standard bleibt 16/9 (bestehende Videos). */
  aspect?: "16/9" | "9/16";
};

export const VIDEO_ADS: VideoAd[] = [
  {
    id: "video-hotel-greece",
    company: "Aegean Blue Resorts",
    logo: "AB",
    headline: "Santorin im Sonnenuntergang",
    body: "Infinity-Pool über der Caldera – jetzt als Frühbucher 25 % sparen.",
    category: "Hotel",
    location: "Santorin, Griechenland",
    cta: "Jetzt buchen",
    url: "https://example.com/aegean-blue",
    poster: hotelGreece,
    video: videoHotelGreece.url,
  },
  {
    id: "video-festival-berlin",
    company: "Berlin Open Air",
    logo: "BO",
    headline: "Drei Nächte, ein Vibe",
    body: "Open-Air-Festival in Berlin – Tickets in der letzten Runde.",
    category: "Event",
    location: "Berlin, Deutschland",
    cta: "Tickets sichern",
    url: "https://example.com/berlin-open-air",
    poster: festivalBerlin,
    video: videoFestivalBerlin.url,
  },
  {
    id: "video-flight-tokyo",
    company: "SkyLine Air",
    logo: "SL",
    headline: "Tokio bei Nacht",
    body: "Direktflüge nach Tokio – Fensterplatz inklusive Skyline.",
    category: "Flug",
    location: "Tokio, Japan",
    cta: "Flug finden",
    url: "https://example.com/skyline-air",
    poster: flightTokyo,
    video: videoFlightTokyo.url,
  },
  // Test-Werbemittel (Eigenwerbung) fuer den Video-Werbefeed – 9:16, ~14 s.
  {
    id: "video-ydude-selftest",
    company: "y-Dude",
    logo: "Y",
    headline: "Speak local. Connect Global.",
    body: "Slang, Stimme und Ort – hoere, wie deine Region klingt.",
    category: "y-Dude",
    location: "Weltweit",
    cta: "Rein in den Vibe",
    url: "https://y-dude.com",
    poster: ydudeSelftestPoster,
    video: videoYdudeSelftest.url,
    aspect: "9/16",
  },
];

export const videoAdById = (id: string) => VIDEO_ADS.find((a) => a.id === id) ?? null;
