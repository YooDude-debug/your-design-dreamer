/**
 * „Channels verwalten“ – eigene Verwaltungsseite des eingeloggten Nutzers.
 *
 * Nutzt ausschliesslich die bestehende `listManagedChannels`-API und die
 * geteilte `ManagedChannelRow`-Komponente (Öffnen, Moderation, Einstellungen,
 * Moderatoren). Keine parallele Datenhaltung.
 */

import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Tv } from "lucide-react";
import { goBackOr } from "@/lib/back-nav";
import { useLang } from "@/lib/lang-context";
import { channelTexts } from "@/lib/i18n-channels";
import { ManagedChannelRow } from "@/components/channels/ManagedChannelRow";
import { listManagedChannels } from "@/lib/channels.functions";

export const Route = createFileRoute("/_authenticated/channels/mine")({
  head: () => ({
    meta: [
      { title: "Channels verwalten — Y-Dude" },
      {
        name: "description",
        content:
          "Eigene und moderierte Y-Dude Channels verwalten: Beiträge moderieren, Moderatoren und Channel-Einstellungen.",
      },
      { property: "og:title", content: "Channels verwalten — Y-Dude" },
      { property: "og:description", content: "Eigene Channels verwalten und moderieren." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChannelsMine,
});

function ChannelsMine() {
  const { lang } = useLang();
  const c = channelTexts[lang];
  const router = useRouter();
  const loadManaged = useServerFn(listManagedChannels);

  const { data: managed = [], isLoading } = useQuery({
    queryKey: ["managed-channels"],
    queryFn: () => loadManaged(),
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4">
      <header className="mb-4 flex items-center gap-3">
        <BackButton
          onClick={() => goBackOr(router, "/channels")}
          ariaLabel={c.back}
          className="shrink-0"
        />
        <h1 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-bold">
          <Tv className="h-5 w-5 shrink-0 text-brand" /> {c.manageChannelsTitle}
        </h1>
      </header>

      <section>
        {isLoading && (
          <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {c.loading}
          </p>
        )}
        {!isLoading && managed.length === 0 && (
          <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
            {c.noManagedChannels}
          </p>
        )}
        <div className="space-y-2">
          {managed.map((x) => (
            <ManagedChannelRow key={x.id} channel={x} />
          ))}
        </div>
      </section>
    </div>
  );
}
