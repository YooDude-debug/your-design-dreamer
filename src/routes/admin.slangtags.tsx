import { createFileRoute } from "@tanstack/react-router";
import { slangTagPrefix } from "@/lib/slangtag-rules";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Trash2, RotateCcw, Play, Pencil, Save, X, Flame } from "lucide-react";
import {
  adminGetSlangTags,
  adminPurgeSlangTag,
  adminSetSlangTagDeleted,
  adminUpdateSlangTag,
} from "@/lib/admin.functions";
import type { AdminSlangTagRow } from "@/lib/admin.shared";
import { AppDataProvider } from "@/lib/data";
import { AdminSlangTagCreate } from "@/components/admin/AdminSlangTagCreate";
import {
  AdminButton,
  AdminEmpty,
  AdminInput,
  AdminLoading,
  AdminPanel,
  AdminSection,
} from "@/components/admin/AdminUI";
import { formatDateTime } from "@/lib/format-date";

export const Route = createFileRoute("/admin/slangtags")({
  head: () => ({
    meta: [
      { property: "og:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
      { name: "twitter:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
      { title: "SlangTag-Verwaltung — Y-Dude Admin" },
      {
        name: "description",
        content: "Alle SlangTags anhören, bearbeiten, löschen und wiederherstellen.",
      },
      { property: "og:title", content: "SlangTag-Verwaltung — Y-Dude Admin" },
      {
        property: "og:description",
        content: "SlangTags anhören, bearbeiten und wiederherstellen.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminSlangTags,
  errorComponent: ({ error, reset }) => (
    <AdminSection
      title="SlangTag-Verwaltung"
      description="Der Bereich konnte nicht geladen werden."
    >
      <AdminPanel>
        <p className="text-sm font-semibold text-foreground">Interner Fehler</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {error instanceof Error ? error.message : "Unbekannter Fehler"}
        </p>
        <div className="mt-2">
          <AdminButton variant="primary" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Erneut versuchen
          </AdminButton>
        </div>
      </AdminPanel>
    </AdminSection>
  ),
});

function AdminSlangTags() {
  const load = useServerFn(adminGetSlangTags);
  const update = useServerFn(adminUpdateSlangTag);
  const setDeleted = useServerFn(adminSetSlangTagDeleted);
  const purge = useServerFn(adminPurgeSlangTag);

  const [query, setQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(true);
  const [rows, setRows] = useState<AdminSlangTagRow[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", meaning: "", region: "", language: "" });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refresh = useCallback(
    async (q: string, deleted: boolean) => {
      setRows(null);
      try {
        setRows(await load({ data: { query: q, includeDeleted: deleted } }));
      } catch (err) {
        setRows([]);
        console.error("[admin/slangtags] load failed", err);
        toast.error(
          err instanceof Error ? `Laden fehlgeschlagen: ${err.message}` : "Laden fehlgeschlagen",
        );
      }
    },
    [load],
  );

  useEffect(() => {
    void refresh("", true);
  }, [refresh]);

  const play = (url: string | null) => {
    if (!url) return toast.error("Kein Audio vorhanden");
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    void audio.play().catch(() => toast.error("Audio konnte nicht geladen werden"));
  };

  return (
    <AdminSection
      title="SlangTag-Verwaltung"
      description="Alle SlangTags: anhören, bearbeiten, löschen und wiederherstellen."
      actions={
        <>
          <AdminInput
            value={query}
            onChange={setQuery}
            placeholder="SlangTag suchen…"
            className="w-40"
          />
          <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => {
                setIncludeDeleted(e.target.checked);
                void refresh(query, e.target.checked);
              }}
              className="accent-brand"
            />
            Gelöschte anzeigen
          </label>
          <AdminButton onClick={() => void refresh(query, includeDeleted)}>
            <Search className="h-3.5 w-3.5" /> Suchen
          </AdminButton>
        </>
      }
    >
      {/* Der Anlege-Bereich nutzt den App-Datenkontext (Audio-Upload + Moderation).
          Das Admin-Cockpit liegt außerhalb von /_authenticated, deshalb wird der
          Provider hier gezielt für diesen Teilbaum bereitgestellt. */}
      <AppDataProvider>
        <AdminSlangTagCreate onCreated={() => void refresh(query, includeDeleted)} />
      </AppDataProvider>

      {rows === null ? (
        <AdminLoading />
      ) : rows.length === 0 ? (
        <AdminEmpty>Keine SlangTags gefunden.</AdminEmpty>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <AdminPanel key={t.id} className={t.deletedAt ? "opacity-60" : ""}>
              {editing === t.id ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <AdminInput
                    value={draft.name}
                    onChange={(v) => setDraft({ ...draft, name: v })}
                    placeholder="Name"
                  />
                  <AdminInput
                    value={draft.region}
                    onChange={(v) => setDraft({ ...draft, region: v })}
                    placeholder="Region"
                  />
                  <AdminInput
                    value={draft.language}
                    onChange={(v) => setDraft({ ...draft, language: v })}
                    placeholder="Sprache"
                  />
                  <AdminInput
                    value={draft.meaning}
                    onChange={(v) => setDraft({ ...draft, meaning: v })}
                    placeholder="Bedeutung"
                  />
                  <div className="flex gap-1.5 sm:col-span-2">
                    <AdminButton
                      variant="primary"
                      onClick={() => {
                        void update({ data: { id: t.id, ...draft } })
                          .then(() => {
                            toast.success("SlangTag gespeichert");
                            setEditing(null);
                            return refresh(query, includeDeleted);
                          })
                          .catch(() => toast.error("Speichern fehlgeschlagen"));
                      }}
                    >
                      <Save className="h-3.5 w-3.5" /> Speichern
                    </AdminButton>
                    <AdminButton onClick={() => setEditing(null)}>
                      <X className="h-3.5 w-3.5" /> Abbrechen
                    </AdminButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {slangTagPrefix(t.kind)}
                      {t.name}
                      {t.deletedAt && (
                        <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          GELÖSCHT
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {t.meaning || "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      @{t.ownerUsername} · {t.region || "—"} · {t.language} · ▶ {t.playsCount} · ♥{" "}
                      {t.likesCount} · Nutzungen {t.usesCount} · {formatDateTime(t.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <AdminButton onClick={() => play(t.audioUrl)}>
                      <Play className="h-3.5 w-3.5" /> Anhören
                    </AdminButton>
                    <AdminButton
                      onClick={() => {
                        setEditing(t.id);
                        setDraft({
                          name: t.name,
                          meaning: t.meaning,
                          region: t.region,
                          language: t.language,
                        });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                    </AdminButton>
                    {t.deletedAt ? (
                      <>
                        <AdminButton
                          onClick={() =>
                            void setDeleted({ data: { id: t.id, deleted: false } })
                              .then(() => {
                                toast.success("SlangTag wiederhergestellt");
                                return refresh(query, includeDeleted);
                              })
                              .catch(() => toast.error("Aktion fehlgeschlagen"))
                          }
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Wiederherstellen
                        </AdminButton>
                        <AdminButton
                          variant="danger"
                          onClick={() => {
                            if (!window.confirm("SlangTag endgültig entfernen?")) return;
                            void purge({ data: { id: t.id } })
                              .then(() => {
                                toast.success("SlangTag endgültig entfernt");
                                return refresh(query, includeDeleted);
                              })
                              .catch(() => toast.error("Aktion fehlgeschlagen"));
                          }}
                        >
                          <Flame className="h-3.5 w-3.5" /> Endgültig
                        </AdminButton>
                      </>
                    ) : (
                      <AdminButton
                        variant="danger"
                        onClick={() =>
                          void setDeleted({ data: { id: t.id, deleted: true } })
                            .then(() => {
                              toast.success("SlangTag gelöscht");
                              return refresh(query, includeDeleted);
                            })
                            .catch(() => toast.error("Aktion fehlgeschlagen"))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Löschen
                      </AdminButton>
                    )}
                  </div>
                </div>
              )}
            </AdminPanel>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
