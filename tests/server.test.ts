import { describe, it, expect } from "vitest";
import { wikilinkTarget, appendUnderHeading, linkLabel, relativeMarkdownPath } from "../src/server";

describe("wikilinkTarget", () => {
  it("strips path and .md", () => {
    expect(wikilinkTarget("wiki/claude-code/index.md")).toBe("index");
    expect(wikilinkTarget("insights/foo.md")).toBe("foo");
  });
});

describe("linkLabel", () => {
  it("returns the filename without extension", () => {
    expect(linkLabel("insights/foo-bar.md")).toBe("foo-bar");
    expect(linkLabel("foo.md")).toBe("foo");
  });
});

describe("relativeMarkdownPath", () => {
  it("returns ./sibling for same directory", () => {
    expect(relativeMarkdownPath("wiki/a.md", "wiki/b.md")).toBe("./b.md");
  });
  it("returns ../sibling-dir/file across one level", () => {
    expect(relativeMarkdownPath("insights/a.md", "wiki/b.md")).toBe("../wiki/b.md");
  });
  it("descends into subfolders", () => {
    expect(relativeMarkdownPath("wiki/index.md", "wiki/claude-code/x.md")).toBe(
      "./claude-code/x.md",
    );
  });
  it("handles deep cross-tree", () => {
    expect(relativeMarkdownPath("wiki/claude-code/x.md", "insights/y.md")).toBe(
      "../../insights/y.md",
    );
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
