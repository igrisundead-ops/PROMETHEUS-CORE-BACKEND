export const FONT_ROLE_VALUES = ["hero", "subtitle", "support", "body", "caption", "quote"] as const;
export const FONT_PERSONALITY_VALUES = [
  "clean",
  "neutral",
  "editorial",
  "luxury",
  "dramatic",
  "expressive",
  "ceremonial",
  "technical",
  "romantic",
  "fashion",
  "readable",
  "decorative",
  "minimal",
  "vintage",
  "futuristic",
  "organic",
  "geometric",
  "authoritative"
] as const;
export const FONT_CLASSIFICATION_VALUES = [
  "sans",
  "serif",
  "script",
  "display",
  "mono",
  "blackletter",
  "decorative",
  "condensed",
  "wide",
  "variable"
] as const;

export type FontRole = typeof FONT_ROLE_VALUES[number];
export type FontPersonality = typeof FONT_PERSONALITY_VALUES[number];
export type FontClassification = typeof FONT_CLASSIFICATION_VALUES[number];

export type FontVariationAxis = {
  tag: string;
  min: number;
  default: number;
  max: number;
  name: string | null;
};

export type FontObservedMetadata = {
  sourceFilename: string;
  sourceZipPath: string;
  extractedRelativePath: string;
  extractedAbsolutePath: string;
  filename: string;
  extension: ".ttf" | ".otf" | ".woff" | ".woff2";
  postscriptName: string | null;
  familyName: string | null;
  subfamilyName: string | null;
  fullName: string | null;
  weightClass: number | null;
  widthClass: number | null;
  italic: boolean | null;
  glyphCount: number | null;
  unicodeRanges: string[];
  ascent: number | null;
  descent: number | null;
  capHeight: number | null;
  xHeight: number | null;
  licenseTexts: string[];
  variationAxes: FontVariationAxis[];
};

export type FontHeuristicProfile = {
  classifications: FontClassification[];
  primaryRole: FontRole;
  roles: FontRole[];
  personality: FontPersonality[];
  likelyUseCases: string[];
  avoidUseCases: string[];
  pairingGuidance: string[];
  motionCompatibility: string[];
  readabilityScore: number;
  expressivenessScore: number;
  confidence: number;
};

export type FontManifestRecord = {
  fontId: string;
  familyId: string;
  fileHash: string;
  contentHash: string;
  descriptorHash: string;
  status: "ok" | "fallback";
  metadataConfidence: "high" | "medium" | "low";
  needsManualLicenseReview: boolean;
  canonicalSourceZip: string;
  sourceZips: string[];
  duplicateSourceZips: string[];
  duplicateCount: number;
  observed: FontObservedMetadata;
  inferred: FontHeuristicProfile;
  descriptor: string;
  specimenPath: string | null;
  metadataWarnings: string[];
  metadataErrors: string[];
  createdAt: string;
  updatedAt: string;
};

export type FontDescriptorRecord = {
  fontId: string;
  familyId: string;
  descriptorHash: string;
  descriptor: string;
  filePath: string;
  metadata: FontManifestRecord;
};

export type FontEmbeddingRecord = {
  font_id: string;
  family_id: string;
  embedding_model: string;
  embedding_provider: string;
  embedding_dimensions: number;
  descriptor_hash: string;
  embedding: number[];
  descriptor: string;
  metadata: FontManifestRecord;
};

export type FontCompatibilityBreakdown = {
  roleContrast: number;
  readabilitySupportBonus: number;
  expressivenessContrast: number;
  sameFamilyPenalty: number;
  decorativeClashPenalty: number;
  sameClassificationPenalty: number;
  licensePenalty: number;
  unicodeCoverageBonus: number;
  styleContrastBonus: number;
  embeddingSignal: number;
};

export type FontCompatibilityEdge = {
  from: string;
  to: string;
  pairing_type: string;
  score: number;
  reason: string;
  recommended_usage: string[];
  needs_manual_license_review: boolean;
  breakdown: FontCompatibilityBreakdown;
};

export type FontCompatibilityNode = {
  id: string;
  family: string | null;
  style: string | null;
  roles: FontRole[];
  primary_role: FontRole;
  personality: FontPersonality[];
  metadata: FontManifestRecord;
};

export type FontCompatibilityGraph = {
  nodes: FontCompatibilityNode[];
  edges: FontCompatibilityEdge[];
};

export type FontIngestionReport = {
  sourceZipDir: string;
  workspaceDir: string;
  scannedZipCount: number;
  extractedFontCount: number;
  canonicalFontCount: number;
  duplicatesSkipped: number;
  failedFonts: number;
  successfulDescriptors: number;
  specimenCount: number;
  generatedAt: string;
  warnings: string[];
  failures: Array<{
    sourceZipPath: string;
    entryName: string;
    reason: string;
  }>;
};

export type FontPipelinePaths = {
  repoRoot: string;
  workspaceDir: string;
  rawZipsDir: string;
  sourceZipDir: string;
  extractedFontsDir: string;
  specimensDir: string;
  outputsDir: string;
  fontManifestPath: string;
  fontDescriptorsPath: string;
  fontEmbeddingsPath: string;
  fontIngestionReportPath: string;
  fontCompatibilityGraphPath: string;
};
