import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Bot, RefreshCw, ScaleIcon, ShieldCheck, User } from "lucide-react";
import {
  getMyModerationActions,
  submitModerationAppeal,
  type MyModerationAction,
} from "@/lib/moderation-dsa.functions";
import {
  APPEAL_WINDOW_DAYS,
  actionLabel,
  appealStatusLabel,
  reasonLabel,
} from "@/lib/moderation-reasons";
import { formatDateTime } from "@/lib/format-date";
import { BackButton } from "@/components/ui/nav-buttons";

export const Route = createFileRoute("/_authenticated/moderation")({
  head: () => ({
    meta: [
      { title: "Moderation & Einspruch — Y-Dude" },
      {
        name: "description",
        content:
          "Alle Moderationsentscheidungen zu deinem Konto mit Begründung – und die Möglichkeit, ihnen zu widersprechen.",
      },
      { property: "og:title", content: "Moderation & Einspruch — Y-Dude" },
      {
        property: "og:description",
        content: "Entscheidungen einsehen, Begründung lesen, Einspruch einlegen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ModerationPage,
});

function ModerationPage() {
  const load = useServerFn(getMyModerationActions);
  const appeal = useServerFn(submitModerationAppeal);
  const [rows, setRows] = useState<MyModerationAction[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setRows(await load({}));
    } catch {
      setRows([]);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const send = async (actionId: string) => {
    setBusy(true);
    try {
      await appeal({ data: { actionId, message: text } });
      toast.success("Einspruch eingelegt. Wir prüfen die Entscheidung erneut.");
      setOpenId(null);
      setText("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Einspruch fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4">
      <header className="mb-4 flex items-center gap-3">
        <BackButton />
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-foreground">Moderation &amp; Einspruch</h1>
          <p className="text-[11px] text-muted-foreground">
            Entscheidungen zu deinen Inhalten und deinem Konto – mit Begründung.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          aria-label="Aktualisieren"
          className="ml-auto rounded-full border border-border p-2 text-muted-foreground hover:text-brand"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      <section className="mb-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Wenn wir einen Inhalt entfernen, ausblenden oder dein Konto einschränken, erfährst du hier
          den Grund. Du kannst jeder Entscheidung innerhalb von {APPEAL_WINDOW_DAYS} Tagen
          widersprechen; wir prüfen sie dann durch einen Menschen erneut. Zusätzlich kannst du dich
          jederzeit an eine außergerichtliche Streitbeilegungsstelle wenden oder den Rechtsweg
          beschreiten – Einzelheiten stehen in unseren{" "}
          <Link to="/legal/terms" className="text-brand underline">
            Nutzungsbedingungen
          </Link>
          .
        </p>
      </section>

      {rows === null ? (
        <p className="py-10 text-center text-[12px] text-muted-foreground">Wird geladen …</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-brand" />
          <p className="text-sm text-foreground">Keine Moderationsentscheidungen.</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Gegen dein Konto und deine Inhalte liegt nichts vor.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const canAppeal =
              !r.appeal &&
              (!r.appealDeadline || new Date(r.appealDeadline).getTime() > Date.now()) &&
              r.actionKind !== "no_action";
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {actionLabel(r.actionKind)}
                      {r.targetLabel ? ` · ${r.targetLabel}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Grund: {reasonLabel(r.reasonCode)} · {formatDateTime(r.createdAt)}
                    </p>
                    <p className="mt-2 rounded-xl border border-border bg-background/50 p-2.5 text-[12px] leading-relaxed text-foreground">
                      {r.publicReason}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      {r.automated ? (
                        <>
                          <Bot className="h-3 w-3" /> Automatisiert erkannt, auf Einspruch prüft ein
                          Mensch
                        </>
                      ) : (
                        <>
                          <User className="h-3 w-3" /> Von einem Menschen entschieden
                        </>
                      )}
                    </p>

                    {r.appeal ? (
                      <div className="mt-3 rounded-xl border border-brand/30 bg-brand/5 p-2.5">
                        <p className="text-[11px] font-semibold text-brand">
                          Einspruch: {appealStatusLabel(r.appeal.status)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{r.appeal.message}</p>
                        {r.appeal.decisionNote && (
                          <p className="mt-1.5 text-[11px] text-foreground">
                            Ergebnis: {r.appeal.decisionNote}
                          </p>
                        )}
                      </div>
                    ) : canAppeal && openId === r.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          rows={4}
                          maxLength={2000}
                          placeholder="Warum hältst du die Entscheidung für falsch?"
                          className="w-full rounded-xl border border-border bg-background p-2.5 text-[12px] text-foreground outline-none focus:border-brand/60"
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={busy}
                            onClick={() => void send(r.id)}
                            className="rounded-full bg-brand px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            Einspruch senden
                          </button>
                          <button
                            onClick={() => setOpenId(null)}
                            className="rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    ) : canAppeal ? (
                      <button
                        onClick={() => {
                          setOpenId(r.id);
                          setText("");
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/40 px-3 py-1.5 text-[11px] text-brand"
                      >
                        <ScaleIcon className="h-3.5 w-3.5" /> Einspruch einlegen
                      </button>
                    ) : (
                      <p className="mt-3 text-[10px] text-muted-foreground">
                        Einspruchsfrist abgelaufen.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
