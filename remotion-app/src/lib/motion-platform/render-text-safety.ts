import type {MotionAssetManifest} from "../types";

export const ENABLE_PREVIEW_INTERNAL_DIAGNOSTIC_TEXT = false;
export const ENABLE_PREVIEW_RETRIEVAL_OVERLAY_ASSETS = false;

const INTERNAL_DIAGNOSTIC_TEXT_PATTERNS = [
  /retrieval-assets/i,
  /does not exist/i,
  /[a-z]:\\/i,
  /\/public\//i,
  /\.html\b/i,
  /\.tsx?\b/i,
  /\benoent\b/i,
  /error:/i,
  /cannot find/i,
  /no such file/i,
  /\bundefined\b/i,
  /\bnull\b/i,
  /graphic asset/i,
  /text capsule/i,
  /title keyword/i,
  /sidecall/i,
  /matchedtext/i,
  /canonicallabel/i
] as const;

const cleanRenderableText = (value: unknown): string => {
  if (typeof value !== "string") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
};

export const isInternalDiagnosticText = (value: unknown): boolean => {
  const cleaned = cleanRenderableText(value);
  if (!cleaned) {
    return false;
  }

  return INTERNAL_DIAGNOSTIC_TEXT_PATTERNS.some((pattern) => pattern.test(cleaned));
};

export const sanitizeRenderableOverlayText = (value: unknown): string => {
  const cleaned = cleanRenderableText(value);
  if (!cleaned) {
    return "";
  }

  if (!ENABLE_PREVIEW_INTERNAL_DIAGNOSTIC_TEXT && isInternalDiagnosticText(cleaned)) {
    return "";
  }

  return cleaned;
};

export const shouldRenderOverlayText = (value: unknown): boolean => {
  return sanitizeRenderableOverlayText(value).length > 0;
};

type PreviewOverlayAssetInput = Pick<
  Partial<MotionAssetManifest>,
  "src" | "renderMode" | "sourceKind" | "sourceHtml" | "sourceFile"
>;

const isRetrievalAssetReference = (value: unknown): boolean => {
  const cleaned = cleanRenderableText(value);
  if (!cleaned) {
    return false;
  }

  return /retrieval-assets/i.test(cleaned) || /\.html\b/i.test(cleaned);
};

export const shouldRenderPreviewOverlayAsset = (
  asset: PreviewOverlayAssetInput | null | undefined
): boolean => {
  if (!asset) {
    return false;
  }

  const references = [
    asset.src,
    asset.sourceHtml,
    asset.sourceFile,
    asset.renderMode,
    asset.sourceKind
  ];

  if (references.some((reference) => isInternalDiagnosticText(reference))) {
    return false;
  }

  if (!ENABLE_PREVIEW_RETRIEVAL_OVERLAY_ASSETS) {
    if (
      references.some((reference) => isRetrievalAssetReference(reference)) ||
      asset.renderMode === "iframe" ||
      asset.sourceKind === "authoring-batch" ||
      Boolean(asset.sourceHtml)
    ) {
      return false;
    }
  }

  return cleanRenderableText(asset.src).length > 0;
};
