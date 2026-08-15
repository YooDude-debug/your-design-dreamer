/**
 * Anzeige-Hilfen für den vom Nutzer selbst gewählten Status.
 *
 * Einzige Quelle der Wahrheit ist die Spalte `profiles.presence_status`
 * (Werte: `online`, `busy`, `offline`). Die technische Realtime-Präsenz
 * (ist ein Client verbunden?) darf diesen Wert niemals überschreiben.
 */
import type { PresenceStatus } from "@/lib/types";

export const PRESENCE_LABELS: Record<"de" | "en" | "el", Record<PresenceStatus, string>> = {
  de: { online: "Online", busy: "Beschäftigt", offline: "Offline" },
  en: { online: "Online", busy: "Busy", offline: "Offline" },
  el: { online: "Συνδεδεμένος", busy: "Απασχολημένος", offline: "Αποσυνδεδεμένος" },
};

/** Beschriftung des manuell gewählten Status in der aktiven Sprache. */
export function presenceLabel(lang: "de" | "en" | "el", status: PresenceStatus): string {
  return PRESENCE_LABELS[lang][status];
}

/** Punktfarbe des Status-Indikators (bestehende Farbwelt: grün / amber / grau). */
export function presenceDotClass(status: PresenceStatus): string {
  if (status === "online") return "bg-brand";
  if (status === "busy") return "bg-amber-400/80";
  return "bg-muted-foreground/50";
}

/** Textfarbe des Status-Hinweises. */
export function presenceTextClass(status: PresenceStatus): string {
  if (status === "online") return "text-brand";
  if (status === "busy") return "text-amber-300/90";
  return "text-muted-foreground";
}
