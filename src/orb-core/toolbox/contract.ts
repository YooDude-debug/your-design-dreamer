/**
 * ORB → Toolbox: reiner Vertrag (browser- und servertauglich).
 *
 * Diese Datei enthält KEINEN Datenbankzugriff, KEINEN Dateizugriff, KEINEN
 * Modellaufruf und KEINE Schreiboperation. Sie definiert ausschliesslich:
 *  · welche Analysen die Toolbox überhaupt kennt,
 *  · die technische Identität einer Analyse (analysis_id, event_id, …),
 *  · die harten Grenzen des ersten Integrationsstandes (READ-ONLY),
 *  · die Form von Befund und Empfehlung.
 *
 * Grundsatz: TOOLBOX = ANALYSE, ORB = AUSFÜHRUNG, MENSCH = FREIGABE.
 * Eine Analyse erzeugt niemals eine Berechtigung, niemals eine Änderung und
 * niemals eine Freigabe. Sie beschreibt nur einen Zustand.
 */

/* ----------------------------------------------------- Harte Grenzen (Riegel) */

/** Der erste Integrationsstand darf ausschliesslich lesen und analysieren. */
export const TOOLBOX_READ_ONLY = true;
export const TOOLBOX_ANALYSIS_ENABLED = true;

/** Alles Schreibende ist im ersten Stand ausdrücklich abgeschaltet. */
export const TOOLBOX_CODE_WRITE_ENABLED = false;
export const TOOLBOX_DB_WRITE_ENABLED = false;
export const TOOLBOX_MIGRATION_ENABLED = false;
export const TOOLBOX_DEPLOYMENT_ENABLED = false;
export const TOOLBOX_APPROVAL_ENABLED = false;
export const TOOLBOX_CONFIG_WRITE_ENABLED = false;
export const TOOLBOX_SECRET_ACCESS_ENABLED = false;

/** Fähigkeiten, die ORB Core behält und die Toolbox NIE selbst nachbildet. */
export const ORB_OWNED_CAPABILITIES = [
  "memory",
  "graph",
  "connections",
  "curiosity",
  "energy",
  "impulse",
  "autonomous_questions",
  "conversation",
  "event_system",
  "request_tracking",
  "model_request_tracking",
] as const;

export type OrbOwnedCapability = (typeof ORB_OWNED_CAPABILITIES)[number];

export type ToolboxOperation =
  | "code_write"
  | "db_write"
  | "migration"
  | "deployment"
  | "approval"
  | "config_write"
  | "secret_access";

export type ToolboxOperationCheck = { allowed: false; reason: string };

/**
 * Jede schreibende Operation der Toolbox ist im ersten Stand verboten.
 * Die Funktion existiert, damit eine Ablehnung nachvollziehbar dokumentiert
 * wird statt still zu verschwinden.
 */
export function checkToolboxOperationAllowed(operation: ToolboxOperation): ToolboxOperationCheck {
  const reasons: Record<ToolboxOperation, string> = {
    code_write: "Die Toolbox darf keinen Code verändern (TOOLBOX_CODE_WRITE_ENABLED = false).",
    db_write:
      "Die Toolbox darf keine ORB-Daten verändern (TOOLBOX_DB_WRITE_ENABLED = false). " +
      "Schreibende ORB-Vorgänge laufen ausschliesslich über ORB Core.",
    migration: "Die Toolbox darf keine Migration ausführen (TOOLBOX_MIGRATION_ENABLED = false).",
    deployment: "Die Toolbox darf kein Deployment auslösen (TOOLBOX_DEPLOYMENT_ENABLED = false).",
    approval:
      "Die Toolbox darf keine Freigabe erteilen (TOOLBOX_APPROVAL_ENABLED = false). " +
      "Freigaben erteilt ausschliesslich ein Administrator im Admin-Bereich.",
    config_write:
      "Die Toolbox darf keine Konfiguration, keine Schwelle, keinen Prompt und kein Modell ändern " +
      "(TOOLBOX_CONFIG_WRITE_ENABLED = false).",
    secret_access:
      "Die Toolbox erhält keine Zugangsschlüssel (TOOLBOX_SECRET_ACCESS_ENABLED = false).",
  };
  return { allowed: false, reason: reasons[operation] };
}

/** Eine Analyse begründet nie ein Recht – auch nicht die eigene Empfehlung. */
export function analysisGrantsAuthority(): false {
  return false;
}

/* ----------------------------------------------------------- Analysearten */

/**
 * Nur Analysen mit vorhandener, reproduzierbarer, lesender Grundlage.
 * `system_logs` und `request_structure` sind bewusst als „bekannt, aber nicht
 * unterstützt“ geführt: dafür existiert heute keine lesbare Schnittstelle.
 */
export const TOOLBOX_ANALYSIS_TYPES = [
  "memory_recall",
  "repair_pipeline_state",
  "system_logs",
  "request_structure",
] as const;

export type ToolboxAnalysisType = (typeof TOOLBOX_ANALYSIS_TYPES)[number];

/** Analysearten, die über eine bereits vorhandene Schnittstelle laufen. */
export const SUPPORTED_TOOLBOX_ANALYSIS_TYPES: readonly ToolboxAnalysisType[] = [
  "memory_recall",
  "repair_pipeline_state",
];

export function isSupportedAnalysisType(type: ToolboxAnalysisType): boolean {
  return SUPPORTED_TOOLBOX_ANALYSIS_TYPES.includes(type);
}

/** Begründung, warum eine bekannte Analyseart heute nicht ausführbar ist. */
export const UNSUPPORTED_ANALYSIS_REASON: Record<string, string> = {
  system_logs:
    "Die Protokollzeilen der Beobachtungsschicht stehen nur als Laufzeitausgabe zur Verfügung; " +
    "es existiert keine lesbare Abfrageschnittstelle. Nicht implementiert, nur dokumentiert.",
  request_structure:
    "Die Request-/Ereigniszählung aus P3/P4 entsteht als Protokollzeile, nicht als abfragbare " +
    "Ablage. Ohne vorhandene Leseschnittstelle keine Analyse. Nicht implementiert, nur dokumentiert.",
};

/* --------------------------------------------------- Technische Identität */

export const TOOLBOX_ANALYSIS_ID_RE = /^ORB-TBX-[0-9A-Z]{8}$/;

export function formatAnalysisId(token: string): string {
  const clean = token
    .replace(/[^0-9a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 8);
  const id = `ORB-TBX-${clean.padEnd(8, "0")}`;
  if (!TOOLBOX_ANALYSIS_ID_RE.test(id)) throw new Error("Ungültige Toolbox-Analyse-ID");
  return id;
}

export function isAnalysisId(value: string): boolean {
  return TOOLBOX_ANALYSIS_ID_RE.test(value);
}

/**
 * Woher kam die Anforderung?
 *  · `admin_ui`, `admin_chat` – ein Administrator im Admin-Bereich,
 *  · `orb_internal` – eine ausdrückliche interne Anforderung aus ORB Core
 *    heraus (P10). Sie ist rein lesend und wird zusätzlich serverseitig gegen
 *    die bestehende Administratorprüfung geführt; sie entsteht niemals
 *    automatisch aus dem normalen Verarbeitungspfad.
 */
export const TOOLBOX_SOURCES = ["admin_ui", "admin_chat", "orb_internal"] as const;

export type ToolboxSource = (typeof TOOLBOX_SOURCES)[number];

/** Feste Quelle der internen ORB-Anforderung (P10). */
export const ORB_INTERNAL_SOURCE = "orb_internal" as const;

/**
 * Quellen, die niemals eine Analyse anfordern dürfen: ORB darf sich nicht
 * selbst diagnostizieren lassen und daraus Änderungen ableiten.
 */
export const FORBIDDEN_TOOLBOX_SOURCES = [
  "orb_autonomous",
  "llm",
  "memory",
  "graph",
  "system_prompt",
] as const;

export const ANALYSIS_STATES = ["COMPLETED", "UNSUPPORTED", "FAILED"] as const;

export type ToolboxAnalysisState = (typeof ANALYSIS_STATES)[number];

/**
 * Anforderung einer Analyse. Ausdrücklich OHNE Chattext, ohne Nachrichteninhalt
 * und ohne personenbezogene Daten: nur technische Kennungen und die Analyseart.
 */
export type ToolboxAnalysisRequest = {
  analysisType: ToolboxAnalysisType;
  source: ToolboxSource;
  /** Technische Ereigniskennung aus der Beobachtungsschicht (evt_…), optional. */
  eventId: string | null;
  /** Technische Modellaufruf-/Request-Kennung (mrq_…), optional. */
  requestId: string | null;
  /** Obergrenze, damit eine hängende Analyse niemanden blockiert. */
  timeoutMs?: number;
};

export type ToolboxFinding = {
  code: string;
  severity: "info" | "warning" | "error";
  summary: string;
  /** Technische Belege: Pfade, Zeilen, Messwerte – keine Inhalte. */
  evidence: string[];
};

export type ToolboxRecommendation = {
  summary: string;
  files: string[];
  /** Immer true: eine Empfehlung wird nie ohne Menschen wirksam. */
  requiresHumanApproval: true;
  /** Immer false: die Toolbox wendet nichts an. */
  applied: false;
  /**
   * Nur ein Hinweis, dass die vorhandene Reparaturstrecke daraus einen
   * Fix-Vorschlag erzeugen könnte. Erzeugt selbst nichts.
   */
  proposalCandidate: boolean;
};

export type ToolboxAnalysisResult = {
  analysisId: string;
  analysisType: ToolboxAnalysisType;
  status: ToolboxAnalysisState;
  source: ToolboxSource;
  eventId: string | null;
  requestId: string | null;
  timestamp: string;
  durationMs: number;
  findings: ToolboxFinding[];
  recommendations: ToolboxRecommendation[];
  /** Technischer Fehlergrund ohne Inhalt (z. B. "timeout", "unavailable"). */
  failureKind: string | null;
  /** Unveränderliche Nachweise des Read-only-Standes. */
  readOnly: true;
  codeChanged: false;
  dbChanged: false;
  proposalCreated: false;
  approvalCreated: false;
  deployed: false;
  /** Die Verdrahtung erzeugt keinen kostenpflichtigen Modellaufruf. */
  modelCalls: 0;
};

/** Was die Toolbox heute kann und was ausdrücklich nicht – für die Anzeige. */
export function toolboxCapabilities(): {
  readOnly: true;
  analysis: readonly ToolboxAnalysisType[];
  supported: readonly ToolboxAnalysisType[];
  forbidden: ToolboxOperation[];
  orbOwned: readonly OrbOwnedCapability[];
} {
  return {
    readOnly: TOOLBOX_READ_ONLY,
    analysis: TOOLBOX_ANALYSIS_TYPES,
    supported: SUPPORTED_TOOLBOX_ANALYSIS_TYPES,
    forbidden: [
      "code_write",
      "db_write",
      "migration",
      "deployment",
      "approval",
      "config_write",
      "secret_access",
    ],
    orbOwned: ORB_OWNED_CAPABILITIES,
  };
}

/* ------------------------------------------- Fähigkeitenverzeichnis (P12) */

/**
 * P12 – Discovery-Lücke: der Analysezugang existierte (P10), war aber nirgends
 * als *benannte, aufzählbare* ORB-Fähigkeit geführt. Es gab im Projekt weder
 * eine Capability-Registry noch eine Capability-ID: die einzige Fähigkeitsliste
 * ist die Objektform von `createOrbCore()` – eine Aufzählung „welche
 * Analysefähigkeit habe ich?" war damit nicht möglich.
 *
 * Genau diese Lücke schliesst der Eintrag unten. Es entsteht KEINE neue
 * Analysefunktion, KEINE zweite Schnittstelle und KEIN neuer Endpunkt: der
 * Eintrag zeigt ausschliesslich auf den bereits vorhandenen internen Zugang.
 * Genau EIN Name, kein zweiter parallel.
 */
export const ORB_ANALYSIS_CAPABILITY_ID = "orb.analysis" as const;

export type OrbCapabilityId = typeof ORB_ANALYSIS_CAPABILITY_ID;

export type OrbCapabilityDescriptor = {
  capabilityId: OrbCapabilityId;
  /** Vorhandener Adapter – nicht neu, nur benannt. */
  adapter: "src/orb-core/toolbox/adapter.server.ts#runToolboxAnalysis";
  /** Interner Server-zu-Server-Aufruf, keine Oberfläche, kein HTTP-Endpunkt. */
  transport: "internal_server_call";
  resolver: "src/orb-core/toolbox/access.server.ts#resolveOrbCapability";
  source: typeof ORB_INTERNAL_SOURCE;
  requiresAdminRole: true;
  readOnly: true;
  requiresHumanApprovalForAnyChange: true;
  analysis: readonly ToolboxAnalysisType[];
  supported: readonly ToolboxAnalysisType[];
};

/** Das vollständige Verzeichnis: heute genau eine Fähigkeit. */
export const ORB_CAPABILITY_REGISTRY: readonly OrbCapabilityDescriptor[] = [
  {
    capabilityId: ORB_ANALYSIS_CAPABILITY_ID,
    adapter: "src/orb-core/toolbox/adapter.server.ts#runToolboxAnalysis",
    transport: "internal_server_call",
    resolver: "src/orb-core/toolbox/access.server.ts#resolveOrbCapability",
    source: ORB_INTERNAL_SOURCE,
    requiresAdminRole: true,
    readOnly: true,
    requiresHumanApprovalForAnyChange: true,
    analysis: TOOLBOX_ANALYSIS_TYPES,
    supported: SUPPORTED_TOOLBOX_ANALYSIS_TYPES,
  },
];

/** Aufzählung aller ORB-Fähigkeiten – rein lesend, ohne Datenbankzugriff. */
export function listOrbCapabilities(): readonly OrbCapabilityDescriptor[] {
  return ORB_CAPABILITY_REGISTRY;
}

/** Nachschlagen einer Fähigkeit über ihre eindeutige ID. */
export function findOrbCapability(capabilityId: string): OrbCapabilityDescriptor | null {
  return ORB_CAPABILITY_REGISTRY.find((c) => c.capabilityId === capabilityId) ?? null;
}
