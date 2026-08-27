/**
 * Rein visueller Entwicklungs-Platzhalter für einen AdSense-Platz.
 *
 * Zeigt an genau der Stelle, an der der Werbekernel später einen echten
 * AdSense-Platz vergibt, eine leere Fläche mit gleicher Breite, Höhe,
 * Position und Einbettung im Feed.
 *
 * Diese Komponente nimmt bewusst KEINEN Kontakt zu Google auf: kein Script,
 * kein `<ins class="adsbygoogle">`, keine Impressionen, keine Klicks.
 * Sichtbar ausschließlich für Admins im aktiven Werbe-Testmodus (die Freigabe
 * entsteht serverseitig im Werbeplan).
 */

type Props = {
  position: number;
  lang?: string;
};

export function AdSenseDevSlot({ position, lang = "de" }: Props) {
  const de = lang !== "en";
  return (
    <aside
      data-adsense-dev-slot=""
      aria-label={de ? "Werbeplatz (Entwicklung)" : "Ad placement (development)"}
      className="overflow-hidden rounded-2xl border border-dashed border-brand/40 bg-surface/40"
    >
      <div className="flex items-center justify-between gap-2 border-b border-dashed border-brand/25 bg-brand/5 px-3 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand">
          {de ? "GESPONSERT" : "SPONSORED"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {de ? "Position" : "Position"} {position}
        </span>
      </div>
      {/* Grösse orientiert sich am späteren responsiven AdSense-Feedblock. */}
      <div className="grid min-h-[280px] place-items-center px-3 py-6 text-center">
        <p className="text-sm font-semibold text-foreground">AdSense – Development Slot</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {de
            ? "Platzhalter des Werbekernels. AdSense ist deaktiviert – keine Google-Anfrage, keine Messung."
            : "Ad kernel placeholder. AdSense is disabled — no Google request, no measurement."}
        </p>
      </div>
    </aside>
  );
}
