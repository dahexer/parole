"use client";

import type { AnalysisOptions, Language } from "@/lib/analysisTypes";

export const ANALYSIS_STEPS = {
  it: ["Preparazione della trascrizione", "Analisi del linguaggio nel contesto", "Esame degli schemi conversazionali", "Confronto delle dichiarazioni", "Estrazione delle affermazioni fattuali", "In attesa della risposta di OpenAI", "Completata"],
  en: ["Preparing transcript", "Analysing language in context", "Examining conversation patterns", "Comparing statements", "Extracting factual claims", "Waiting for OpenAI", "Complete"],
};

export function AnalysisControls({
  language, disabled, running, hasAnalysis, progress, error, lastAnalysedAt, options, autoAnalyse,
  onOptions, onAutoAnalyse, onAnalyse, onCancel,
}: {
  language: Language;
  disabled: boolean;
  running: boolean;
  hasAnalysis: boolean;
  progress: number;
  error: string | null;
  lastAnalysedAt: string | null;
  options: AnalysisOptions;
  autoAnalyse: boolean;
  onOptions: (options: AnalysisOptions) => void;
  onAutoAnalyse: (value: boolean) => void;
  onAnalyse: () => void;
  onCancel: () => void;
}) {
  const copy = language === "it" ? {
    title: "Analisi contestuale AI",
    privacy: "Quando avvii l’analisi, il testo completo della trascrizione viene inviato a OpenAI. Non viene inviato durante la registrazione.",
    action: hasAnalysis ? "Rianalizza" : "Analizza l’intera conversazione",
    cancel: "Annulla analisi", retry: "Riprova", auto: "Analizza automaticamente dopo la registrazione",
    intent: "Possibile intento", contradictions: "Contraddizioni", facts: "Affermazioni fattuali", patterns: "Schemi conversazionali",
    last: "Ultima analisi",
  } : {
    title: "Contextual AI analysis",
    privacy: "When you start analysis, the complete transcript text is sent to OpenAI. It is not sent while recording.",
    action: hasAnalysis ? "Reanalyse" : "Analyse full conversation",
    cancel: "Cancel analysis", retry: "Retry", auto: "Analyse automatically after recording",
    intent: "Possible intent", contradictions: "Contradictions", facts: "Factual claims", patterns: "Conversation patterns",
    last: "Last analysed",
  };
  const toggles: Array<[keyof AnalysisOptions, string]> = [
    ["analyseIntent", copy.intent], ["analyseContradictions", copy.contradictions],
    ["extractFactualClaims", copy.facts], ["analyseConversationPatterns", copy.patterns],
  ];
  const steps = ANALYSIS_STEPS[language];
  return (
    <section className="analysis-controls" aria-labelledby="analysis-controls-title">
      <div className="analysis-controls-head">
        <div><span className="section-kicker">OpenAI</span><h2 id="analysis-controls-title">{copy.title}</h2></div>
        <div className="analysis-actions">
          {running && <button type="button" className="secondary-control" onClick={onCancel}>{copy.cancel}</button>}
          <button type="button" className="analysis-primary" disabled={disabled || running} onClick={onAnalyse}>{error ? copy.retry : copy.action}</button>
        </div>
      </div>
      <p className="privacy-notice"><span aria-hidden="true">◇</span>{copy.privacy}</p>
      <div className="analysis-options">
        {toggles.map(([key, label]) => <label key={key}><input type="checkbox" checked={options[key]} onChange={(event) => onOptions({ ...options, [key]: event.target.checked })} /> {label}</label>)}
        <label><input type="checkbox" checked={autoAnalyse} onChange={(event) => onAutoAnalyse(event.target.checked)} /> {copy.auto}</label>
      </div>
      {running && <div className="analysis-progress" role="status" aria-live="polite">
        <div><span>{steps[Math.min(progress, steps.length - 1)]}</span><strong>{Math.round(((progress + 1) / steps.length) * 100)}%</strong></div>
        <progress max={steps.length} value={progress + 1} />
      </div>}
      {error && <p className="analysis-error" role="alert">{error}</p>}
      {lastAnalysedAt && <small className="last-analysed">{copy.last}: {new Date(lastAnalysedAt).toLocaleString(language)}</small>}
    </section>
  );
}
