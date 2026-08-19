import { describe, expect, it } from "vitest";
import { alignQuote, contextAnalysisModelSchema, validateAndAlignAnalysis } from "@/lib/analysisSchema";
import type { TranscriptSegment } from "@/lib/analysisTypes";

const segments: TranscriptSegment[] = [
  { id: "s-1", text: "I don't think you're capable of grasping this.", startMs: 0, endMs: 2_000, source: "local-speech", isFinal: true },
  { id: "s-2", text: "Actually, I changed my mind.", startMs: 2_100, endMs: 3_000, source: "local-speech", isFinal: true },
];

function modelOutput() {
  return {
    contextualFindings: [{
      id: "f-1", segmentId: "s-1", relatedSegmentIds: [], quote: "I don't think you're capable of grasping this.", startOffset: 0, endOffset: 48,
      category: "belittling", subcategory: null, severity: "high", confidence: "high", confidenceScore: 0.93,
      title: "Belittling paraphrase", explanation: "Questions the listener's ability.", contextualReasoning: "It replaces engagement with a judgement of capacity.",
      possibleEffect: null, isDirectlyAddressedToListener: true, isQuotedSpeech: false, alternativeInterpretation: null,
      evidence: ["Exact wording"], dictionaryRelatedPhrase: null, startMs: 0, endMs: 2_000,
    }],
    contradictions: [], factualClaims: [],
    overview: {
      shortSummary: "A brief dismissive exchange.", apparentPurposes: [], communicationStyle: ["dismissive"], recurringPatterns: [],
      balanceAssessment: { description: "Insufficient context.", evidenceSegmentIds: [] }, unansweredQuestions: [],
      escalationPattern: { detected: false, explanation: null, evidenceSegmentIds: [] }, overallSignalLevel: "moderate", overallConfidence: "medium", limitations: ["Short sample"],
    }, dictionaryContext: [],
  };
}

describe("structured output validation", () => {
  it("accepts valid output and aligns an exact quotation", () => {
    const result = validateAndAlignAnalysis(modelOutput(), segments);
    expect(result.value.contextualFindings).toHaveLength(1);
    expect(result.value.contextualFindings[0].source).toBe("contextual_ai");
  });

  it("realigns conservative punctuation differences", () => {
    expect(alignQuote("That’s not right.", "That's not right", 99, 100)).toMatchObject({ startOffset: 0 });
  });

  it("rejects invented quotations but preserves valid findings", () => {
    const raw = modelOutput();
    raw.contextualFindings.push({ ...raw.contextualFindings[0], id: "f-2", quote: "Words that were never said", startOffset: 0, endOffset: 5 });
    const result = validateAndAlignAnalysis(raw, segments);
    expect(result.value.contextualFindings).toHaveLength(1);
    expect(result.rejectedFindings).toBe(1);
  });

  it("rejects unknown segment IDs", () => {
    const raw = modelOutput(); raw.contextualFindings[0].segmentId = "missing";
    expect(validateAndAlignAnalysis(raw, segments).value.contextualFindings).toHaveLength(0);
  });

  it("safely maps unknown categories", () => {
    const raw = modelOutput(); raw.contextualFindings[0].category = "model_invented_category";
    expect(validateAndAlignAnalysis(raw, segments).value.contextualFindings[0].category).toBe("other_review_signal");
  });

  it("rejects out-of-range confidence", () => {
    const raw = modelOutput(); raw.contextualFindings[0].confidenceScore = 1.2;
    expect(() => contextAnalysisModelSchema.parse(raw)).toThrow();
  });
});
