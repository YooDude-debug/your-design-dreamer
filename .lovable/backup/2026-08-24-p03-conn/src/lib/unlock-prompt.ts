import { useSyncExternalStore } from "react";
import type { SlangTag } from "@/lib/types";

/**
 * Kleiner globaler Store für die Freischalt-Abfrage. Dadurch kann jede
 * Komponente `openUnlockPrompt(tag)` aufrufen, ohne Props durchzureichen –
 * spätere Freischaltmethoden (Challenge, Event, Premium) lassen sich hier
 * modular ergänzen.
 */
let current: SlangTag | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openUnlockPrompt(tag: SlangTag) {
  current = tag;
  emit();
}
export function closeUnlockPrompt() {
  current = null;
  emit();
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useUnlockTarget() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
