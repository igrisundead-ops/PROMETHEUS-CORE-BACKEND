import { composeMotionPhysics, MotionPhysics, MotionCompositionInput } from "./motion-composition-engine";
import { calculateAttentionPriority, AttentionDominance, AttentionInput } from "./attention-priority-engine";
import { analyzeNegativeSpace, VisualSafetyMap, NegativeSpaceInput } from "./negative-space-engine";
import { evaluateSilence, SilenceOrchestration, SilenceInput } from "./silence-intelligence-engine";
import { scoreFontPerformance, FontPerformanceScore, FontPerformanceInput } from "./font-performance-engine";
import { calculateOpticalBalance, OpticalImperfection, OpticalBalanceInput } from "./optical-balance-engine";
import { runCriticLoopV2, CriticV2Result } from "./critic-loop-v2";
import { sequenceTasteHistory } from "./style-memory-system";

export type StylePhysicsState = {
  motion: MotionPhysics;
  attention: AttentionDominance;
  safety: VisualSafetyMap;
  silence: SilenceOrchestration;
  font: FontPerformanceScore;
  optical: OpticalImperfection;
  critic: CriticV2Result;
  rationale: string[];
};

export type StylePhysicsInput = {
  text: string;
  isEmphasized: boolean;
  emotionalIntensity: number;
  aggression: number;
  restraint: number;
  cinematicDrift: number;
  dominance: number;
  anticipationDelay: number;
  cameraMotionEnergy: "static" | "calm" | "aggressive" | "handheld" | "cinematic-glide";
  speakerEmotion: "neutral" | "happy" | "sad" | "angry" | "vulnerable" | "authoritative";
  faceBoundingBoxes: Array<{x: number; y: number; width: number; height: number}>;
  pauseDurationMs: number;
  fontFamily: string;
  expectedScale: number;
};

export const resolveStylePhysics = (input: StylePhysicsInput): StylePhysicsState => {
  const {
    text,
    isEmphasized,
    emotionalIntensity,
    aggression,
    restraint,
    cinematicDrift,
    dominance,
    anticipationDelay,
    cameraMotionEnergy,
    speakerEmotion,
    faceBoundingBoxes,
    pauseDurationMs,
    fontFamily,
    expectedScale
  } = input;

  // 1. Foundation Engines
  const motion = composeMotionPhysics({
    aggression,
    restraint,
    emotionalIntensity,
    cinematicDrift,
    dominance,
    anticipationDelay,
    cameraMotionEnergy
  });

  const safety = analyzeNegativeSpace({
    faceBoundingBoxes
  });

  const silence = evaluateSilence({
    pauseDurationMs,
    emotionalVulnerability: speakerEmotion === "vulnerable" ? 0.9 : 0.2,
    isDramaticHook: isEmphasized && aggression > 0.7,
    visualOverwhelmScore: safety.overallComplexity,
    audioLoudnessPeak: 0.5, // Mock
    sequencePosition: "middle"
  });

  const attention = calculateAttentionPriority({
    transcriptSemantics: {
      intent: isEmphasized ? "hook" : "context",
      isPunchy: aggression > 0.75,
      isVulnerable: speakerEmotion === "vulnerable"
    },
    emotionalIntensity,
    speakerEmotion,
    frameComplexity: safety.overallComplexity,
    faceProminence: faceBoundingBoxes[0]?.width ?? 0,
    motionEnergy: aggression,
    isSilenced: silence.isSilenced,
    pacingContext: aggression > 0.6 ? "fast" : "medium"
  });

  const font = scoreFontPerformance({
    fontFamily,
    expectedMotionVelocity: motion.velocity,
    expectedScale,
    backgroundComplexity: safety.overallComplexity,
    surfaceTone: "neutral"
  });

  const optical = calculateOpticalBalance({
    text,
    isEmphasized,
    dominance: attention.typographyDominance,
    emotionalWeight: emotionalIntensity
  });

  // 2. Critic Loop V2
  const critic = runCriticLoopV2({
    strategy: safety.bestQuadrant.x < 0.4 ? "asymmetric-left" : "center",
    motionPhysics: motion,
    attention,
    safetyMap: safety,
    silence,
    fontFamily,
    text
  });

  // 3. Record in Memory
  sequenceTasteHistory.record({
    strategy: critic.revisions.strategy ?? (safety.bestQuadrant.x < 0.4 ? "asymmetric-left" : "center"),
    motionEnergy: aggression > 0.7 ? "aggressive" : "calm",
    fontFamily,
    scale: expectedScale,
    quadrantIndex: safety.bestQuadrant.x > 0.5 ? 1 : 0
  });

  const rationale = [
    ...silence.rationale,
    ...font.limitations,
    ...critic.slopFlags,
    `attention-focus=${attention.activeFocus}`
  ];

  return {
    motion,
    attention,
    safety,
    silence,
    font,
    optical,
    critic,
    rationale
  };
};

export * from "./motion-composition-engine";
export * from "./attention-priority-engine";
export * from "./negative-space-engine";
export * from "./silence-intelligence-engine";
export * from "./font-performance-engine";
export * from "./style-memory-system";
export * from "./optical-balance-engine";
export * from "./critic-loop-v2";
