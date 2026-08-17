/**
 * Y-Dude – dezenter Live-Voice-Filter für SlangTag-Aufnahmen.
 *
 * Nutzt ausschließlich die bereits vorhandene Web-Audio-Pipeline
 * (AudioContext aus `use-audio-recorder.ts`). Es entsteht keine zweite
 * Audio-Pipeline und kein Voice Changer: die Kette ist bewusst minimal
 * eingestellt (Rumpelfilter, leichte Wärme, sanfte Kompression, weicher
 * Höhen-Cut, Limiter). Kein Hall, kein Echo, kein Pitch-Shift.
 *
 * Die VAD arbeitet weiterhin auf dem Rohsignal – der Filter hängt in einem
 * parallelen Zweig und kann Sprachbeginn/-ende nicht beeinflussen.
 */
export type VoiceFilterChain = {
  /** Eingang der Kette (mit dem Mikrofon-Source verbinden). */
  input: AudioNode;
  /** Ausgang der Kette (auf Aufnahme-Tap bzw. Monitoring legen). */
  output: AudioNode;
};

export function createVoiceFilterChain(ctx: AudioContext | BaseAudioContext): VoiceFilterChain {
  // 1) High-Pass gegen tiefes Rumpeln (Tisch, Wind, Griffgeräusche)
  const highPass = ctx.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 85;
  highPass.Q.value = 0.7;

  // 2) Dezenter Low-Mid-Boost für Wärme/Körper (+1.5 dB)
  const warmth = ctx.createBiquadFilter();
  warmth.type = "peaking";
  warmth.frequency.value = 220;
  warmth.Q.value = 0.8;
  warmth.gain.value = 1.5;

  // 3) Leichte Präsenz-Zähmung: harte Zischlaute etwas weicher (-1.5 dB)
  const deHarsh = ctx.createBiquadFilter();
  deHarsh.type = "peaking";
  deHarsh.frequency.value = 3200;
  deHarsh.Q.value = 1.1;
  deHarsh.gain.value = -1.5;

  // 4) Sanfter High-Frequency-Cut gegen kalten/trockenen Klang
  const airCut = ctx.createBiquadFilter();
  airCut.type = "lowpass";
  airCut.frequency.value = 11000;
  airCut.Q.value = 0.5;

  // 5) Leichte Kompression für gleichmäßigere Lautstärke (Ratio 2:1)
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -22;
  comp.knee.value = 24;
  comp.ratio.value = 2;
  comp.attack.value = 0.006;
  comp.release.value = 0.18;

  // Kleiner Ausgleich für die Kompression
  const makeup = ctx.createGain();
  makeup.gain.value = 1.08;

  // 6) Limiter gegen Clipping (schnell, hohe Ratio, kurz vor 0 dBFS)
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1.5;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;

  highPass.connect(warmth);
  warmth.connect(deHarsh);
  deHarsh.connect(airCut);
  airCut.connect(comp);
  comp.connect(makeup);
  makeup.connect(limiter);

  return { input: highPass, output: limiter };
}
