import { useEffect, useState } from "react";

/**
 * Verzögert einen Wert um `delay` Millisekunden. Schnelle Eingaben werden zu
 * einer einzigen Aktualisierung zusammengeführt; ein leerer Wert (z. B. nach
 * dem Löschen des Suchfelds) wirkt sofort.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return;
    if (typeof value === "string" && value.length === 0) {
      setDebounced(value);
      return;
    }
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  return debounced;
}
