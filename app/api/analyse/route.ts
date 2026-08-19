import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import {
  analyseRequestSchema,
  contextAnalysisModelSchema,
  validateAndAlignAnalysis,
  withAnalysisMetadata,
} from "@/lib/analysisSchema";
import { analysisModel, createOpenAIClient } from "@/lib/openai";
import { contextualAnalysisInput, contextualAnalysisSystemPrompt } from "@/lib/prompts/contextualAnalysis";
import { chunkTranscriptSegments } from "@/lib/transcriptSegments";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 1_500_000;
const MAX_TRANSCRIPT_CHARACTERS = 240_000;

function errorMessage(language: "it" | "en", key: "missing" | "invalid" | "large" | "provider" | "rate" | "timeout") {
  const messages = {
    it: {
      missing: "L’analisi contestuale non è configurata sul server.",
      invalid: "La richiesta di analisi non è valida.",
      large: "La trascrizione supera il limite configurato.",
      provider: "Il servizio di analisi non è momentaneamente disponibile.",
      rate: "Troppe richieste di analisi. Riprova tra poco.",
      timeout: "L’analisi ha impiegato troppo tempo. Riprova.",
    },
    en: {
      missing: "Contextual analysis is not configured on the server.",
      invalid: "The analysis request is invalid.",
      large: "The transcript exceeds the configured limit.",
      provider: "The analysis service is temporarily unavailable.",
      rate: "Too many analysis requests. Please try again shortly.",
      timeout: "The analysis took too long. Please retry.",
    },
  };
  return messages[language][key];
}

function combineParts(parts: Array<ReturnType<typeof validateAndAlignAnalysis>["value"]>, language: "it" | "en") {
  const unique = <T>(values: T[], key: (value: T) => string) => Array.from(new Map(values.map((value) => [key(value), value])).values());
  const contextualFindings = unique(parts.flatMap((part) => part.contextualFindings), (item) => `${item.segmentId}:${item.startOffset}:${item.endOffset}:${item.category}`);
  const contradictions = unique(parts.flatMap((part) => part.contradictions), (item) => `${item.firstSegmentId}:${item.secondSegmentId}:${item.classification}`);
  const factualClaims = unique(parts.flatMap((part) => part.factualClaims), (item) => `${item.segmentId}:${item.quote.toLocaleLowerCase()}`);
  const dictionaryContext = unique(parts.flatMap((part) => part.dictionaryContext), (item) => item.dictionaryFindingId);
  const overviews = parts.map((part) => part.overview);
  const first = overviews[0];
  return {
    contextualFindings,
    contradictions,
    factualClaims,
    dictionaryContext,
    overview: {
      ...first,
      shortSummary: overviews.map((overview) => overview.shortSummary).join(" ").slice(0, 2_000),
      apparentPurposes: unique(overviews.flatMap((overview) => overview.apparentPurposes), (item) => item.purpose).slice(0, 20),
      communicationStyle: Array.from(new Set(overviews.flatMap((overview) => overview.communicationStyle))).slice(0, 30),
      recurringPatterns: Array.from(new Set(overviews.flatMap((overview) => overview.recurringPatterns))).slice(0, 30),
      unansweredQuestions: unique(overviews.flatMap((overview) => overview.unansweredQuestions), (item) => item.questionSegmentId).slice(0, 40),
      escalationPattern: overviews.find((overview) => overview.escalationPattern.detected)?.escalationPattern ?? first.escalationPattern,
      overallSignalLevel: overviews.some((overview) => overview.overallSignalLevel === "high") ? "high" as const
        : overviews.some((overview) => overview.overallSignalLevel === "moderate") ? "moderate" as const : "low" as const,
      limitations: Array.from(new Set([
        ...overviews.flatMap((overview) => overview.limitations),
        language === "it"
          ? "La trascrizione lunga è stata analizzata in blocchi sovrapposti; alcuni collegamenti tra blocchi potrebbero non essere rilevati."
          : "The long transcript was analysed in overlapping blocks; some cross-block relationships may not be detected.",
      ])).slice(0, 30),
    },
  };
}

export async function POST(request: Request) {
  let language: "it" | "en" = "en";
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: errorMessage(language, "large") }, { status: 413 });
    }
    const parsed = analyseRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: errorMessage(language, "invalid") }, { status: 400 });
    }
    language = parsed.data.language;
    const client = createOpenAIClient();
    if (!client) return NextResponse.json({ error: errorMessage(language, "missing") }, { status: 503 });

    const transcriptCharacters = parsed.data.segments.reduce((sum, segment) => sum + segment.text.length, 0);
    if (transcriptCharacters > MAX_TRANSCRIPT_CHARACTERS) {
      return NextResponse.json({ error: errorMessage(language, "large") }, { status: 413 });
    }

    const model = analysisModel();
    const supportsReasoningControls = /^(gpt-5|o[134])/.test(model);
    const chunks = chunkTranscriptSegments(parsed.data.segments);
    const parts: Array<ReturnType<typeof validateAndAlignAnalysis>["value"]> = [];
    let rejectedFindings = 0;

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const segmentIds = new Set(chunk.map((segment) => segment.id));
      const matches = parsed.data.dictionaryFindings.filter((finding) => segmentIds.has(finding.segmentId));
      const response = await client.responses.parse({
        model,
        store: false,
        ...(supportsReasoningControls ? { reasoning: { effort: "low" as const } } : {}),
        input: [
          { role: "developer", content: contextualAnalysisSystemPrompt(language) },
          { role: "user", content: contextualAnalysisInput(language, chunk, matches, parsed.data.options, chunks.length > 1 ? { index, total: chunks.length } : undefined) },
        ],
        text: {
          ...(supportsReasoningControls ? { verbosity: "low" as const } : {}),
          format: zodTextFormat(contextAnalysisModelSchema, "conversation_analysis"),
        },
      });
      if (!response.output_parsed) throw new Error("Structured analysis response was empty");
      const validated = validateAndAlignAnalysis(response.output_parsed, parsed.data.segments, parsed.data.dictionaryFindings);
      parts.push(validated.value);
      rejectedFindings += validated.rejectedFindings;
    }

    const value = parts.length === 1 ? parts[0] : combineParts(parts, language);
    return NextResponse.json({
      analysis: withAnalysisMetadata(value, model, chunks.length > 1),
      rejectedFindings,
    });
  } catch (error) {
    if (error instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: errorMessage(language, "rate") }, { status: 429 });
    }
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return NextResponse.json({ error: errorMessage(language, "timeout") }, { status: 504 });
    }
    console.error("Contextual analysis failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: errorMessage(language, "provider") }, { status: 502 });
  }
}
