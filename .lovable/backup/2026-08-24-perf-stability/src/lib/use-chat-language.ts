/**
 * Sprachsteuerung eines Chats.
 *
 * - `myLang`: Zielsprache für empfangene Nachrichten (Standard: Sprache des
 *   angemeldeten Nutzers bzw. der Oberfläche).
 * - `partnerLang`: "auto" (Standard, Erkennung durch die bestehende Logik) oder
 *   eine manuell gewählte Sprache.
 *
 * Die Auswahl wird pro Chat lokal gespeichert und übersteht ein Neuladen.
 * Die Übersetzungslogik selbst bleibt unverändert.
 */

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/lang-context";
import { isTranslationLang, type TranslationLang } from "@/lib/lang-detect";

export type PartnerLang = TranslationLang | "auto";

export type ChatLanguage = {
  myLang: TranslationLang;
  partnerLang: PartnerLang;
  setMyLang: (l: TranslationLang) => void;
  setPartnerLang: (l: PartnerLang) => void;
};

const KEY = "ydude.chatLang.v1";

type Stored = Record<string, { my?: string; partner?: string }>;

function read(): Stored {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Stored;
  } catch {
    return {};
  }
}

function write(next: Stored) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Speicher voll oder gesperrt – Einstellung gilt dann nur für die Sitzung. */
  }
}

export function useChatLanguage(conversationId: string | null): ChatLanguage {
  const { lang } = useLang();
  const fallback: TranslationLang = isTranslationLang(lang) ? lang : "de";

  const [myLang, setMy] = useState<TranslationLang>(fallback);
  const [partnerLang, setPartner] = useState<PartnerLang>("auto");

  // Gespeicherte Auswahl erst nach der Hydration übernehmen.
  useEffect(() => {
    if (!conversationId) {
      setMy(fallback);
      setPartner("auto");
      return;
    }
    const saved = read()[conversationId];
    setMy(isTranslationLang(saved?.my) ? saved.my : fallback);
    setPartner(
      saved?.partner === "auto" || isTranslationLang(saved?.partner)
        ? (saved.partner as PartnerLang)
        : "auto",
    );
  }, [conversationId, fallback]);

  const persist = useCallback(
    (patch: { my?: TranslationLang; partner?: PartnerLang }) => {
      if (!conversationId) return;
      const all = read();
      all[conversationId] = { ...all[conversationId], ...patch };
      write(all);
    },
    [conversationId],
  );

  const setMyLang = useCallback(
    (l: TranslationLang) => {
      setMy(l);
      persist({ my: l });
    },
    [persist],
  );

  const setPartnerLang = useCallback(
    (l: PartnerLang) => {
      setPartner(l);
      persist({ partner: l });
    },
    [persist],
  );

  return { myLang, partnerLang, setMyLang, setPartnerLang };
}
