import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, RefreshCw, Rocket, Send } from "lucide-react";
import {
  adminGetBetaLaunchStatus,
  adminRunBetaLaunchDispatch,
  adminSendBetaLaunchTest,
  adminSetOpenBeta,
} from "@/lib/admin.functions";
import {
  AdminButton,
  AdminInput,
  AdminLoading,
  AdminPanel,
  AdminSection,
  AdminSelect,
} from "@/components/admin/AdminUI";

type Status = {
  openBeta: boolean;
  activatedAt: string | null;
  scheduledSendAt: string | null;
  sendStartedAt: string | null;
  sendCompletedAt: string | null;
  dispatchId: string | null;
  recipients: number;
  alreadyNotified: number;
  pending: number;
};

export const Route = createFileRoute("/admin/beta")({
  head: () => ({
    meta: [
      { title: "Open-Beta-Start — Y-Dude Admin" },
      {
        name: "description",
        content:
          "Offene Beta aktivieren und die einmalige Startbenachrichtigung an Notify-me-Adressen steuern.",
      },
      { property: "og:title", content: "Open-Beta-Start — Y-Dude Admin" },
      { property: "og:description", content: "Beta-Aktivierung und Startmail-Versand steuern." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminBeta,
});

const BERLIN = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  dateStyle: "medium",
  timeStyle: "short",
});

const fmt = (iso: string | null) => (iso ? `${BERLIN.format(new Date(iso))} Uhr (Berlin)` : "—");

function AdminBeta() {
  const loadStatus = useServerFn(adminGetBetaLaunchStatus);
  const setBeta = useServerFn(adminSetOpenBeta);
  const sendTest = useServerFn(adminSendBetaLaunchTest);
  const runDispatch = useServerFn(adminRunBetaLaunchDispatch);

  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [testMail, setTestMail] = useState("");
  const [lang, setLang] = useState<"de" | "en" | "el">("de");

  const refresh = useCallback(async () => {
    try {
      setStatus(await loadStatus());
    } catch {
      toast.error("Status konnte nicht geladen werden");
    }
  }, [loadStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleBeta = async (enabled: boolean) => {
    setBusy(true);
    try {
      const next = await setBeta({ data: { enabled } });
      setStatus(next);
      toast.success(
        enabled
          ? `Open Beta aktiv — Versand geplant: ${fmt(next.scheduledSendAt)}`
          : "Open Beta deaktiviert",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    }
    setBusy(false);
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await sendTest({ data: { email: testMail, language: lang } });
      toast[r.sent ? "success" : "info"](
        r.sent ? "Testmail wurde verschickt" : `Nicht verschickt: ${r.reason ?? "unbekannt"}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Testmail fehlgeschlagen");
    }
    setBusy(false);
  };

  const dispatchNow = async () => {
    if (
      !window.confirm(
        "Startmail jetzt an alle bestätigten Notify-me-Adressen senden? Bereits benachrichtigte Adressen werden übersprungen.",
      )
    )
      return;
    setBusy(true);
    try {
      const r = await runDispatch({ data: { force: true } });
      if (!r.ran) toast.info(`Kein Versand: ${r.skipped ?? "nicht fällig"}`);
      else
        toast.success(
          `Versand: ${r.sent} gesendet, ${r.suppressed} gesperrt, ${r.failed} Fehler, ${r.alreadyNotified} übersprungen`,
        );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Versand fehlgeschlagen");
    }
    setBusy(false);
  };

  return (
    <AdminSection
      title="Open-Beta-Start"
      description="Aktivierung der offenen Beta und einmalige Startbenachrichtigung an die bestehenden Notify-me-Adressen. Adressen werden serverseitig verarbeitet und nie im Admin-Bereich angezeigt."
      actions={
        <AdminButton onClick={() => void refresh()} disabled={busy}>
          <RefreshCw className="h-3.5 w-3.5" /> Aktualisieren
        </AdminButton>
      }
    >
      {!status ? (
        <AdminLoading />
      ) : (
        <div className="space-y-4">
          <AdminPanel>
            <PanelTitle>Status</PanelTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Offene Beta" value={status.openBeta ? "AKTIV" : "inaktiv"} />
              <Stat label="Empfänger (bestätigt)" value={String(status.recipients)} />
              <Stat label="Bereits benachrichtigt" value={String(status.alreadyNotified)} />
              <Stat label="Offen" value={String(status.pending)} />
            </div>
            <dl className="mt-4 space-y-1.5 text-[11px] text-muted-foreground">
              <Row label="Aktiviert am" value={fmt(status.activatedAt)} />
              <Row label="Geplanter Versand (10:00 Uhr)" value={fmt(status.scheduledSendAt)} />
              <Row label="Versand gestartet" value={fmt(status.sendStartedAt)} />
              <Row label="Versand abgeschlossen" value={fmt(status.sendCompletedAt)} />
              <Row label="Versand-ID" value={status.dispatchId ?? "—"} />
            </dl>
          </AdminPanel>

          <AdminPanel>
            <PanelTitle>1. Testmail an eine einzelne Adresse</PanelTitle>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Der Test verändert keinen Versandstatus und wird nicht als Startmail gezählt.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <AdminInput
                value={testMail}
                onChange={setTestMail}
                placeholder="test@example.com"
                type="email"
                className="w-64"
              />
              <AdminSelect
                value={lang}
                onChange={setLang}
                options={[
                  { value: "de", label: "Deutsch" },
                  { value: "en", label: "English" },
                  { value: "el", label: "Ελληνικά" },
                ]}
              />
              <AdminButton onClick={() => void test()} disabled={busy || testMail.trim() === ""}>
                <Mail className="h-3.5 w-3.5" /> Testmail senden
              </AdminButton>
            </div>
          </AdminPanel>

          <AdminPanel>
            <PanelTitle>2. Offene Beta aktivieren</PanelTitle>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Bei Aktivierung wird der Versand automatisch auf den nächsten 10:00-Uhr-Termin
              (Europe/Berlin, MEZ/MESZ automatisch) eingeplant. Eine erneute Aktivierung löst keinen
              zweiten Versand aus.
            </p>
            <div className="flex flex-wrap gap-2">
              {status.openBeta ? (
                <AdminButton onClick={() => void toggleBeta(false)} disabled={busy} variant="danger">
                  Open Beta deaktivieren
                </AdminButton>
              ) : (
                <AdminButton
                  onClick={() => void toggleBeta(true)}
                  disabled={busy}
                  variant="primary"
                >
                  <Rocket className="h-3.5 w-3.5" /> Open Beta aktivieren
                </AdminButton>
              )}
              <AdminButton
                onClick={() => void dispatchNow()}
                disabled={busy || !status.openBeta || status.pending === 0}
              >
                <Send className="h-3.5 w-3.5" /> Versand jetzt ausführen
              </AdminButton>
            </div>
          </AdminPanel>
        </div>
      )}
    </AdminSection>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-brand">{children}</h2>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
