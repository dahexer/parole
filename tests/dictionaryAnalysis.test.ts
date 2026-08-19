import { describe, expect, it } from "vitest";
import { analyseDictionarySegments, findDictionaryMatches } from "@/lib/dictionaryAnalysis";
import { redFlags } from "@/lib/redFlags";
import { redFlagsEn } from "@/lib/redFlagsEn";
import type { RedFlag } from "@/lib/redFlags";

const segment = (text: string) => ({ id: "s-1", text, startMs: 0, endMs: 1_000, source: "local-speech" as const, isFinal: true });

describe("dictionary analysis regression", () => {
  it("keeps Italian matching, severity and explanations", () => {
    const findings = analyseDictionarySegments([segment("Non è niente, stai esagerando.")], redFlags, "it");
    expect(findings.map((finding) => finding.quote.toLocaleLowerCase("it"))).toContain("stai esagerando");
    expect(findings.every((finding) => finding.explanation.length > 0)).toBe(true);
    expect(findings.every((finding) => ["low", "medium", "high"].includes(finding.severity))).toBe(true);
  });

  it("keeps English matching", () => {
    const findings = analyseDictionarySegments([segment("You are overreacting. It was just a joke.")], redFlagsEn, "en");
    expect(findings.map((finding) => finding.quote.toLocaleLowerCase("en"))).toEqual(expect.arrayContaining(["you are overreacting", "it was just a joke"]));
  });

  it("lets the longest overlapping phrase win", () => {
    const dictionary: RedFlag[] = [
      { phrase: "understand", category: "short", severity: "low", explanation: "short" },
      { phrase: "you do not understand", category: "long", severity: "high", explanation: "long" },
    ];
    const matches = findDictionaryMatches("You do not understand", dictionary, "en");
    expect(matches).toHaveLength(1);
    expect(matches[0].flag.category).toBe("long");
  });
});
