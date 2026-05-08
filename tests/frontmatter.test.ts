import { describe, it, expect } from "vitest";
import { parse, stringify, isInsight, getInsightFrontmatter } from "../src/frontmatter";

describe("frontmatter", () => {
  it("round-trips frontmatter and body", () => {
    const raw = `---
id: 01H
title: Hello
status: active
confidence: 0.7
---

This is the body.
`;
    const { data, body } = parse(raw);
    expect(data.id).toBe("01H");
    expect(data.status).toBe("active");
    expect(body.trim()).toBe("This is the body.");
    const re = stringify(data, body);
    const re2 = parse(re);
    expect(re2.data.id).toBe("01H");
  });

  it("isInsight requires status and confidence", () => {
    expect(isInsight({ status: "active", confidence: 0.5 })).toBe(true);
    expect(isInsight({ status: "active" })).toBe(false);
    expect(isInsight({})).toBe(false);
  });

  it("getInsightFrontmatter coerces missing arrays to []", () => {
    const fm = getInsightFrontmatter({
      id: "x",
      title: "T",
      status: "draft",
      confidence: 0.5,
      created: "2026-01-01",
      last_updated: "2026-01-01",
    });
    expect(fm).not.toBeNull();
    expect(fm!.tags).toEqual([]);
    expect(fm!.evidence).toEqual([]);
    expect(fm!.supersedes).toEqual([]);
  });

  it("getInsightFrontmatter returns null for non-insights", () => {
    expect(getInsightFrontmatter({ title: "wiki page" })).toBeNull();
  });
});
