/** ORB Developer Environment – browser-sichere Typen (keine Server-Imports). */

import type { FixState, RootCauseLevel } from "@/orb-dev/fix-model";

export type AuditEntry = {
  at: string;
  adminId: string;
  action: string;
  fixId: string | null;
  previousState: FixState | null;
  newState: FixState | null;
  files: string[];
  result: string;
};

export type ChainStep = {
  stage:
    | "MEMORY"
    | "RECALL"
    | "CANDIDATE_SEARCH"
    | "FILTER"
    | "RANKING"
    | "ACTIVE_MEMORY"
    | "CONTEXT"
    | "LLM";
  outcome: "PASS" | "BLOCKED" | "NOT_REACHED";
  detail: string;
};

export type Diagnosis = {
  caseId: string;
  question: string;
  memory: string;
  observation: string;
  reproduction: {
    questionTopic: string | null;
    questionIntent: string | null;
    questionTokens: string[];
    memoryTopic: string | null;
    lexicalSimilarity: number;
    topicAffinity: number;
    overlap: number;
  };
  codeTrace: { path: string; line: number; text: string }[];
  relatedTests: string[];
  chain: ChainStep[];
  rootCause: string;
  rootCauseLevel: RootCauseLevel;
};
