import type { TranscriptSegment } from "./analysisTypes";

let fallbackCounter = 0;

export function createSegment(
  text: string,
  source: TranscriptSegment["source"],
  timing: { startMs?: number | null; endMs?: number | null } = {},
): TranscriptSegment {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `segment-${Date.now()}-${fallbackCounter += 1}`;
  return {
    id,
    text: text.trim(),
    startMs: timing.startMs ?? null,
    endMs: timing.endMs ?? null,
    source,
    isFinal: true,
  };
}

export function transcriptText(segments: TranscriptSegment[]) {
  return segments.filter((segment) => segment.isFinal && segment.text.trim()).map((segment) => segment.text.trim()).join(" ");
}

export function transcriptDuration(segments: TranscriptSegment[]) {
  return segments.reduce((maximum, segment) => Math.max(maximum, segment.endMs ?? 0), 0) || null;
}

export function chunkTranscriptSegments(
  segments: TranscriptSegment[],
  maximumCharacters = 55_000,
  overlapSegments = 2,
) {
  const finalSegments = segments.filter((segment) => segment.isFinal && segment.text.trim());
  if (finalSegments.reduce((sum, segment) => sum + segment.text.length, 0) <= maximumCharacters) {
    return [finalSegments];
  }

  const chunks: TranscriptSegment[][] = [];
  let current: TranscriptSegment[] = [];
  let length = 0;

  for (const segment of finalSegments) {
    if (current.length && length + segment.text.length > maximumCharacters) {
      chunks.push(current);
      current = current.slice(-overlapSegments);
      length = current.reduce((sum, item) => sum + item.text.length, 0);
    }
    current.push(segment);
    length += segment.text.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

export function normaliseTranscriptForHash(segments: TranscriptSegment[]) {
  return segments
    .filter((segment) => segment.isFinal)
    .map(({ id, text, speakerId, speakerLabel }) => ({
      id,
      text: text.trim().replace(/\s+/g, " "),
      speakerId: speakerId ?? null,
      speakerLabel: speakerLabel ?? null,
    }));
}
