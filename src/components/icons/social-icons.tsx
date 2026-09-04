import type { ReactElement, SVGProps } from "react";
import { Globe } from "lucide-react";
import type { ProfileFieldKey } from "@/lib/profile-extra";

/**
 * Kompakte Plattform-Icons für die Social-Felder des Profils.
 * Reine Inline-SVGs (currentColor), damit keine zusätzliche Icon-Bibliothek
 * installiert werden muss. Verwendet in „Profil bearbeiten → Information“
 * und in der öffentlichen Profilansicht.
 */

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true as const,
  ...props,
});

export function InstagramIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16.6 2h-2.9v13.2a2.9 2.9 0 1 1-2.2-2.8V9.4a6 6 0 1 0 5.1 5.9V8.9a6.7 6.7 0 0 0 3.9 1.2V7.2a3.9 3.9 0 0 1-3.9-3.9V2Z" />
    </svg>
  );
}

export function YouTubeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M22.5 7.6a3 3 0 0 0-2.1-2.1C18.6 5 12 5 12 5s-6.6 0-8.4.5A3 3 0 0 0 1.5 7.6 31 31 0 0 0 1 12a31 31 0 0 0 .5 4.4 3 3 0 0 0 2.1 2.1C5.4 19 12 19 12 19s6.6 0 8.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23 12a31 31 0 0 0-.5-4.4ZM9.9 15.1V8.9l5.5 3.1-5.5 3.1Z" />
    </svg>
  );
}

export function TwitchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.3 2 2.6 6.3v13.1h4.6V22h2.6l2.6-2.6h3.7l5-5V2H4.3Zm14.4 11.4-2.9 2.9h-4.6l-2.6 2.6v-2.6H5.8V3.7h12.9v9.7Z" />
      <path d="M13.9 6.9h1.7v5h-1.7zM9.3 6.9H11v5H9.3z" />
    </svg>
  );
}

export function DiscordIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19.3 5.4A16.5 16.5 0 0 0 15.2 4l-.3.5c1.4.4 2.1.8 3 1.4a11.6 11.6 0 0 0-9.8 0c.9-.6 1.8-1.1 3-1.4L10.8 4a16.5 16.5 0 0 0-4.1 1.4C4.1 9.2 3.4 12.9 3.7 16.5a16.6 16.6 0 0 0 5 2.5l.7-1.1c-.7-.3-1.4-.6-2-1l.4-.3a11.9 11.9 0 0 0 10.2 0l.4.3c-.6.4-1.3.7-2 1l.7 1.1a16.6 16.6 0 0 0 5-2.5c.4-4.2-.6-7.9-2.8-11.1ZM9.3 14.4c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm5.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}

export function WebsiteIcon(props: IconProps) {
  return <Globe {...props} />;
}

export type SocialKey = Extract<
  ProfileFieldKey,
  "website" | "instagram" | "tiktok" | "youtube" | "twitch" | "discord"
>;

export const SOCIAL_ICONS: Record<SocialKey, (props: IconProps) => ReactElement> = {
  website: WebsiteIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  twitch: TwitchIcon,
  discord: DiscordIcon,
};
