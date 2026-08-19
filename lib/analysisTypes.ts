import type { RedFlag, Severity } from "./redFlags";

export type Language = "it" | "en";

export type TranscriptSegment = {
  id: string;
  text: string;
  startMs: number | null;
  endMs: number | null;
  speakerId?: string | null;
  speakerLabel?: string | null;
  source: "local-speech" | "remote-transcription" | "audio-import";
  isFinal: boolean;
};

export type AnalysisOptions = {
  analyseIntent: boolean;
  analyseContradictions: boolean;
  extractFactualClaims: boolean;
  analyseConversationPatterns: boolean;
};

export type FindingSource = "dictionary" | "contextual_ai" | "contradiction_ai" | "fact_check";
export type Confidence = "low" | "medium" | "high";
export type ContextStatus =
  | "not_context_checked"
  | "context_supported"
  | "context_weakened"
  | "likely_quotation"
  | "likely_false_positive";

export type DictionaryFinding = {
  id: string;
  segmentId: string;
  quote: string;
  startOffset: number;
  endOffset: number;
  startMs: number | null;
  endMs: number | null;
  category: string;
  severity: Severity;
  explanation: string;
  matchedEntry: RedFlag;
  source: "dictionary";
  contextStatus: ContextStatus;
};

export type ContextualFinding = {
  id: string;
  segmentId: string;
  relatedSegmentIds: string[];
  quote: string;
  startOffset: number;
  endOffset: number;
  category: string;
  subcategory: string | null;
  severity: Severity;
  confidence: Confidence;
  confidenceScore: number;
  title: string;
  explanation: string;
  contextualReasoning: string;
  possibleEffect: string | null;
  isDirectlyAddressedToListener: boolean | null;
  isQuotedSpeech: boolean;
  alternativeInterpretation: string | null;
  evidence: string[];
  dictionaryRelatedPhrase: string | null;
  startMs: number | null;
  endMs: number | null;
  source: "contextual_ai";
};

export type ContradictionFinding = {
  id: string;
  firstSegmentId: string;
  firstQuote: string;
  secondSegmentId: string;
  secondQuote: string;
  classification:
    | "direct_contradiction"
    | "possible_inconsistency"
    | "changed_position"
    | "different_context"
    | "insufficient_context";
  severity: Severity;
  confidence: Confidence;
  confidenceScore: number;
  explanation: string;
  missingContext: string | null;
  source: "contradiction_ai";
};

export type FactualClaim = {
  id: string;
  segmentId: string;
  quote: string;
  normalisedClaim: string;
  claimType:
    | "externally_verifiable"
    | "internally_checkable"
    | "opinion"
    | "personal_experience"
    | "prediction"
    | "private_unverifiable"
    | "too_vague";
  importance: Severity;
  requiresCurrentInformation: boolean;
  internalTranscriptStatus:
    | "not_checked"
    | "supported_elsewhere_in_transcript"
    | "conflicted_elsewhere_in_transcript"
    | "insufficient_context";
  relatedSegmentIds: string[];
  explanation: string;
};

export type ConversationOverview = {
  shortSummary: string;
  apparentPurposes: Array<{
    purpose: string;
    confidence: Confidence;
    evidenceSegmentIds: string[];
    explanation: string;
  }>;
  communicationStyle: string[];
  recurringPatterns: string[];
  balanceAssessment: { description: string; evidenceSegmentIds: string[] };
  unansweredQuestions: Array<{
    questionSegmentId: string;
    relatedResponseSegmentIds: string[];
    explanation: string;
  }>;
  escalationPattern: {
    detected: boolean;
    explanation: string | null;
    evidenceSegmentIds: string[];
  };
  overallSignalLevel: "low" | "moderate" | "high";
  overallConfidence: Confidence;
  limitations: string[];
};

export type ContextAnalysis = {
  version: string;
  contextualFindings: ContextualFinding[];
  contradictions: ContradictionFinding[];
  factualClaims: FactualClaim[];
  overview: ConversationOverview;
  dictionaryContext: Array<{
    dictionaryFindingId: string;
    status: Exclude<ContextStatus, "not_context_checked">;
    explanation: string;
  }>;
  chunked: boolean;
  model: string;
  analysedAt: string;
};

export type FactCheckResult = {
  claimId: string;
  verdict:
    | "supported"
    | "mostly_supported"
    | "misleading"
    | "unsupported"
    | "contradicted"
    | "unverifiable"
    | "insufficient_reliable_evidence";
  confidence: Confidence;
  explanation: string;
  correctedInformation: string | null;
  sources: Array<{
    title: string;
    url: string;
    publisher: string | null;
    publishedDate: string | null;
    accessedDate: string;
  }>;
  caveats: string[];
};

export type ConversationAnalysisExport = {
  version: string;
  createdAt: string;
  language: Language;
  transcript: TranscriptSegment[];
  dictionaryFindings: DictionaryFinding[];
  contextualFindings: ContextualFinding[];
  contradictions: ContradictionFinding[];
  factualClaims: FactualClaim[];
  factChecks: FactCheckResult[];
  overview: ConversationOverview | null;
};
