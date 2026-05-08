import { describe, it, expect } from "vitest";
import { wikilinkTarget, appendUnderHeading } from "../src/server";

describe("wikilinkTarget", () => {
  it("strips path and .md", () => {
    expect(wikilinkTarget("wiki/claude-code/index.md")).toBe("index");
    expect(wikilinkTarget("insights/foo.md")).toBe("foo");
  });
});

describe("appendUnderHeading", () => {
  it("appends to existing heading", () => {
    const before = `# Note\n\nBody.\n\n## Related\n\n- [[a]]\n`;
    const after = appendUnderHeading(before, "Related", "- [[b]]");
    expect(after).toContain("- [[a]]");
    expect(after).toContain("- [[b]]");
  });

  it("creates heading if missing", () => {
    const before = `# Note\n\nBody.\n`;
    const after = appendUnderHeading(before, "Related", "- [[b]]");
    expect(after).toContain("## Related");
    expect(after).toContain("- [[b]]");
  });
});
