/**
 * Sprachausgabe fuer die Mini-Games. Nutzt die Sprachausgabe des Geraets
 * (Web Speech API) mit der Locale des jeweiligen Wortes – keine zusaetzliche
 * Audio-Infrastruktur.
 */
export function speakWord(text: string, locale: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const value = text.trim();
  if (!value) return false;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(value);
  utter.lang = locale || "en-US";
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang?.toLowerCase() === locale.toLowerCase());
  if (voice) utter.voice = voice;
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
  return true;
}

export function stopSpeakingWord() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
