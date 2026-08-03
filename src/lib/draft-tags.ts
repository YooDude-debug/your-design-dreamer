import { createContext, useContext } from "react";

/**
 * Signalisiert, dass neu aufgenommene SlangTags zunaechst nur temporaer zum
 * aktuellen Beitrags-Entwurf gehoeren. Sie werden erst beim erfolgreichen
 * Veroeffentlichen dauerhaft gespeichert (siehe `commitDraftTags`).
 */
export const DraftTagModeContext = createContext(false);

/** true, solange die Eingabe innerhalb eines Beitrags-Entwurfs erfolgt. */
export function useDraftTagMode() {
  return useContext(DraftTagModeContext);
}
