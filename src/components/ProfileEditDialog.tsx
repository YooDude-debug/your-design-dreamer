import { useEffect, useRef, useState } from "react";
import { X, Upload, Save, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data";

const LANGUAGES = ["Deutsch", "English", "Ελληνικά", "Português", "日本語"];

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export function ProfileEditDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, updateMyProfile } = useData();
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(me?.displayName ?? "");
  const [username, setUsername] = useState(me?.username ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [location, setLocation] = useState(me?.location ?? "");
  const [language, setLanguage] = useState(me?.language ?? "Deutsch");
  const [cover, setCover] = useState<string | null>(me?.cover ?? null);

  const [source, setSource] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState<string | null>(me?.avatar ?? null);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!open || !me) return;
    setDisplayName(me.displayName);
    setUsername(me.username);
    setBio(me.bio);
    setLocation(me.location);
    setLanguage(me.language);
    setCover(me.cover);
    setPreview(me.avatar);
    setSource(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [open, me]);

  // Draw crop canvas
  useEffect(() => {
    if (!source) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = source;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  useEffect(() => {
    if (source) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, offset]);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = canvas.width;
    ctx.clearRect(0, 0, S, S);
    const base = Math.max(S / img.width, S / img.height);
    const scale = base * zoom;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (S - w) / 2 + offset.x, (S - h) / 2 + offset.y, w, h);
    setPreview(canvas.toDataURL("image/jpeg", 0.88));
  };

  if (!open || !me) return null;

  const onPickAvatar = async (file?: File) => {
    if (!file) return;
    setSource(await readFile(file));
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const onPickCover = async (file?: File) => {
    if (!file) return;
    setCover(await readFile(file));
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateMyProfile({
        displayName: displayName.trim() || me.displayName,
        username: username.trim().replace(/^@/, "") || me.username,
        bio,
        location,
        language,
        // nur hochladen, wenn ein neues Bild gewählt wurde
        avatarDataUrl: preview !== me.avatar ? preview : undefined,
        coverDataUrl: cover !== me.cover ? cover : undefined,
      });
      toast.success("Profil gespeichert");
      onClose();
    } catch {
      toast.error("Profil konnte nicht gespeichert werden. Ist der Benutzername schon vergeben?");
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-2xl rounded-2xl border border-border bg-surface p-5 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight">
            Profil <span className="text-gradient-green">bearbeiten</span>
          </h2>
          <button onClick={onClose} aria-label="Schließen" className="rounded-full p-1.5 text-muted-foreground hover:text-brand">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
          {/* Avatar crop + preview */}
          <div className="space-y-3">
            <div className="relative mx-auto h-40 w-40">
              <div className="absolute -inset-1 rounded-full bg-gradient-brand opacity-70 blur-md" />
              <div className="relative h-40 w-40 overflow-hidden rounded-full border-2 border-brand/60 bg-background">
                {source ? (
                  <canvas
                    ref={canvasRef}
                    width={320}
                    height={320}
                    className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
                    onPointerDown={(e) => {
                      dragging.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (!dragging.current) return;
                      setOffset({ x: e.clientX - dragging.current.x, y: e.clientY - dragging.current.y });
                    }}
                    onPointerUp={() => (dragging.current = null)}
                  />
                ) : preview ? (
                  <img src={preview} alt="Profilbild" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-black text-brand">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {source && (
              <label className="block text-xs text-muted-foreground">
                Zuschneiden / Zoom
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="mt-1 w-full accent-[oklch(0.82_0.24_150)]"
                />
              </label>
            )}

            <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:border-brand/60 hover:text-brand">
              <Upload className="h-3.5 w-3.5" /> Profilbild hochladen
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickAvatar(e.target.files?.[0])} />
            </label>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <label className="block text-xs text-muted-foreground">
              Anzeigename
              <input className={`mt-1 ${field}`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label className="block text-xs text-muted-foreground">
              Benutzername
              <input className={`mt-1 ${field}`} value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="block text-xs text-muted-foreground">
              Kurzbeschreibung
              <textarea rows={3} className={`mt-1 resize-none ${field}`} value={bio} onChange={(e) => setBio(e.target.value)} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs text-muted-foreground">
                Wohnort
                <input className={`mt-1 ${field}`} value={location} onChange={(e) => setLocation(e.target.value)} />
              </label>
              <label className="block text-xs text-muted-foreground">
                Sprache
                <select className={`mt-1 ${field}`} value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Hintergrundbild (optional)</div>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-14 w-28 overflow-hidden rounded-lg border border-border bg-background">
                  {cover && <img src={cover} alt="Hintergrund" className="h-full w-full object-cover" />}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:border-brand-cyan/60 hover:text-brand-cyan">
                  <ImagePlus className="h-3.5 w-3.5" /> Hochladen
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickCover(e.target.files?.[0])} />
                </label>
                {cover && (
                  <button onClick={() => setCover(null)} className="text-xs text-muted-foreground hover:text-destructive">
                    Entfernen
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-full border border-border px-5 py-2 text-sm text-muted-foreground hover:text-foreground">
            Abbrechen
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Speichern …" : "Profil speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
