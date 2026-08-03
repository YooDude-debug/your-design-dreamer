import { useEffect, useRef, useState } from "react";
import { X, Upload, Save, ImagePlus, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { SlangTagField } from "@/components/SlangTagInput";
import { supabase } from "@/integrations/supabase/client";

const LANGUAGES = ["Deutsch", "English", "Ελληνικά", "Português", "日本語"];

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

type Tab = "profile" | "security";

export function ProfileEditDialog({
  open,
  onClose,
  initialTab = "profile",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
}) {
  const { me, user, updateMyProfile } = useData();
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>(initialTab);
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
    setTab(initialTab);
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
  }, [open, me, initialTab]);

  // Zuschnitt-Canvas zeichnen
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
      toast.success(t.profileSaved);
      onClose();
    } catch {
      toast.error(t.profileSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-2xl rounded-2xl border border-border bg-surface p-5 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight">
            {t.editProfileTitleA} <span className="text-gradient-green">{t.editProfileTitleB}</span>
          </h2>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="rounded-full p-1.5 text-muted-foreground hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4 border-b border-border text-sm">
          {[
            { key: "profile" as const, label: t.tabProfile },
            { key: "security" as const, label: t.tabSecurity },
          ].map((x) => (
            <button
              key={x.key}
              onClick={() => setTab(x.key)}
              className={`-mb-px border-b-2 pb-2 transition-colors ${
                tab === x.key
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        {tab === "profile" ? (
          <>
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
              {/* Avatar */}
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
                          setOffset({
                            x: e.clientX - dragging.current.x,
                            y: e.clientY - dragging.current.y,
                          });
                        }}
                        onPointerUp={() => (dragging.current = null)}
                      />
                    ) : preview ? (
                      <img
                        src={preview}
                        alt={me.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-black text-brand">
                        {displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {source && (
                  <label className="block text-xs text-muted-foreground">
                    {t.cropZoom}
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
                  <Upload className="h-3.5 w-3.5" /> {t.uploadAvatar}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickAvatar(e.target.files?.[0])}
                  />
                </label>
              </div>

              {/* Felder */}
              <div className="space-y-3">
                <label className="block text-xs text-muted-foreground">
                  {t.displayName}
                  <input
                    className={`mt-1 ${field}`}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-muted-foreground">
                  {t.username}
                  <input
                    className={`mt-1 ${field}`}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </label>
                <div className="block text-xs text-muted-foreground">
                  {t.bio}
                  <div className={`mt-1 ${field}`}>
                    <SlangTagField
                      multiline
                      rows={3}
                      value={bio}
                      onChange={setBio}
                      region={location}
                      placeholder={t.bioPh}
                      aria-label={t.bio}
                      className="resize-none text-foreground"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-muted-foreground">
                    {t.location}
                    <input
                      className={`mt-1 ${field}`}
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </label>
                  <label className="block text-xs text-muted-foreground">
                    {t.language}
                    <select
                      className={`mt-1 ${field}`}
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">{t.coverImage}</div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="h-14 w-28 overflow-hidden rounded-lg border border-border bg-background">
                      {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs hover:border-brand-cyan/60 hover:text-brand-cyan">
                      <ImagePlus className="h-3.5 w-3.5" /> {t.upload}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onPickCover(e.target.files?.[0])}
                      />
                    </label>
                    {cover && (
                      <button
                        onClick={() => setCover(null)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        {t.remove}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-full border border-border px-5 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? t.saving : t.saveProfile}
              </button>
            </div>
          </>
        ) : (
          <SecuritySection email={user?.email ?? ""} onDone={onClose} />
        )}
      </div>
    </div>
  );
}

/** Einstellungen → Sicherheit: Passwortwechsel für jeden angemeldeten Account. */
function SecuritySection({ email, onDone }: { email: string; onDone: () => void }) {
  const { t } = useLang();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast.error(t.passwordTooShort);
    if (next !== confirm) return toast.error(t.passwordMismatch);
    setBusy(true);
    // Aktuelles Passwort verifizieren, bevor es geändert wird.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signInError) {
      setBusy(false);
      toast.error(t.wrongPassword);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) {
      toast.error(t.passwordChangeFailed);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success(t.passwordChanged);
    onDone();
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-5 max-w-md space-y-3">
      <h3 className="inline-flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="h-4 w-4 text-brand" /> {t.changePassword}
      </h3>
      <p className="text-xs text-muted-foreground">{t.securityHint}</p>
      <label className="block text-xs text-muted-foreground">
        {t.currentPassword}
        <input
          type="password"
          required
          autoComplete="current-password"
          className={`mt-1 ${field}`}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        {t.newPassword}
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={`mt-1 ${field}`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        {t.confirmPassword}
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={`mt-1 ${field}`}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-6 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
      >
        <Lock className="h-4 w-4" /> {busy ? t.saving : t.changePassword}
      </button>
    </form>
  );
}
