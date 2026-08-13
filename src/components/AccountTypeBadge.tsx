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

  const label = creator && business ? "Creator / Unternehmer" : creator ? "Creator" : "Unternehmer";
  const Icon = creator ? Sparkles : BriefcaseBusiness;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand/50 bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
