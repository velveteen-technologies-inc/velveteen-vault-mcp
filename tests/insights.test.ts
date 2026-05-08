import { describe, it, expect } from "vitest";
import { slugify, buildInsightFile, markSuperseded } from "../src/insights";
import { parse } from "../src/frontmatter";

describe("slugify", () => {
  it("normalizes spaces and punctuation", () => {
    expect(slugify("Claude Code is GREAT!")).toBe("claude-code-is-great");
  });

  it("trims dashes from edges", () => {
    expect(slugify("---hello---")).toBe("hello");
  });

  it("caps length at 80", () => {
    expect(slugify("a".repeat(200)).length).toBe(80);
  });
});

describe("buildInsightFile", () => {
  it("produces valid frontmatter and a path under insights/", () => {
    const out = buildInsightFile({
      title: "MCP unlocks voice second brain",
      content: "Talking to the vault during hikes is the killer use case.",
      tags: ["meta", "dev"],
      evidence: ["raw/yt-foo.md"],
      confidence: 0.8,
      status: "draft",
      supersedes: [],
    });
    expect(out.path).toBe("insights/mcp-unlocks-voice-second-brain.md");
    const { data, body } = parse(out.body);
    expect(data.status).toBe("draft");
    expect(data.confidence).toBe(0.8);
    expect(data.tags).toEqual(["meta", "dev"]);
    expect(data.evidence).toEqual(["raw/yt-foo.md"]);
    expect(typeof data.id).toBe("string");
    expect((data.id as string).length).toBeGreaterThan(20);
    expect(body).toContain("Talking to the vault");
  });
});

describe("markSuperseded", () => {
  it("flips status to revised and bumps last_updated", () => {
    const before = `---
id: x
title: Old
status: active
confidence: 0.7
created: 2026-01-01T00:00:00.000Z
last_updated: 2026-01-01T00:00:00.000Z
tags: []
evidence: []
supersedes: []
---

old body
`;
    const after = markSuperseded(before, "insights/new.md");
    const { data } = parse(after);
    expect(data.status).toBe("revised");
    expect(data.last_updated).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("leaves non-insight notes untouched", () => {
    const before = `---
title: Wiki page
---

body
`;
    const after = markSuperseded(before, "insights/x.md");
    expect(after).toBe(before);
  });
});
