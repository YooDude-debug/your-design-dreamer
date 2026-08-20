import { useEffect, useRef, useState } from "react";
import { Check, Globe2 } from "lucide-react";
import { TRANSLATION_LANGS, type TranslationLang } from "@/lib/lang-detect";
import { chatLangCopy, LANG_LABEL } from "@/lib/i18n-chat-language";
import { useLang } from "@/lib/lang-context";
import type { PartnerLang } from "@/lib/use-chat-language";

/**
 * Kompakte Sprachzeile im Chat-Header: "🇩🇪 Deutsch → 🌐 Automatisch".
 * Beim Antippen öffnet sich eine kleine Auswahl, kein dauerhaftes Panel.
 */
export function ChatLanguageBar({
  myLang,
  partnerLang,
  onMyLang,
  onPartnerLang,
}: {
  myLang: TranslationLang;
  partnerLang: PartnerLang;
  onMyLang: (l: TranslationLang) => void;
  onPartnerLang: (l: PartnerLang) => void;
}) {
  const { lang } = useLang();
  const c = chatLangCopy(lang);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const partnerText =
    partnerLang === "auto"
      ? `🌐 ${c.autoShort}`
      : `${LANG_LABEL[partnerLang].flag} ${LANG_LABEL[partnerLang].name}`;

  const row = (active: boolean) =>
    `flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
      active ? "bg-brand/15 text-brand" : "text-foreground hover:bg-brand/10"
    }`;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={c.openSettings}
        aria-expanded={open}
        className="inline-flex max-w-full items-center gap-1 truncate text-[11px] font-semibold text-muted-foreground transition-colors hover:text-brand"
      >
        <Globe2 className="h-3 w-3 shrink-0 text-brand" />
        <span className="truncate">
          {LANG_LABEL[myLang].flag} {LANG_LABEL[myLang].name} → {partnerText}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[130] mt-1 w-56 rounded-xl border border-border bg-surface p-2 shadow-glow">
          <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {c.myLanguage}
          </p>
          {TRANSLATION_LANGS.map((l) => (
            <button key={l} type="button" onClick={() => onMyLang(l)} className={row(l === myLang)}>
              <span>
                {LANG_LABEL[l].flag} {LANG_LABEL[l].name}
              </span>
              {l === myLang && <Check className="h-3 w-3" />}
            </button>
          ))}

          <p className="mt-2 px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {c.partner}
          </p>
          <button
            type="button"
            onClick={() => onPartnerLang("auto")}
            className={row(partnerLang === "auto")}
          >
            <span>🌐 {c.auto}</span>
            {partnerLang === "auto" && <Check className="h-3 w-3" />}
          </button>
          {TRANSLATION_LANGS.map((l) => (
            <button
              key={`p-${l}`}
              type="button"
              onClick={() => onPartnerLang(l)}
              className={row(partnerLang === l)}
            >
              <span>
                {LANG_LABEL[l].flag} {LANG_LABEL[l].name}
              </span>
              {partnerLang === l && <Check className="h-3 w-3" />}
            </button>
          ))}

          <p className="mt-2 px-2 text-[10px] leading-snug text-muted-foreground">{c.settingsHint}</p>
        </div>
      )}
    </div>
  );
}
