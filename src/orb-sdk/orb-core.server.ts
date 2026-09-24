/**
 * ORB SDK – serverseitige Fähigkeiten (stabile API-Grenze).
 *
 * Diese Datei ist die einzige erlaubte Tür in den geschützten ORB Core. Sie
 * enthält KEINE eigene Logik: jede Fähigkeit reicht den Aufruf unverändert an
 * die bestehende Umsetzung unter `src/orb-core/` weiter. Damit bleibt das
 * Verhalten identisch und es existiert weiterhin genau eine Umsetzung.
 *
 * Persistenz: es wird ausschliesslich die vorhandene ORB-Datenhaltung benutzt
 * (orb_nodes, orb_connections, orb_state, orb_messages, orb_metrics,
 * orb_interests, orb_suggestions, orb_questions, orb_threads, orb_style). Der
 * Zugriff erfolgt über den übergebenen, angemeldeten Datenzugang – niemals mit
 * Dienstschlüsseln und niemals aus dem Browser.
 */

import type { DB } from "@/orb-core/engine.server";
import type { OrbImageAttachment } from "@/lib/orb-attachments";

/** Kontrollierter Datenzugang: der angemeldete Supabase-Client des Benutzers. */
export type OrbDataSource = DB;

/** Sitzung eines angemeldeten Benutzers gegen den ORB Core. */
export type OrbSession = { data: OrbDataSource; userId: string };

/**
 * Fähigkeiten des ORB Core. Namen beschreiben Fähigkeiten, nicht Verfahren;
 * interne Gewichtungen, Schwellen und Heuristiken bleiben verborgen.
 */
export function createOrbCore(session: OrbSession) {
  const { data: db, userId } = session;
  return {
    /** Zustand, Erinnerungen, Interessen, Threads, Vorschläge, Kennzahlen. */
    async getSnapshot() {
      const core = await import("@/orb-core/engine.server");
      return core.getSnapshot(db, userId);
    },
    /** Eine Erfahrung verarbeiten (Abruf → Entscheidung → Sprache → Lernen). */
    async processInput(
      text: string,
      opts?: {
        source?: "user_stated";
        images?: OrbImageAttachment[];
        replyToOrbMessageId?: string;
      },
    ) {
      const core = await import("@/orb-core/engine.server");
      return core.processInput(db, userId, text, {
        source: opts?.source ?? "user_stated",
        // Bildanhänge sind flüchtiger Anfragekontext der Sprachschicht.
        images: opts?.images ?? [],
        // P5-H: optionale ausdrückliche Reply-Referenz (serverseitig geprüft).
        replyToOrbMessageId: opts?.replyToOrbMessageId,
      });
    },
    /** Ausdrückliches Lernereignis mit hoher Wichtigkeit. */
    async learn(lesson: string) {
      const core = await import("@/orb-core/engine.server");
      return core.recordLearning(db, userId, lesson);
    },
    /** Rückmeldung zu einer Erinnerung (verstärken oder abschwächen). */
    async recordFeedback(input: { nodeId: string; kind: "positive" | "negative" }) {
      const core = await import("@/orb-core/engine.server");
      return core.recordFeedback(db, userId, input);
    },
    /** Neugier, offene Wissenslücken und Entscheidung – nur lesend. */
    async inspectCuriosity() {
      const core = await import("@/orb-core/engine.server");
      return core.inspectCuriosity(db, userId);
    },
    /** Eigener Gesprächsimpuls aus Neugier (Kernpräsenz). */
    async evaluateCuriosity() {
      const core = await import("@/orb-core/engine.server");
      return core.askProactively(db, userId);
    },
    /** Zugängliche Feed-Beiträge beobachten (nur lesen) und bewerten. */
    async observeFeed() {
      const core = await import("@/orb-core/feed.server");
      return core.observeFeed(db, userId);
    },
    /** Entscheidung des Benutzers zu einem Vorschlag – wird gelernt. */
    async decideSuggestion(input: { suggestionId: string; accepted: boolean }) {
      const core = await import("@/orb-core/feed.server");
      return core.decideSuggestion(db, userId, input);
    },
    /**
     * Den verfügbaren Gesprächskontext im Hintergrund auswerten und dauerhaft
     * Wertvolles in das Gedächtnisnetz übernehmen. Erzeugt keine Chat-Antwort.
     */
    async analyzeContext() {
      const analysis = await import("@/orb-core/analysis/apply.server");
      return analysis.analyzeAndPersist(db, userId);
    },
    /**
     * Den vorhandenen technischen Analysezugang erkennen (P10) – rein lesend,
     * ohne Datenbank, ohne Modellaufruf. Erzeugt keine Analyse.
     */
    async discoverAnalysisAccess() {
      const access = await import("@/orb-core/toolbox/access.server");
      return access.discoverAnalysisAccess();
    },
    /**
     * P12 – Discovery: „Welche Analysefähigkeiten stehen ORB zur Verfügung?"
     * Aufzählung des Fähigkeitenverzeichnisses samt eindeutiger Kennung
     * (`orb.analysis`). Rein lesend, ohne Datenbank, ohne Modellaufruf; es wird
     * keine Analyse ausgeführt.
     */
    async listAnalysisCapabilities() {
      const access = await import("@/orb-core/toolbox/access.server");
      return access.listAnalysisCapabilities();
    },
    /**
     * P12 – Auflösen einer Fähigkeitskennung auf den vorhandenen, rein
     * lesenden Zugang. Unbekannte Kennung ⇒ `null`, keine Ausnahme.
     */
    async resolveAnalysisCapability(capabilityId: string) {
      const access = await import("@/orb-core/toolbox/access.server");
      const resolved = access.resolveOrbCapability(capabilityId);
      if (!resolved) return null;
      const { request, ...descriptor } = resolved;
      return {
        ...descriptor,
        /** Ausdrückliche, lesende Anforderung über den vorhandenen Zugang. */
        request: (req: Parameters<typeof request>[2]) => request(db, userId, req),
      };
    },
    /**
     * Eine lesende technische Analyse ausdrücklich anfordern (P10).
     * Nur für Administratoren, rein lesend, ohne automatische Änderung; jede
     * Empfehlung benötigt weiterhin eine menschliche Freigabe. Wird niemals
     * automatisch aus dem normalen Verarbeitungspfad aufgerufen.
     */
    async requestAnalysis(request: {
      analysisType: "memory_recall" | "repair_pipeline_state" | "system_logs" | "request_structure";
      eventId?: string | null;
      requestId?: string | null;
      timeoutMs?: number;
    }) {
      const access = await import("@/orb-core/toolbox/access.server");
      return access.requestOrbAnalysis(db, userId, request);
    },
    /**
     * P21 – eine rein lesende technische Codeanalyse ausdrücklich anfordern
     * (`orb.code_analysis`). Nur für Administratoren, nur im Lesebereich des
     * Projekts, ohne Zugangsdaten. Es wird nichts geschrieben, nichts
     * angewendet, nichts veröffentlicht; jede Änderung benötigt weiterhin eine
     * getrennte menschliche Freigabe. Wird niemals automatisch aus dem
     * normalen Verarbeitungspfad, aus autonomen Fragen, aus Neugier oder aus
     * dem Gedächtnis aufgerufen.
     */
    async requestCodeAnalysis(request: {
      target: string;
      question: string;
      reason: string;
      requestId: string;
      source?: "orb_internal" | "admin_ui" | "admin_chat";
      timeoutMs?: number;
    }) {
      const access = await import("@/orb-core/toolbox/access.server");
      const contract = await import("@/orb-core/toolbox/code-contract");
      return access.requestOrbCodeAnalysis(db, userId, {
        capability: contract.ORB_CODE_ANALYSIS_CAPABILITY_ID,
        mode: "read_only",
        target: request.target,
        question: request.question,
        reason: request.reason,
        requestId: request.requestId,
        source: request.source ?? "orb_internal",
        ...(request.timeoutMs === undefined ? {} : { timeoutMs: request.timeoutMs }),
      });
    },
  };
}

/** Sprachschicht: unabhängig von der Benutzersitzung, aber nur serverseitig. */
export const orbVoice = {
  /** Aufnahme (WAV, base64) → deutscher Text. */
  async transcribe(audioBase64: string) {
    const voice = await import("@/orb-core/voice.server");
    return voice.transcribe(audioBase64);
  },
  /** Deutscher Text → gesprochene Antwort (MP3, base64). */
  async synthesize(text: string) {
    const voice = await import("@/orb-core/voice.server");
    return voice.synthesize(text);
  },
};
