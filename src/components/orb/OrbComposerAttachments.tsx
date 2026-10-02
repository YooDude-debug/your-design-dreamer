/**
 * ORB Multimodal Composer – Bildanhänge im bestehenden Texteingabebereich.
 *
 * Nur Eingabe und Vorschau: Kamera (native Geräte-Kamera über das
 * Datei-Element), Galerie und Datei-Auswahl. Keine eigene Kamera-App, kein
 * Canvas/WebGL, keine zusätzliche Bibliothek, keine Bildgenerierung.
 * Gültigkeit wird vor dem Senden geprüft (`@/lib/orb-attachments`).
 */

import { pickConverted, shouldConvertToWebp } from "@/orb-core/visual/assets";
import { useEffect, useRef, useState } from "react";
import { Camera, Images, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ORB_IMAGE_ACCEPT,
  ORB_IMAGE_MAX_COUNT,
  ORB_IMAGE_MAX_BYTES,
  checkImageFile,
  sniffImageMime,
  validateImageAttachment,
  type OrbImageMime,
} from "@/lib/orb-attachments";

export type OrbAttachment = {
  id: string;
  mimeType: OrbImageMime;
  dataBase64: string;
  name: string;
};

type Props = {
  attachments: OrbAttachment[];
  onChange: (next: OrbAttachment[]) => void;
  disabled?: boolean;
  onActivity?: () => void;
};

/** Canvas-Umwandlung nach WebP (Qualität 0.9); `null`, wenn nicht möglich. */
async function toWebp(file: File): Promise<Uint8Array | null> {
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Datei → reines Base64 (ohne `data:`-Präfix) und echte Signatur prüfen. */
async function readImage(file: File): Promise<OrbAttachment | string> {
  const first = checkImageFile({ type: file.type, size: file.size });
  if (!first.ok) return first.reason;

  const buffer = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageMime(buffer.slice(0, 16));
  if (!sniffed) return "Die Datei ist kein erlaubtes Bild.";
  if (sniffed !== first.mimeType) return "Dateityp und Bildinhalt stimmen nicht überein.";

  // Visual Memory: Standbilder (PNG/JPEG) möglichst als WebP. Nur übernehmen,
  // wenn das Ergebnis echt WebP und nicht grösser ist – sonst Original.
  let finalBytes: Uint8Array = buffer;
  let finalMime: OrbImageMime = sniffed;
  if (shouldConvertToWebp(sniffed)) {
    const converted = await toWebp(file);
    const head = converted ? sniffImageMime(converted.slice(0, 16)) : null;
    if (
      converted &&
      pickConverted(
        { mimeType: sniffed, bytes: buffer.length },
        { sniffed: head, bytes: converted.length },
      ) === "converted"
    ) {
      finalBytes = converted;
      finalMime = "image/webp";
    }
  }

  let binary = "";
  for (let i = 0; i < finalBytes.length; i += 1)
    binary += String.fromCharCode(finalBytes[i] as number);
  const dataBase64 = btoa(binary);

  const verified = validateImageAttachment({ mimeType: finalMime, dataBase64 });
  if (!verified.ok) return verified.reason;

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mimeType: finalMime,
    dataBase64,
    name: file.name || "Bild",
  };
}

export function OrbComposerAttachments({ attachments, onChange, disabled, onActivity }: Props) {
  const [open, setOpen] = useState(false);
  const [supportsCamera, setSupportsCamera] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Kamera nur anbieten, wenn das Gerät die native Aufnahme sinnvoll kennt.
    const input = document.createElement("input");
    const hasCapture = "capture" in input;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    setSupportsCamera(
      hasCapture && (coarse || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)),
    );
  }, []);

  const accept = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onActivity?.();
    const free = ORB_IMAGE_MAX_COUNT - attachments.length;
    if (free <= 0) {
      toast.error(`Höchstens ${ORB_IMAGE_MAX_COUNT} Bilder pro Nachricht.`);
      return;
    }
    const next: OrbAttachment[] = [];
    for (const file of Array.from(files).slice(0, free)) {
      const result = await readImage(file);
      if (typeof result === "string") toast.error(result);
      else next.push(result);
    }
    if (next.length > 0) onChange([...attachments, ...next]);
    setOpen(false);
  };

  return (
    <div className="min-w-0" data-testid="orb-composer-attachments">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2" data-testid="orb-attachment-previews">
          {attachments.map((item) => (
            <div
              key={item.id}
              className="relative size-16 overflow-hidden rounded-md border border-border bg-background"
            >
              <img
                src={`data:${item.mimeType};base64,${item.dataBase64}`}
                alt={item.name}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(attachments.filter((a) => a.id !== item.id))}
                aria-label={`${item.name} entfernen`}
                data-testid="orb-attachment-remove"
                className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-background/90 text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-center gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={disabled}
          aria-label="Bild anhängen"
          aria-expanded={open}
          data-testid="orb-attach-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          <Paperclip className="size-4" />
        </Button>
        {open && (
          <div
            className="absolute bottom-full left-0 z-30 mb-2 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-1.5 shadow-lg"
            data-testid="orb-attach-options"
            role="menu"
          >
            <p
              className="px-1.5 pb-1.5 text-[10px] leading-snug text-muted-foreground"
              data-testid="orb-attach-limits"
            >
              Nur Bilder: PNG, JPEG, WEBP, GIF · max. {ORB_IMAGE_MAX_COUNT} ×{" "}
              {Math.round(ORB_IMAGE_MAX_BYTES / (1024 * 1024))} MB
            </p>
            <div className="flex flex-col gap-1">
              {supportsCamera && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  role="menuitem"
                  className="h-8 justify-start"
                  data-testid="orb-attach-camera"
                  onClick={() => {
                    setOpen(false);
                    cameraRef.current?.click();
                  }}
                >
                  <Camera className="mr-1 size-3.5" /> Kamera
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                role="menuitem"
                className="h-8 justify-start"
                data-testid="orb-attach-gallery"
                onClick={() => {
                  setOpen(false);
                  galleryRef.current?.click();
                }}
              >
                <Images className="mr-1 size-3.5" /> Galerie
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                role="menuitem"
                className="h-8 justify-start"
                data-testid="orb-attach-file"
                onClick={() => {
                  setOpen(false);
                  fileRef.current?.click();
                }}
              >
                <Paperclip className="mr-1 size-3.5" /> Datei
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Native Kamera des Geräts – kein eigener Kamera-Viewer. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="orb-input-camera"
        onChange={(e) => void accept(e.target.files)}
      />
      {/* Galerie/Fotos des Geräts. */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="orb-input-gallery"
        onChange={(e) => void accept(e.target.files)}
      />
      {/* Dateien/Ordner – ausschliesslich unterstützte Bildformate. */}
      <input
        ref={fileRef}
        type="file"
        accept={ORB_IMAGE_ACCEPT}
        multiple={ORB_IMAGE_MAX_COUNT > 1}
        className="hidden"
        data-testid="orb-input-file"
        onChange={(e) => void accept(e.target.files)}
      />
    </div>
  );
}
