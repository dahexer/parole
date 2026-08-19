"use client";

import { useState } from "react";
import type {
  ContextAnalysis, ContextualFinding, DictionaryFinding, FactCheckResult, FactualClaim, Language,
} from "@/lib/analysisTypes";
import type { TranscriptFinding } from "./TranscriptView";

type Tab = "transcript" | "signals" | "intent" | "contradictions" | "facts" | "method";

const tabs = {
  it: { transcript: "Trascrizione", signals: "Segnali nel contesto", intent: "Intento generale", contradictions: "Contraddizioni", facts: "Fatti", method: "Metodo e limiti" },
  en: { transcript: "Transcript", signals: "Contextual signals", intent: "Overall intent", contradictions: "Contradictions", facts: "Facts", method: "Method and limitations" },
};

const italianCategories: Record<string, string> = {
  conversational_shutdown: "Chiusura della conversazione", belittling: "Svalutazione", patronising: "Tono paternalistico",
  intellectual_superiority: "Superiorità intellettuale", false_consensus: "Falso consenso", unsupported_certainty: "Certezza non supportata",
  minimisation: "Minimizzazione", invalidating_language: "Linguaggio invalidante", blame_shifting: "Spostamento della colpa",
  question_avoidance: "Elusione della domanda", moving_goalposts: "Spostamento dei criteri", personal_attack: "Attacco personale",
  contradiction: "Contraddizione", possible_inconsistency: "Possibile incoerenza", unsupported_factual_claim: "Affermazione non supportata",
  other_review_signal: "Altro segnale da esaminare",
};

function categoryLabel(category: string, language: Language) {
  if (language === "it" && italianCategories[category]) return italianCategories[category];
  return category.split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`analysis-badge ${tone}`}>{children}</span>;
}

export function AnalysisPanels({
  language, analysis, dictionaryFindings, selectedFinding, factChecks, checkingClaimIds,
  onNavigate, onCheckClaims, onExport,
}: {
  language: Language;
  analysis: ContextAnalysis | null;
  dictionaryFindings: DictionaryFinding[];
  selectedFinding: TranscriptFinding | null;
  factChecks: FactCheckResult[];
  checkingClaimIds: string[];
  onNavigate: (segmentId: string, findingId?: string) => void;
  onCheckClaims: (claims: FactualClaim[]) => void;
  onExport: (format: "text" | "html" | "json") => void;
}) {
  const [tab, setTab] = useState<Tab>("transcript");
  const copy = language === "it" ? {
    noAnalysis: "Avvia l’analisi contestuale per aggiungere spiegazioni, schemi, contraddizioni e affermazioni fattuali.",
    dictionary: "Dizionario", ai: "AI contestuale", confidence: "Confidenza", evidence: "Evidenza", alternative: "Lettura alternativa",
    noSignals: "Nessun segnale contestuale con evidenza sufficiente.", possiblePurpose: "Possibile scopo conversazionale", style: "Stile comunicativo", patterns: "Schemi ricorrenti", balance: "Equilibrio della conversazione", unanswered: "Domande senza risposta", escalation: "Escalation",
    none: "Nessuno rilevato", noContradictions: "Nessuna contraddizione supportata dal contesto.",
    first: "Prima dichiarazione", second: "Seconda dichiarazione", ready: "Pronte da verificare", internal: "Conflitti interni", other: "Opinioni, private o non verificabili", checked: "Risultati verificati", check: "Verifica affermazione", checkAll: "Verifica tutte le affermazioni pubbliche", webNotice: "La verifica è un’azione separata: la sola affermazione selezionata e il minimo contesto possono essere cercati sul web pubblico.",
    method: "Il dizionario locale è deterministico e immediato. L’analisi AI usa l’intera conversazione per valutare significato e contesto. Le inferenze non provano intenzioni nascoste; le contraddizioni non provano una menzogna. Solo la verifica web può confrontare una dichiarazione pubblica con fonti esterne.",
    principle: "L’applicazione identifica linguaggio ed evidenze che possono meritare attenzione. Non può determinare in modo affidabile le intenzioni nascoste di una persona, diagnosticarla o provare che abbia mentito deliberatamente.",
    export: "Esporta", low: "bassa", medium: "media", high: "alta", model: "Modello", chunked: "Analisi in blocchi sovrapposti",
  } : {
    noAnalysis: "Start contextual analysis to add explanations, patterns, contradictions and factual claims.",
    dictionary: "Dictionary", ai: "Contextual AI", confidence: "Confidence", evidence: "Evidence", alternative: "Alternative reading",
    noSignals: "No contextual signals had sufficient evidence.", possiblePurpose: "Possible conversational purpose", style: "Communication style", patterns: "Recurring patterns", balance: "Conversation balance", unanswered: "Unanswered questions", escalation: "Escalation",
    none: "None detected", noContradictions: "No context-supported contradictions were found.",
    first: "First statement", second: "Second statement", ready: "Ready to verify", internal: "Internal conflicts", other: "Opinions, private or unverifiable", checked: "Verified results", check: "Check claim", checkAll: "Check all public claims", webNotice: "Fact checking is a separate action: only the selected claim and minimum context may be searched on the public web.",
    method: "The local dictionary is deterministic and immediate. AI analysis uses the full conversation to assess meaning and context. Inferences do not prove hidden intent; contradictions do not prove lying. Only web verification compares a public claim with external sources.",
    principle: "The application identifies language and evidence that may deserve attention. It cannot reliably determine a person’s hidden intentions, diagnose them, or prove that they deliberately lied.",
    export: "Export", low: "low", medium: "medium", high: "high", model: "Model", chunked: "Analysed in overlapping blocks",
  };
  const claims = analysis?.factualClaims ?? [];
  const verifiable = claims.filter((claim) => claim.claimType === "externally_verifiable");
  const internal = claims.filter((claim) => claim.internalTranscriptStatus === "conflicted_elsewhere_in_transcript" || claim.claimType === "internally_checkable");
  const other = claims.filter((claim) => !verifiable.includes(claim) && !internal.includes(claim));
  const factResult = (claimId: string) => factChecks.find((result) => result.claimId === claimId);

  const findingCard = (finding: ContextualFinding) => <article className="finding-card" key={finding.id}>
    <button type="button" className="finding-link" onClick={() => onNavigate(finding.segmentId, finding.id)}>
      <q>{finding.quote}</q>
    </button>
    <div className="finding-meta"><Badge tone={finding.severity}>{categoryLabel(finding.category, language)}</Badge><Badge>{copy.ai}</Badge><Badge>{copy.confidence}: {copy[finding.confidence]}</Badge></div>
    <h3>{finding.title}</h3><p>{finding.explanation}</p><p className="context-reasoning">{finding.contextualReasoning}</p>
    {!!finding.evidence.length && <details><summary>{copy.evidence}</summary><ul>{finding.evidence.map((item) => <li key={item}>{item}</li>)}</ul></details>}
    {finding.alternativeInterpretation && <p className="alternative"><strong>{copy.alternative}:</strong> {finding.alternativeInterpretation}</p>}
  </article>;

  const claimGroup = (title: string, group: FactualClaim[], canCheck: boolean) => <section className="claim-group"><h3>{title} <span>{group.length}</span></h3>{group.map((claim) => {
    const result = factResult(claim.id);
    return <article className="claim-card" key={claim.id}>
      <button type="button" className="finding-link" onClick={() => onNavigate(claim.segmentId)}><q>{claim.quote}</q></button>
      <p>{claim.explanation}</p><div className="finding-meta"><Badge>{claim.claimType.replaceAll("_", " ")}</Badge><Badge tone={claim.importance}>{claim.importance}</Badge></div>
      {canCheck && !result && <button className="mini-action" type="button" disabled={checkingClaimIds.includes(claim.id)} onClick={() => onCheckClaims([claim])}>{copy.check}</button>}
      {result && <div className="fact-result"><strong>{result.verdict.replaceAll("_", " ")}</strong><p>{result.explanation}</p>{result.correctedInformation && <p>{result.correctedInformation}</p>}<ul>{result.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>{source.publisher ? ` — ${source.publisher}` : ""}</li>)}</ul></div>}
    </article>;
  })}</section>;

  return (
    <section className="analysis-workspace">
      <div className="analysis-tabs" role="tablist" aria-label={language === "it" ? "Sezioni dell’analisi" : "Analysis sections"}>
        {(Object.keys(tabs[language]) as Tab[]).map((key) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{tabs[language][key]}</button>)}
      </div>
      <div className="analysis-panel" role="tabpanel">
        {tab === "transcript" && <>
          <div className="panel-summary"><div><strong>{dictionaryFindings.length}</strong><span>{copy.dictionary}</span></div><div><strong>{analysis?.contextualFindings.length ?? 0}</strong><span>{copy.ai}</span></div><div><strong>{analysis?.contradictions.length ?? 0}</strong><span>{tabs[language].contradictions}</span></div></div>
          {selectedFinding ? <article className="selected-finding"><div className="finding-meta"><Badge tone={selectedFinding.severity}>{selectedFinding.severity}</Badge><Badge>{selectedFinding.source === "dictionary" ? copy.dictionary : copy.ai}</Badge></div><h3>{selectedFinding.category}</h3><q>{selectedFinding.quote}</q><p>{selectedFinding.explanation}</p>{selectedFinding.source === "dictionary" && selectedFinding.contextStatus !== "not_context_checked" && <p className="context-status">{selectedFinding.contextStatus.replaceAll("_", " ")}</p>}</article> : <p className="panel-empty">{analysis?.overview.shortSummary ?? copy.noAnalysis}</p>}
          <div className="export-actions"><span>{copy.export}</span><button type="button" onClick={() => onExport("text")}>TXT</button><button type="button" onClick={() => onExport("html")}>HTML</button><button type="button" onClick={() => onExport("json")}>JSON</button></div>
        </>}
        {tab === "signals" && (analysis?.contextualFindings.length ? <div className="finding-grid">{analysis.contextualFindings.map(findingCard)}</div> : <p className="panel-empty">{analysis ? copy.noSignals : copy.noAnalysis}</p>)}
        {tab === "intent" && (analysis ? <div className="overview-panel"><p className="overview-summary">{analysis.overview.shortSummary}</p><h3>{copy.possiblePurpose}</h3><div className="purpose-grid">{analysis.overview.apparentPurposes.map((purpose) => <article key={purpose.purpose}><strong>{purpose.purpose}</strong><Badge>{copy[purpose.confidence]}</Badge><p>{purpose.explanation}</p></article>)}</div><h3>{copy.style}</h3><div className="tag-list">{analysis.overview.communicationStyle.map((item) => <Badge key={item}>{item}</Badge>)}</div><h3>{copy.patterns}</h3><ul>{analysis.overview.recurringPatterns.map((item) => <li key={item}>{item}</li>)}</ul><h3>{copy.balance}</h3><p>{analysis.overview.balanceAssessment.description}</p><h3>{copy.unanswered}</h3>{analysis.overview.unansweredQuestions.length ? <ul>{analysis.overview.unansweredQuestions.map((item) => <li key={item.questionSegmentId}><button type="button" className="text-link" onClick={() => onNavigate(item.questionSegmentId)}>{item.explanation}</button></li>)}</ul> : <p>{copy.none}</p>}<h3>{copy.escalation}</h3><p>{analysis.overview.escalationPattern.explanation ?? copy.none}</p></div> : <p className="panel-empty">{copy.noAnalysis}</p>)}
        {tab === "contradictions" && (analysis?.contradictions.length ? <div className="contradiction-list">{analysis.contradictions.map((item) => <article key={item.id}><div className="contradiction-pair"><button type="button" onClick={() => onNavigate(item.firstSegmentId)}><small>{copy.first}</small><q>{item.firstQuote}</q></button><span aria-hidden="true">↔</span><button type="button" onClick={() => onNavigate(item.secondSegmentId)}><small>{copy.second}</small><q>{item.secondQuote}</q></button></div><div className="finding-meta"><Badge tone={item.severity}>{item.classification.replaceAll("_", " ")}</Badge><Badge>{copy.confidence}: {copy[item.confidence]}</Badge></div><p>{item.explanation}</p>{item.missingContext && <p className="alternative">{item.missingContext}</p>}</article>)}</div> : <p className="panel-empty">{analysis ? copy.noContradictions : copy.noAnalysis}</p>)}
        {tab === "facts" && <><p className="privacy-notice">{copy.webNotice}</p>{verifiable.length > 1 && <button className="analysis-primary" type="button" disabled={checkingClaimIds.length > 0} onClick={() => onCheckClaims(verifiable)}>{copy.checkAll}</button>}{claimGroup(copy.ready, verifiable, true)}{claimGroup(copy.internal, internal, false)}{claimGroup(copy.other, other, false)}</>}
        {tab === "method" && <div className="method-panel"><p className="principle">{copy.principle}</p><p>{copy.method}</p>{analysis && <><dl><div><dt>{copy.model}</dt><dd>{analysis.model}</dd></div><div><dt>{copy.confidence}</dt><dd>{copy[analysis.overview.overallConfidence]}</dd></div>{analysis.chunked && <div><dt>{copy.chunked}</dt><dd>✓</dd></div>}</dl><h3>{language === "it" ? "Limiti" : "Limitations"}</h3><ul>{analysis.overview.limitations.map((item) => <li key={item}>{item}</li>)}</ul></>}</div>}
      </div>
    </section>
  );
}
