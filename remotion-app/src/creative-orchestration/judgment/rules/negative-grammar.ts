import {LONG_INFORMATIONAL_COPY_WORDS, MAX_ACTIVE_FOCAL_ELEMENTS, WEAK_MATTE_THRESHOLD} from "../constants";
import type {
  AntiRepetitionSummary,
  CandidateTreatmentProfile,
  JudgmentEngineInput,
  NegativeGrammarViolation,
  PreJudgmentSnapshot
} from "../types";
import {sequenceNegativeGrammarRules} from "./sequence-negative-grammar";

export type NegativeGrammarRule = {
  id: string;
  evaluate: (input: {
    input: JudgmentEngineInput;
    snapshot: PreJudgmentSnapshot;
    candidate: CandidateTreatmentProfile;
    antiRepetition: AntiRepetitionSummary;
  }) => NegativeGrammarViolation | null;
};

const informationalCopyWords = (input: JudgmentEngineInput): number => {
  return (input.transcriptSegment || input.moment.transcriptText).split(/\s+/).map((token) => token.trim()).filter(Boolean).length;
};

const localNegativeGrammarRules: NegativeGrammarRule[] = [
  {
    id: "avoid-dense-typography-on-busy-backgrounds",
    evaluate: ({snapshot, candidate}) => {
      if (!snapshot.spatialConstraints.busyFrame) {
        return null;
      }
      if (candidate.typographyMode !== "full-caption" && candidate.finalTreatment !== "title-card") {
        return null;
      }
      return {
        ruleId: "avoid-dense-typography-on-busy-backgrounds",
        message: "Dense typography is blocked over a visually busy frame.",
        severity: "critical",
        blocking: !snapshot.spatialConstraints.denseTextAllowed,
        penalty: 0.34,
        candidateId: candidate.id,
        affectedRegions: snapshot.spatialConstraints.riskyZones
      };
    }
  },
  {
    id: "block-cursive-for-long-informational-copy",
    evaluate: ({input, candidate}) => {
      if (candidate.typographyMode !== "editorial-cursive") {
        return null;
      }
      if (informationalCopyWords(input) < LONG_INFORMATIONAL_COPY_WORDS) {
        return null;
      }
      return {
        ruleId: "block-cursive-for-long-informational-copy",
        message: "Long informational copy should not use a cursive treatment.",
        severity: "high",
        blocking: true,
        penalty: 0.3,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "limit-active-focal-elements",
    evaluate: ({input, candidate}) => {
      const activeElements = input.sceneAnalysis?.activeFocalElements ?? 1;
      const requestedExtras = (candidate.allowedProposalTypes.includes("asset") ? 1 : 0) + (candidate.allowedProposalTypes.includes("motion") ? 1 : 0) + (candidate.allowedProposalTypes.includes("text") ? 1 : 0);
      if (activeElements + requestedExtras < MAX_ACTIVE_FOCAL_ELEMENTS) {
        return null;
      }
      return {
        ruleId: "limit-active-focal-elements",
        message: "Animating too many focal elements at once will overcook the frame.",
        severity: "high",
        blocking: candidate.intensity === "expressive",
        penalty: 0.24,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "protect-right-third-face-occupancy",
    evaluate: ({input, candidate}) => {
      if (input.speakerMetadata?.placementRegion !== "right-third") {
        return null;
      }
      if (candidate.placementMode !== "right-anchor") {
        return null;
      }
      return {
        ruleId: "protect-right-third-face-occupancy",
        message: "The right third is already occupied by the speaker face, so a heavy headline there is weak.",
        severity: "high",
        blocking: candidate.finalTreatment === "title-card",
        penalty: 0.28,
        candidateId: candidate.id,
        affectedRegions: ["right-third"]
      };
    }
  },
  {
    id: "isolate-punch-word-when-emotional-center",
    evaluate: ({snapshot, candidate}) => {
      if (!snapshot.emphasisTargets.isolatePunchWord) {
        return null;
      }
      if (candidate.emphasisMode === "isolated-punch-word") {
        return null;
      }
      return {
        ruleId: "isolate-punch-word-when-emotional-center",
        message: "The emotional center should isolate the punch word instead of burying it in a broad caption.",
        severity: "medium",
        blocking: false,
        penalty: 0.18,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "block-behind-subject-text-with-weak-matte",
    evaluate: ({input, candidate}) => {
      if (candidate.matteUsage !== "behind-subject-text") {
        return null;
      }
      if ((input.subjectSegmentation?.matteConfidence ?? 0.5) >= WEAK_MATTE_THRESHOLD) {
        return null;
      }
      return {
        ruleId: "block-behind-subject-text-with-weak-matte",
        message: "Critical behind-subject text is blocked because matte confidence is weak.",
        severity: "critical",
        blocking: true,
        penalty: 0.42,
        candidateId: candidate.id,
        affectedRegions: [input.subjectSegmentation?.subjectRegion ?? "center"]
      };
    }
  },
  {
    id: "avoid-glow-on-bright-footage",
    evaluate: ({input, snapshot, candidate}) => {
      if (!snapshot.emphasisTargets.allowedEffects.includes("glow")) {
        return null;
      }
      if ((input.sceneAnalysis?.brightness ?? 0.5) <= 0.7) {
        return null;
      }
      if (candidate.emphasisMode !== "isolated-punch-word") {
        return null;
      }
      return {
        ruleId: "avoid-glow-on-bright-footage",
        message: "Glow is risky on bright footage unless contrast remains unmistakable.",
        severity: "medium",
        blocking: false,
        penalty: 0.16,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "avoid-stacking-premium-effects",
    evaluate: ({candidate}) => {
      const stacksPremiumEffects = candidate.backgroundTextMode === "hero" && candidate.matteUsage !== "none" && candidate.motionMode !== "none";
      if (!stacksPremiumEffects) {
        return null;
      }
      return {
        ruleId: "avoid-stacking-premium-effects",
        message: "Premium effects should not stack on every beat.",
        severity: "high",
        blocking: candidate.intensity === "expressive",
        penalty: 0.2,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "preserve-breathing-room",
    evaluate: ({snapshot, candidate}) => {
      if (!snapshot.spatialConstraints.frameNeedsRestraint) {
        return null;
      }
      if (candidate.placementMode === "full-frame" || candidate.backgroundTextMode === "hero") {
        return {
          ruleId: "preserve-breathing-room",
          message: "The frame needs breathing room, so full-frame pressure should be penalized.",
          severity: "medium",
          blocking: false,
          penalty: 0.14,
          candidateId: candidate.id,
          affectedRegions: []
        };
      }
      return null;
    }
  }
];

export const negativeGrammarRules: NegativeGrammarRule[] = [
  ...localNegativeGrammarRules,
  ...sequenceNegativeGrammarRules
];
