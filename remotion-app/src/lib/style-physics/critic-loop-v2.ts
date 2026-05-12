import { MotionPhysics } from "./motion-composition-engine";
import { AttentionDominance } from "./attention-priority-engine";
import { VisualSafetyMap } from "./negative-space-engine";
import { SilenceOrchestration } from "./silence-intelligence-engine";
import { sequenceTasteHistory } from "./style-memory-system";

export type CriticV2Result = {
  isApproved: boolean;
  slopFlags: string[];
  revisions: {
    strategy?: string;
    scaleMultiplier?: number;
    motionAggression?: number;
  };
};

export type OrchestrationProposedState = {
  strategy: string;
  motionPhysics: MotionPhysics;
  attention: AttentionDominance;
  safetyMap: VisualSafetyMap;
  silence: SilenceOrchestration;
  fontFamily: string;
  text: string;
};

export const runCriticLoopV2 = (proposed: OrchestrationProposedState): CriticV2Result => {
  const slopFlags: string[] = [];
  const revisions: CriticV2Result["revisions"] = {};

  // 1. Memory Check (Repetitive Grammar)
  const memoryCheck = sequenceTasteHistory.isRepetitive({
    strategy: proposed.strategy,
    motionEnergy: proposed.motionPhysics.motionAggression > 0.7 ? "aggressive" : "calm",
    fontFamily: proposed.fontFamily,
    scale: proposed.motionPhysics.scaleInertia,
    quadrantIndex: proposed.safetyMap.bestQuadrant.x > 0.5 ? 1 : 0 // Simplified quadrant
  });

  if (memoryCheck.repetitive) {
    slopFlags.push(`repetitive-cinematic-grammar: ${memoryCheck.reason}`);
    if (memoryCheck.reason === "center-stack-syndrome-detected") {
      revisions.strategy = "asymmetric-left";
    }
  }

  // 2. AI Slop Detectors
  // Detector: Bounce Easing Abuse
  if (proposed.motionPhysics.easing.includes("back") && proposed.motionPhysics.motionAggression > 0.8) {
    slopFlags.push("bounce-easing-abuse");
    revisions.motionAggression = proposed.motionPhysics.motionAggression * 0.8;
  }

  // Detector: Over-rendering during silence tension
  if (proposed.silence.tensionScore > 0.8 && !proposed.silence.isSilenced) {
    slopFlags.push("over-rendering-high-tension-silence");
  }

  // Detector: Excessive text occupancy
  if (proposed.text.length > 20 && proposed.motionPhysics.scaleInertia > 0.1) {
    slopFlags.push("excessive-text-occupancy-clutter");
    revisions.scaleMultiplier = 0.85;
  }

  return {
    isApproved: slopFlags.length === 0,
    slopFlags,
    revisions
  };
};
