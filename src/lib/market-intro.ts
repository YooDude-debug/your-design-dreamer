export const MARKET_INTRO_SESSION_KEY = "yd:market:intro-seen";

type SessionStore = Pick<Storage, "getItem" | "setItem">;

/**
 * Beansprucht das Market-Intro höchstens einmal pro Browser-Sitzung.
 * Der Laufzeit-Merker verhindert auch bei schneller In-App-Navigation einen
 * zweiten Frame, bevor sessionStorage erneut gelesen werden kann.
 */
export function createMarketIntroGate() {
  let claimed = false;

  return {
    claim(store: SessionStore): boolean {
      if (claimed) return false;
      claimed = true;

      try {
        if (store.getItem(MARKET_INTRO_SESSION_KEY) === "1") return false;
        store.setItem(MARKET_INTRO_SESSION_KEY, "1");
      } catch {
        // Ohne Storage gilt der Laufzeit-Merker weiterhin für diese App-Sitzung.
      }

      return true;
    },
  };
}

export const marketIntroGate = createMarketIntroGate();
