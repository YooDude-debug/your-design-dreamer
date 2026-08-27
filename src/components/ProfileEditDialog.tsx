import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Upload, Save, ImagePlus, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";

import { ProfileDetailsForm } from "@/components/ProfileDetailsForm";
import { AccountSection } from "@/components/AccountSection";
import { avatarGlowFromFlags } from "@/components/AvatarGlow";
import { profileTexts } from "@/lib/i18n-profile";
import { supabase } from "@/integrations/supabase/client";
import { authTexts } from "@/lib/i18n-auth";
import { useUsernameCheck } from "@/lib/use-username-check";
import {
  DEFAULT_DISPLAY_NAME_MODE,
  DISPLAY_NAME_MODES,
  IDENTITY_POLICY_FALLBACK,
  cooldownUntil,
  loadIdentityPolicy,
  loadProfileDetails,
  previewPublicName,
  type DisplayNameMode,
  type IdentityPolicy,
} from "@/lib/profile-extra";

const LANGUAGES = ["Deutsch", "English", "Ελληνικά", "Português", "日本語"];

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

type Tab = "profile" | "details" | "security" | "account";

export function ProfileEditDialog({
  open,
  onClose,
  initialTab = "profile",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
}) {
  const { me, user, updateMyProfile, isCreator, isBusiness } = useData();
  const { t, lang } = useLang();
  const glow = avatarGlowFromFlags(isCreator, isBusiness);
  const pt = profileTexts[lang];
  const [tab, setTab] = useState<Tab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [displayNameMode, setDisplayNameMode] = useState<DisplayNameMode>(
    (me?.displayNameMode as DisplayNameMode) ?? DEFAULT_DISPLAY_NAME_MODE,
  );
  // Feste Registrierungsdaten: nur zur Anzeige, nicht editierbar.
  const [identity, setIdentity] = useState<{
    firstName: string;
    lastName: string;
    usernameChangedAt: string | null;
    modeChangedAt: string | null;
  }>({ firstName: "", lastName: "", usernameChangedAt: null, modeChangedAt: null });
  const [policy, setPolicy] = useState<IdentityPolicy>(IDENTITY_POLICY_FALLBACK);
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
    setDisplayNameMode((me.displayNameMode as DisplayNameMode) ?? DEFAULT_DISPLAY_NAME_MODE);
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

  // Live-Prüfung des Wunsch-Usernames (Server entscheidet verbindlich).
  const nameCheck = useUsernameCheck(username, {
    enabled: !!me && username.trim() !== "" && username.trim() !== me.username,
  });

  // Gesperrte Identitätsdaten und Sperrfristen laden (nur eigenes Profil).
  useEffect(() => {
    if (!open || !me) return;
    let alive = true;
    void Promise.all([loadProfileDetails([me.id]), loadIdentityPolicy()]).then(([map, pol]) => {
      if (!alive) return;
      const d = map[me.id] ?? {};
      setIdentity({
        firstName: d.firstName ?? "",
        lastName: d.lastName ?? "",
        usernameChangedAt: d.usernameChangedAt ?? null,
        modeChangedAt: d.displayNameModeChangedAt ?? null,
      });
      setPolicy(pol);
    });
    return () => {
      alive = false;
    };
  }, [open, me]);

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

  // Stabile Identität: Username und Namensanzeige nur nach Sperrfrist änderbar.
  const usernameNext = cooldownUntil(identity.usernameChangedAt, policy.usernameCooldownDays);
  const usernameLocked = usernameNext !== null;
  const modeNext = cooldownUntil(identity.modeChangedAt, policy.displayModeCooldownDays);
  const modeLocked = modeNext !== null;
  const dateFmt = (d: Date) => d.toLocaleDateString();
  const realName = `${identity.firstName} ${identity.lastName}`.trim();

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
    // Komfortprüfung; die endgültige Entscheidung trifft die Datenbank.
    if (
      me &&
      username.trim() !== me.username &&
      nameCheck.state === "done" &&
      nameCheck.status &&
      nameCheck.status !== "available"
    ) {
      toast.error(
        nameCheck.status === "taken"
          ? "Dieser Benutzername ist bereits vergeben."
          : nameCheck.status === "reserved"
            ? "Dieser Username kann nicht verwendet werden. Bitte wähle einen anderen."
            : "Benutzername: 3–24 Zeichen, nur Buchstaben, Zahlen, _ . -",
      );
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        displayNameMode,
        username: usernameLocked ? me.username : username.trim().replace(/^@/, "") || me.username,
        bio,
        location,
        language,
        // nur hochladen, wenn ein neues Bild gewählt wurde
        avatarDataUrl: preview !== me.avatar ? preview : undefined,
        coverDataUrl: cover !== me.cover ? cover : undefined,
      });
      toast.success(t.profileSaved);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("USERNAME_RESERVED")) {
        toast.error("Dieser Username kann nicht verwendet werden. Bitte wähle einen anderen.");
      } else if (msg.includes("duplicate key") || msg.includes("23505")) {
        toast.error("Dieser Benutzername ist bereits vergeben.");
      } else if (msg.includes("USERNAME_COOLDOWN")) {
        toast.error("Der Benutzername kann derzeit noch nicht geändert werden.");
      } else if (msg.includes("DISPLAY_MODE_COOLDOWN")) {
        toast.error("Die Namensanzeige kann derzeit noch nicht geändert werden.");
      } else {
        toast.error(t.profileSaveFailed);
      }
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/80 p-4 backdrop-blur-sm isolate">
      <div className="my-6 w-full max-w-2xl rounded-2xl border border-border bg-background p-5 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tight">
            {t.editProfileTitleA} <span className="text-gradient-green">{t.editProfileTitleB}</span>
          </h2>
          <CloseButton onClick={onClose} label={t.close} />
        </div>

        <div className="mt-4 flex items-center gap-4 overflow-x-auto border-b border-border text-sm">
          {[
            { key: "profile" as const, label: t.tabProfile },
            { key: "details" as const, label: pt.tabDetails },
            { key: "security" as const, label: t.tabSecurity },
            { key: "account" as const, label: pt.tabAccount },
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
                  <div
                    className={`absolute -inset-1 rounded-full ${glow.aura} opacity-70 blur-md`}
                  />
                  <div
                    className={`relative h-40 w-40 overflow-hidden rounded-full border-2 ${glow.border}/60 bg-background`}
                  >
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
                        {me.displayName.slice(0, 1).toUpperCase()}
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
                <fieldset className="rounded-xl border border-border px-3 py-3">
                  <legend className="px-1 text-xs font-semibold text-muted-foreground">
                    Wie soll dein Name auf Y-Dude angezeigt werden?
                  </legend>
                  <div className="space-y-1.5">
                    {DISPLAY_NAME_MODES.map((m) => (
                      <label
                        key={m}
                        className={`flex items-center gap-2 px-1 text-xs ${
                          modeLocked ? "text-muted-foreground/60" : "text-muted-foreground"
                        }`}
                      >
                        <input
                          type="radio"
                          name="displayNameMode"
                          value={m}
                          disabled={modeLocked}
                          checked={displayNameMode === m}
                          onChange={() => setDisplayNameMode(m)}
                          className="h-4 w-4 shrink-0 accent-[oklch(0.82_0.24_150)]"
                        />
                        <span>
                          {m === "username"
                            ? "Nur Username anzeigen"
                            : m === "real_name"
                              ? "Richtigen Namen anzeigen"
                              : "Username + richtigen Namen anzeigen"}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                    Öffentlich sichtbar:{" "}
                    <span className="font-semibold text-foreground">
                      {previewPublicName(
                        username || me.username,
                        identity.firstName,
                        identity.lastName,
                        displayNameMode,
                      )}
                    </span>
                  </p>
                  {modeLocked && modeNext && (
                    <p className="mt-1 inline-flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" /> Änderung wieder möglich ab {dateFmt(modeNext)}.
                    </p>
                  )}
                </fieldset>

                <label className="block text-xs text-muted-foreground">
                  {t.username}
                  <input
                    className={`mt-1 ${field} ${usernameLocked ? "opacity-60" : ""}`}
                    value={username}
                    disabled={usernameLocked}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  {nameCheck.state === "checking" && (
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      ⟳ Username wird geprüft …
                    </span>
                  )}
                  {nameCheck.state === "done" && nameCheck.status && (
                    <span
                      className={`mt-1 block text-[11px] ${
                        nameCheck.status === "available" ? "text-brand" : "text-destructive"
                      }`}
                    >
                      {nameCheck.status === "available" ? "✓" : "✕"}{" "}
                      {authTexts[lang].username.status[nameCheck.status]}
                    </span>
                  )}
                  {nameCheck.suggestions.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {nameCheck.suggestions.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setUsername(sug)}
                          className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-brand/60 hover:text-brand"
                        >
                          @{sug} <span className="text-brand">✓</span>
                        </button>
                      ))}
                    </span>
                  )}
                  {usernameLocked && usernameNext ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" /> Änderung wieder möglich ab{" "}
                      {dateFmt(usernameNext)}.
                    </span>
                  ) : (
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      Nach einer Änderung ist der nächste Wechsel erst nach{" "}
                      {policy.usernameCooldownDays} Tagen möglich.
                    </span>
                  )}
                </label>

                <div className="rounded-xl border border-border px-3 py-2 text-[11px] text-muted-foreground">
                  <p className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <Lock className="h-3 w-3" /> Registrierungsdaten
                  </p>
                  <p className="mt-1">
                    Vorname, Nachname und Geburtsdatum sind feste Registrierungsdaten und hier nicht
                    änderbar. Eine Korrektur ist nur über den Support möglich.
                  </p>
                  {realName && <p className="mt-1">Hinterlegter Name: {realName}</p>}
                </div>
                {/* Bewusst ein einfaches Textfeld: In den Profileinstellungen darf die
                    SlangTag-Erkennung nicht aktiv werden (auch nicht bei Autofill). */}
                <label className="block text-xs text-muted-foreground">
                  {t.bio}
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t.bioPh}
                    aria-label={t.bio}
                    className={`mt-1 resize-none text-foreground ${field}`}
                  />
                </label>
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
        ) : tab === "details" ? (
          <ProfileDetailsForm onClose={onClose} />
        ) : tab === "security" ? (
          <SecuritySection email={user?.email ?? ""} onDone={onClose} />
        ) : (
          <AccountSection />
        )}
      </div>
    </div>,
    document.body,
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
