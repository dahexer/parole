import { z } from "zod";
import type {
  ContextAnalysis,
  ContextualFinding,
  DictionaryFinding,
  TranscriptSegment,
} from "./analysisTypes";

export const ANALYSIS_SCHEMA_VERSION = "1.0.0";
export const PROMPT_VERSION = "2026-08-05.1";

export const ANALYSIS_CATEGORIES = [
  "dismissal", "conversational_shutdown", "belittling", "patronising",
  "intellectual_superiority", "false_consensus", "unsupported_certainty", "minimisation",
  "invalidating_language", "blame_shifting", "deflection", "topic_avoidance",
  "question_avoidance", "moving_goalposts", "straw_man", "loaded_question",
  "personal_attack", "ridicule", "shaming", "guilt_pressure", "fear_pressure",
  "coercive_language", "threat", "ultimatum", "gaslighting_like_language",
  "reality_denial", "memory_undermining", "emotional_blackmail", "appeal_to_authority",
  "thought_terminating_cliche", "overgeneralisation", "absolute_statement", "double_standard",
  "contradiction", "possible_inconsistency", "unsupported_factual_claim",
  "misleading_implication", "possible_misinformation", "other_review_signal",
] as const;

const severitySchema = z.enum(["low", "medium", "high"]);
const confidenceSchema = z.enum(["low", "medium", "high"]);
const scoreSchema = z.number().min(0).max(1);

export const transcriptSegmentSchema = z.object({
  id: z.string().min(1).max(160).regex(/^[A-Za-z0-9:_-]+$/),
  text: z.string().min(1).max(30_000),
  startMs: z.number().int().nonnegative().nullable(),
  endMs: z.number().int().nonnegative().nullable(),
  speakerId: z.string().max(120).nullable().optional(),
  speakerLabel: z.string().max(120).nullable().optional(),
  source: z.enum(["local-speech", "remote-transcription", "audio-import"]),
  isFinal: z.boolean(),
}).strict().superRefine((segment, context) => {
  if (segment.startMs !== null && segment.endMs !== null && segment.endMs < segment.startMs) {
    context.addIssue({ code: "custom", message: "endMs must be after startMs" });
  }
});

export const dictionaryFindingInputSchema = z.object({
  id: z.string().min(1).max(240),
  segmentId: z.string().min(1).max(160),
  quote: z.string().min(1).max(2_000),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  category: z.string().min(1).max(160),
  severity: severitySchema,
  explanation: z.string().max(2_000),
  matchedPhrase: z.string().min(1).max(2_000),
}).strict();

export const analyseRequestSchema = z.object({
  language: z.enum(["it", "en"]),
  segments: z.array(transcriptSegmentSchema).min(1).max(2_000),
  dictionaryFindings: z.array(dictionaryFindingInputSchema).max(5_000).default([]),
  options: z.object({
    analyseIntent: z.boolean(),
    analyseContradictions: z.boolean(),
    extractFactualClaims: z.boolean(),
    analyseConversationPatterns: z.boolean(),
  }).strict(),
}).strict();

const contextualFindingModelSchema = z.object({
  id: z.string().min(1).max(200),
  segmentId: z.string().min(1).max(160),
  relatedSegmentIds: z.array(z.string().min(1).max(160)).max(30),
  quote: z.string().min(1).max(2_000),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  category: z.string().min(1).max(100),
  subcategory: z.string().max(120).nullable(),
  severity: severitySchema,
  confidence: confidenceSchema,
  confidenceScore: scoreSchema,
  title: z.string().min(1).max(160),
  explanation: z.string().min(1).max(600),
  contextualReasoning: z.string().min(1).max(2_000),
  possibleEffect: z.string().max(800).nullable(),
  isDirectlyAddressedToListener: z.boolean().nullable(),
  isQuotedSpeech: z.boolean(),
  alternativeInterpretation: z.string().max(1_000).nullable(),
  evidence: z.array(z.string().min(1).max(800)).max(12),
  dictionaryRelatedPhrase: z.string().max(500).nullable(),
  startMs: z.number().int().nonnegative().nullable(),
  endMs: z.number().int().nonnegative().nullable(),
}).strict();

const contradictionModelSchema = z.object({
  id: z.string().min(1).max(200),
  firstSegmentId: z.string().min(1).max(160),
  firstQuote: z.string().min(1).max(2_000),
  secondSegmentId: z.string().min(1).max(160),
  secondQuote: z.string().min(1).max(2_000),
  classification: z.enum(["direct_contradiction", "possible_inconsistency", "changed_position", "different_context", "insufficient_context"]),
  severity: severitySchema,
  confidence: confidenceSchema,
  confidenceScore: scoreSchema,
  explanation: z.string().min(1).max(2_000),
  missingContext: z.string().max(1_000).nullable(),
}).strict();

const factualClaimModelSchema = z.object({
  id: z.string().min(1).max(200),
  segmentId: z.string().min(1).max(160),
  quote: z.string().min(1).max(2_000),
  normalisedClaim: z.string().min(1).max(2_000),
  claimType: z.enum(["externally_verifiable", "internally_checkable", "opinion", "personal_experience", "prediction", "private_unverifiable", "too_vague"]),
  importance: severitySchema,
  requiresCurrentInformation: z.boolean(),
  internalTranscriptStatus: z.enum(["not_checked", "supported_elsewhere_in_transcript", "conflicted_elsewhere_in_transcript", "insufficient_context"]),
  relatedSegmentIds: z.array(z.string().min(1).max(160)).max(30),
  explanation: z.string().min(1).max(1_000),
}).strict();

const overviewModelSchema = z.object({
  shortSummary: z.string().min(1).max(2_000),
  apparentPurposes: z.array(z.object({
    purpose: z.string().min(1).max(200),
    confidence: confidenceSchema,
    evidenceSegmentIds: z.array(z.string().min(1).max(160)).max(30),
    explanation: z.string().min(1).max(1_000),
  }).strict()).max(20),
  communicationStyle: z.array(z.string().min(1).max(200)).max(30),
  recurringPatterns: z.array(z.string().min(1).max(300)).max(30),
  balanceAssessment: z.object({
    description: z.string().min(1).max(1_000),
    evidenceSegmentIds: z.array(z.string().min(1).max(160)).max(30),
  }).strict(),
  unansweredQuestions: z.array(z.object({
    questionSegmentId: z.string().min(1).max(160),
    relatedResponseSegmentIds: z.array(z.string().min(1).max(160)).max(30),
    explanation: z.string().min(1).max(1_000),
  }).strict()).max(40),
  escalationPattern: z.object({
    detected: z.boolean(),
    explanation: z.string().max(1_000).nullable(),
    evidenceSegmentIds: z.array(z.string().min(1).max(160)).max(30),
  }).strict(),
  overallSignalLevel: z.enum(["low", "moderate", "high"]),
  overallConfidence: confidenceSchema,
  limitations: z.array(z.string().min(1).max(500)).max(30),
}).strict();

export const contextAnalysisModelSchema = z.object({
  contextualFindings: z.array(contextualFindingModelSchema).max(500),
  contradictions: z.array(contradictionModelSchema).max(200),
  factualClaims: z.array(factualClaimModelSchema).max(500),
  overview: overviewModelSchema,
  dictionaryContext: z.array(z.object({
    dictionaryFindingId: z.string().min(1).max(240),
    status: z.enum(["context_supported", "context_weakened", "likely_quotation", "likely_false_positive"]),
    explanation: z.string().min(1).max(600),
  }).strict()).max(5_000),
}).strict();

export const factCheckRequestSchema = z.object({
  language: z.enum(["it", "en"]),
  claims: z.array(factualClaimModelSchema).min(1).max(20),
  context: z.array(z.object({
    segmentId: z.string().min(1).max(160),
    text: z.string().min(1).max(2_000),
  }).strict()).max(40).default([]),
}).strict();

export const factCheckModelSchema = z.object({
  results: z.array(z.object({
    claimId: z.string().min(1).max(200),
    verdict: z.enum(["supported", "mostly_supported", "misleading", "unsupported", "contradicted", "unverifiable", "insufficient_reliable_evidence"]),
    confidence: confidenceSchema,
    explanation: z.string().min(1).max(2_000),
    correctedInformation: z.string().max(2_000).nullable(),
    sources: z.array(z.object({
      title: z.string().min(1).max(500),
      url: z.string().url().max(2_000),
      publisher: z.string().max(300).nullable(),
      publishedDate: z.string().max(50).nullable(),
      accessedDate: z.string().min(1).max(50),
    }).strict()).max(20),
    caveats: z.array(z.string().min(1).max(500)).max(20),
  }).strict()).max(20),
}).strict();

type ModelAnalysis = z.infer<typeof contextAnalysisModelSchema>;

function normalisedWithMap(value: string) {
  let normalised = "";
  const map: number[] = [];
  let pendingSpace = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index].normalize("NFKD").toLocaleLowerCase();
    if (/\p{L}|\p{N}/u.test(character)) {
      if (pendingSpace && normalised) {
        normalised += " ";
        map.push(index);
      }
      normalised += character;
      map.push(index);
      pendingSpace = false;
    } else {
      pendingSpace = true;
    }
  }
  return { normalised: normalised.trim(), map };
}

export function alignQuote(segmentText: string, quote: string, hintedStart: number, hintedEnd: number) {
  if (hintedStart >= 0 && hintedEnd <= segmentText.length && hintedStart < hintedEnd) {
    const candidate = segmentText.slice(hintedStart, hintedEnd);
    if (candidate === quote) return { startOffset: hintedStart, endOffset: hintedEnd, quote: candidate };
  }
  const exactStart = segmentText.indexOf(quote);
  if (exactStart >= 0 && segmentText.indexOf(quote, exactStart + 1) === -1) {
    return { startOffset: exactStart, endOffset: exactStart + quote.length, quote };
  }
  const haystack = normalisedWithMap(segmentText);
  const needle = normalisedWithMap(quote).normalised;
  const normalisedStart = needle.length >= 4 ? haystack.normalised.indexOf(needle) : -1;
  if (normalisedStart >= 0 && haystack.normalised.indexOf(needle, normalisedStart + 1) === -1) {
    const startOffset = haystack.map[normalisedStart];
    const endOffset = (haystack.map[normalisedStart + needle.length - 1] ?? startOffset) + 1;
    const alignedQuote = segmentText.slice(startOffset, endOffset);
    return { startOffset, endOffset, quote: alignedQuote };
  }
  return null;
}

function validSegmentIds(ids: string[], segments: Map<string, TranscriptSegment>) {
  return ids.filter((id) => segments.has(id));
}

export function validateAndAlignAnalysis(
  raw: unknown,
  transcript: TranscriptSegment[],
  dictionaryFindings: Array<Pick<DictionaryFinding, "id">> = [],
) {
  const parsed = contextAnalysisModelSchema.parse(raw) as ModelAnalysis;
  const segments = new Map(transcript.map((segment) => [segment.id, segment]));
  const dictionaryIds = new Set(dictionaryFindings.map((finding) => finding.id));
  let rejectedFindings = 0;

  const contextualFindings: ContextualFinding[] = [];
  for (const finding of parsed.contextualFindings) {
    const segment = segments.get(finding.segmentId);
    const aligned = segment && alignQuote(segment.text, finding.quote, finding.startOffset, finding.endOffset);
    if (!segment || !aligned) {
      rejectedFindings += 1;
      continue;
    }
    contextualFindings.push({
      ...finding,
      ...aligned,
      category: (ANALYSIS_CATEGORIES as readonly string[]).includes(finding.category)
        ? finding.category
        : "other_review_signal",
      relatedSegmentIds: validSegmentIds(finding.relatedSegmentIds, segments),
      startMs: segment.startMs === null ? null : finding.startMs,
      endMs: segment.endMs === null ? null : finding.endMs,
      source: "contextual_ai",
    });
  }

  const contradictions = parsed.contradictions.flatMap((finding) => {
    const first = segments.get(finding.firstSegmentId);
    const second = segments.get(finding.secondSegmentId);
    if (!first || !second || !alignQuote(first.text, finding.firstQuote, 0, 0) || !alignQuote(second.text, finding.secondQuote, 0, 0)) {
      rejectedFindings += 1;
      return [];
    }
    return [{ ...finding, source: "contradiction_ai" as const }];
  });

  const factualClaims = parsed.factualClaims.flatMap((claim) => {
    const segment = segments.get(claim.segmentId);
    if (!segment || !alignQuote(segment.text, claim.quote, 0, 0)) {
      rejectedFindings += 1;
      return [];
    }
    return [{ ...claim, relatedSegmentIds: validSegmentIds(claim.relatedSegmentIds, segments) }];
  });

  const evidenceIds = (ids: string[]) => validSegmentIds(ids, segments);
  const overview = {
    ...parsed.overview,
    apparentPurposes: parsed.overview.apparentPurposes.map((purpose) => ({ ...purpose, evidenceSegmentIds: evidenceIds(purpose.evidenceSegmentIds) })),
    balanceAssessment: { ...parsed.overview.balanceAssessment, evidenceSegmentIds: evidenceIds(parsed.overview.balanceAssessment.evidenceSegmentIds) },
    unansweredQuestions: parsed.overview.unansweredQuestions.filter((item) => segments.has(item.questionSegmentId)).map((item) => ({ ...item, relatedResponseSegmentIds: evidenceIds(item.relatedResponseSegmentIds) })),
    escalationPattern: { ...parsed.overview.escalationPattern, evidenceSegmentIds: evidenceIds(parsed.overview.escalationPattern.evidenceSegmentIds) },
  };

  return {
    value: {
      contextualFindings,
      contradictions,
      factualClaims,
      overview,
      dictionaryContext: parsed.dictionaryContext.filter((item) => dictionaryIds.has(item.dictionaryFindingId)),
    },
    rejectedFindings,
  };
}

export function withAnalysisMetadata(
  value: ReturnType<typeof validateAndAlignAnalysis>["value"],
  model: string,
  chunked: boolean,
): ContextAnalysis {
  return {
    ...value,
    version: ANALYSIS_SCHEMA_VERSION,
    model,
    chunked,
    analysedAt: new Date().toISOString(),
  };
}
