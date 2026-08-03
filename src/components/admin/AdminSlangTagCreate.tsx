import { useState } from "react";
import { toast } from "sonner";
import { Mic, Square, Plus, Loader2 } from "lucide-react";
import { AdminButton, AdminInput, AdminPanel, AdminSelect } from "@/components/admin/AdminUI";
import { useData } from "@/lib/data-context";
import { useAudioRecorder } from "@/lib/use-audio-recorder";
import {
  AudioSourceSwitch,
  AudioUploadPicker,
  type AudioSourceMode,
} from "@/components/AudioUploadPicker";
import { checkSlangTagName, sanitizeSlangTagName } from "@/lib/slangtag-rules";
import { SLANGTAG_MAX_SECONDS, SLANGTAG_MAX_SECONDS_EXTENDED } from "@/lib/audio-format";
import type { SlangTagCtaType } from "@/lib/types";

type Mode = "community" | "creator" | "company";

const MODES: { value: Mode; label: string }[] = [
  { value: "community", label: "🟢 Community" },
  { value: "creator", label: "⭐ Creator" },
  { value: "company", label: "🏢 Unternehmen" },
];

const CTA_OPTIONS: { value: SlangTagCtaType; label: string }[] = [
  { value: "website", label: "Webseite besuchen" },
  { value: "offer", label: "Angebot ansehen" },
  { value: "booking", label: "Jetzt buchen" },
  { value: "info", label: "Mehr erfahren" },
  { value: "route", label: "Route öffnen" },
];

/**
 * Admin-Testmodus: SlangTag als Community, Creator oder Unternehmen anlegen.
 * Bei „Unternehmen" kann zusätzlich „Gesponsert" aktiviert werden, damit die
 * Darstellung exakt der späteren Werbekunden-Ansicht entspricht.
 */
export function AdminSlangTagCreate({ onCreated }: { onCreated?: () => void }) {
  const { createTag } = useData();
  const [mode, setMode] = useState<Mode>("community");
  const [sponsored, setSponsored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    region: "",
    meaning: "",
    company: "",
    logoUrl: "",
    description: "",
    ctaUrl: "",
    discountCode: "",
    voucher: "",
    location: "",
    openingHours: "",
    phone: "",
    companyUrl: "",
  });
  const [ctaType, setCtaType] = useState<SlangTagCtaType>("website");
  const [source, setSource] = useState<AudioSourceMode>("record");
  const [uploaded, setUploaded] = useState<{ dataUrl: string; duration: string } | null>(null);
  const {
    audio: recorded,
    recording,
    seconds,
    duration: recordedDuration,
    start,
    stop,
    reset: resetRecording,
  } = useAudioRecorder(
    () => toast.error("Mikrofon nicht verfügbar"),
    mode === "community" ? SLANGTAG_MAX_SECONDS : SLANGTAG_MAX_SECONDS_EXTENDED,
  );
  const maxSeconds = mode === "community" ? SLANGTAG_MAX_SECONDS : SLANGTAG_MAX_SECONDS_EXTENDED;

  const audio = source === "upload" ? (uploaded?.dataUrl ?? null) : recorded;
  const duration = source === "upload" ? (uploaded?.duration ?? "0:01") : recordedDuration;

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const submit = async () => {
    const name = sanitizeSlangTagName(form.name);
    const check = checkSlangTagName(name);
    if (!check.ok) return toast.error("Ungültiger SlangTag-Name");
    if (!audio) return toast.error(`Bitte zuerst Audio aufnehmen oder hochladen (1–${maxSeconds} s)`);
    if (mode === "company" && !form.company.trim())
      return toast.error("Firmenname ist für Unternehmens-SlangTags erforderlich");

    setSaving(true);
    const tag = await createTag({
      name: check.value,
      audioDataUrl: audio,
      duration,
      region: form.region,
      meaning: form.meaning,
      kind: mode === "community" ? "community" : "creator",
      ownerType: mode === "community" ? "user" : mode === "creator" ? "creator" : "company",
      company: mode === "company" ? form.company.trim() : "",
      sponsored: mode === "company" && sponsored,
      logoUrl: mode === "company" ? form.logoUrl.trim() || null : null,
      description: mode === "company" ? form.description : "",
      ctaType: mode === "company" ? ctaType : null,
      ctaUrl: mode === "company" ? form.ctaUrl.trim() || null : null,
      discountCode: mode === "company" ? form.discountCode : "",
      voucher: mode === "company" ? form.voucher : "",
      location: mode === "company" ? form.location : "",
      openingHours: mode === "company" ? form.openingHours : "",
      phone: mode === "company" ? form.phone : "",
      companyUrl: mode === "company" ? form.companyUrl.trim() : "",
    });
    setSaving(false);
    if (!tag) return toast.error("SlangTag konnte nicht erstellt werden");
    toast.success("SlangTag erstellt");
    resetRecording();
    setUploaded(null);
    setForm({
      name: "",
      region: "",
      meaning: "",
      company: "",
      logoUrl: "",
      description: "",
      ctaUrl: "",
      discountCode: "",
      voucher: "",
      location: "",
      openingHours: "",
      phone: "",
      companyUrl: "",
    });
    onCreated?.();
  };

  return (
    <AdminPanel className="mb-3">
      <p className="text-xs font-bold text-foreground">SlangTag anlegen (Testmodus)</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <AdminSelect
          value={mode}
          onChange={(v: Mode) => {
            setMode(v);
            if (v !== "company") setSponsored(false);
          }}
          options={MODES}
        />
        {mode === "company" && (
          <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={sponsored}
              onChange={(e) => setSponsored(e.target.checked)}
              className="accent-brand"
            />
            📢 Gesponsert
          </label>
        )}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <AdminInput value={form.name} onChange={set("name")} placeholder="Name (ohne $)" />
        <AdminInput value={form.region} onChange={set("region")} placeholder="Region" />
        <AdminInput
          value={form.meaning}
          onChange={set("meaning")}
          placeholder="Bedeutung"
          className="sm:col-span-2"
        />
      </div>

      {mode === "company" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <AdminInput value={form.company} onChange={set("company")} placeholder="Firmenname" />
          <AdminInput value={form.logoUrl} onChange={set("logoUrl")} placeholder="Logo-URL" />
          <AdminInput
            value={form.description}
            onChange={set("description")}
            placeholder="Beschreibung"
            className="sm:col-span-2"
          />
          <AdminSelect value={ctaType} onChange={setCtaType} options={CTA_OPTIONS} />
          <AdminInput value={form.ctaUrl} onChange={set("ctaUrl")} placeholder="CTA-Link" />
          <AdminInput
            value={form.companyUrl}
            onChange={set("companyUrl")}
            placeholder="Link zur Unternehmensseite"
          />
          <AdminInput
            value={form.discountCode}
            onChange={set("discountCode")}
            placeholder="Rabattcode (optional)"
          />
          <AdminInput
            value={form.voucher}
            onChange={set("voucher")}
            placeholder="Gutschein (optional)"
          />
          <AdminInput
            value={form.location}
            onChange={set("location")}
            placeholder="Standort (optional)"
          />
          <AdminInput
            value={form.openingHours}
            onChange={set("openingHours")}
            placeholder="Öffnungszeiten (optional)"
          />
          <AdminInput
            value={form.phone}
            onChange={set("phone")}
            placeholder="Telefonnummer (optional)"
          />
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <AudioSourceSwitch
          mode={source}
          onChange={(next) => {
            if (recording) stop();
            setSource(next);
          }}
          className="w-full sm:w-auto"
        />
        {source === "upload" ? (
          <AudioUploadPicker
            compact
            onReady={(res) => setUploaded({ dataUrl: res.dataUrl, duration: res.duration })}
          />
        ) : recording ? (
          <AdminButton variant="danger" onClick={stop}>
            <Square className="h-3.5 w-3.5" /> Stop {seconds}s
          </AdminButton>
        ) : (
          <AdminButton onClick={() => void start()}>
            <Mic className="h-3.5 w-3.5" /> {audio ? "Neu aufnehmen" : "Audio aufnehmen"}
          </AdminButton>
        )}
        {audio && <span className="text-[11px] text-muted-foreground">Audio {duration}</span>}
        <AdminButton variant="primary" onClick={() => void submit()} disabled={saving}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Erstellen
        </AdminButton>
      </div>
    </AdminPanel>
  );
}
