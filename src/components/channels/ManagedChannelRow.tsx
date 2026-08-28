/**
 * Zeile für einen verwalteten Channel inkl. rollenabhängiger Aktionen.
 * Wird von der Channel-Übersicht und „Channels verwalten“ (/channels/mine)
 * gemeinsam genutzt, damit die Verwaltungslogik nicht dupliziert wird.
 */

import { Link } from "@tanstack/react-router";
import { Settings, ShieldCheck, Tv, UserCog } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { categoryLabel, channelTexts } from "@/lib/i18n-channels";

export interface ManagedChannel {
  id: string;
  name: string;
  icon: string | null;
  categoryName: string | null;
  categoryNameEn: string | null;
  categoryNameEl: string | null;
  followersCount: number;
  postsCount: number;
  role: "owner" | "moderator";
}

export function ManagedChannelRow({ channel }: { channel: ManagedChannel }) {
  const { lang } = useLang();
  const c = channelTexts[lang];
  const category = channel.categoryName
    ? categoryLabel(lang, {
        name: channel.categoryName,
        nameEn: channel.categoryNameEn,
        nameEl: channel.categoryNameEl,
      })
    : c.noCategory;
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-3">
        <span className="w-6 shrink-0 text-center text-lg">{channel.icon ?? "📺"}</span>
        <Link
          to="/channels/$channelId"
          params={{ channelId: channel.id }}
          className="min-w-0 flex-1"
        >
          <span className="block truncate text-sm font-semibold">{channel.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {channel.role === "owner" ? c.roleOwner : c.roleModerator} · {category} ·{" "}
            {channel.followersCount} {c.followersSuffix} · {channel.postsCount} {c.postsSuffix}
          </span>
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ActionLink channelId={channel.id} tab="moderate" icon={Tv} label={c.openChannel} />
        <ActionLink
          channelId={channel.id}
          tab="moderate"
          icon={ShieldCheck}
          label={c.moderatePosts}
        />
        <ActionLink channelId={channel.id} tab="settings" icon={Settings} label={c.editChannel} />
        {channel.role === "owner" && (
          <ActionLink channelId={channel.id} tab="team" icon={UserCog} label={c.manageModerators} />
        )}
      </div>
    </div>
  );
}

function ActionLink({
  channelId,
  tab,
  icon: Icon,
  label,
}: {
  channelId: string;
  tab: "moderate" | "settings" | "team";
  icon: typeof Tv;
  label: string;
}) {
  return (
    <Link
      to="/channels/$channelId"
      params={{ channelId }}
      search={{ tab }}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}
