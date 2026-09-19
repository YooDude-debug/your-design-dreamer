/**
 * Gespeicherte Avatar-Auswahl des ORB (rein clientseitig, kein Serverzugriff).
 */

import { useCallback, useEffect, useState } from "react";

import {
  ORB_AVATAR_STORAGE_KEY,
  parseAvatarMode,
  type OrbAvatarMode,
} from "@/integrations/y-dude-orb/avatar";

export function useOrbAvatarMode(): [OrbAvatarMode, (mode: OrbAvatarMode) => void] {
  const [mode, setMode] = useState<OrbAvatarMode>("emoji");

  useEffect(() => {
    try {
      setMode(parseAvatarMode(window.localStorage.getItem(ORB_AVATAR_STORAGE_KEY)));
    } catch {
      /* Kein lokaler Speicher verfügbar – bestehende Darstellung bleibt. */
    }
  }, []);

  const update = useCallback((next: OrbAvatarMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(ORB_AVATAR_STORAGE_KEY, next);
    } catch {
      /* Auswahl gilt dann nur für diese Sitzung. */
    }
  }, []);

  return [mode, update];
}
