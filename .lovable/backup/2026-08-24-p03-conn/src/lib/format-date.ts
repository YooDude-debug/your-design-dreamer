/** Datum + Uhrzeit im deutschen Format (für Admin-Listen). */
export function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("de-DE")} ${d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
