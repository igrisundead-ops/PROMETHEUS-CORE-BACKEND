import type {AssetSearchRequest, AssetSearchResult, UnifiedAssetType} from "../assets/types";
import type {MotionAssetManifest, MotionSceneKind, MotionTier} from "../types";

export type MotionGraphicsEnergyLevel = "low" | "medium" | "high";
export type MotionGraphicsVisualMode = "minimal" | "cinematic" | "aggressive" | "clean-tech";
export type MotionGraphicsAssetRole =
  | "foreground"
  | "accent"
  | "transition"
  | "background-companion"
  | "typography-support";
export type MotionGraphicsAnchor =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "left"
  | "right"
  | "top"
  | "bottom";
export type MotionGraphicsSafeZoneKind = "title-safe" | "text" | "face" | "caption";

export type MotionGraphicsSafeZone = {
  id: string;
  kind: MotionGraphicsSafeZoneKind;
  label: string;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
};

export type MotionGraphicsPlacementConstraint = {
  avoidList: string[];
  forbiddenRegions: MotionGraphicsSafeZone[];
  preferredAnchors: MotionGraphicsAnchor[];
  textSafeZoneId?: string;
  faceSafeZoneId?: string;
  centerReserved: boolean;
  notes: string[];
};

export type MotionGraphicsCandidateSummary = {
  assetId: string;
  assetType: UnifiedAssetType;
  score: number;
  tags: string[];
  labels: string[];
  retrievalCaption: string;
  semanticDescription: string;
  animated: boolean;
  confidence: number;
};

export type MotionGraphicsAgentQuery = {
  sceneId: string;
  transcriptSegment: string;
  hookScore: number;
  emphasisScore: number;
  desiredOutcome: string;
  tone: string;
  motionIntensity: MotionGraphicsEnergyLevel;
  creatorStylePreset: MotionTier;
  visualMode: MotionGraphicsVisualMode;
  sceneIntent: string;
  sceneKind?: MotionSceneKind;
  keywords: string[];
  visibleText: string;
  assetCandidates: MotionGraphicsCandidateSummary[];
  avoidList: string[];
  placementConstraints: MotionGraphicsPlacementConstraint;
  safeAreaConstraints: MotionGraphicsSafeZone[];
  backgroundLuminanceNote: string;
  contrastNote: string;
  subjectOccupiesCenterFrame: boolean;
  textOccupiesCenterFrame: boolean;
  request: AssetSearchRequest;
};

export type MotionGraphicsDecisionAsset = {
  assetId: string;
  asset?: MotionAssetManifest;
  role: MotionGraphicsAssetRole;
  startFrame: number;
  endFrame: number;
  position: {
    anchor: MotionGraphicsAnchor;
    x?: number;
    y?: number;
  };
  scale?: number;
  opacity?: number;
  rotation?: number;
  blendMode?: string;
  enterAnimation?: string;
  exitAnimation?: string;
  rationale?: string;
  retrievalScore?: number;
  whyItMatched?: string;
  recommendedUsage?: string;
};

export type MotionGraphicsDecisionDebug = {
  candidateResults: AssetSearchResult[];
  rejectedCandidates: Array<{assetId: string; reason: string}>;
  selectedAssetIds: string[];
  finalLayerStack: string[];
  artifactMitigation: string[];
  legacyBackgroundOverlayDisabled: boolean;
};

export type MotionGraphicsDecision = {
  sceneId: string;
  enabled: boolean;
  rationale?: string;
  sceneIntent?: string;
  energyLevel?: MotionGraphicsEnergyLevel;
  visualMode?: MotionGraphicsVisualMode;
  query: MotionGraphicsAgentQuery;
  safeZones: MotionGraphicsSafeZone[];
  selectedAssets: MotionGraphicsDecisionAsset[];
  debug: MotionGraphicsDecisionDebug;
};

export type MotionGraphicsAgentDebugPanel = {
  agentInvoked: boolean;
  artifactSource: string;
  mitigationSummary: string[];
};

export type MotionGraphicsPlan = {
  enabled: boolean;
  sceneDecisions: MotionGraphicsDecision[];
  sceneMap: Record<string, MotionGraphicsDecision>;
  reasons: string[];
  disableLegacyBackgroundOverlay: boolean;
  debug: MotionGraphicsAgentDebugPanel;
};
