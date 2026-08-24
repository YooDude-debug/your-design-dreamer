/**
 * Zuletzt verwendete Kamera (Front/Rück) – lokal gespeichert, damit die
 * nächste Kamera-/SlangShot-Aufnahme wieder damit startet. Keine
 * Datenbankänderung nötig.
 */
export type CameraFacing = "user" | "environment";

const KEY = "ydude.camera.facing";

export function loadCameraFacing(): CameraFacing {
  if (typeof localStorage === "undefined") return "user";
  try {
    const v = localStorage.getItem(KEY);
    return v === "environment" || v === "user" ? v : "user";
  } catch {
    return "user";
  }
}

export function saveCameraFacing(facing: CameraFacing) {
  try {
    localStorage.setItem(KEY, facing);
  } catch {
    /* ignore */
  }
}

export function otherFacing(facing: CameraFacing): CameraFacing {
  return facing === "user" ? "environment" : "user";
}
