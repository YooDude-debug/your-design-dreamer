/**
 * Live-Username-Prüfung mit Debounce, Kurzzeit-Cache und Race-Schutz.
 *
 * Nur Nutzerkomfort: die verbindliche Prüfung erfolgt beim Absenden erneut
 * serverseitig (und in der Datenbank per Trigger/UNIQUE-Regel).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { checkUsername } from "@/lib/account.functions";
import { USERNAME_RE, type UsernameStatus } from "@/lib/username";

export type UsernameCheck = {
  state: "idle" | "checking" | "done";
  status: UsernameStatus | null;
  suggestions: string[];
};

const DEBOUNCE_MS = 450;
const CACHE_TTL_MS = 30_000;

export function useUsernameCheck(
  username: string,
  opts: { firstName?: string; lastName?: string; enabled?: boolean } = {},
): UsernameCheck {
  const enabled = opts.enabled !== false;
  const [result, setResult] = useState<UsernameCheck>({
    state: "idle",
    status: null,
    suggestions: [],
  });
  const cache = useRef(new Map<string, { at: number; value: UsernameCheck }>());
  const seq = useRef(0);
  const names = useRef({ firstName: opts.firstName, lastName: opts.lastName });
  names.current = { firstName: opts.firstName, lastName: opts.lastName };

  const apply = useCallback((id: number, value: UsernameCheck) => {
    // Veraltete Antworten verwerfen (Race Conditions).
    if (id !== seq.current) return;
    setResult(value);
  }, []);

  useEffect(() => {
    const value = username.trim();
    const id = ++seq.current;

    if (!enabled || value === "") {
      setResult({ state: "idle", status: null, suggestions: [] });
      return;
    }
    if (!USERNAME_RE.test(value)) {
      // Syntaxfehler brauchen keine Datenbankabfrage.
      setResult({ state: "done", status: "invalid", suggestions: [] });
      return;
    }

    const key = value.toLowerCase();
    const hit = cache.current.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      setResult(hit.value);
      return;
    }

    setResult((prev) => ({ ...prev, state: "checking" }));
    const timer = window.setTimeout(() => {
      void checkUsername({
        data: {
          username: value,
          ...(names.current.firstName ? { firstName: names.current.firstName } : {}),
          ...(names.current.lastName ? { lastName: names.current.lastName } : {}),
          withSuggestions: true,
        },
      })
        .then((res) => {
          const next: UsernameCheck = {
            state: "done",
            status: res.status,
            suggestions: res.suggestions,
          };
          cache.current.set(key, { at: Date.now(), value: next });
          apply(id, next);
        })
        .catch(() => apply(id, { state: "idle", status: null, suggestions: [] }));
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [username, enabled, apply]);

  return result;
}
