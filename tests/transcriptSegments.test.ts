import { describe, expect, it } from "vitest";
import { chunkTranscriptSegments } from "@/lib/transcriptSegments";
import type { TranscriptSegment } from "@/lib/analysisTypes";

describe("long transcript handling", () => {
  it("chunks only at stable segment boundaries and overlaps adjacent blocks", () => {
    const segments: TranscriptSegment[] = Array.from({ length: 8 }, (_, index) => ({
      id: `s-${index}`, text: `Sentence ${index} `.repeat(5), startMs: null, endMs: null, source: "audio-import", isFinal: true,
    }));
    const chunks = chunkTranscriptSegments(segments, 180, 2);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[1][0].id).toBe(chunks[0].at(-2)?.id);
    expect(chunks.flat().every((segment) => segments.includes(segment))).toBe(true);
  });
});
