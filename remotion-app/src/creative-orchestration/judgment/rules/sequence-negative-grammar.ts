import type {
  AntiRepetitionSummary,
  CandidateTreatmentProfile,
  JudgmentEngineInput,
  NegativeGrammarViolation,
  PreJudgmentSnapshot
} from "../types";
import {deriveVisualDensityProfile} from "./sequence-memory";

export type SequenceNegativeGrammarRule = {
  id: string;
  evaluate: (input: {
    input: JudgmentEngineInput;
    snapshot: PreJudgmentSnapshot;
    candidate: CandidateTreatmentProfile;
    antiRepetition: AntiRepetitionSummary;
  }) => NegativeGrammarViolation | null;
};

export const sequenceNegativeGrammarRules: SequenceNegativeGrammarRule[] = [
  {
    id: "avoid-consecutive-high-intensity-treatment-repetition",
    evaluate: ({input, snapshot, candidate, antiRepetition}) => {
      if (candidate.intensity !== "expressive") {
        return null;
      }
      if (snapshot.recentSequenceMetrics.consecutiveHighIntensityMoments === 0) {
        return null;
      }
      if (input.moment.momentType === "payoff" || input.moment.importance >= 0.96) {
        return null;
      }
      return {
        ruleId: "avoid-consecutive-high-intensity-treatment-repetition",
        message: "Do not keep firing high-intensity treatments on consecutive beats unless the beat truly earns it.",
        severity: snapshot.recentSequenceMetrics.consecutiveHighIntensityMoments >= 2 ? "critical" : "high",
        blocking: snapshot.recentSequenceMetrics.consecutiveHighIntensityMoments >= 2,
        penalty: 0.24 + antiRepetition.repetitionPenalty * 0.12,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "avoid-repeated-behind-subject-text-across-adjacent-beats",
    evaluate: ({snapshot, candidate, antiRepetition}) => {
      if (candidate.matteUsage !== "behind-subject-text") {
        return null;
      }
      if (snapshot.recentSequenceMetrics.consecutiveBehindSubjectTextMoments === 0) {
        return null;
      }
      return {
        ruleId: "avoid-repeated-behind-subject-text-across-adjacent-beats",
        message: "Behind-subject text should not repeat across adjacent beats without a reset.",
        severity: snapshot.recentSequenceMetrics.consecutiveBehindSubjectTextMoments >= 1 ? "high" : "medium",
        blocking: snapshot.recentSequenceMetrics.consecutiveBehindSubjectTextMoments >= 1,
        penalty: 0.26 + antiRepetition.repetitionPenalty * 0.1,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "limit-consecutive-expressive-typography",
    evaluate: ({snapshot, candidate}) => {
      if (snapshot.recentSequenceMetrics.consecutiveExpressiveTypographyMoments < 2) {
        return null;
      }
      if (candidate.typographyMode !== "keyword-only" && candidate.typographyMode !== "title-card") {
        return null;
      }
      return {
        ruleId: "limit-consecutive-expressive-typography",
        message: "Expressive typography loses force when it dominates too many consecutive beats.",
        severity: "high",
        blocking: false,
        penalty: 0.18,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "prefer-restraint-after-loud-run",
    evaluate: ({input, snapshot, candidate}) => {
      if (!snapshot.recentSequenceMetrics.preferRestraintNext) {
        return null;
      }
      if (candidate.intensity === "minimal" || candidate.intensity === "restrained") {
        return null;
      }
      if (input.moment.momentType === "payoff" && input.moment.importance >= 0.94) {
        return null;
      }
      return {
        ruleId: "prefer-restraint-after-loud-run",
        message: "The sequence is already loud, so this beat should restore breathing room unless it is a real payoff.",
        severity: "medium",
        blocking: false,
        penalty: 0.16,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "preserve-sequence-contrast",
    evaluate: ({snapshot, candidate, antiRepetition}) => {
      if (!snapshot.recentSequenceMetrics.needsContrastNext && !antiRepetition.forceContrast) {
        return null;
      }
      const recentPattern = snapshot.recentVisualPatterns[snapshot.recentVisualPatterns.length - 1];
      if (!recentPattern) {
        return null;
      }
      const candidateDensity = deriveVisualDensityProfile(candidate);
      const matchesLastBeat =
        recentPattern.visualDensity === candidateDensity &&
        recentPattern.typographyMode === candidate.typographyMode &&
        recentPattern.motionMode === candidate.motionMode;
      if (!matchesLastBeat) {
        return null;
      }
      return {
        ruleId: "preserve-sequence-contrast",
        message: "This beat is too visually similar to the immediately previous beat.",
        severity: "medium",
        blocking: false,
        penalty: 0.2,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "avoid-repeated-emotional-peaks-without-reset",
    evaluate: ({input, snapshot, candidate}) => {
      if (snapshot.recentSequenceMetrics.consecutiveEmotionalPeakMoments < 2) {
        return null;
      }
      const currentBeatStillPeaks = input.moment.energy >= 0.8 && candidate.intensity !== "minimal";
      if (!currentBeatStillPeaks) {
        return null;
      }
      return {
        ruleId: "avoid-repeated-emotional-peaks-without-reset",
        message: "Repeated emotional peaks flatten the sequence unless a calmer reset beat follows.",
        severity: "high",
        blocking: false,
        penalty: 0.2,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "avoid-repeating-typography-signature",
    evaluate: ({snapshot, candidate, antiRepetition}) => {
      if (snapshot.recentSequenceMetrics.consecutiveRepeatedTypographyModeMoments < 2) {
        return null;
      }
      const lastPattern = snapshot.recentVisualPatterns[snapshot.recentVisualPatterns.length - 1];
      if (!lastPattern || lastPattern.typographyMode !== candidate.typographyMode) {
        return null;
      }
      return {
        ruleId: "avoid-repeating-typography-signature",
        message: "The same typography signature is repeating too often across adjacent beats.",
        severity: antiRepetition.repeatedTypographyModeCount >= 2 ? "high" : "medium",
        blocking: false,
        penalty: 0.18,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "avoid-repeating-motion-signature",
    evaluate: ({snapshot, candidate, antiRepetition}) => {
      if (snapshot.recentSequenceMetrics.consecutiveRepeatedMotionSignatureMoments < 2) {
        return null;
      }
      const lastPattern = snapshot.recentVisualPatterns[snapshot.recentVisualPatterns.length - 1];
      if (!lastPattern || lastPattern.motionMode !== candidate.motionMode) {
        return null;
      }
      return {
        ruleId: "avoid-repeating-motion-signature",
        message: "The same motion signature is repeating too often across adjacent beats.",
        severity: antiRepetition.repeatedMotionModeCount >= 2 ? "high" : "medium",
        blocking: false,
        penalty: 0.17,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "avoid-spending-visual-climax-too-early",
    evaluate: ({input, snapshot, candidate}) => {
      const visualClimaxCandidate = candidate.backgroundTextMode === "hero" || candidate.placementMode === "full-frame" || candidate.intensity === "expressive";
      if (!visualClimaxCandidate) {
        return null;
      }
      if (snapshot.recentSequenceMetrics.climaxBudgetRemaining > 0.45) {
        return null;
      }
      if (input.moment.momentType === "payoff" || input.moment.importance >= 0.95) {
        return null;
      }
      return {
        ruleId: "avoid-spending-visual-climax-too-early",
        message: "The sequence has already spent too much climax budget to justify another major visual peak here.",
        severity: "high",
        blocking: false,
        penalty: 0.22,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "avoid-repeating-premium-trick",
    evaluate: ({candidate, antiRepetition}) => {
      if (antiRepetition.repeatedPremiumTrickCount === 0) {
        return null;
      }
      const repeatsPremiumTrick = candidate.backgroundTextMode === "hero" ||
        candidate.matteUsage === "behind-subject-text" ||
        candidate.motionMode === "blur-slide-up" ||
        candidate.motionMode === "light-sweep-reveal" ||
        candidate.motionMode === "zoom-through-layer";
      if (!repeatsPremiumTrick) {
        return null;
      }
      return {
        ruleId: "avoid-repeating-premium-trick",
        message: "The same premium trick is being reused too quickly, which makes the sequence feel formulaic.",
        severity: "medium",
        blocking: false,
        penalty: 0.14,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  },
  {
    id: "avoid-flattening-pacing-rhythm",
    evaluate: ({snapshot, candidate}) => {
      const repeatedPatternRun = Math.max(
        snapshot.recentSequenceMetrics.consecutiveRepeatedMotionSignatureMoments,
        snapshot.recentSequenceMetrics.consecutiveRepeatedTypographyModeMoments,
        snapshot.recentSequenceMetrics.consecutiveRepeatedPlacementMoments
      );
      if (repeatedPatternRun < 2) {
        return null;
      }
      const lastPattern = snapshot.recentVisualPatterns[snapshot.recentVisualPatterns.length - 1];
      if (!lastPattern) {
        return null;
      }
      const keepsSameRhythm = lastPattern.motionMode === candidate.motionMode &&
        lastPattern.typographyMode === candidate.typographyMode &&
        lastPattern.placementMode === candidate.placementMode;
      if (!keepsSameRhythm) {
        return null;
      }
      return {
        ruleId: "avoid-flattening-pacing-rhythm",
        message: "The beat rhythm needs a pacing correction instead of another identical visual cadence.",
        severity: "medium",
        blocking: false,
        penalty: 0.16,
        candidateId: candidate.id,
        affectedRegions: []
      };
    }
  }
];

