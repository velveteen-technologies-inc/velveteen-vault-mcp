import { describe, it, expect } from "vitest";
import { tokenize, scoreContent, makeSnippet, tierOf } from "../src/search.js";

describe("tokenize", () => {
  it("lowercases and splits on non-alphanumerics", () => {
    expect(tokenize("Claude Code MCP")).toEqual(["claude", "code", "mcp"]);
  });

  it("drops single-character tokens", () => {
    expect(tokenize("a big idea")).toEqual(["big", "idea"]);
  });

  it("handles empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("scoreContent", () => {
  it("counts term occurrences", () => {
    const score = scoreContent("claude is a model. claude code uses claude.", ["claude"], "x.md");
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it("rewards path matches", () => {
    const inPath = scoreContent("body", ["mcp"], "wiki/mcp/intro.md");
    const inBodyOnly = scoreContent("mcp body", ["mcp"], "wiki/x/intro.md");
    expect(inPath).toBeGreaterThan(inBodyOnly);
  });

  it("returns 0 for no matches", () => {
    expect(scoreContent("hello world", ["banana"], "x.md")).toBe(0);
  });
});

describe("makeSnippet", () => {
  it("centers around first matching term", () => {
    const text = "a".repeat(200) + " TARGET " + "b".repeat(200);
    const snippet = makeSnippet(text, ["target"]);
    expect(snippet.toLowerCase()).toContain("target");
    expect(snippet.startsWith("...")).toBe(true);
    expect(snippet.endsWith("...")).toBe(true);
  });

  it("does not crash if term missing", () => {
    const snippet = makeSnippet("short body", ["missing"]);
    expect(snippet).toBeTruthy();
  });
});

describe("tierOf", () => {
  it("classifies known prefixes", () => {
    expect(tierOf("insights/x.md")).toBe("insights");
    expect(tierOf("wiki/foo/bar.md")).toBe("wiki");
    expect(tierOf("raw/y.md")).toBe("raw");
    expect(tierOf("daily-notes/2026-05-08.md")).toBe("daily-notes");
    expect(tierOf("people/alice.md")).toBe("people");
    expect(tierOf("projects/p.md")).toBe("projects");
  });

  it("falls back to other", () => {
    expect(tierOf("config/creators.yml")).toBe("other");
  });
});
