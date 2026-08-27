import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Heart,
  Play,
  Repeat2,
  Share2,
  Bookmark,
  MessageCircle,
  MapPin,
  Globe,
  User,
  ArrowLeft,
  Trophy,
  Trash2,
} from "lucide-react";
import { SlangTagChip } from "@/components/SlangTagChip";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { SlangText } from "@/components/SlangTagInput";
import { formatStat } from "@/lib/types";
import { SlangTagName } from "@/components/SlangTagName";
import { slangTagLabel } from "@/lib/slangtag-rules";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ReportMenu } from "@/components/ReportDialog";
import { profileLang, tagMeaning } from "@/lib/globe/tag-meanings";
import { arenaTexts } from "@/lib/i18n-arena";

export const Route = createFileRoute("/_authenticated/slangtag/$name")({
  head: () => ({
    meta: [
      { title: "SlangTag — Y-Dude" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "SlangTag Detailseite: Audio, Bedeutung, Region, Beispiele und Beiträge.",
      },
      { property: "og:title", content: "SlangTag — Y-Dude" },
      {
        property: "og:description",
        content: "Höre den SlangTag, sieh Bedeutung, Region und alle Beiträge.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SlangTagDetail,
});

function SlangTagDetail() {
  const { name } = Route.useParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const {
    me,
    getTag,
    sortedTags,
    toggleTagLike,
    toggleTagSave,
    likedTags,
    savedTags,
    shareTag,
    posts,
    canDeleteTag,
    deleteTag,
  } = useData();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const tag = getTag(name);
  /** Bedeutung in der Profilsprache (Profil hat Vorrang vor Oberflächensprache). */
  const at = arenaTexts[lang];
  const meaningLang = profileLang(me?.language, lang);
  const localMeaning = tag ? tagMeaning(tag.name, meaningLang, tag.meaning) : null;

  const usedIn = useMemo(
    () => posts.filter((p) => p.slangTagIds.includes(tag?.id ?? "")),
    [posts, tag],
  );

  const ranking = sortedTags("plays").slice(0, 10);

  if (!tag) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">
          SlangTag {name} — {t.tagNotFound}
        </p>
      </div>
    );
  }

  const liked = likedTags.includes(tag.id);
  const saved = savedTags.includes(tag.id);

  const stats = [
    { icon: Play, label: t.statPlays, v: tag.stats.plays },
    { icon: Heart, label: t.statLikes, v: tag.stats.likes },
    { icon: Repeat2, label: t.statUses, v: tag.stats.uses },
    { icon: Share2, label: t.statShares, v: tag.stats.shares },
    { icon: Bookmark, label: t.statSaves, v: tag.stats.saves },
    { icon: MessageCircle, label: t.statComments, v: tag.stats.comments },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-4 sm:py-6 2xl:max-w-6xl">
      <BackButton onClick={() => navigate({ to: "/dev" })} label={t.backToFeed} className="mb-4" />

      <section className="overflow-hidden rounded-2xl border border-border bg-background p-5">
        <div className="flex flex-wrap items-center gap-4">
          <SlangTagChip tag={tag} variant="glass" showStats={false} />
          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-tight">
              <SlangTagName tag={tag} showLock={false} />
            </h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-brand" /> {tag.region}
              </span>
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3 text-brand-cyan" /> {tag.language}
              </span>
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" /> @{tag.creator}
              </span>
              <span>{new Date(tag.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => void toggleTagLike(tag.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${liked ? "border-brand bg-brand/15 text-brand" : "border-border text-muted-foreground hover:text-brand"}`}
            >
              <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />{" "}
              {formatStat(tag.stats.likes)}
            </button>
            <button
              onClick={() => void toggleTagSave(tag.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${saved ? "border-brand-cyan bg-brand-cyan/15 text-brand-cyan" : "border-border text-muted-foreground hover:text-brand-cyan"}`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} /> {t.saveAction}
            </button>
            <button
              onClick={() => void shareTag(tag.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-brand"
            >
              <Share2 className="h-3.5 w-3.5" /> {t.share}
            </button>
            <ReportMenu targetType="slang_tag" targetId={tag.id} targetUserId={tag.ownerId} />
            {canDeleteTag(tag) && (
              <button
                onClick={() => setConfirm(true)}
                title={t.deleteTag}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-brand/60 hover:text-brand"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t.delete}
              </button>
            )}
          </div>
        </div>

        {localMeaning && (
          <p className="mt-4 text-sm leading-relaxed">
            <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {at.meaningLabel}
            </span>
            <span className="font-semibold text-foreground">{localMeaning}</span>
            {tag.region && <span className="ml-1.5 text-muted-foreground">· {tag.region}</span>}
          </p>
        )}

        {tag.meaning && tag.meaning !== localMeaning && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            <SlangText
              text={tag.meaning}
              onOpenTag={(x) => navigate({ to: "/slangtag/$name", params: { name: x.name } })}
            />
          </p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-background/50 p-3 text-center"
            >
              <s.icon className="mx-auto h-4 w-4 text-brand" />
              <div className="mt-1 text-base font-black">{formatStat(s.v)}</div>
              <div className="truncate text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {tag.examples.length > 0 && (
            <section className="rounded-2xl border border-border bg-background p-5">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest">{t.examples}</h2>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {tag.examples.map((ex) => (
                  <li
                    key={ex}
                    className="rounded-lg border border-border bg-background/50 px-3 py-2"
                  >
                    „{ex}"
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-background p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest">
              {t.postsWith} {slangTagLabel(tag)} ({usedIn.length})
            </h2>
            {usedIn.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noPostsWithTag}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {usedIn.map((p) =>
                  p.image ? (
                    <SlangTagCanvas
                      key={p.id}
                      image={p.image}
                      placements={p.placements ?? []}
                      onOpenTag={(n) => navigate({ to: "/slangtag/$name", params: { name: n } })}
                    />
                  ) : (
                    <div
                      key={p.id}
                      className="rounded-xl border border-border bg-background/50 p-3 text-sm"
                    >
                      {p.description || p.title}
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="rounded-2xl border border-border bg-background p-5">
          <h2 className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest">
            <Trophy className="h-3.5 w-3.5 text-brand" /> {t.topSlangTags}
          </h2>
          <ol className="space-y-1">
            {ranking.map((r, i) => (
              <li key={r.id}>
                <button
                  onClick={() => navigate({ to: "/slangtag/$name", params: { name: r.name } })}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-brand/10 ${r.id === tag.id ? "bg-brand/10" : ""}`}
                >
                  <span className="w-4 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                  <SlangTagName tag={r} className="truncate font-semibold" />
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                    {formatStat(r.stats.plays)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm}
        title={t.deleteTagConfirm}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setBusy(true);
          void deleteTag(tag.id).then((ok) => {
            setBusy(false);
            setConfirm(false);
            toast[ok ? "success" : "error"](ok ? t.tagDeleted : t.tagDeleteFailed);
            if (ok) void navigate({ to: "/dev" });
          });
        }}
      />
    </div>
  );
}
