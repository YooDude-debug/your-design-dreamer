/**
 * Technisches Protokoll des Audio-/SlangTag-Ablaufs.
 *
 * Zweck: Wenn eine Aufnahme, Speech-to-Text oder die SlangTag-Erstellung
 * scheitert, ist im Browser-Protokoll nachvollziehbar, an welchem Schritt es
 * lag. Es werden ausschliesslich technische Ereignisse und kurze
 * Fehlerkennungen protokolliert – niemals Audioinhalte, Transkripte,
 * Nachrichten, Namen, Tokens oder Passwoerter.
 */

export type AudioEvent =
  | "audio_recording_started"
  | "microphone_permission_granted"
  | "microphone_permission_denied"
  | "media_recorder_started"
  | "media_recorder_error"
  | "audio_recording_completed"
  | "speech_to_text_started"
  | "speech_to_text_success"
  | "speech_to_text_error"
  | "slangtag_creation_started"
  | "slangtag_creation_error";

/** Protokolliert ein Ereignis mit optionaler technischer Kennung. */
export function audioLog(event: AudioEvent, detail?: string) {
  const suffix = detail ? ` ${detail.slice(0, 80)}` : "";
  if (event.endsWith("_error") || event.endsWith("_denied")) {
    console.warn(`[audio] ${event}${suffix}`);
    return;
  }
  console.info(`[audio] ${event}${suffix}`);
}
