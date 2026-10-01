import { marketTexts } from "@/lib/i18n-market";
import { useLang } from "@/lib/lang-context";

export function ShopError() {
  const { lang } = useLang();
  return <p className="p-6 text-sm text-muted-foreground">{marketTexts[lang].shopNotFound}</p>;
}
