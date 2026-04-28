import {BUSY_FRAME_THRESHOLD, DEFAULT_SAFE_ZONES, WEAK_MATTE_THRESHOLD} from "../constants";
import type {JudgmentEngineInput, SpatialConstraints} from "../types";

export const buildSpatialConstraints = (input: JudgmentEngineInput): SpatialConstraints => {
  const scene = input.sceneAnalysis;
  const speaker = input.speakerMetadata;
  const matte = input.subjectSegmentation;
  const busyFrame = (scene?.backgroundComplexity ?? 0.35) >= BUSY_FRAME_THRESHOLD || (scene?.sceneDensity ?? 0.35) >= BUSY_FRAME_THRESHOLD;
  const denseTextAllowed = !busyFrame && (scene?.mobileReadabilityRisk ?? 0.2) < 0.65;
  const speakerRegion = speaker?.placementRegion;
  const speakerBlockedZones = speakerRegion ? [speakerRegion] : [];
  const riskyZones = new Set(scene?.busyRegions ?? []);

  if (speakerRegion === "right-third") {
    riskyZones.add("right-third");
  }
  if (speakerRegion === "left-third") {
    riskyZones.add("left-third");
  }
  if ((scene?.occlusionRisk ?? 0.2) >= 0.6) {
    riskyZones.add("center");
  }

  const behindSubjectTextLegal = (matte?.behindSubjectTextSupported ?? true) && (matte?.matteConfidence ?? 0.5) >= WEAK_MATTE_THRESHOLD;
  const safeZones = [...new Set([
    ...DEFAULT_SAFE_ZONES,
    ...((scene?.safeZones ?? []) as typeof DEFAULT_SAFE_ZONES[number][])
  ])].filter((zone) => !riskyZones.has(zone));

  return {
    safeZones,
    riskyZones: [...riskyZones],
    speakerBlockedZones,
    behindSubjectTextLegal,
    denseTextAllowed,
    frameNeedsRestraint: busyFrame || (scene?.motionDensity ?? 0.35) >= 0.7,
    busyFrame,
    occlusionRisk: scene?.occlusionRisk ?? 0.2,
    mobileReadabilityRisk: scene?.mobileReadabilityRisk ?? 0.2,
    notes: [
      ...(busyFrame ? ["Frame density is high, so typography and motion need restraint."] : []),
      ...(!behindSubjectTextLegal ? ["Behind-subject text is unsafe because matte confidence is weak."] : []),
      ...(speakerRegion === "right-third" ? ["Avoid heavy headline placement on the right third because the face already owns that zone."] : []),
      ...(speakerRegion === "left-third" ? ["Avoid heavy headline placement on the left third because the face already owns that zone."] : [])
    ]
  };
};
