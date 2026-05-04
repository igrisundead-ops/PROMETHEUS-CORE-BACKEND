export const FONT_CATEGORY_IDS = [
  "display-serif",
  "display-sans",
  "script",
  "neutral-sans",
  "mono",
  "decorative"
] as const;

export type FontCategory = (typeof FONT_CATEGORY_IDS)[number];

export const FONT_ROLE_BANDS = ["hero", "support", "body", "accent", "unknown"] as const;
export type FontRoleBand = (typeof FONT_ROLE_BANDS)[number];

export const FONT_CONTEXT_ROLES = [
  "hero",
  "headline",
  "subtitle",
  "caption",
  "quote",
  "support",
  "accent",
  "ui",
  "mono",
  "unknown"
] as const;
export type FontContextRole = (typeof FONT_CONTEXT_ROLES)[number];

export const FONT_USAGE_LAYERS = [
  "frontend-ui",
  "rendering",
  "template-system",
  "component",
  "animation-text-layer",
  "stylebook",
  "debug",
  "unknown"
] as const;
export type FontUsageLayer = (typeof FONT_USAGE_LAYERS)[number];

export const FONT_SOURCE_TYPES = [
  "google",
  "remotion-google",
  "local",
  "system",
  "css-fallback",
  "unknown"
] as const;
export type FontSourceType = (typeof FONT_SOURCE_TYPES)[number];

export const FONT_QUALITY_FLAGS = [
  "readability-risk",
  "overused",
  "premium-conflict",
  "limited-weight-range",
  "motion-noise-risk",
  "kerning-risk",
  "role-bleed"
] as const;
export type FontQualityFlag = (typeof FONT_QUALITY_FLAGS)[number];

export type FontUsageOccurrence = {
  filePath: string;
  line: number;
  stack: string;
  fontToken: string;
  contextRole: FontContextRole;
  roleBand: FontRoleBand;
  usageLayer: FontUsageLayer;
  dynamicChoice: boolean;
  activeRuntime: boolean;
  rawLine: string;
};

export type FontNode = {
  id: string;
  name: string;
  normalizedName: string;
  category: FontCategory;
  sourceTypes: FontSourceType[];
  usageCount: number;
  dynamicUseCount: number;
  hardcodedUseCount: number;
  activeRuntimeUseCount: number;
  legacyUseCount: number;
  files: string[];
  stacks: string[];
  contextRoles: FontContextRole[];
  roleBands: FontRoleBand[];
  qualityFlags: FontQualityFlag[];
  qualityNotes: string[];
  weightRange: string;
  allowedRoleBands: FontRoleBand[];
  occurrences: FontUsageOccurrence[];
};

export type TypographyAuditIssue = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  summary: string;
  fontNames: string[];
};

export type TypographyAuditSummary = {
  filesScanned: number;
  fontOccurrenceCount: number;
  uniqueFontCount: number;
  dynamicOccurrenceCount: number;
  hardcodedOccurrenceCount: number;
  activeRuntimeOccurrenceCount: number;
  legacyOccurrenceCount: number;
};

export type TypographyAuditReport = {
  generatedAt: string;
  repoRoot: string;
  summary: TypographyAuditSummary;
  fontNodes: FontNode[];
  issues: TypographyAuditIssue[];
  missingCategories: string[];
  governanceGaps: string[];
  removalRecommendations: string[];
  categoryMap: Record<FontCategory, string[]>;
};
