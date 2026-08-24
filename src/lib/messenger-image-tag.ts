/**
 * SlangTag-Overlay auf Messenger-Bildern.
 *
 * Die Position wird ausschliesslich RELATIV zum Bild gespeichert (0..1), damit
 * sie auf jedem Endgeraet und in jeder Bildgroesse identisch erscheint. Bild
 * und SlangTag bleiben technisch getrennt: das Overlay ist ein eigenes
 * interaktives Element und wird nie in das Bild gerendert.
 */

import type { TranslationLang } from "@/lib/lang-detect";

export type MediaTagPlacement = {
  /** Mittelpunkt relativ zur Bildbreite (0..1) */
  x: number;
  /** Mittelpunkt relativ zur Bildhoehe (0..1) */
  y: number;
  /** Groesse des Chips (0.6..1.6) */
  scale: number;
  /** Drehung in Grad */
  rotation: number;
  /** Oeffentlicher SlangTag; null = privater Chat-SlangTag der Nachricht. */
  tagId: string | null;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const defaultPlacement = (tagId: string | null = null): MediaTagPlacement => ({
  x: 0.5,
  y: 0.75,
  scale: 1,
  rotation: 0,
  tagId,
});

/** Liest eine gespeicherte Platzierung robust aus der Datenbank. */
export function parsePlacement(value: unknown): MediaTagPlacement | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.x !== "number" || typeof r.y !== "number") return null;
  return {
    x: clamp01(r.x),
    y: clamp01(r.y),
    scale: typeof r.scale === "number" ? Math.min(1.6, Math.max(0.6, r.scale)) : 1,
    rotation: typeof r.rotation === "number" ? r.rotation : 0,
    tagId: typeof r.tagId === "string" ? r.tagId : null,
  };
}

/** Relative Position aus einem Zeigerereignis innerhalb des Bildes. */
export function relativeFromPointer(rect: DOMRect, clientX: number, clientY: number) {
  return {
    x: clamp01(rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5),
    y: clamp01(rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5),
  };
}

export type ImageTagDict = {
  title: string;
  hint: string;
  chooseExisting: string;
  recordNew: string;
  remove: string;
  noTags: string;
  searchPh: string;
  dragHint: string;
  placed: string;
};

export const IMAGE_TAG_COPY: Record<TranslationLang, ImageTagDict> = {
  de: {
    title: "SlangTag auf dem Bild",
    hint: "SlangTag auswählen oder aufnehmen und frei auf dem Bild platzieren.",
    chooseExisting: "Vorhandenen SlangTag",
    recordNew: "Neu aufnehmen",
    remove: "SlangTag entfernen",
    noTags: "Noch keine SlangTags vorhanden.",
    searchPh: "SlangTag suchen",
    dragHint: "Ziehen zum Verschieben",
    placed: "Position gespeichert",
  },
  en: {
    title: "SlangTag on the image",
    hint: "Pick or record a SlangTag and place it freely on the image.",
    chooseExisting: "Existing SlangTag",
    recordNew: "Record new",
    remove: "Remove SlangTag",
    noTags: "No SlangTags yet.",
    searchPh: "Search SlangTag",
    dragHint: "Drag to move",
    placed: "Position saved",
  },
  el: {
    title: "SlangTag στην εικόνα",
    hint: "Διάλεξε ή ηχογράφησε ένα SlangTag και τοποθέτησέ το πάνω στην εικόνα.",
    chooseExisting: "Υπάρχον SlangTag",
    recordNew: "Νέα ηχογράφηση",
    remove: "Αφαίρεση SlangTag",
    noTags: "Δεν υπάρχουν ακόμη SlangTags.",
    searchPh: "Αναζήτηση SlangTag",
    dragHint: "Σύρε για μετακίνηση",
    placed: "Η θέση αποθηκεύτηκε",
  },
};
