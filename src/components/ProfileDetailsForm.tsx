import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useState } from "react";
import { Save, X, Eye, Globe, Users, Lock } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang-context";
import { useData } from "@/lib/data-context";
import { supabase } from "@/integrations/supabase/client";
import { profileTexts, FIELD_LABEL_KEY } from "@/lib/i18n-profile";
import {
  PROFILE_FIELDS,
  FIELD_VISIBILITIES,
  loadProfileDetails,
  saveProfileDetails,
  visibilityOf,
  asList,
  asText,
  type FieldVisibility,
  type ProfileFieldGroup,
  type ProfileFieldKey,
  type ProfileFieldSpec,
} from "@/lib/profile-extra";

/**
 * Einstellungen → Profil: erweiterte Profilfelder mit Sichtbarkeit je Feld.
 * Mobile First: eine Spalte, ab `sm` zwei Spalten.
 */

const VIS_ICON: Record<FieldVisibility, typeof Globe> = {
  public: Globe,
  followers: Users,
  private: Lock,
};

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

function VisibilityPicker({
  value,
  onChange,
  labels,
  title,
}: {
  value: FieldVisibility;
  onChange: (v: FieldVisibility) => void;
  labels: Record<FieldVisibility, string>;
  title: string;
}) {
  return (
    <div className="mt-1 flex items-center gap-1" role="group" aria-label={title}>
      {FIELD_VISIBILITIES.map((v) => {
        const Icon = VIS_ICON[v];
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            title={labels[v]}
            aria-pressed={active}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
              active
                ? "border-brand text-brand"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{labels[v]}</span>
          </button>
        );
      })}
    </div>
  );
}

function TagsInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const parts = raw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...values];
    for (const part of parts) {
      if (!next.some((v) => v.toLowerCase() === part.toLowerCase()) && next.length < 20) {
        next.push(part.slice(0, 40));
      }
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div className={`mt-1 ${field} flex flex-wrap items-center gap-1.5 py-1.5`}>
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-xs text-brand"
        >
          {v}
          <CloseButton onClick={() => onChange(values.filter((x) => x !== v))} label={`${v} entfernen`} />
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={values.length === 0 ? placeholder : ""}
        className="min-w-[8ch] flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

export function ProfileDetailsForm({ onClose }: { onClose: () => void }) {
  const { lang, t } = useLang();
  const p = profileTexts[lang];
  const { me } = useData();

  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [vis, setVis] = useState<Partial<Record<ProfileFieldKey, FieldVisibility>>>({});
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [likesPrivate, setLikesPrivate] = useState(false);

  /** Like-Privatsphäre laden/speichern (eigenes Profil, RLS-geschützt). */
  useEffect(() => {
    if (!me) return;
    let alive = true;
    void supabase
      .from("profiles")
      .select("likes_private")
      .eq("id", me.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setLikesPrivate(Boolean(data?.likes_private));
      });
    return () => {
      alive = false;
    };
  }, [me]);

  const setLikesPrivateFlag = async (next: boolean) => {
    if (!me) return;
    setLikesPrivate(next);
    const { error } = await supabase
      .from("profiles")
      .update({ likes_private: next })
      .eq("id", me.id);
    if (error) {
      setLikesPrivate(!next);
      toast.error(p.detailsSaveFailed);
    }
  };

  useEffect(() => {
    if (!me) return;
    let alive = true;
    void loadProfileDetails([me.id]).then((map) => {
      if (!alive) return;
      const d = map[me.id] ?? {};
      const nextValues: Record<string, string | string[]> = {};
      const nextVis: Partial<Record<ProfileFieldKey, FieldVisibility>> = {};
      for (const spec of PROFILE_FIELDS) {
        nextValues[spec.key] = spec.kind === "tags" ? asList(d[spec.key]) : asText(d[spec.key]);
        nextVis[spec.key] = visibilityOf(d, spec.key);
      }
      setValues(nextValues);
      setVis(nextVis);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [me]);

  const save = async () => {
    if (!me) return;
    setSaving(true);
    try {
      await saveProfileDetails(me.id, values, vis);
      toast.success(p.detailsSaved);
      onClose();
    } catch {
      toast.error(p.detailsSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  const visLabels: Record<FieldVisibility, string> = {
    public: p.visPublic,
    followers: p.visFollowers,
    private: p.visPrivate,
  };

  const groups: { key: ProfileFieldGroup; label: string }[] = [
    { key: "personal", label: p.groupPersonal },
    { key: "interests", label: p.groupInterests },
    { key: "social", label: p.groupSocial },
  ];

  const renderField = (spec: ProfileFieldSpec) => {
    const label = p[FIELD_LABEL_KEY[spec.key]];
    // Feste Registrierungsdaten: nur Anzeige, keine Sichtbarkeitswahl.
    if (spec.locked) {
      return (
        <div key={spec.key} className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <input
            type={spec.kind === "date" ? "date" : "text"}
            readOnly
            disabled
            className={`mt-1 opacity-60 ${field}`}
            value={asText(values[spec.key])}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Registrierungsdaten – nicht änderbar und immer privat.
          </p>
        </div>
      );
    }
    return (
      <div key={spec.key} className="min-w-0">
        <div className="text-xs text-muted-foreground">
          {label} <span className="opacity-60">({p.optional})</span>
        </div>
        {spec.kind === "tags" ? (
          <TagsInput
            values={asList(values[spec.key])}
            onChange={(v) => setValues((s) => ({ ...s, [spec.key]: v }))}
            placeholder={p.tagsHint}
          />
        ) : (
          <input
            type={spec.kind === "date" ? "date" : spec.kind === "url" ? "url" : "text"}
            inputMode={spec.kind === "url" ? "url" : "text"}
            maxLength={spec.max}
            className={`mt-1 ${field}`}
            value={asText(values[spec.key])}
            onChange={(e) => setValues((s) => ({ ...s, [spec.key]: e.target.value }))}
          />
        )}
        <VisibilityPicker
          value={vis[spec.key] ?? spec.defaultVisibility}
          onChange={(v) => setVis((s) => ({ ...s, [spec.key]: v }))}
          labels={visLabels}
          title={p.visHint}
        />
      </div>
    );
  };

  if (!ready) {
    return <p className="mt-5 text-sm text-muted-foreground">{t.loading}</p>;
  }

  return (
    <div className="mt-5 space-y-6">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="text-sm font-bold">{g.label}</h3>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PROFILE_FIELDS.filter((f) => f.group === g.key).map(renderField)}
          </div>
        </section>
      ))}

      <section>
        <h3 className="text-sm font-bold">Likes</h3>
        <label className="mt-2 flex items-start gap-3 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={likesPrivate}
            onChange={(e) => void setLikesPrivateFlag(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand"
          />
          <span>
            Like-Privatsphäre aktivieren – mein Benutzername wird in Like-Listen anonymisiert
            (z.&nbsp;B. Ma*****).
          </span>
        </label>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {me && (
          <a
            href={`/profile/${me.username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:border-brand/60 hover:text-brand"
          >
            <Eye className="h-3.5 w-3.5" /> {p.showPreview}
          </a>
        )}
        <div className="ml-auto flex items-center gap-3">
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
            <Save className="h-4 w-4" /> {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
