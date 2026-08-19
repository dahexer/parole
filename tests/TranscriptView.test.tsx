// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TranscriptView } from "@/components/TranscriptView";
import type { ContextualFinding, DictionaryFinding, TranscriptSegment } from "@/lib/analysisTypes";

const segment: TranscriptSegment = { id: "s-1", text: "This discussion is over.", startMs: null, endMs: null, source: "local-speech", isFinal: true };
const dictionary: DictionaryFinding = { id: "d-1", segmentId: "s-1", quote: "discussion is over", startOffset: 5, endOffset: 23, startMs: null, endMs: null, category: "Silencing", severity: "high", explanation: "Ends dialogue.", matchedEntry: { phrase: "discussion is over", category: "Silencing", severity: "high", explanation: "Ends dialogue." }, source: "dictionary", contextStatus: "context_supported" };
const contextual: ContextualFinding = { id: "c-1", segmentId: "s-1", relatedSegmentIds: [], quote: "This discussion is over.", startOffset: 0, endOffset: 24, category: "conversational_shutdown", subcategory: null, severity: "high", confidence: "high", confidenceScore: .95, title: "Shutdown", explanation: "Ends the exchange.", contextualReasoning: "Direct closure.", possibleEffect: null, isDirectlyAddressedToListener: true, isQuotedSpeech: false, alternativeInterpretation: null, evidence: [], dictionaryRelatedPhrase: "discussion is over", startMs: null, endMs: null, source: "contextual_ai" };

describe("TranscriptView", () => {
  it("combines overlapping highlights without nesting marks and supports keyboard selection", () => {
    const onSelect = vi.fn();
    const { container } = render(<TranscriptView segments={[segment]} interim="" dictionaryFindings={[dictionary]} contextualFindings={[contextual]} selectedId={null} language="en" onSelect={onSelect} />);
    expect(container.querySelectorAll("mark mark")).toHaveLength(0);
    const signal = screen.getAllByRole("button")[0];
    fireEvent.keyDown(signal, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
