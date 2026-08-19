"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { redFlags, severityLabels, type Severity } from "@/lib/redFlags";
import { redFlagsEn } from "@/lib/redFlagsEn";
import { analyseDictionarySegments } from "@/lib/dictionaryAnalysis";
import { createSegment, normaliseTranscriptForHash, transcriptDuration, transcriptText } from "@/lib/transcriptSegments";
import type {
  AnalysisOptions, ContextAnalysis, ConversationAnalysisExport, DictionaryFinding, FactCheckResult, FactualClaim, Language, TranscriptSegment,
} from "@/lib/analysisTypes";
import { ANALYSIS_SCHEMA_VERSION, PROMPT_VERSION } from "@/lib/analysisSchema";
import { TranscriptView, type TranscriptFinding } from "@/components/TranscriptView";
import { AudioImport } from "@/components/AudioImport";
import { AnalysisControls, ANALYSIS_STEPS } from "@/components/AnalysisControls";
import { AnalysisPanels } from "@/components/AnalysisPanels";
import { ConversationTimeline } from "@/components/ConversationTimeline";

type Mode = "local" | "remote";
type Theme = "light" | "dark";
type SpeechResultEvent = Event & { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
type SpeechErrorEvent = Event & { error: string };
type SpeechRecognitionLike = EventTarget & {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null; start: () => void; stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
}

const defaultOptions: AnalysisOptions = {
  analyseIntent: true,
  analyseContradictions: true,
  extractFactualClaims: true,
  analyseConversationPatterns: true,
};

const severityColors: Record<Severity, { background: string; color: string }> = {
  high: { background: "#ff5964", color: "#26080b" },
  medium: { background: "#ff9f43", color: "#291303" },
  low: { background: "#ffd166", color: "#2a2104" },
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const translations = {
  it: {
    ready: "Pronto ad ascoltare", homeAria: "Parole, torna all'inizio", privacy: "Privacy first",
    languageAria: "Seleziona la lingua", themeAria: (next: string) => `Passa alla modalità ${next}`, dark: "scura", light: "chiara",
    eyebrow: "Ascolta le parole. Riconosci i segnali.", headline: "Le parole lasciano tracce.", headlineAccent: "Noi le mettiamo in luce.",
    hero: "Trascrivi una conversazione, individua subito i segnali nel dizionario e analizza il significato nel contesto quando scegli di farlo.",
    featureAria: "Caratteristiche", features: ["Analisi locale istantanea", "Analisi contestuale facoltativa", "Verifica web esplicita"],
    workspaceAria: "Area di trascrizione", modeKicker: "Modalità di ascolto", modeQuestion: "Come vuoi trascrivere?", modeAria: "Seleziona modalità",
    localTitle: "Browser locale", localSubtitle: "Audio sul dispositivo", remoteTitle: "Remoto OpenAI", remoteSubtitle: "Maggiore precisione",
    localNote: "Il browser gestisce il riconoscimento. La disponibilità e il trattamento dell’audio dipendono dal browser usato.",
    remoteNote: "L’audio viene diviso in brevi segmenti e inviato all’endpoint sicuro per la trascrizione OpenAI.",
    statsAria: "Statistiche analisi", signals: "segnali locali", categories: "categorie", emptyTitle: "La trascrizione apparirà qui",
    emptyLine1: "Premi Start, parla oppure importa un file audio.", emptyLine2: "I segnali del dizionario verranno evidenziati subito.",
    start: "Start", stop: "Stop", clear: "Pulisci", copy: "Copia", edit: "Modifica", save: "Salva modifiche", cancel: "Annulla",
    legendAria: "Legenda gravità", legendTitle: "Livello del segnale", red: "Rosso", orange: "Arancione", yellow: "Giallo",
    highSeverity: "Alta gravità", mediumSeverity: "Media gravità", lowSeverity: "Bassa gravità", aiLegend: "✦ AI contestuale", weakenedLegend: "≈ Contesto indebolito",
    guidanceKicker: "Uno strumento, non un verdetto", guidanceTitle: "Il contesto conta.",
    guidanceBody: "Una frase isolata non definisce una relazione. I risultati indicano segnali linguistici da esaminare, non intenzioni provate o diagnosi. In caso di pericolo immediato, contatta i servizi di emergenza locali.",
    footer: "Consapevolezza nelle conversazioni, senza giudizio.", localSelected: "Modalità locale selezionata", remoteSelected: "Modalità OpenAI selezionata",
    languageSelected: "Italiano selezionato", segment: "Trascrizione del segmento…", failed: "Trascrizione non riuscita", remoteActive: "Ascolto e trascrizione in corso",
    completed: "Trascrizione completata", genericError: "Errore durante la trascrizione", localUnsupported: "Il riconoscimento locale non è supportato in questo browser. Prova Chrome o la modalità remota.",
    micDenied: "Permesso microfono negato", micError: "Errore microfono", startFailed: "Non è stato possibile avviare il microfono", localActive: "Ascolto locale in corso",
    recordingUnsupported: "La registrazione audio non è supportata in questo browser", remoteListening: "Ascolto remoto in corso", micUnavailable: "Permesso microfono negato o microfono non disponibile",
    sendingFinal: "Invio dell’ultimo segmento…", stopped: "Registrazione fermata", cleared: "Trascrizione pulita", nothingToCopy: "Non c’è ancora nulla da copiare",
    copiedRich: "Trascrizione copiata con evidenziazioni", copiedPlain: "Trascrizione copiata come testo semplice", invalidAudio: "Scegli un file audio supportato entro 25 MB.",
    imported: "File audio trascritto", editWarning: "La modifica manuale rimuove i timestamp perché il testo non è più allineato all’audio.", severity: severityLabels,
  },
  en: {
    ready: "Ready to listen", homeAria: "Parole, back to the top", privacy: "Privacy first", languageAria: "Select language",
    themeAria: (next: string) => `Switch to ${next} mode`, dark: "dark", light: "light", eyebrow: "Listen to the words. Recognise the signs.",
    headline: "Words leave traces.", headlineAccent: "We bring them to light.",
    hero: "Transcribe a conversation, see dictionary signals immediately, and analyse meaning in context when you choose to.",
    featureAria: "Features", features: ["Instant local analysis", "Optional contextual analysis", "Explicit web verification"],
    workspaceAria: "Transcription workspace", modeKicker: "Listening mode", modeQuestion: "How would you like to transcribe?", modeAria: "Select transcription mode",
    localTitle: "Local browser", localSubtitle: "Audio on this device", remoteTitle: "Remote OpenAI", remoteSubtitle: "Higher accuracy",
    localNote: "Your browser handles speech recognition. Availability and audio processing depend on the browser you use.",
    remoteNote: "Audio is split into short segments and sent to the secure endpoint for OpenAI transcription.",
    statsAria: "Analysis statistics", signals: "local signals", categories: "categories", emptyTitle: "Your transcript will appear here",
    emptyLine1: "Press Start, speak, or import an audio file.", emptyLine2: "Dictionary signals will be highlighted immediately.",
    start: "Start", stop: "Stop", clear: "Clear", copy: "Copy", edit: "Edit", save: "Save changes", cancel: "Cancel",
    legendAria: "Severity legend", legendTitle: "Signal level", red: "Red", orange: "Orange", yellow: "Yellow", highSeverity: "High severity", mediumSeverity: "Medium severity", lowSeverity: "Low severity",
    aiLegend: "✦ Contextual AI", weakenedLegend: "≈ Context weakened", guidanceKicker: "A tool, not a verdict", guidanceTitle: "Context matters.",
    guidanceBody: "A single phrase does not define a relationship. Results point to language worth reviewing, not proven intentions or diagnoses. If you are in immediate danger, contact your local emergency services.",
    footer: "Awareness in conversations, without judgement.", localSelected: "Local mode selected", remoteSelected: "OpenAI mode selected", languageSelected: "English selected",
    segment: "Transcribing segment…", failed: "Transcription failed", remoteActive: "Listening and transcribing", completed: "Transcription complete", genericError: "Error during transcription",
    localUnsupported: "Local speech recognition is not supported in this browser. Try Chrome or remote mode.", micDenied: "Microphone permission denied", micError: "Microphone error",
    startFailed: "The microphone could not be started", localActive: "Listening locally", recordingUnsupported: "Audio recording is not supported in this browser", remoteListening: "Listening remotely",
    micUnavailable: "Microphone permission denied or microphone unavailable", sendingFinal: "Sending the final segment…", stopped: "Recording stopped", cleared: "Transcript cleared",
    nothingToCopy: "There is nothing to copy yet", copiedRich: "Transcript copied with highlights", copiedPlain: "Transcript copied as plain text", invalidAudio: "Choose a supported audio file up to 25 MB.",
    imported: "Audio file transcribed", editWarning: "Manual editing removes timestamps because the text is no longer aligned with the audio.",
    severity: { high: "High", medium: "Medium", low: "Low" } as Record<Severity, string>,
  },
};

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("local");
  const [theme, setTheme] = useState<Theme>("light");
  const [language, setLanguage] = useState<Language>("it");
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [interim, setInterim] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [notice, setNotice] = useState("Pronto ad ascoltare");
  const [analysis, setAnalysis] = useState<ContextAnalysis | null>(null);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisOptions, setAnalysisOptions] = useState(defaultOptions);
  const [autoAnalyse, setAutoAnalyse] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<TranscriptFinding | null>(null);
  const [factChecks, setFactChecks] = useState<FactCheckResult[]>([]);
  const [checkingClaimIds, setCheckingClaimIds] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteActiveRef = useRef(false);
  const remoteCursorRef = useRef(0);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const abortAnalysisRef = useRef<AbortController | null>(null);
  const pendingAutoRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const t = translations[language];

  useEffect(() => {
    const saved = localStorage.getItem("rft-theme") as Theme | null;
    const savedLanguage: Language = localStorage.getItem("rft-language") === "en" ? "en" : "it";
    const initial = saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = initial;
    document.documentElement.lang = savedLanguage;
    const frame = requestAnimationFrame(() => {
      setTheme(initial); setLanguage(savedLanguage); setNotice(translations[savedLanguage].ready);
      setAutoAnalyse(localStorage.getItem("rft-auto-analyse") === "true");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const transcript = useMemo(() => transcriptText(transcriptSegments), [transcriptSegments]);
  const dictionary = language === "it" ? redFlags : redFlagsEn;
  const rawDictionaryFindings = useMemo(() => analyseDictionarySegments(transcriptSegments, dictionary, language), [dictionary, language, transcriptSegments]);
  const dictionaryContext = useMemo(() => new Map<string, DictionaryFinding["contextStatus"]>(analysis?.dictionaryContext.map((item) => [item.dictionaryFindingId, item.status]) ?? []), [analysis]);
  const dictionaryFindings = useMemo<DictionaryFinding[]>(() => rawDictionaryFindings.map((finding) => ({ ...finding, contextStatus: dictionaryContext.get(finding.id) ?? "not_context_checked" })), [dictionaryContext, rawDictionaryFindings]);
  const categoryCount = useMemo(() => new Set(dictionaryFindings.map((finding) => finding.category)).size, [dictionaryFindings]);
  const durationMs = useMemo(() => transcriptDuration(transcriptSegments), [transcriptSegments]);

  const invalidateAnalysis = useCallback(() => {
    setAnalysis(null); setFactChecks([]); setSelectedFinding(null); setAnalysisError(null);
  }, []);

  const appendTranscript = useCallback((text: string, source: TranscriptSegment["source"], timing: { startMs?: number | null; endMs?: number | null } = {}) => {
    const clean = text.trim();
    if (!clean) return;
    setTranscriptSegments((current) => [...current, createSegment(clean, source, timing)]);
    invalidateAnalysis();
  }, [invalidateAnalysis]);

  const addTranscribedPayload = useCallback((payload: { text?: string; durationMs?: number | null; segments?: Array<{ id: string; text: string; startMs: number | null; endMs: number | null }> }, source: "remote-transcription" | "audio-import") => {
    const base = source === "remote-transcription" ? remoteCursorRef.current : 0;
    const created = payload.segments?.length ? payload.segments.map((segment) => ({
      id: `${source}:${segment.id}:${Math.round(Math.random() * 1e6)}`,
      text: segment.text.trim(),
      startMs: segment.startMs === null ? null : base + segment.startMs,
      endMs: segment.endMs === null ? null : base + segment.endMs,
      source,
      isFinal: true,
    } satisfies TranscriptSegment)).filter((segment) => segment.text) : payload.text?.trim() ? [createSegment(payload.text, source, { startMs: base, endMs: payload.durationMs ? base + payload.durationMs : null })] : [];
    if (created.length) {
      setTranscriptSegments((current) => source === "audio-import" ? created : [...current, ...created]);
      invalidateAnalysis();
    }
    if (source === "remote-transcription") remoteCursorRef.current += payload.durationMs ?? 8_000;
  }, [invalidateAnalysis]);

  const uploadAudio = useCallback(async (blob: Blob, source: "remote-transcription" | "audio-import", fileName?: string) => {
    if (blob.size < 1 || blob.size > 25 * 1024 * 1024) throw new Error(t.invalidAudio);
    setIsProcessingAudio(true); setNotice(t.segment);
    const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mpeg") ? "mp3" : blob.type.includes("wav") ? "wav" : blob.type.includes("aac") ? "aac" : blob.type.includes("mp4") ? "m4a" : "webm";
    const formData = new FormData();
    formData.append("audio", blob, fileName || `segment-${Date.now()}.${extension}`); formData.append("language", language);
    try {
      const response = await fetch("/api/transcribe", { method: "POST", body: formData });
      const payload = await response.json() as { text?: string; durationMs?: number | null; segments?: Array<{ id: string; text: string; startMs: number | null; endMs: number | null }>; error?: string };
      if (!response.ok) throw new Error(payload.error || t.failed);
      addTranscribedPayload(payload, source);
      setNotice(source === "audio-import" ? t.imported : remoteActiveRef.current ? t.remoteActive : t.completed);
    } finally {
      if (source === "audio-import" || !remoteActiveRef.current) setIsProcessingAudio(false);
    }
  }, [addTranscribedPayload, language, t]);

  function recordSegment(stream: MediaStream) {
    if (!remoteActiveRef.current) return;
    const preferred = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
    const chunks: BlobPart[] = []; recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      uploadQueueRef.current = uploadQueueRef.current.then(() => uploadAudio(blob, "remote-transcription")).catch((error: unknown) => setNotice(error instanceof Error ? error.message : t.genericError)).finally(() => {
        if (!remoteActiveRef.current) setIsProcessingAudio(false);
      });
      if (remoteActiveRef.current) recordSegment(stream);
    };
    recorder.start();
    segmentTimerRef.current = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 8_000);
  }

  const startLocal = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { setNotice(t.localUnsupported); return; }
    const recognition = new Recognition(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = language === "it" ? "it-IT" : "en-US";
    recognition.onresult = (event) => {
      let finalText = ""; let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]; if (result.isFinal) finalText += result[0].transcript; else interimText += result[0].transcript;
      }
      if (finalText) appendTranscript(finalText, "local-speech"); setInterim(interimText);
    };
    recognition.onerror = (event) => { setNotice(event.error === "not-allowed" ? t.micDenied : `${t.micError}: ${event.error}`); setIsRecording(false); };
    recognition.onend = () => { setInterim(""); setIsRecording(false); };
    try { recognition.start(); recognitionRef.current = recognition; setIsRecording(true); setNotice(t.localActive); } catch { setNotice(t.startFailed); }
  };

  const startRemote = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setNotice(t.recordingUnsupported); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream; remoteActiveRef.current = true; remoteCursorRef.current = 0;
      setIsRecording(true); setNotice(t.remoteListening); recordSegment(stream);
    } catch { setNotice(t.micUnavailable); }
  };

  const start = () => {
    if (isRecording) return;
    if (mode === "local") startLocal();
    else void startRemote();
  };
  const stop = () => {
    recognitionRef.current?.stop(); recognitionRef.current = null; remoteActiveRef.current = false;
    if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
    if (recorderRef.current?.state === "recording") { setIsProcessingAudio(true); recorderRef.current.stop(); }
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
    setInterim(""); setIsRecording(false); pendingAutoRef.current = autoAnalyse;
    setNotice(mode === "remote" ? t.sendingFinal : t.stopped);
  };

  useEffect(() => () => {
    recognitionRef.current?.stop(); remoteActiveRef.current = false;
    if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop()); abortAnalysisRef.current?.abort();
  }, []);

  const runAnalysis = useCallback(async () => {
    const finals = transcriptSegments.filter((segment) => segment.isFinal && segment.text.trim());
    if (!finals.length || analysisRunning) return;
    const abort = new AbortController(); abortAnalysisRef.current = abort;
    const analysisTimeout = window.setTimeout(() => abort.abort("timeout"), 100_000);
    setAnalysisRunning(true); setAnalysisError(null); setAnalysisProgress(0);
    const progressTimer = window.setInterval(() => setAnalysisProgress((current) => Math.min(ANALYSIS_STEPS[language].length - 2, current + 1)), 1_800);
    try {
      const compactDictionary = rawDictionaryFindings.map((finding) => ({
        id: finding.id, segmentId: finding.segmentId, quote: finding.quote, startOffset: finding.startOffset, endOffset: finding.endOffset,
        category: finding.category, severity: finding.severity, explanation: finding.explanation, matchedPhrase: finding.matchedEntry.phrase,
      }));
      const keyMaterial = JSON.stringify({ transcript: normaliseTranscriptForHash(finals), language, analysisOptions, version: ANALYSIS_SCHEMA_VERSION, prompt: PROMPT_VERSION, model: "configured-server-model" });
      const cacheKey = `rft-analysis:${await sha256(keyMaterial)}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setAnalysis(JSON.parse(cached) as ContextAnalysis); setAnalysisProgress(ANALYSIS_STEPS[language].length - 1); return;
      }
      const response = await fetch("/api/analyse", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
        body: JSON.stringify({ language, segments: finals, dictionaryFindings: compactDictionary, options: analysisOptions }),
      });
      const payload = await response.json() as { analysis?: ContextAnalysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || (language === "it" ? "Analisi non riuscita." : "Analysis failed."));
      sessionStorage.setItem(cacheKey, JSON.stringify(payload.analysis)); setAnalysis(payload.analysis); setAnalysisProgress(ANALYSIS_STEPS[language].length - 1);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setAnalysisError(abort.signal.reason === "timeout"
          ? language === "it" ? "OpenAI non ha risposto entro 100 secondi. Riprova con una trascrizione più breve." : "OpenAI did not respond within 100 seconds. Retry with a shorter transcript."
          : language === "it" ? "Analisi annullata." : "Analysis cancelled.");
      }
      else setAnalysisError(error instanceof Error ? error.message : t.genericError);
    } finally {
      window.clearInterval(progressTimer); window.clearTimeout(analysisTimeout); setAnalysisRunning(false); abortAnalysisRef.current = null; pendingAutoRef.current = false;
    }
  }, [analysisOptions, analysisRunning, language, rawDictionaryFindings, t.genericError, transcriptSegments]);

  useEffect(() => {
    if (pendingAutoRef.current && !isRecording && !isProcessingAudio && transcriptSegments.length) void runAnalysis();
  }, [isProcessingAudio, isRecording, runAnalysis, transcriptSegments.length]);

  const checkClaims = async (claims: FactualClaim[]) => {
    const selected = claims.filter((claim) => claim.claimType === "externally_verifiable" && !factChecks.some((result) => result.claimId === claim.id));
    if (!selected.length) return; setCheckingClaimIds(selected.map((claim) => claim.id));
    try {
      const relatedIds = new Set(selected.flatMap((claim) => [claim.segmentId, ...claim.relatedSegmentIds]));
      const context = transcriptSegments.filter((segment) => relatedIds.has(segment.id)).map((segment) => ({ segmentId: segment.id, text: segment.text }));
      const response = await fetch("/api/fact-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, claims: selected, context }) });
      const payload = await response.json() as { results?: FactCheckResult[]; error?: string };
      if (!response.ok || !payload.results) throw new Error(payload.error || t.genericError);
      setFactChecks((current) => [...current.filter((item) => !selected.some((claim) => claim.id === item.claimId)), ...payload.results!]);
    } catch (error) { setAnalysisError(error instanceof Error ? error.message : t.genericError); }
    finally { setCheckingClaimIds([]); }
  };

  const navigate = (segmentId: string, timeMs?: number | null, findingId?: string) => {
    document.getElementById(`segment-${segmentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (timeMs !== undefined && timeMs !== null && audioRef.current) { audioRef.current.currentTime = timeMs / 1_000; void audioRef.current.play().catch(() => undefined); }
    if (findingId) setSelectedFinding([...dictionaryFindings, ...(analysis?.contextualFindings ?? [])].find((finding) => finding.id === findingId) ?? null);
  };

  const exportData = (): ConversationAnalysisExport => ({
    version: ANALYSIS_SCHEMA_VERSION, createdAt: new Date().toISOString(), language, transcript: transcriptSegments,
    dictionaryFindings, contextualFindings: analysis?.contextualFindings ?? [], contradictions: analysis?.contradictions ?? [],
    factualClaims: analysis?.factualClaims ?? [], factChecks, overview: analysis?.overview ?? null,
  });

  const exportAnalysis = (format: "text" | "html" | "json") => {
    const data = exportData(); let content: string; let type: string;
    if (format === "json") { content = JSON.stringify(data, null, 2); type = "application/json"; }
    else if (format === "html") {
      const highlights = dictionaryFindings.map((finding) => { const colors = severityColors[finding.severity]; return `<li><mark style="background:${colors.background};color:${colors.color}">${escapeHtml(finding.quote)}</mark> — ${escapeHtml(finding.category)} (${escapeHtml(finding.source)})</li>`; }).join("");
      content = `<!doctype html><meta charset="utf-8"><title>Parole</title><h1>Parole</h1><p>${escapeHtml(transcript)}</p><h2>${escapeHtml(analysis?.overview.shortSummary ?? "")}</h2><ul>${highlights}</ul><h2>Contextual findings</h2><ul>${(analysis?.contextualFindings ?? []).map((finding) => `<li><strong>${escapeHtml(finding.title)}</strong>: ${escapeHtml(finding.explanation)}</li>`).join("")}</ul><p><small>Legend: red high, orange medium, yellow low; ✦ contextual AI.</small></p>`; type = "text/html";
    } else {
      content = [transcript, "", analysis?.overview.shortSummary ?? "", "", ...dictionaryFindings.map((finding) => `[Dictionary · ${finding.severity}] “${finding.quote}” — ${finding.explanation}`), ...(analysis?.contextualFindings ?? []).map((finding) => `[Contextual AI · ${finding.severity}] “${finding.quote}” — ${finding.explanation}`), ...(analysis?.contradictions ?? []).map((item) => `[Contradiction] “${item.firstQuote}” ↔ “${item.secondQuote}” — ${item.explanation}`), ...(analysis?.factualClaims ?? []).map((claim) => `[Claim · ${claim.claimType}] “${claim.quote}” — ${claim.explanation}`), ...factChecks.map((result) => `[Fact check · ${result.verdict}] ${result.explanation} ${result.sources.map((source) => source.url).join(" ")}`)].join("\n"); type = "text/plain";
    }
    const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `parole.${format === "text" ? "txt" : format}`; anchor.click(); URL.revokeObjectURL(url);
  };

  const copyTranscript = async () => {
    if (!transcript) { setNotice(t.nothingToCopy); return; }
    const html = dictionaryFindings.reduce((result, finding) => result.replace(escapeHtml(finding.quote), `<mark>${escapeHtml(finding.quote)}</mark>`), escapeHtml(transcript));
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) { await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([transcript], { type: "text/plain" }), "text/html": new Blob([`<p>${html}</p>`], { type: "text/html" }) })]); setNotice(t.copiedRich); }
      else { await navigator.clipboard.writeText(transcript); setNotice(t.copiedPlain); }
    } catch { setNotice(t.copiedPlain); }
  };

  const clearTranscript = () => { setTranscriptSegments([]); setInterim(""); invalidateAnalysis(); setNotice(t.cleared); if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); } };
  const changeMode = (next: Mode) => { if (isRecording) stop(); setMode(next); setNotice(next === "local" ? t.localSelected : t.remoteSelected); };
  const changeLanguage = (next: Language) => { if (isRecording) stop(); setLanguage(next); invalidateAnalysis(); setNotice(translations[next].languageSelected); document.documentElement.lang = next; localStorage.setItem("rft-language", next); };
  const toggleTheme = () => { const next = theme === "light" ? "dark" : "light"; setTheme(next); document.documentElement.dataset.theme = next; localStorage.setItem("rft-theme", next); };
  const importFile = (file: File) => {
    const allowedExtension = /\.(mp3|wav|m4a|mp4|webm|ogg|aac)$/i.test(file.name);
    if (file.size > 25 * 1024 * 1024 || (!file.type.startsWith("audio/") && file.type !== "video/mp4" && !allowedExtension)) { setNotice(t.invalidAudio); return; }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(file));
    void uploadAudio(file, "audio-import", file.name).catch((error: unknown) => {
      setIsProcessingAudio(false);
      setNotice(error instanceof Error ? error.message : t.genericError);
    });
  };
  const saveEdit = () => {
    if (!editDraft.trim()) return; setTranscriptSegments([createSegment(editDraft, "local-speech")]); invalidateAnalysis(); setEditing(false); setNotice(t.editWarning);
  };

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#top" aria-label={t.homeAria}><span className="brand-mark" aria-hidden="true">P</span><span><strong>Parole</strong></span></a><div className="topbar-actions"><label className="language-select"><span className="sr-only">{t.languageAria}</span><select value={language} onChange={(event) => changeLanguage(event.target.value as Language)} aria-label={t.languageAria}><option value="it">IT · Italiano</option><option value="en">EN · English</option></select></label><span className="privacy-pill"><span aria-hidden="true">●</span> {t.privacy}</span><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={t.themeAria(theme === "light" ? t.dark : t.light)}><span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span></button></div></header>
    <section className="hero" id="top"><div className="eyebrow"><span aria-hidden="true">✦</span> {t.eyebrow}</div><h1>{t.headline}<br /><em>{t.headlineAccent}</em></h1><p>{t.hero}</p><div className="trust-row" aria-label={t.featureAria}>{t.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div></section>
    <section className="workspace" aria-label={t.workspaceAria}>
      <div className="mode-panel"><div className="mode-copy"><span className="section-kicker">{t.modeKicker}</span><h2>{t.modeQuestion}</h2></div><div className="mode-switch" role="group" aria-label={t.modeAria}><button type="button" className={mode === "local" ? "active" : ""} onClick={() => changeMode("local")} aria-pressed={mode === "local"}><span className="mode-icon" aria-hidden="true">⌁</span><span><strong>{t.localTitle}</strong><small>{t.localSubtitle}</small></span></button><button type="button" className={mode === "remote" ? "active" : ""} onClick={() => changeMode("remote")} aria-pressed={mode === "remote"}><span className="mode-icon" aria-hidden="true">◈</span><span><strong>{t.remoteTitle}</strong><small>{t.remoteSubtitle}</small></span></button></div><p className="mode-note"><span aria-hidden="true">{mode === "local" ? "⌂" : "◇"}</span>{mode === "local" ? t.localNote : t.remoteNote}</p></div>
      <AudioImport language={language} disabled={isRecording || isProcessingAudio} onFile={importFile} />
      {audioUrl && <audio ref={audioRef} className="audio-player" controls src={audioUrl} />}
      <div className="transcript-card"><div className="transcript-head"><div><span className={`status-dot ${isRecording ? "live" : ""}`} aria-hidden="true" /><span className="status-label" aria-live="polite">{notice}</span></div><div className="metrics" aria-label={t.statsAria}><span><strong>{dictionaryFindings.length}</strong> {t.signals}</span><span><strong>{categoryCount}</strong> {t.categories}</span></div></div>
        <div className={`transcript-body ${!transcript && !interim ? "empty" : ""}`}>{!transcript && !interim ? <div className="empty-state"><div className="sound-orbit" aria-hidden="true"><span>⌁</span></div><h3>{t.emptyTitle}</h3><p>{t.emptyLine1}<br />{t.emptyLine2}</p></div> : editing ? <div className="editor"><p>{t.editWarning}</p><textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} autoFocus /><div><button type="button" className="analysis-primary" onClick={saveEdit}>{t.save}</button><button type="button" className="secondary-control" onClick={() => setEditing(false)}>{t.cancel}</button></div></div> : <TranscriptView segments={transcriptSegments} interim={interim} dictionaryFindings={dictionaryFindings} contextualFindings={analysis?.contextualFindings ?? []} selectedId={selectedFinding?.id ?? null} language={language} onSelect={setSelectedFinding} />}</div>
        <div className="controls"><button type="button" className={`primary-control ${isRecording ? "recording" : ""}`} onClick={isRecording ? stop : start} disabled={isProcessingAudio}><span aria-hidden="true">{isRecording ? "■" : "●"}</span> {isRecording ? t.stop : t.start}</button><button type="button" className="secondary-control" onClick={clearTranscript} disabled={!transcript && !interim}><span aria-hidden="true">↺</span> {t.clear}</button><button type="button" className="secondary-control" onClick={() => { setEditDraft(transcript); setEditing(true); }} disabled={!transcript || isRecording}><span aria-hidden="true">✎</span> {t.edit}</button><button type="button" className="secondary-control copy-control" onClick={() => void copyTranscript()} disabled={!transcript}><span aria-hidden="true">▣</span> {t.copy}</button></div>
      </div>
      <div className="legend" aria-label={t.legendAria}><span className="legend-title">{t.legendTitle}</span><span><i className="legend-dot high" />{t.red} <small>{t.highSeverity}</small></span><span><i className="legend-dot medium" />{t.orange} <small>{t.mediumSeverity}</small></span><span><i className="legend-dot low" />{t.yellow} <small>{t.lowSeverity}</small></span><span>{t.aiLegend}</span><span>{t.weakenedLegend}</span></div>
      <ConversationTimeline durationMs={durationMs} dictionaryFindings={dictionaryFindings} contextualFindings={analysis?.contextualFindings ?? []} factChecks={factChecks} language={language} onNavigate={(segmentId, timeMs, findingId) => navigate(segmentId, timeMs, findingId)} />
      <AnalysisControls language={language} disabled={!transcript || isRecording || isProcessingAudio} running={analysisRunning} hasAnalysis={!!analysis} progress={analysisProgress} error={analysisError} lastAnalysedAt={analysis?.analysedAt ?? null} options={analysisOptions} autoAnalyse={autoAnalyse} onOptions={setAnalysisOptions} onAutoAnalyse={(value) => { setAutoAnalyse(value); localStorage.setItem("rft-auto-analyse", String(value)); }} onAnalyse={() => void runAnalysis()} onCancel={() => abortAnalysisRef.current?.abort()} />
      <AnalysisPanels language={language} analysis={analysis} dictionaryFindings={dictionaryFindings} selectedFinding={selectedFinding} factChecks={factChecks} checkingClaimIds={checkingClaimIds} onNavigate={(segmentId, findingId) => navigate(segmentId, undefined, findingId)} onCheckClaims={(claims) => void checkClaims(claims)} onExport={exportAnalysis} />
    </section>
    <section className="guidance"><div><span className="section-kicker">{t.guidanceKicker}</span><h2>{t.guidanceTitle}</h2></div><p>{t.guidanceBody}</p></section>
    <footer><span>Parole</span><p>{t.footer}</p></footer>
  </main>;
}
