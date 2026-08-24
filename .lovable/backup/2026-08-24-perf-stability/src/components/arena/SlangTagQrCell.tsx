import { useEffect, useState } from "react";
import { Download, QrCode, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang-context";
import {
  isQrRevealed,
  qrDataUrlToFile,
  renderSlangTagQr,
  setQrRevealed,
  slangTagDeepLink,
} from "@/lib/slangtag-qr";
import type { SlangTag } from "@/lib/types";

const TEXTS = {
  de: {
    create: "QR-Code erstellen",
    download: "QR herunterladen",
    share: "QR teilen",
    again: "QR neu erzeugen",
    failed: "QR-Code konnte nicht erstellt werden",
    ready: "QR-Code erstellt",
    shareFailed: "Teilen wird nicht unterstützt – Link kopiert",
    copied: "Link kopiert",
  },
  en: {
    create: "Create QR code",
    download: "Download QR",
    share: "Share QR",
    again: "Regenerate QR",
    failed: "Could not create QR code",
    ready: "QR code created",
    shareFailed: "Sharing not supported – link copied",
    copied: "Link copied",
  },
};

/**
 * QR-Generator direkt in der SlangTag-Karte: Das Icon wird nach der Erzeugung
 * an derselben Stelle durch den fertigen QR-Code ersetzt (kein Popup).
 */
export function SlangTagQrCell({ tag }: { tag: SlangTag }) {
  const { lang } = useLang();
  const tx = lang === "de" ? TEXTS.de : TEXTS.en;
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // Nach Reload bleibt die Zuordnung erhalten: QR wird deterministisch neu erzeugt.
  useEffect(() => {
    if (!isQrRevealed(tag.id)) return;
    let alive = true;
    void renderSlangTagQr(tag.id)
      .then((url) => {
        if (!alive) return;
        setDataUrl(url);
        setOpen(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tag.id]);

  const build = async (notify: boolean) => {
    setBusy(true);
    try {
      const url = await renderSlangTagQr(tag.id);
      setDataUrl(url);
      setOpen(true);
      setQrRevealed(tag.id, true);
      if (notify) toast.success(tx.ready);
    } catch {
      toast.error(tx.failed);
    } finally {
      setBusy(false);
    }
  };

  const fileName = `y-dude-slangtag-${tag.name.replace(/[^\w-]+/g, "-").toLowerCase()}.png`;

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName;
    a.click();
  };

  const share = async () => {
    if (!dataUrl) return;
    const link = slangTagDeepLink(tag.id);
    try {
      const file = await qrDataUrlToFile(dataUrl, fileName);
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: tag.name, text: link });
        return;
      }
      if (nav.share) {
        await nav.share({ title: tag.name, text: link, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast.success(tx.copied);
    } catch {
      try {
        await navigator.clipboard.writeText(link);
        toast.message(tx.shareFailed);
      } catch {
        toast.error(tx.failed);
      }
    }
  };

  if (!open || !dataUrl) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void build(true)}
        aria-label={tx.create}
        title={tx.create}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 text-muted-foreground hover:border-brand/50 hover:text-brand disabled:opacity-50"
      >
        <QrCode className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <img
        src={dataUrl}
        alt={`QR ${tag.name}`}
        width={64}
        height={64}
        className="h-16 w-16 shrink-0 rounded-md border border-brand/40 bg-white p-0.5"
        style={{ imageRendering: "pixelated" }}
      />
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={download}
          aria-label={tx.download}
          title={tx.download}
          className="grid h-5 w-5 place-items-center rounded-full border border-brand/40 text-brand hover:bg-brand/10"
        >
          <Download className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          onClick={() => void share()}
          aria-label={tx.share}
          title={tx.share}
          className="grid h-5 w-5 place-items-center rounded-full border border-white/15 text-muted-foreground hover:border-brand/50 hover:text-brand"
        >
          <Share2 className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void build(false)}
          aria-label={tx.again}
          title={tx.again}
          className="grid h-5 w-5 place-items-center rounded-full border border-white/15 text-muted-foreground hover:border-brand/50 hover:text-brand disabled:opacity-50"
        >
          <RefreshCw className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}
