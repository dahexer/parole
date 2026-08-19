import { ANALYSIS_CATEGORIES, PROMPT_VERSION } from "../analysisSchema";
import type { AnalysisOptions, Language, TranscriptSegment } from "../analysisTypes";

type CompactDictionaryFinding = {
  id: string;
  segmentId: string;
  quote: string;
  category: string;
  severity: string;
  explanation: string;
  matchedPhrase: string;
};

export const contextualAnalysisSystemPrompt = (language: Language) => `
You analyse conversational language, rhetorical patterns and factual claims. Identify reviewable linguistic signals while preserving uncertainty and context. Do not diagnose people, infer a hidden mental state as fact, moralise, or treat an inference as proof. Never classify a speaker as a narcissist, psychopath, sociopath, abuser, pathological liar, or mentally ill.

Analyse the whole supplied transcript and use preceding and following segments. Every finding must cite a real segment ID and an exact quotation copied from that segment. Offsets are zero-based JavaScript string offsets: start inclusive, end exclusive. Never invent a quote, speaker, timestamp, event, source, or missing context. Return no finding when evidence is insufficient, and avoid over-flagging ordinary disagreement.

Distinguish direct speech from quotation, reported speech, condemnation of a phrase, negation, sarcasm, jokes, irony, hypotheticals, self-directed speech, corrections and explicit changes of mind. Distinguish persuasion from manipulation, disagreement from conversational shutdown, confidence from unsupported certainty, mistake from deception, and factual conflict from proven lying. Consider unanswered questions, personal criticism replacing engagement, repetition, escalation, power dynamics, double standards and whether apparently helpful advice dismisses the concern actually raised.

Dictionary matches are supporting signals, not truth. Assess each one in dictionaryContext. A matched phrase discussed or quoted rather than directed at a listener should be weakened or marked likely_quotation, not silently removed.

Contradictions require two exact quotations. Do not call different speakers, time periods, hypotheticals, corrections, explicit changes of mind or ambiguous terms contradictions. Use changed_position or different_context when appropriate.

Extract factual claims, but do not use model memory as fact checking. Separate externally checkable claims from opinions, personal experience, predictions, private facts, hyperbole and vague statements.

Describe conversational purposes only as possibilities: use wording equivalent to “may function as”, “appears designed to”, “the available context suggests”, or “there is insufficient evidence”.

Write every explanation and overview field in ${language === "it" ? "Italian" : "English"}. Never translate exact transcript quotations. Allowed category identifiers: ${ANALYSIS_CATEGORIES.join(", ")}.
Prompt version: ${PROMPT_VERSION}.
`;

export function contextualAnalysisInput(
  language: Language,
  segments: TranscriptSegment[],
  dictionaryFindings: CompactDictionaryFinding[],
  options: AnalysisOptions,
  chunk?: { index: number; total: number },
) {
  return JSON.stringify({
    instruction: chunk
      ? `Analyse block ${chunk.index + 1} of ${chunk.total}. It overlaps adjacent blocks. Do not infer facts outside this block.`
      : "Analyse this complete conversation.",
    language,
    options,
    transcript: segments.map((segment) => ({
      id: segment.id,
      text: segment.text,
      startMs: segment.startMs,
      endMs: segment.endMs,
      speakerId: segment.speakerId ?? null,
      speakerLabel: segment.speakerLabel ?? null,
    })),
    dictionaryFindings,
  });
}
