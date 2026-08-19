import type { Language, DictionaryFinding, TranscriptSegment } from "./analysisTypes";
import type { RedFlag } from "./redFlags";

export type DictionaryMatch = { start: number; end: number; flag: RedFlag };

export function findDictionaryMatches(text: string, dictionary: RedFlag[], language: Language): DictionaryMatch[] {
  const lowerText = text.toLocaleLowerCase(language);
  const matches: DictionaryMatch[] = [];
  for (const flag of [...dictionary].sort((a, b) => b.phrase.length - a.phrase.length)) {
    const needle = flag.phrase.toLocaleLowerCase(language);
    let from = 0;
    while (from < lowerText.length) {
      const start = lowerText.indexOf(needle, from);
      if (start === -1) break;
      const end = start + needle.length;
      if (!matches.some((match) => start < match.end && end > match.start)) {
        matches.push({ start, end, flag });
      }
      from = end;
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

function interpolateTimestamp(segment: TranscriptSegment, offset: number) {
  if (segment.startMs === null || segment.endMs === null || !segment.text.length) return null;
  return Math.round(segment.startMs + ((segment.endMs - segment.startMs) * offset) / segment.text.length);
}

export function analyseDictionarySegments(
  segments: TranscriptSegment[],
  dictionary: RedFlag[],
  language: Language,
): DictionaryFinding[] {
  return segments.flatMap((segment) => findDictionaryMatches(segment.text, dictionary, language).map((match) => ({
    id: `dictionary:${segment.id}:${match.start}:${match.end}`,
    segmentId: segment.id,
    quote: segment.text.slice(match.start, match.end),
    startOffset: match.start,
    endOffset: match.end,
    startMs: interpolateTimestamp(segment, match.start),
    endMs: interpolateTimestamp(segment, match.end),
    category: match.flag.category,
    severity: match.flag.severity,
    explanation: match.flag.explanation,
    matchedEntry: match.flag,
    source: "dictionary" as const,
    contextStatus: "not_context_checked" as const,
  })));
}
