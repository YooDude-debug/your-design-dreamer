import { type CameraFacing } from "@/lib/video/camera-facing";

/**
 * Gemeinsame getUserMedia-Constraints für Foto UND Video im SlangShot-Editor.
 *
 * Wichtig (Ursache des zuvor "zu stark gezoomten" Bildes):
 * Es wurde `width: { ideal: 1080 }, height: { ideal: 1920 }` angefragt. Kameras
 * liefern native Modi im Querformat; der Browser erfüllt eine Hochformat-
 * Anfrage über `resizeMode: "crop-and-scale"` (Standard) und schneidet dazu
 * links/rechts weg → sichtbar engerer Bildwinkel = digitaler Zoom.
 *
 * Deshalb hier bewusst konservativ:
 * - nur `facingMode` (normale Front-/Rückkamera; keine Ultraweitwinkel-/Tele-
 *   Auswahl per deviceId, keine Enumeration)
 * - kein width/height/aspectRatio → das Gerät liefert seinen Standardmodus
 * - `resizeMode: "none"` (falls unterstützt) → kein Crop-and-Scale
 */
export function cameraVideoConstraints(facing: CameraFacing): MediaTrackConstraints {
  const base: MediaTrackConstraints = { facingMode: { ideal: facing } };
  try {
    const supported = navigator.mediaDevices?.getSupportedConstraints?.() as
      | (MediaTrackSupportedConstraints & { resizeMode?: boolean })
      | undefined;
    if (supported?.resizeMode) {
      (base as MediaTrackConstraints & { resizeMode?: string }).resizeMode = "none";
    }
  } catch {
    /* ignore */
  }
  return base;
}

/**
 * Setzt einen eventuell vom Gerät/Browser vorbelegten digitalen Zoom auf den
 * neutralen Wert zurück. Ohne Zoom-Unterstützung passiert nichts.
 */
export async function resetCameraZoom(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  try {
    const caps = track.getCapabilities?.() as (MediaTrackCapabilities & {
      zoom?: { min: number; max: number };
    }) | undefined;
    const zoom = caps?.zoom;
    if (!zoom) return;
    const neutral = Math.min(Math.max(1, zoom.min), zoom.max);
    await track.applyConstraints({
      advanced: [{ zoom: neutral } as unknown as MediaTrackConstraintSet],
    });
  } catch {
    /* Zoom nicht steuerbar – bestehendes Verhalten bleibt unverändert. */
  }
}
