/** Meldegründe – bewusst fest verdrahtet, damit Auswertungen im Adminbereich stabil bleiben. */
export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "hate", label: "Beleidigung oder Hassrede" },
  { value: "harassment", label: "Belästigung" },
  { value: "violence", label: "Gewalt oder gefährliche Inhalte" },
  { value: "sexual", label: "Sexuelle Inhalte" },
  { value: "copyright", label: "Urheberrechtsverletzung" },
  { value: "misinformation", label: "Falsche Informationen" },
  { value: "scam", label: "Betrug oder Scam" },
  { value: "other", label: "Sonstiges" },
];
