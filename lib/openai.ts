import OpenAI from "openai";

export function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 75_000, maxRetries: 0 });
}

export const analysisModel = () => process.env.OPENAI_ANALYSIS_MODEL || "gpt-5-mini";
export const factCheckModel = () => process.env.OPENAI_FACT_CHECK_MODEL || process.env.OPENAI_ANALYSIS_MODEL || "gpt-5-mini";
