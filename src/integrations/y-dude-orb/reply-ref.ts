/**
 * P5-H (Client): Reply-Referenz und Sendesperre. Browser-sicher, rein.
 * Keine Semantik – nur „welche ORB-Zeile war beim Senden die letzte“.
 */
export function lastOrbMessageId(
  messages: { id: string; role: string }[] | null | undefined,
): string | undefined {
  if (!messages) return undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "orb") return messages[i].id;
  }
  return undefined;
}

/** Synchrone Sperre: verhindert eine zweite Anfrage, solange eine läuft. */
export function createSendGate() {
  let busy = false;
  return {
    tryAcquire(externallyBusy = false): boolean {
      if (busy || externallyBusy) return false;
      busy = true;
      return true;
    },
    release() {
      busy = false;
    },
    get busy() {
      return busy;
    },
  };
}
