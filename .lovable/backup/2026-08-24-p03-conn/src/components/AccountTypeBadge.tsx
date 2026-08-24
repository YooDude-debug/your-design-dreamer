import { useEffect, useState } from "react";
import { BriefcaseBusiness, Sparkles } from "lucide-react";

import { loadProfileDetails, peekProfileDetails } from "@/lib/profile-extra";

/**
 * Öffentliche Kontokennzeichnung (Creator bzw. Unternehmer).
 *
 * Die Flags kommen aus der bestehenden Serverfunktion `profile_details`, die
 * ausschließlich Creator-/Unternehmer-Status ausliefert. Interne Rollen wie
 * „admin“ werden bewusst NICHT öffentlich dargestellt.
 */
export function AccountTypeBadge({ userId }: { userId: string }) {
  const peek = peekProfileDetails([userId])?.[userId];
  const [creator, setCreator] = useState<boolean>(!!peek?.isCreator);
  const [business, setBusiness] = useState<boolean>(!!peek?.isBusiness);

  useEffect(() => {
    let alive = true;
    void loadProfileDetails([userId]).then((d) => {
      if (!alive) return;
      setCreator(!!d[userId]?.isCreator);
      setBusiness(!!d[userId]?.isBusiness);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!creator && !business) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {creator && (
        <span className="inline-flex items-center gap-1 rounded-full border border-brand/50 bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
          <Sparkles className="h-3 w-3" />
          Creator
        </span>
      )}
      {business && (
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-cyan/50 bg-brand-cyan/10 px-2 py-0.5 text-[11px] font-bold text-brand-cyan">
          <BriefcaseBusiness className="h-3 w-3" />
          Unternehmer
        </span>
      )}
    </span>
  );
}
