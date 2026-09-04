/**
 * Einheitliche Zurück-Navigation im Business-Bereich.
 *
 * Es wird bewusst KEIN `history.back()` verwendet: Jede Business-Karte
 * definiert ihr festes Ziel eine Ebene höher. Die letzte Business-Ebene
 * (`/business`) führt zurück auf das eigene Profil.
 */
import { useNavigate } from "@tanstack/react-router";

import { BackButton } from "@/components/ui/nav-buttons";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import type { Lang } from "@/lib/i18n-dict";

const LABEL: Record<Lang, string> = {
  de: "Zurück",
  en: "Back",
  el: "Πίσω",
};

/** `business` = eine Ebene hoch nach /business, `profile` = Ende der Kette. */
export function BusinessBackButton({
  target,
  className = "",
}: {
  target: "business" | "profile";
  className?: string;
}) {
  const { lang } = useLang();
  const { me } = useData();
  const navigate = useNavigate();
  const label = LABEL[lang];

  if (target === "business") {
    return (
      <BackButton to="/business" size="sm" label={label} ariaLabel={label} className={className} />
    );
  }

  return (
    <BackButton
      size="sm"
      label={label}
      ariaLabel={label}
      className={className}
      onClick={() => {
        if (me?.username) {
          void navigate({ to: "/profile/$username", params: { username: me.username } });
          return;
        }
        void navigate({ to: "/" });
      }}
    />
  );
}
