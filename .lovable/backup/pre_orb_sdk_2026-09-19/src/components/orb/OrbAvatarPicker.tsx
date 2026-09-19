/**
 * Auswahl der ORB-Darstellung (realistisches Gesicht oder bestehendes Emoji).
 *
 * Die Auswahl liegt rein clientseitig im lokalen Speicher – keine Server- oder
 * Datenbankabfrage. Beide Darstellungen nutzen denselben ORB-Zustand.
 */

import type { OrbAvatarMode } from "@/lib/orb-avatar";

const OPTIONS: { value: OrbAvatarMode; label: string }[] = [
  { value: "face", label: "Realistisches Gesicht" },
  { value: "emoji", label: "ORB Core Emoji" },
];

export function OrbAvatarPicker({
  mode,
  onChange,
}: {
  mode: OrbAvatarMode;
  onChange: (mode: OrbAvatarMode) => void;
}) {
  return (
    <fieldset className="w-full">
      <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Avatar
      </legend>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              mode === option.value
                ? "border-brand text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            <input
              type="radio"
              name="orb-avatar"
              checked={mode === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
