import matter from "gray-matter";

export interface InsightFrontmatter {
  id: string;
  title: string;
  created: string;
  last_updated: string;
  status: "draft" | "active" | "revised" | "retired";
  confidence: number;
  tags: string[];
  evidence: string[];
  supersedes: string[];
}

export interface ParsedNote {
  data: Record<string, unknown>;
  body: string;
}

export function parse(raw: string): ParsedNote {
  const { data, content } = matter(raw);
  return { data: data as Record<string, unknown>, body: content };
}

export function stringify(data: Record<string, unknown>, body: string): string {
  return matter.stringify(body, data);
}

export function isInsight(data: Record<string, unknown>): boolean {
  return typeof data.status === "string" && typeof data.confidence === "number";
}

export function getInsightFrontmatter(
  data: Record<string, unknown>,
): InsightFrontmatter | null {
  if (!isInsight(data)) return null;
  return {
    id: String(data.id ?? ""),
    title: String(data.title ?? ""),
    created: String(data.created ?? ""),
    last_updated: String(data.last_updated ?? ""),
    status: data.status as InsightFrontmatter["status"],
    confidence: Number(data.confidence),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    evidence: Array.isArray(data.evidence) ? (data.evidence as string[]) : [],
    supersedes: Array.isArray(data.supersedes) ? (data.supersedes as string[]) : [],
  };
}
