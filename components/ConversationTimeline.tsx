"use client";

import type { ContextualFinding, DictionaryFinding, FactCheckResult, Language } from "@/lib/analysisTypes";

export function ConversationTimeline({
  durationMs, dictionaryFindings, contextualFindings, factChecks, language, onNavigate,
}: {
  durationMs: number | null;
  dictionaryFindings: DictionaryFinding[];
  contextualFindings: ContextualFinding[];
  factChecks: FactCheckResult[];
  language: Language;
  onNavigate: (segmentId: string, timeMs: number | null, findingId?: string) => void;
}) {
  if (!durationMs) return null;
  const checked = new Set(factChecks.map((result) => result.claimId));
  const markers = [
    ...dictionaryFindings.filter((finding) => finding.startMs !== null).map((finding) => ({ id: finding.id, segmentId: finding.segmentId, timeMs: finding.startMs!, kind: "dictionary", label: finding.category })),
    ...contextualFindings.filter((finding) => finding.startMs !== null).map((finding) => ({ id: finding.id, segmentId: finding.segmentId, timeMs: finding.startMs!, kind: "contextual", label: finding.title })),
  ];
  return (
    <section className="timeline" aria-label={language === "it" ? "Cronologia dei segnali" : "Signal timeline"}>
      <div className="timeline-head"><strong>{language === "it" ? "Cronologia" : "Timeline"}</strong><span>{Math.round(durationMs / 1_000)}s</span></div>
      <div className="timeline-track">
        {markers.map((marker) => <button
          key={marker.id}
          type="button"
          className={`timeline-marker ${marker.kind}`}
          style={{ left: `${Math.min(100, (marker.timeMs / durationMs) * 100)}%` }}
          title={`${Math.round(marker.timeMs / 1_000)}s — ${marker.label}`}
          aria-label={`${marker.label}, ${Math.round(marker.timeMs / 1_000)} seconds`}
          onClick={() => onNavigate(marker.segmentId, marker.timeMs, marker.id)}
        />)}
        {checked.size > 0 && <span className="timeline-fact-key" aria-hidden="true">✓</span>}
      </div>
    </section>
  );
}
