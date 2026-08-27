import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Download, Trash2, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang-context";
import { profileTexts, type ProfileDict } from "@/lib/i18n-profile";
import { exportMyData, deleteMyAccount } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { clearDeviceMediaCache } from "@/lib/media";
import { AdsMasterSwitch } from "@/components/AdsMasterSwitch";
import { ThemeSection } from "@/components/ThemeSection";

/**
 * Einstellungen → Konto: DSGVO-Datenexport (Art. 15/20) und vollständige
 * Kontolöschung (Art. 17). Beide Vorgänge verlangen das Passwort erneut.
 */

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

function errorText(err: unknown, p: ProfileDict): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("RATE_LIMIT")) return p.tooManyAttempts;
  if (msg.includes("INVALID_PASSWORD")) return p.passwordRequired;
  return msg;
}

export function AccountSection() {
  const { lang } = useLang();
  const p = profileTexts[lang];
  const navigate = useNavigate();

  const runExport = useServerFn(exportMyData);
  const runDelete = useServerFn(deleteMyAccount);

  const [exportPw, setExportPw] = useState("");
  const [exporting, setExporting] = useState(false);
  const [link, setLink] = useState<{ url: string; filename: string } | null>(null);

  const [delPw, setDelPw] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const onExport = async () => {
    if (!exportPw) return toast.error(p.passwordRequired);
    setExporting(true);
    setLink(null);
    try {
      const res = await runExport({ data: { password: exportPw } });
      setLink({ url: res.url, filename: res.filename });
      setExportPw("");
      toast.success(p.exportDone);
    } catch (err) {
      toast.error(`${p.exportFailed}: ${errorText(err, p)}`);
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    if (!delPw) return toast.error(p.passwordRequired);
    if (!confirmed) return toast.error(p.confirmRequired);
    setDeleting(true);
    try {
      await runDelete({ data: { password: delPw, confirm: true } });
      clearDeviceMediaCache();
      await supabase.auth.signOut();
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* Speicher nicht verfügbar – unkritisch */
      }
      toast.success(p.deleteDone);
      void navigate({ to: "/" });
    } catch (err) {
      toast.error(`${p.deleteFailed}: ${errorText(err, p)}`);
      setDeleting(false);
    }
  };

  return (
    <div className="mt-5 space-y-6">
      {/* Erscheinungsbild – ein zentrales Theme fuer die ganze Plattform. */}
      <ThemeSection />
      {/* Dauerhafte Werbe-Steuerung – nur fuer Admin-Konten sichtbar. */}
      <AdsMasterSwitch />
      {/* Datenexport */}
      <section className="rounded-2xl border border-border bg-background/60 p-4">
        <h3 className="inline-flex items-center gap-2 text-sm font-bold">
          <Download className="h-4 w-4 text-brand" /> {p.exportTitle}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{p.exportDesc}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/80">{p.exportHint}</p>

        <label className="mt-3 block max-w-sm text-xs text-muted-foreground">
          {p.passwordLabel}
          <input
            type="password"
            autoComplete="current-password"
            className={`mt-1 ${field}`}
            value={exportPw}
            onChange={(e) => setExportPw(e.target.value)}
          />
        </label>
        <button
          onClick={() => void onExport()}
          disabled={exporting}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand/60 px-5 py-2 text-sm font-semibold text-brand disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {exporting ? p.exportRunning : p.exportButton}
        </button>

        {link && (
          <div className="mt-3 rounded-xl border border-brand/40 bg-brand/10 p-3">
            <a
              href={link.url}
              download={link.filename}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand underline"
            >
              <Download className="h-4 w-4" /> {p.exportDownload}
            </a>
            <p className="mt-1 text-[11px] text-muted-foreground">{p.exportLinkHint}</p>
          </div>
        )}
      </section>

      {/* Kontolöschung */}
      <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <h3 className="inline-flex items-center gap-2 text-sm font-bold text-destructive">
          <Trash2 className="h-4 w-4" /> {p.deleteTitle}
        </h3>
        <p className="mt-1 inline-flex items-start gap-2 text-xs font-semibold text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {p.deleteWarning}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{p.deleteDesc}</p>

        <label className="mt-3 block max-w-sm text-xs text-muted-foreground">
          {p.passwordLabel}
          <input
            type="password"
            autoComplete="current-password"
            className={`mt-1 ${field}`}
            value={delPw}
            onChange={(e) => setDelPw(e.target.value)}
          />
        </label>

        <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[oklch(0.62_0.22_25)]"
          />
          <span>{p.deleteConfirmLabel}</span>
        </label>

        <button
          onClick={() => void onDelete()}
          disabled={deleting || !confirmed}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> {deleting ? p.deleteRunning : p.deleteButton}
        </button>

        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" /> {p.deleteDesc}
        </p>
      </section>
    </div>
  );
}
