/**
 * Bedeutung eines SlangTags – auf Namensebene, nicht pro Audio-Variante.
 *
 * Datenfluss: SlangTag (`normalized_name`) → `slang_definitions` → Globe Vote →
 * Gewinner-Variante → Slang Globe. Der Globe-Eintrag löst die Bedeutung immer
 * über die SlangTag-ID auf (`slang_tag_definitions`), es wird nichts dupliziert.
 * Übersetzungen liegen in `slang_definition_translations` (pro Sprache).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SlangDefinition = {
  /** Stabile ID der Bedeutung (Namensebene). */
  definitionId: string;
  normalizedName: string;
  meaning: string;
  example: string;
  /** Sprache der ausgelieferten Bedeutung (Übersetzung oder Quellsprache). */
  lang: string;
  sourceLanguage: string;
  region: string;
};

/** Bedeutung je SlangTag-ID. */
export type SlangDefinitionMap = Record<string, SlangDefinition>;

/**
 * Lädt die Bedeutungen für die angegebenen SlangTag-IDs – optional in der
 * Sprache des Nutzers (Fallback: Quellsprache).
 */
export function useSlangDefinitions(tagIds: string[], lang?: string) {
  const idKey = useMemo(() => [...tagIds].sort().join(","), [tagIds]);
  const [definitions, setDefinitions] = useState<SlangDefinitionMap>({});

  const load = useCallback(async () => {
    const ids = idKey ? idKey.split(",") : [];
    if (ids.length === 0) {
      setDefinitions({});
      return;
    }
    const { data } = await supabase.rpc("slang_tag_definitions", {
      _tag_ids: ids,
      ...(lang ? { _lang: lang } : {}),
    });

    const next: SlangDefinitionMap = {};
    for (const row of data ?? []) {
      if (!row.tag_id || !row.definition_id) continue;
      next[row.tag_id] = {
        definitionId: row.definition_id,
        normalizedName: row.normalized_name ?? "",
        meaning: row.meaning ?? "",
        example: row.example ?? "",
        lang: row.lang ?? "",
        sourceLanguage: row.source_language ?? "",
        region: row.region ?? "",
      };
    }
    setDefinitions(next);
  }, [idKey, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Speichert Bedeutung + Beispielsatz für den SlangTag-Namen der Variante. */
  const saveDefinition = useCallback(
    async (tagId: string, meaning: string, example: string) => {
      const { error } = await supabase.rpc("upsert_slang_definition", {
        _tag_id: tagId,
        _meaning: meaning,
        _example: example,
      });
      if (error) throw error;
      await load();
    },
    [load],
  );

  return { definitions, saveDefinition, reload: load };
}
