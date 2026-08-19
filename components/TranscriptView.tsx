"use client";

import { useMemo } from "react";
import type { ContextualFinding, DictionaryFinding, Language, TranscriptSegment } from "@/lib/analysisTypes";

export type TranscriptFinding = DictionaryFinding | ContextualFinding;

type Range = { start: number; end: number; findings: TranscriptFinding[] };

function combinedRanges(text: string, findings: TranscriptFinding[]): Range[] {
  const boundaries = Array.from(new Set([0, text.length, ...findings.flatMap((finding) => [finding.startOffset, finding.endOffset])]))
    .filter((value) => value >= 0 && value <= text.length)
    .sort((a, b) => a - b);
  const ranges: Range[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (start === end) continue;
    const active = findings.filter((finding) => finding.startOffset < end && finding.endOffset > start);
    const previous = ranges.at(-1);
    if (previous && previous.end === start && previous.findings.map((item) => item.id).join() === active.map((item) => item.id).join()) {
      previous.end = end;
    } else {
      ranges.push({ start, end, findings: active });
    }
  }
  return ranges;
}

function severity(findings: TranscriptFinding[]) {
  if (findings.some((finding) => finding.severity === "high")) return "high";
  if (findings.some((finding) => finding.severity === "medium")) return "medium";
  return "low";
}

export function TranscriptView({
  segments,
  interim,
  dictionaryFindings,
  contextualFindings,
  selectedId,
  language,
  onSelect,
}: {
  segments: TranscriptSegment[];
  interim: string;
  dictionaryFindings: DictionaryFinding[];
  contextualFindings: ContextualFinding[];
  selectedId: string | null;
  language: Language;
  onSelect: (finding: TranscriptFinding) => void;
}) {
  const bySegment = useMemo(() => {
    const map = new Map<string, TranscriptFinding[]>();
    for (const finding of [...dictionaryFindings, ...contextualFindings]) {
      map.set(finding.segmentId, [...(map.get(finding.segmentId) ?? []), finding]);
    }
    return map;
  }, [contextualFindings, dictionaryFindings]);

  if (!segments.length && !interim) return null;
  return (
    <div className="transcript-text" aria-label={language === "it" ? "Trascrizione analizzata" : "Analysed transcript"}>
      {segments.map((segment, segmentIndex) => {
        const ranges = combinedRanges(segment.text, bySegment.get(segment.id) ?? []);
        return (
          <span className="transcript-segment" data-segment-id={segment.id} id={`segment-${segment.id}`} key={segment.id}>
            {segment.speakerLabel && <strong className="speaker-label">{segment.speakerLabel}: </strong>}
            {ranges.map((range) => {
              const text = segment.text.slice(range.start, range.end);
              if (!range.findings.length) return <span key={`${segment.id}:${range.start}`}>{text}</span>;
              const contextual = range.findings.some((finding) => finding.source === "contextual_ai");
              const weakened = range.findings.some((finding) => finding.source === "dictionary" && finding.contextStatus !== "not_context_checked" && finding.contextStatus !== "context_supported");
              const primary = range.findings[0];
              const label = range.findings.map((finding) => `${finding.source === "dictionary" ? "Dictionary" : "AI"}: ${finding.category}`).join("; ");
              return (
                <mark
                  key={`${segment.id}:${range.start}`}
                  className={`flag flag-${severity(range.findings)} ${contextual ? "flag-contextual" : ""} ${weakened ? "flag-weakened" : ""} ${range.findings.some((finding) => finding.id === selectedId) ? "flag-selected" : ""}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${text}. ${label}. ${range.findings.length} ${language === "it" ? "segnali" : "signals"}.`}
                  onClick={() => onSelect(primary)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(primary);
                    }
                  }}
                >
                  <span aria-hidden="true" className="source-icon">{contextual ? "✦" : weakened ? "≈" : "!"}</span>{text}
                </mark>
              );
            })}
            {segmentIndex < segments.length - 1 ? " " : ""}
          </span>
        );
      })}
      {interim && <span className="interim" aria-label={language === "it" ? "Testo provvisorio" : "Provisional text"}> {interim}</span>}
    </div>
  );
}
