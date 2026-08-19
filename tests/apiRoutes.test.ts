import { afterEach, describe, expect, it } from "vitest";
import { POST as analyse } from "@/app/api/analyse/route";
import { POST as factCheck } from "@/app/api/fact-check/route";

const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => { process.env.OPENAI_API_KEY = originalKey; });

describe("analysis API boundaries", () => {
  it("rejects invalid requests", async () => {
    const response = await analyse(new Request("http://local/api/analyse", { method: "POST", body: JSON.stringify({ language: "en" }) }));
    expect(response.status).toBe(400);
  });

  it("returns a friendly missing-key response", async () => {
    delete process.env.OPENAI_API_KEY;
    const response = await analyse(new Request("http://local/api/analyse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      language: "en", segments: [{ id: "s-1", text: "Hello", startMs: null, endMs: null, source: "local-speech", isFinal: true }], dictionaryFindings: [], options: { analyseIntent: true, analyseContradictions: true, extractFactualClaims: true, analyseConversationPatterns: true },
    }) }));
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty("error");
  });

  it("rejects fact checking with no selected claims", async () => {
    const response = await factCheck(new Request("http://local/api/fact-check", { method: "POST", body: JSON.stringify({ language: "en", claims: [], context: [] }) }));
    expect(response.status).toBe(400);
  });
});
