import type {TransitionOverlayMode} from "../types";

export type TransitionOverlayRules = {
  overlayScale: number;
  preferredDurationMinMs: number;
  preferredDurationMaxMs: number;
  maxDurationMs: number;
  minSilenceMs: number;
  cooldownMs: number;
  maxTransitionsPerWindow: number;
  windowMs: number;
  densityPerMinute: number;
  transitionLeadMs: number;
  transitionTailMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  repetitionPenaltyWindowMs: number;
};

const standardRules: TransitionOverlayRules = {
  overlayScale: 1.05,
  preferredDurationMinMs: 1350,
  preferredDurationMaxMs: 1400,
  maxDurationMs: 2500,
  minSilenceMs: 350,
  cooldownMs: 2500,
  maxTransitionsPerWindow: 2,
  windowMs: 12000,
  densityPerMinute: 2.2,
  transitionLeadMs: 120,
  transitionTailMs: 140,
  fadeInMs: 120,
  fadeOutMs: 220,
  repetitionPenaltyWindowMs: 18000
};

const fastIntroRules: TransitionOverlayRules = {
  overlayScale: 1.05,
  preferredDurationMinMs: 1350,
  preferredDurationMaxMs: 1400,
  maxDurationMs: 2500,
  minSilenceMs: 220,
  cooldownMs: 850,
  maxTransitionsPerWindow: 4,
  windowMs: 9000,
  densityPerMinute: 5.8,
  transitionLeadMs: 70,
  transitionTailMs: 90,
  fadeInMs: 90,
  fadeOutMs: 180,
  repetitionPenaltyWindowMs: 11000
};

export const transitionOverlayRulesByMode: Record<Exclude<TransitionOverlayMode, "off">, TransitionOverlayRules> = {
  standard: standardRules,
  "fast-intro": fastIntroRules
};

export const resolveTransitionOverlayRules = (
  mode: Exclude<TransitionOverlayMode, "off">,
  overrides?: Partial<TransitionOverlayRules>
): TransitionOverlayRules => {
  const rules = transitionOverlayRulesByMode[mode];
  if (!overrides) {
    return rules;
  }

  return {
    ...rules,
    ...overrides,
    overlayScale: overrides.overlayScale ?? rules.overlayScale,
    preferredDurationMinMs: overrides.preferredDurationMinMs ?? rules.preferredDurationMinMs,
    preferredDurationMaxMs: overrides.preferredDurationMaxMs ?? rules.preferredDurationMaxMs,
    maxDurationMs: overrides.maxDurationMs ?? rules.maxDurationMs,
    minSilenceMs: overrides.minSilenceMs ?? rules.minSilenceMs,
    cooldownMs: overrides.cooldownMs ?? rules.cooldownMs,
    maxTransitionsPerWindow: overrides.maxTransitionsPerWindow ?? rules.maxTransitionsPerWindow,
    windowMs: overrides.windowMs ?? rules.windowMs,
    densityPerMinute: overrides.densityPerMinute ?? rules.densityPerMinute,
    transitionLeadMs: overrides.transitionLeadMs ?? rules.transitionLeadMs,
    transitionTailMs: overrides.transitionTailMs ?? rules.transitionTailMs,
    fadeInMs: overrides.fadeInMs ?? rules.fadeInMs,
    fadeOutMs: overrides.fadeOutMs ?? rules.fadeOutMs,
    repetitionPenaltyWindowMs: overrides.repetitionPenaltyWindowMs ?? rules.repetitionPenaltyWindowMs
  };
};

export const isTransitionOverlayModeEnabled = (mode: TransitionOverlayMode): boolean => {
  return mode !== "off";
};
