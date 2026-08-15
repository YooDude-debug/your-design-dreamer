import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";
import type { SlangDefinition } from "@/lib/slang-definitions";

/**
 * Bedeutung eines SlangTag-Namens (nicht der einzelnen Audio-Variante).
 * Gespeichert wird über `upsert_slang_definition` auf `normalized_name`.
 */
export function GlobeVoteMeaning({
  definition,
  canEdit,
  onSave,
}: {
  definition: SlangDefinition | null;
  canEdit: boolean;
  onSave: (meaning: string, example: string) => Promise<void>;
}) {
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const [editing, setEditing] = useState(false);
  const [meaning, setMeaning] = useState(definition?.meaning ?? "");
  const [example, setExample] = useState(definition?.example ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) return;
    setMeaning(definition?.meaning ?? "");
    setExample(definition?.example ?? "");
  }, [definition?.meaning, definition?.example, editing]);

  const hasMeaning = Boolean(definition?.meaning);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(meaning.trim(), example.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {editing ? (
        <div className="mt-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
              {at.meaningSectionTitle}
            </p>
          </div>
          <textarea
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            rows={2}
            placeholder={at.meaningPlaceholder}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-brand/60"
          />
          <input
            value={example}
            onChange={(e) => setExample(e.target.value)}
            placeholder={at.examplePlaceholder}
            aria-label={at.exampleLabel}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-brand/60"
          />
          <p className="text-[9px] text-muted-foreground">{at.meaningHint}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="tap-safe rounded-full border border-brand/50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand disabled:opacity-50"
            >
              {at.meaningSaveBtn}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
              className="tap-safe rounded-full border border-border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground disabled:opacity-50"
            >
              {at.meaningCancelBtn}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <p className="text-[10px]">
                {hasMeaning ? (
                  definition!.meaning
                ) : (
                  <span className="text-muted-foreground">{at.meaningMissing}</span>
                )}
              </p>
              {definition?.example && (
                <p className="text-[10px] italic text-muted-foreground">„{definition.example}“</p>
              )}
              {!canEdit && !hasMeaning && (
                <p className="text-[9px] text-muted-foreground">{at.meaningOwnerOnlyHint}</p>
              )}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="tap-safe inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground hover:border-brand/50 hover:text-brand"
              >
                <Pencil className="h-3 w-3" />
                {hasMeaning ? at.meaningEditBtn : at.meaningAddBtn}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );


}
