import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import { factCheckModelSchema, factCheckRequestSchema } from "@/lib/analysisSchema";
import { createOpenAIClient, factCheckModel } from "@/lib/openai";
import { factCheckingSystemPrompt } from "@/lib/prompts/factChecking";

export const runtime = "nodejs";

function citedUrls(output: OpenAI.Responses.ResponseOutputItem[]) {
  const urls = new Set<string>();
  for (const item of output) {
    if (item.type !== "message") continue;
    for (const content of item.content) {
      if (content.type !== "output_text") continue;
      for (const annotation of content.annotations) {
        if (annotation.type === "url_citation") urls.add(annotation.url);
      }
    }
  }
  return urls;
}

export async function POST(request: Request) {
  let language: "it" | "en" = "en";
  try {
    const parsed = factCheckRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid fact-check request / Richiesta di verifica non valida." }, { status: 400 });
    }
    language = parsed.data.language;
    const client = createOpenAIClient();
    if (!client) {
      return NextResponse.json({ error: language === "it" ? "La verifica non è configurata sul server." : "Fact checking is not configured on the server." }, { status: 503 });
    }
    const eligible = parsed.data.claims.filter((claim) => claim.claimType === "externally_verifiable");
    if (!eligible.length) {
      return NextResponse.json({ error: language === "it" ? "Nessuna affermazione verificabile selezionata." : "No verifiable claims were selected." }, { status: 400 });
    }
    const accessedDate = new Date().toISOString().slice(0, 10);
    const response = await client.responses.parse({
      model: factCheckModel(),
      store: false,
      tools: [{ type: "web_search" }],
      input: [
        { role: "developer", content: factCheckingSystemPrompt(language, accessedDate) },
        { role: "user", content: JSON.stringify({ claims: eligible, minimumContext: parsed.data.context }) },
      ],
      text: { format: zodTextFormat(factCheckModelSchema, "fact_check_results") },
    });
    if (!response.output_parsed) throw new Error("Structured fact-check response was empty");
    const citations = citedUrls(response.output);
    const allowedClaimIds = new Set(eligible.map((claim) => claim.id));
    const results = response.output_parsed.results.filter((result) => allowedClaimIds.has(result.claimId)).map((result) => ({
      ...result,
      sources: result.sources.filter((source) => citations.has(source.url)),
    })).map((result) => result.sources.length || ["unverifiable", "insufficient_reliable_evidence"].includes(result.verdict) ? result : {
      ...result,
      verdict: "insufficient_reliable_evidence" as const,
      confidence: "low" as const,
      caveats: [...result.caveats, language === "it" ? "Nessuna citazione verificabile è stata restituita." : "No verifiable citation was returned."],
    });
    return NextResponse.json({ results, model: factCheckModel(), checkedAt: new Date().toISOString() });
  } catch (error) {
    const status = error instanceof OpenAI.RateLimitError ? 429 : error instanceof OpenAI.APIConnectionTimeoutError ? 504 : 502;
    console.error("Fact check failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: language === "it" ? "La verifica non è momentaneamente disponibile." : "Fact checking is temporarily unavailable." }, { status });
  }
}
