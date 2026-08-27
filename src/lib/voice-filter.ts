/**
 * Y-Dude – Aufnahme-Kette für SlangTag-Sprachaufnahmen.
 *
 * Bewusst vollständig transparent: kein Limiter, kein Compressor, kein
 * Ducking/Sidechain, keine Klangfärbung und keine Lautstärkeanpassung.
 * Die Stimme wird exakt so aufgenommen, wie das Mikrofon sie liefert.
 *
 * Die Funktion bleibt als schmale Pass-Through-Stelle erhalten, damit die
 * bestehende Web-Audio-Verkabelung in `use-audio-recorder.ts` unverändert
 * bleibt (Ein-/Ausgang eines Kettenglieds).
 */
export type VoiceFilterChain = {
  /** Eingang der Kette (mit dem Mikrofon-Source verbinden). */
  input: AudioNode;
  /** Ausgang der Kette (auf Aufnahme-Tap bzw. Monitoring legen). */
  output: AudioNode;
};

export function createVoiceFilterChain(ctx: AudioContext | BaseAudioContext): VoiceFilterChain {
  // Unity-Gain-Node: leitet das Rohsignal 1:1 weiter (0 dB, keine Dynamik).
  const passThrough = ctx.createGain();
  passThrough.gain.value = 1;
  return { input: passThrough, output: passThrough };
}
