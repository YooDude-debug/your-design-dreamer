/**
 * Serverseitige KI-Moderation für Text- und Bildinhalte.
 *
 * Grundsätze:
 * - Läuft ausschließlich auf dem Server (kein Bypass über das Frontend möglich).
 * - Text und Bild werden getrennt geprüft und danach zusammengeführt.
 * - Bilder werden von zwei unabhängigen Modellen bewertet; jeder Treffer zählt.
 * - Antworten werden vollständig ausgewertet (alle Kategorien, Konfidenz,
 *   Schweregrad, Krisenhinweis). Fehlt eine Antwort, wird nicht freigegeben.
 */
import {
  MODERATION_MESSAGES,
  MODERATION_THRESHOLDS,
  POLICY_IDS,
  ZERO_TOLERANCE_IDS,
  policyPromptBlock,
  severityOf,
  thresholdsFor,
  tolerancePromptBlock,
  type ModerationChannel,
  type ContentModerationVerdict,
  type ModerationDecisionKind,
} from "@/lib/moderation-policy";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

/** Textprüfung: strikte JSON-Schema-Ausgabe. */
const TEXT_MODEL = "openai/gpt-5.4-mini";
/** Bildprüfung: zwei unabhängige, bildfähige Modelle. */
const IMAGE_MODEL_PRIMARY = "google/gemini-3.6-flash";
const IMAGE_MODEL_SECONDARY = "openai/gpt-5.4-mini";
/** Audioprüfung (Inhalt, nicht nur Musik). */
export const AUDIO_CONTENT_MODEL = "google/gemini-3.6-flash";

const BASE_RULES_HEAD = `Du bist die Moderations-Instanz einer öffentlichen Social-Media-Plattform (Y-Dude).
Du prüfst nutzergenerierte Inhalte VOR der Veröffentlichung.

Bewertungsregeln:
- Prüfe jede der unten aufgeführten Kategorien einzeln.
- Melde einen Treffer, sobald der Inhalt die Kategorie erfüllt – auch bei Zeichnungen,
  Memes, Comics, KI-generierten Bildern, Kostümen, Tattoos, Graffiti, Bildschirmfotos,
  Texteinblendungen im Bild oder historischem Material.
- Historische, dokumentarische oder "ironische" Rahmung entschuldigt verbotene Symbole NICHT.
- Bewerte auch teilweise sichtbare, gespiegelte, stilisierte oder verfremdete Symbole.
- Erfinde keine Treffer für harmlose Inhalte: Landschaften, Tiere, Haustiere, Essen,
  Architektur, Reisen, Alltag, Familienfotos, Selfies, Kunst ohne verbotene Inhalte,
  Sport, Autos, Mode, Musikinstrumente und Ähnliches sind erlaubt.
- Alltagssprache, Slang, Dialekte, regionale Aussprache, Flüche und derbe Witze ohne Zielgruppe sind erlaubt.
- Stimmeigenschaften sind NIEMALS ein Verstoß: hohe, kindliche, tiefe, verzerrte, laute,
  flüsternde oder ungewöhnlich klingende Stimmen. Auch Kinder- und Jugendstimmen dürfen
  sprechen, lachen, rufen oder Unsinn erzählen.
- Das Alter der sprechenden Person ist kein Bewertungskriterium. minor_safety gilt nur
  bei sexualisierten Inhalten, Grooming, Kontaktaufnahme mit sexueller Absicht oder
  konkreter Gefährdung von Kindern – nicht allein, weil eine Kinderstimme zu hören ist.
- Bewerte ausschließlich den tatsächlichen Inhalt (gesagte Worte, gezeigte Motive),
  nicht die Person, die Stimme, das Alter, den Akzent oder die Aufnahmequalität.


Kategorien:
${policyPromptBlock()}

Gib für jeden Treffer die Kategorie-ID, eine Konfidenz (0-1) und eine kurze Begründung an.
Setze crisis=true bei Anzeichen akuter Selbstgefährdung.
Setze uncertain=true, wenn du den Inhalt nicht sicher bewerten kannst.`;

/**
 * Vollständige Systemregeln für einen Kanal.
 *
 * Die Kategorien bleiben unverändert; ergänzt werden die Toleranzregeln der
 * offenen Beta (Fehlalarme vermeiden, im Zweifel `uncertain=true`).
 */
function baseRules(channel: ModerationChannel = "text"): string {
  return `${BASE_RULES_HEAD}\n\n${tolerancePromptBlock(channel)}`;
}

type Finding = { category: string; confidence: number };

type RawVerdict = {
  findings: Finding[];
  crisis: boolean;
  uncertain: boolean;
  reason: string;
  ok: boolean;
  source: string;
};

const EMPTY_VERDICT = (source: string): RawVerdict => ({
  findings: [],
  crisis: false,
  uncertain: true,
  reason: "",
  ok: false,
  source,
});

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  return key;
}

function parseJson(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["category", "confidence"],
      },
    },
    crisis: { type: "boolean" },
    uncertain: { type: "boolean" },
    reason: { type: "string" },
  },
  required: ["findings", "crisis", "uncertain", "reason"],
} as const;

const JSON_HINT =
  'Antworte ausschließlich als JSON: {"findings":[{"category":"<id>","confidence":0-1}],' +
  '"crisis":boolean,"uncertain":boolean,"reason":"kurze Begründung"}. ' +
  'Ohne Treffer: {"findings":[],"crisis":false,"uncertain":false,"reason":"unbedenklich"}.';

/** Wertet eine Modellantwort vollständig aus (alle Kategorien, Konfidenzen). */
function readVerdict(raw: Record<string, unknown>, source: string): RawVerdict {
  const allowed = new Set(POLICY_IDS);
  const findings: Finding[] = [];
  const list = Array.isArray(raw.findings) ? raw.findings : [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const category = String(rec.category ?? "").trim();
    if (!allowed.has(category)) continue;
    const confidence = Math.max(0, Math.min(1, Number(rec.confidence) || 0));
    findings.push({ category, confidence: confidence || 0.5 });
  }
  // Manche Modelle liefern zusätzlich eine flache Kategorienliste.
  if (Array.isArray(raw.categories)) {
    for (const c of raw.categories as unknown[]) {
      const id = String(c ?? "").trim();
      if (allowed.has(id) && !findings.some((f) => f.category === id)) {
        findings.push({ category: id, confidence: 0.5 });
      }
    }
  }
  return {
    findings,
    crisis: Boolean(raw.crisis),
    uncertain: Boolean(raw.uncertain),
    reason: typeof raw.reason === "string" ? raw.reason : "",
    ok: true,
    source,
  };
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** Ein Moderationsaufruf gegen das AI-Gateway. */
async function askModel(
  model: string,
  parts: ContentPart[],
  opts: { strictSchema: boolean; channel?: ModerationChannel },
): Promise<RawVerdict> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: `${baseRules(opts.channel)}\n\n${JSON_HINT}` },
      { role: "user", content: parts },
    ],
  };
  if (opts.strictSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "moderation_verdict", strict: true, schema: VERDICT_SCHEMA },
    };
  }

  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${model} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "";
  const parsed = parseJson(content);
  if (Object.keys(parsed).length === 0) return EMPTY_VERDICT(model);
  return readVerdict(parsed, model);
}

/* ------------------------------------------------------------ Entscheidung */

export type ModerationAnalysis = ContentModerationVerdict & {
  /** Rohantworten aller Prüfungen (für das Admin-Cockpit). */
  raw: Record<string, unknown>;
};

/**
 * Führt beliebig viele Modellantworten zu einer Entscheidung zusammen.
 * Jeder Treffer wird berücksichtigt; die höchste Konfidenz pro Kategorie zählt.
 */
export function decide(
  verdicts: RawVerdict[],
  extra?: {
    hardBlock?: string[];
    /**
     * Kategorien, die nur zählen, wenn mindestens eine der genannten
     * Kategorien ebenfalls getroffen wurde. Verhindert Fehlalarme, z. B.
     * `minor_safety` allein aufgrund einer Kinder- oder hohen Stimme.
     */
    requireCorroboration?: { category: string; withAnyOf: string[] }[];
    /** Kanal bestimmt die Sperrschwellen (Audio ist am tolerantesten). */
    channel?: ModerationChannel;
  },
): ModerationAnalysis {
  const best = new Map<string, number>();
  for (const v of verdicts) {
    for (const f of v.findings) {
      best.set(f.category, Math.max(best.get(f.category) ?? 0, f.confidence));
    }
  }
  for (const rule of extra?.requireCorroboration ?? []) {
    if (!best.has(rule.category)) continue;
    if (!rule.withAnyOf.some((id) => best.has(id))) best.delete(rule.category);
  }
  for (const id of extra?.hardBlock ?? []) best.set(id, 1);

  const answered = verdicts.filter((v) => v.ok);
  const uncertain = answered.length === 0 || answered.some((v) => v.uncertain);
  const limits = thresholdsFor(extra?.channel ?? "text");
  const crisis =
    verdicts.some((v) => v.crisis) || (best.get("suicide") ?? 0) >= MODERATION_THRESHOLDS.hold;

  let decision: ModerationDecisionKind = "allow";
  let confidence = 0;
  const labels: string[] = [];
  const flags: string[] = [];
  const reasons: string[] = [];

  for (const [category, conf] of best) {
    const severity = severityOf(category);
    if (!severity) continue;
    labels.push(category);
    if (severity === "flagged") {
      flags.push(category);
      if (decision === "allow") decision = "allow"; // Markierung blockiert nicht
      confidence = Math.max(confidence, conf);
      continue;
    }
    // Sperren nur bei hoher Konfidenz ("eindeutiger Verstoß"). Alles darunter
    // ist entweder unbedenklich oder ein Fall für die manuelle Prüfung.
    const blockAt = ZERO_TOLERANCE_IDS.includes(category)
      ? limits.zeroTolerance
      : limits.block;
    if (conf >= blockAt) {
      decision = "block";
      confidence = Math.max(confidence, conf);
    } else if (conf >= limits.hold && decision !== "block") {
      decision = "review";
      confidence = Math.max(confidence, conf);
    }
  }

  for (const v of verdicts) if (v.reason) reasons.push(`${v.source}: ${v.reason}`);

  // Keine belastbare Antwort → nicht veröffentlichen, sondern manuell prüfen.
  if (decision === "allow" && (answered.length === 0 || (uncertain && labels.length > 0))) {
    decision = "review";
    labels.push("analysis_uncertain");
  }
  if (answered.length === 0) labels.push("analysis_failed");

  const message =
    decision === "block"
      ? MODERATION_MESSAGES.blocked
      : decision === "review"
        ? MODERATION_MESSAGES.review
        : "";

  return {
    decision,
    labels: Array.from(new Set(labels)),
    flags: Array.from(new Set(flags)),
    confidence,
    reason: reasons.join(" | ").slice(0, 2000),
    crisis,
    message,
    raw: {
      verdicts: verdicts.map((v) => ({
        source: v.source,
        ok: v.ok,
        uncertain: v.uncertain,
        crisis: v.crisis,
        reason: v.reason,
        findings: v.findings,
      })),
      checkedAt: new Date().toISOString(),
    },
  };
}

/* ------------------------------------------------------------------- Text */

/** Prüft Freitext (Titel, Beschreibung, Hashtags, Transkript, Namen). */
export async function moderateText(fields: Record<string, string>): Promise<ModerationAnalysis> {
  const text = Object.entries(fields)
    .filter(([, v]) => (v ?? "").trim().length > 0)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
    .slice(0, 6000);

  if (!text.trim()) {
    return decide([{ ...EMPTY_VERDICT("text:empty"), ok: true, uncertain: false }]);
  }

  const verdicts: RawVerdict[] = [];
  try {
    verdicts.push(
      await askModel(
        TEXT_MODEL,
        [{ type: "text", text: `Prüfe diesen nutzergenerierten Text:\n"""${text}"""` }],
        { strictSchema: true, channel: "text" },
      ),
    );
  } catch (e) {
    console.error("[moderation] text check failed", e);
    verdicts.push({ ...EMPTY_VERDICT(TEXT_MODEL), reason: String(e) });
  }
  return decide(verdicts, { channel: "text" });
}

/* ------------------------------------------------------------------ Bild */

function imageMime(path: string): string {
  const ext = (path.split(".").pop() ?? "").toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] ?? "image/jpeg";
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * Prüft ein Bild mit zwei unabhängigen Modellen. Ein Treffer eines Modells
 * genügt – so werden Symbole erkannt, die ein einzelnes Modell übersieht.
 */
export async function moderateImageBytes(
  bytes: Uint8Array,
  path: string,
  context?: string,
  /** "video" für Standbilder eines SlangShots (gleiche Toleranzregeln). */
  channel: Extract<ModerationChannel, "image" | "video"> = "image",
): Promise<ModerationAnalysis> {
  const dataUrl = `data:${imageMime(path)};base64,${toBase64(bytes)}`;
  const prompt =
    "Prüfe dieses hochgeladene Bild vollständig: Motiv, Personen, Symbole, Flaggen, " +
    "Tattoos, Kleidung, Hintergrund, Poster und jeden im Bild sichtbaren Text. " +
    "Benenne alle einschlägigen Kategorien." +
    (context ? `\nBegleittext des Beitrags: """${context.slice(0, 1500)}"""` : "");

  const parts: ContentPart[] = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: dataUrl } },
  ];

  const results = await Promise.allSettled([
    askModel(IMAGE_MODEL_PRIMARY, parts, { strictSchema: false, channel }),
    askModel(IMAGE_MODEL_SECONDARY, parts, { strictSchema: true, channel }),
  ]);

  const verdicts: RawVerdict[] = results.map((r, i) => {
    const model = i === 0 ? IMAGE_MODEL_PRIMARY : IMAGE_MODEL_SECONDARY;
    if (r.status === "fulfilled") return r.value;
    console.error("[moderation] image check failed", model, r.reason);
    return { ...EMPTY_VERDICT(model), reason: String(r.reason) };
  });

  // Auch im Bild/Video zählt `minor_safety` nur mit belastbarem sexuellem oder
  // gefährdendem Kontext – Familien-, Strand- und Sportbilder sind erlaubt.
  return decide(verdicts, {
    channel,
    requireCorroboration: [
      {
        category: "minor_safety",
        withAnyOf: ["sexual_content", "non_consensual_sexual", "harassment", "crime_incitement"],
      },
    ],
  });
}

/** Prüft Audioinhalte inhaltlich (zusätzlich zur Musikerkennung). */
export async function moderateAudioBytes(
  bytes: Uint8Array,
  format: string,
): Promise<ModerationAnalysis> {
  const parts = [
    {
      type: "text",
      text:
        "Prüfe diese kurze Sprachaufnahme ausschließlich inhaltlich: was wird gesagt " +
        "(Worte, Parolen, Drohungen, Sprechchöre) und welche eindeutigen Geräusche " +
        "sind zu hören (z. B. Schüsse). " +
        "Wichtig: Klang, Tonhöhe, Alter, Geschlecht, Dialekt, Akzent, Lautstärke und " +
        "Aufnahmequalität der Stimme sind KEIN Bewertungskriterium. Eine hohe oder " +
        "kindliche Stimme ist kein Verstoß und darf niemals gemeldet werden. " +
        "Wenn du die Worte nicht verstehst, setze uncertain=true und melde keinen Treffer.",
    },
    {
      type: "input_audio",
      input_audio: { data: toBase64(bytes), format },
    },
  ];
  try {
    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AUDIO_CONTENT_MODEL,
        messages: [
          { role: "system", content: `${baseRules("audio")}\n\n${JSON_HINT}` },
          { role: "user", content: parts },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(
        `${AUDIO_CONTENT_MODEL} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`,
      );
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = parseJson(json.choices?.[0]?.message?.content ?? "");
    const verdict =
      Object.keys(parsed).length === 0
        ? EMPTY_VERDICT(AUDIO_CONTENT_MODEL)
        : readVerdict(parsed, AUDIO_CONTENT_MODEL);
    // Eine Kinder-/hohe Stimme allein darf nicht sperren: `minor_safety` zählt
    // nur mit belastbarem sexuellem oder gefährdendem Kontext im Gesagten.
    return decide([verdict], {
      channel: "audio",
      requireCorroboration: [
        {
          category: "minor_safety",
          withAnyOf: ["sexual_content", "non_consensual_sexual", "harassment", "crime_incitement"],
        },
      ],
    });
  } catch (e) {
    console.error("[moderation] audio content check failed", e);
    return decide([{ ...EMPTY_VERDICT(AUDIO_CONTENT_MODEL), reason: String(e) }], {
      channel: "audio",
    });
  }
}

/** Führt mehrere Teilprüfungen (Text, Bild, Audio) zu einem Ergebnis zusammen. */
export function mergeAnalyses(parts: Record<string, ModerationAnalysis>): ModerationAnalysis {
  const order: ModerationDecisionKind[] = ["allow", "review", "block"];
  let decision: ModerationDecisionKind = "allow";
  const labels = new Set<string>();
  const flags = new Set<string>();
  let confidence = 0;
  let crisis = false;
  const reasons: string[] = [];
  const raw: Record<string, unknown> = {};

  for (const [key, part] of Object.entries(parts)) {
    if (order.indexOf(part.decision) > order.indexOf(decision)) decision = part.decision;
    part.labels.forEach((l) => labels.add(l));
    part.flags.forEach((f) => flags.add(f));
    confidence = Math.max(confidence, part.confidence);
    crisis = crisis || part.crisis;
    if (part.reason) reasons.push(`[${key}] ${part.reason}`);
    raw[key] = part.raw;
  }

  return {
    decision,
    labels: Array.from(labels),
    flags: Array.from(flags),
    confidence,
    crisis,
    reason: reasons.join(" | ").slice(0, 4000),
    message:
      decision === "block"
        ? MODERATION_MESSAGES.blocked
        : decision === "review"
          ? MODERATION_MESSAGES.review
          : "",
    raw,
  };
}
