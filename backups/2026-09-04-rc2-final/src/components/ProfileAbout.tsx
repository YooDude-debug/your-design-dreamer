import { useEffect, useState } from "react";
import {
  Globe,
  Languages,
  Cake,
  UserRound,
  Music,
  Gamepad2,
  Film,
  Dumbbell,
  Heart,
  Sparkles,
  Link as LinkIcon,
  Instagram,
  Youtube,
  Twitch,
  MessageCircle,
  Trophy,
  CalendarDays,
} from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { profileTexts, FIELD_LABEL_KEY } from "@/lib/i18n-profile";
import {
  loadProfileDetails,
  loadProfileStats,
  peekProfileDetails,
  peekProfileStats,
  asList,
  asText,
  type ProfileDetails,
  type ProfileStats,
  type ProfileFieldKey,
} from "@/lib/profile-extra";

/**
 * Profilseite: „Über mich“-Karte mit erweiterten Feldern und Statistiken.
 * Es werden ausschließlich Felder gezeigt, die der Server für den aktuellen
 * Betrachter freigegeben hat (Maskierung erfolgt in `profile_details`).
 */

const ICONS: Partial<Record<ProfileFieldKey, typeof Globe>> = {
  origin: Globe,
  languages: Languages,
  birthday: Cake,
  pronouns: UserRound,
  interestTags: Sparkles,
  hobbies: Heart,
  music: Music,
  games: Gamepad2,
  movies: Film,
  sports: Dumbbell,
};

const SOCIALS: { key: ProfileFieldKey; icon: typeof Globe; base?: string }[] = [
  { key: "website", icon: LinkIcon },
  { key: "instagram", icon: Instagram, base: "https://instagram.com/" },
  { key: "tiktok", icon: Music, base: "https://tiktok.com/@" },
  { key: "youtube", icon: Youtube, base: "https://youtube.com/@" },
  { key: "twitch", icon: Twitch, base: "https://twitch.tv/" },
  { key: "discord", icon: MessageCircle },
];

function socialHref(key: ProfileFieldKey, value: string, base?: string): string | null {
  const v = value.trim().replace(/^@/, "");
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (key === "website") return `https://${v}`;
  if (!base) return null;
  return `${base}${v}`;
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <span
          key={x}
          className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] text-foreground/90"
        >
          {x}
        </span>
      ))}
    </div>
  );
}

export function ProfileAbout({ userId }: { userId: string }) {
  const { lang, locale } = useLang();
  const p = profileTexts[lang];
  /**
   * Startwerte kommen aus dem bestehenden Kurzzeit-Cache: bereits geladene
   * Profile erscheinen beim Wiederöffnen sofort, ohne Ladezustand.
   */
  const [details, setDetails] = useState<ProfileDetails | null>(
    () => peekProfileDetails([userId])?.[userId] ?? null,
  );
  const [stats, setStats] = useState<ProfileStats | null>(
    () => peekProfileStats([userId])?.[userId] ?? null,
  );

  useEffect(() => {
    let alive = true;
    setDetails(peekProfileDetails([userId])?.[userId] ?? null);
    setStats(peekProfileStats([userId])?.[userId] ?? null);
    void Promise.all([loadProfileDetails([userId]), loadProfileStats([userId])]).then(([d, s]) => {
      if (!alive) return;
      setDetails(d[userId] ?? {});
      setStats(s[userId] ?? null);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const infoKeys: ProfileFieldKey[] = [
    "origin",
    "languages",
    "birthday",
    "pronouns",
    "interestTags",
    "hobbies",
    "music",
    "games",
    "movies",
    "sports",
  ];

  const infoRows = infoKeys
    .map((key) => {
      const raw = details?.[key];
      const list = asList(raw);
      const text = asText(raw).trim();
      if (list.length === 0 && !text) return null;
      return { key, list, text };
    })
    .filter((x): x is { key: ProfileFieldKey; list: string[]; text: string } => x !== null);

  const socialRows = SOCIALS.map((s) => {
    const value = asText(details?.[s.key]).trim();
    if (!value) return null;
    return { ...s, value, href: socialHref(s.key, value, s.base) };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  if (infoRows.length === 0 && socialRows.length === 0 && !stats) return null;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale);
  };

  return (
    <div className="space-y-4">
      {(infoRows.length > 0 || socialRows.length > 0) && (
        <section className="rounded-2xl border border-border bg-background p-4">
          <h2 className="text-sm font-black tracking-tight">{p.about}</h2>

          {infoRows.length > 0 && (
            <dl className="mt-3 space-y-2.5">
              {infoRows.map((row) => {
                const Icon = ICONS[row.key] ?? Sparkles;
                return (
                  <div key={row.key} className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                    <div className="min-w-0">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {p[FIELD_LABEL_KEY[row.key]]}
                      </dt>
                      <dd className="mt-0.5 text-sm text-foreground/90">
                        {row.list.length > 0 ? (
                          <TagList items={row.list} />
                        ) : row.key === "birthday" ? (
                          fmtDate(row.text)
                        ) : (
                          row.text
                        )}
                      </dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          )}

          {socialRows.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {p.groupSocial}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {socialRows.map((s) => {
                  const Icon = s.icon;
                  const content = (
                    <>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="max-w-[16ch] truncate">{s.value.replace(/^@/, "")}</span>
                    </>
                  );
                  return s.href ? (
                    <a
                      key={s.key}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-brand/60 hover:text-brand"
                    >
                      {content}
                    </a>
                  ) : (
                    <span
                      key={s.key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {content}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {stats && (
        <section className="rounded-2xl border border-border bg-background p-4">
          <h2 className="text-sm font-black tracking-tight">{p.groupCommunity}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              icon={CalendarDays}
              label={p.memberSince}
              value={stats.memberSince ? fmtDate(stats.memberSince) : "–"}
            />
            <Stat icon={Heart} label={p.likesReceived} value={String(stats.likesReceived ?? 0)} />
            <Stat icon={MessageCircle} label={p.statComments} value={String(stats.comments ?? 0)} />
            <Stat icon={Sparkles} label={p.statFollowers} value={String(stats.followers ?? 0)} />
            <Stat icon={UserRound} label={p.statFollowing} value={String(stats.following ?? 0)} />
            <Stat
              icon={Trophy}
              label={p.slangTagRank}
              value={stats.slangTagRank ? `#${stats.slangTagRank}` : "–"}
            />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {stats.verified ? p.verifiedYes : p.verifiedNo}
          </p>
        </section>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Globe; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-2.5">
      <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 text-brand" /> {label}
      </div>
      <div className="mt-1 truncate text-sm font-bold">{value}</div>
    </div>
  );
}
