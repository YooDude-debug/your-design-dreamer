import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { loadProfileDetails, peekProfileDetails } from "@/lib/profile-extra";

export type AvatarGlowColor = "green" | "blue";

export interface AvatarGlowClasses {
  color: AvatarGlowColor;
  /** Gradient für den Hintergrund-Ring (hinter dem Bild). */
  gradientBg: string;
  /** Border-Color des Profilbilds. */
  border: string;
  /** Box-Shadow für den Glow-Effekt. */
  shadow: string;
  /** Klassenname für die verschwommene Aura (nur ProfilePanel). */
  aura: string;
}

function classes(color: AvatarGlowColor): AvatarGlowClasses {
  if (color === "blue") {
    return {
      color: "blue",
      gradientBg: "bg-gradient-to-br from-brand-cyan to-brand-blue",
      border: "border-brand-cyan",
      shadow: "shadow-glow-cyan",
      aura: "bg-gradient-cyan",
    };
  }
  return {
    color: "green",
    gradientBg: "bg-gradient-to-br from-brand to-brand-cyan",
    border: "border-brand",
    shadow: "shadow-glow",
    aura: "bg-gradient-brand",
  };
}

/**
 * Liefert für eine User-ID die passende Avatar-Glow-Farbe.
 *
 * - Grün = normaler User
 * - Blau/Cyan = Creator oder Unternehmer
 *
 * Die Logik basiert ausschließlich auf dem bestehenden Creator-/Unternehmer-Status
 * aus `profile_details`; es werden keine neuen Badges oder Rollen eingeführt.
 */
export function useAvatarGlowColor(userId: string | undefined): AvatarGlowClasses {
  const peek = userId ? peekProfileDetails([userId])?.[userId] : null;
  const initial: AvatarGlowColor = peek?.isCreator || peek?.isBusiness ? "blue" : "green";
  const [state, setState] = useState<AvatarGlowClasses>(classes(initial));

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void loadProfileDetails([userId]).then((d) => {
      if (!alive) return;
      const details = d[userId];
      setState(classes(details?.isCreator || details?.isBusiness ? "blue" : "green"));
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  return state;
}

/**
 * Synchrone Variante, wenn die Details bereits bekannt sind.
 */
export function avatarGlowFromFlags(isCreator?: boolean, isBusiness?: boolean): AvatarGlowClasses {
  return classes(isCreator || isBusiness ? "blue" : "green");
}

interface AvatarGlowRingProps {
  userId: string;
  size?: "sm" | "md" | "lg";
  borderOpacity?: string;
  className?: string;
  children?: React.ReactNode;
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "h-8 w-8",
  md: "h-14 w-14",
  lg: "h-20 w-20",
};

/**
 * Generischer Avatar-Ring mit dynamischem Glow.
 */
export function AvatarGlowRing({
  userId,
  size = "md",
  borderOpacity = "60",
  className = "",
  children,
}: AvatarGlowRingProps) {
  const glow = useAvatarGlowColor(userId);
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-2 ${sizeClass} ${glow.border}/${borderOpacity} ${glow.gradientBg} ${glow.shadow} ${className}`}
    >
      {children}
    </div>
  );
}

interface ProfileAvatarLinkProps {
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null | undefined;
  label?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Klickbarer Profilavatar mit Glow-Ring für die linke Seitenleiste.
 */
export function ProfileAvatarLink({
  userId,
  username,
  displayName,
  avatar,
  label,
  size = "lg",
}: ProfileAvatarLinkProps) {
  const glow = useAvatarGlowColor(userId);
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.lg;

  return (
    <Link
      to="/profile/$username"
      params={{ username }}
      aria-label={label}
      className={`relative mx-auto block ${sizeClass}`}
    >
      <div className={`absolute -inset-1 rounded-full ${glow.aura} opacity-60 blur-md`} />
      <div
        className={`relative grid h-full w-full place-items-center overflow-hidden rounded-full border-2 ${glow.border} bg-background ${glow.shadow}`}
      >
        {avatar ? (
          <img
            src={avatar}
            alt={displayName}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-black text-brand">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
    </Link>
  );
}
