import React, {CSSProperties, useMemo} from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";

import {getCaptionContainerStyle, upperSafeZone} from "../lib/caption-layout";
import {captionPolicy} from "../lib/caption-policy";
import {
  buildCinematicCaptionPlans,
  type CinematicCaptionPlan,
  type CinematicLinePlan,
  type CinematicWordPlan
} from "../lib/cinematic-typography/selector";
import {
  getCinematicVisibilityWindowFrames,
  resolveCinematicMotionStyle
} from "../lib/cinematic-typography/motion-grammar";
import {
  resolveCaptionEditorialDecision,
  type CaptionEditorialContext,
  type CaptionEditorialDecision
} from "../lib/motion-platform/caption-editorial-engine";
import type {TypographyPartPreset} from "../lib/presets/typography-presets";
import type {CaptionChunk, CaptionVerticalBias} from "../lib/types";

type Token = {
  text: string;
  wordIndex: number;
  startMs: number;
  endMs: number;
};

const threeWordPartLabels = ["a", "b", "c"];
const CAPS_SAFE_ITALIC_FONT_FAMILY = "\"Cormorant Garamond\", \"Times New Roman\", serif";
const CAPS_UNSAFE_ITALIC_FONT_PATTERN = /(great vibes|allura|cursive)/i;

export const getUppercaseSafeItalicFontFamily = (fontFamily: string, uppercaseByDefault: boolean): string => {
  if (!uppercaseByDefault) {
    return fontFamily;
  }

  return CAPS_UNSAFE_ITALIC_FONT_PATTERN.test(fontFamily) ? CAPS_SAFE_ITALIC_FONT_FAMILY : fontFamily;
};

export const resolvePartTypographyStyle = (
  partPreset: TypographyPartPreset | null,
  role: "primary" | "secondary",
  uppercaseByDefault: boolean = captionPolicy.styling.uppercaseByDefault,
  editorialDecision?: CaptionEditorialDecision | null
): CSSProperties => {
  const fallbackFontFamily = role === "secondary"
    ? CAPS_SAFE_ITALIC_FONT_FAMILY
    : "\"DM Sans\", sans-serif";
  const fontFamily = getUppercaseSafeItalicFontFamily(partPreset?.fontFamily ?? fallbackFontFamily, uppercaseByDefault);
  const fontWeight = partPreset?.fontWeight ?? (role === "secondary" ? "400" : "700");
  const fontSizeMult = editorialDecision?.fontSizeScale ?? 1;
  const textColor = editorialDecision?.textColor ?? partPreset?.color;
  const textShadow = editorialDecision?.textShadow ?? partPreset?.glow;
  const textStroke = editorialDecision?.textStroke ?? partPreset?.stroke;
  const letterSpacing = editorialDecision?.letterSpacing ?? partPreset?.letterSpacing;
  const textTransform = editorialDecision?.uppercaseBias
    ? "uppercase"
    : (partPreset?.textTransform as CSSProperties["textTransform"]);

  return {
    fontFamily: editorialDecision?.fontFamily ?? fontFamily,
    fontWeight: editorialDecision?.fontWeight ?? fontWeight,
    fontStyle: role === "secondary" ? "italic" : undefined,
    fontSize: partPreset?.sizeMult ? `${partPreset.sizeMult * fontSizeMult}em` : fontSizeMult !== 1 ? `${fontSizeMult}em` : undefined,
    letterSpacing,
    textTransform,
    WebkitTextStroke: textStroke,
    textShadow,
    color: textColor
  };
};

export const isNameWordIndex = (wordIndex: number, chunk: CaptionChunk): boolean => {
  const nameSpans = chunk.semantic?.nameSpans ?? [];
  return nameSpans.some((span) => wordIndex >= span.startWord && wordIndex <= span.endWord);
};

export const isTokenActiveAtTime = (token: Token, currentTimeMs: number): boolean => {
  return currentTimeMs >= token.startMs && currentTimeMs <= token.endMs;
};

export const isTokenActiveAtTimeStrict = (token: Token, currentTimeMs: number): boolean => {
  return currentTimeMs >= token.startMs && currentTimeMs < token.endMs;
};

export const getThreeWordLayoutClassName = (layoutVariant: CaptionChunk["layoutVariant"]): string =>
  `dg-three-layout layout-${layoutVariant}`;

export const getThreeWordPartClassName = (partIndex: number): string => {
  const label = threeWordPartLabels[partIndex] ?? "c";
  return `dg-three-part part-${label}`;
};

export const getThreeWordContrastRole = (
  layoutVariant: CaptionChunk["layoutVariant"],
  partIndex: number
): "secondary" | "primary" | null => {
  if (layoutVariant === "inline") {
    return null;
  }
  return partIndex === 1 ? "primary" : "secondary";
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const getWordProgress = ({
  word,
  currentTimeMs
}: {
  word: CinematicWordPlan["word"];
  currentTimeMs: number;
}): number => {
  const duration = Math.max(1, word.endMs - word.startMs);
  return clamp01((currentTimeMs - word.startMs) / duration);
};

const getAccentColor = (plan: CinematicCaptionPlan): string => {
  if (plan.treatment.moodTags.includes("luxury")) {
    return plan.editorialDecision.surfaceTone === "light"
      ? "rgba(116, 89, 45, 0.96)"
      : "rgba(255, 232, 191, 0.98)";
  }
  if (plan.treatment.moodTags.includes("tech")) {
    return plan.editorialDecision.surfaceTone === "light"
      ? "rgba(42, 85, 128, 0.95)"
      : "rgba(198, 229, 255, 0.98)";
  }
  return plan.editorialDecision.surfaceTone === "light"
    ? "rgba(56, 73, 102, 0.96)"
    : "rgba(231, 240, 255, 0.98)";
};

const getBaseFontSize = (plan: CinematicCaptionPlan): string => {
  const scale = plan.editorialDecision.fontSizeScale;
  const wordCount = plan.metrics.wordCount;
  const treatmentBoost =
    plan.treatment.visualFamily === "monument-display"
      ? 1.16
      : plan.treatment.visualFamily === "precision-sans"
        ? 0.9
        : 1;
  const densityFactor = wordCount >= 6 ? 0.86 : wordCount === 5 ? 0.92 : 1;
  const finalScale = scale * treatmentBoost * densityFactor;

  return `clamp(${Math.round(42 * finalScale)}px, ${(8.3 * finalScale).toFixed(2)}vw, ${Math.round(92 * finalScale)}px)`;
};

const getTreatmentContainerStyle = (plan: CinematicCaptionPlan): CSSProperties => {
  const accentColor = getAccentColor(plan);
  const isLightSurface = plan.editorialDecision.surfaceTone === "light";
  return {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: `translateY(${plan.placementOffsetEm.toFixed(3)}em)`,
    color: plan.editorialDecision.textColor,
    textAlign: "center",
    padding: "0 2.5%",
    ["--dg-cinematic-accent" as string]: accentColor,
    ["--dg-cinematic-shadow" as string]: plan.editorialDecision.textShadow,
    ["--dg-cinematic-stroke" as string]: plan.editorialDecision.textStroke,
    ["--dg-cinematic-width-ch" as string]: String(plan.treatment.compositionRules.maxWidthCh),
    ["--dg-cinematic-font-size" as string]: getBaseFontSize(plan),
    ["--dg-cinematic-line-height" as string]: String(plan.treatment.lineHeightRules.base),
    ["--dg-cinematic-line-gap" as string]: `${plan.lines.length >= 3 ? 0.06 : 0.11}em`,
    ["--dg-cinematic-support-opacity" as string]: isLightSurface ? "0.84" : "0.76"
  };
};

const getLineStyle = ({
  plan,
  line
}: {
  plan: CinematicCaptionPlan;
  line: CinematicLinePlan;
}): CSSProperties => {
  const isSupport = line.role === "support";
  const isMonument = plan.treatment.visualFamily === "monument-display";
  return {
    fontFamily: isSupport ? plan.fontPalette.supportFamily : plan.fontPalette.displayFamily,
    fontWeight: isSupport ? plan.fontPalette.supportWeight : plan.fontPalette.displayWeight,
    fontSize: isSupport ? "0.58em" : isMonument && line.accent ? "1.05em" : "1em",
    letterSpacing: isSupport
      ? plan.treatment.trackingRules.support
      : plan.treatment.casePolicy === "uppercase"
        ? plan.treatment.trackingRules.uppercase
        : plan.treatment.trackingRules.base,
    lineHeight: isSupport ? plan.treatment.lineHeightRules.relaxed : plan.treatment.lineHeightRules.base,
    WebkitTextStroke: isSupport ? "0px transparent" : plan.editorialDecision.textStroke,
    textShadow: isSupport ? "none" : plan.editorialDecision.textShadow,
    color: isSupport ? "rgba(255,255,255,var(--dg-cinematic-support-opacity))" : plan.editorialDecision.textColor,
    textTransform: "none"
  };
};

const getWordStyle = ({
  plan,
  line,
  word,
  isActive,
  wordProgress
}: {
  plan: CinematicCaptionPlan;
  line: CinematicLinePlan;
  word: CinematicWordPlan;
  isActive: boolean;
  wordProgress: number;
}): CSSProperties => {
  const accentColor = getAccentColor(plan);
  const italic = word.italic;
  const emphasisGlow = Math.sin(wordProgress * Math.PI) * 0.16;

  return {
    fontFamily: italic
      ? plan.fontPalette.italicFamily
      : line.role === "support"
        ? plan.fontPalette.supportFamily
        : plan.fontPalette.displayFamily,
    fontStyle: italic ? "italic" : "normal",
    letterSpacing: word.emphasis ? plan.treatment.trackingRules.emphasis : undefined,
    color: isActive
      ? accentColor
      : word.emphasis
        ? accentColor
        : undefined,
    textShadow: isActive
      ? `0 0 18px ${accentColor}, 0 10px 24px rgba(0,0,0,0.35)`
      : word.emphasis
        ? `0 0 12px rgba(255,255,255,${(0.24 + emphasisGlow).toFixed(3)})`
        : undefined,
    WebkitTextStroke: line.role === "support" ? "0px transparent" : plan.editorialDecision.textStroke
  };
};

const CaptionTreatmentLayer: React.FC<{
  plan: CinematicCaptionPlan;
}> = ({plan}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;
  const startFrame = Math.round((plan.chunk.startMs / 1000) * fps);
  const endFrame = Math.round((plan.chunk.endMs / 1000) * fps);
  const blockMotionStyle = resolveCinematicMotionStyle({
    frame,
    fps,
    startFrame,
    endFrame,
    treatment: plan.treatment,
    scope: "block",
    continuityWarmth: plan.continuity.warmth
  });

  let wordSequenceCursor = 0;

  return (
    <div
      className={[
        "dg-cinematic-treatment",
        `dg-cinematic-treatment--${plan.treatment.visualFamily}`,
        `dg-cinematic-treatment--${plan.continuity.mode}`
      ].join(" ")}
      style={getTreatmentContainerStyle(plan)}
    >
      <div className="dg-cinematic-treatment-shell" style={blockMotionStyle}>
        <div className="dg-cinematic-stack">
          {plan.lines.map((line, lineIndex) => {
            const lineHasEmphasis = line.words.some((word) => word.emphasis);
            const lineSequenceStart = wordSequenceCursor;
            wordSequenceCursor += line.words.length;
            const lineMotionStyle = resolveCinematicMotionStyle({
              frame,
              fps,
              startFrame,
              endFrame,
              treatment: plan.treatment,
              scope: "line",
              lineIndex,
              continuityWarmth: plan.continuity.warmth,
              isEmphasis: lineHasEmphasis
            });

            return (
              <div
                key={line.key}
                className={[
                  "dg-cinematic-line",
                  line.role === "support" ? "dg-cinematic-line--support" : "dg-cinematic-line--display",
                  line.accent ? "dg-cinematic-line--accent" : ""
                ].filter(Boolean).join(" ")}
                style={{
                  ...getLineStyle({plan, line}),
                  ...lineMotionStyle
                }}
              >
                {line.words.map((word, wordIndex) => {
                  const isActive = isTokenActiveAtTimeStrict({
                    text: word.displayText,
                    wordIndex: word.wordIndex,
                    startMs: word.word.startMs,
                    endMs: word.word.endMs
                  }, currentTimeMs);
                  const wordProgress = getWordProgress({
                    word: word.word,
                    currentTimeMs
                  });
                  const wordMotionStyle = resolveCinematicMotionStyle({
                    frame,
                    fps,
                    startFrame,
                    endFrame,
                    treatment: plan.treatment,
                    scope: "word",
                    lineIndex,
                    wordSequenceIndex: lineSequenceStart + wordIndex,
                    isEmphasis: word.emphasis,
                    isActive,
                    wordProgress,
                    continuityWarmth: plan.continuity.warmth
                  });

                  return (
                    <span
                      key={`${plan.chunk.id}-${word.wordIndex}`}
                      className={[
                        "dg-cinematic-word",
                        word.emphasis ? "dg-cinematic-word--emphasis" : "",
                        word.isName ? "dg-cinematic-word--name" : "",
                        isActive ? "dg-cinematic-word--active" : ""
                      ].filter(Boolean).join(" ")}
                      style={{
                        ...getWordStyle({
                          plan,
                          line,
                          word,
                          isActive,
                          wordProgress
                        }),
                        ...wordMotionStyle
                      }}
                    >
                      {word.displayText}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const CinematicCaptionOverlay: React.FC<{
  chunks: CaptionChunk[];
  captionBias?: CaptionVerticalBias;
  editorialContext?: Omit<CaptionEditorialContext, "chunk" | "currentTimeMs">;
}> = ({chunks, captionBias = "middle", editorialContext}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const editorialDecisions = useMemo(() => {
    return chunks.map((chunk) => resolveCaptionEditorialDecision({
      chunk,
      ...editorialContext,
      currentTimeMs: chunk.startMs + Math.max(1, (chunk.endMs - chunk.startMs) / 2)
    }));
  }, [chunks, editorialContext]);

  const plans = useMemo(() => {
    return buildCinematicCaptionPlans({
      chunks,
      editorialDecisions,
      captionBias,
      motionTier: editorialContext?.motionTier ?? null
    });
  }, [captionBias, chunks, editorialContext?.motionTier, editorialDecisions]);

  const planWithVisibility = plans.map((plan) => {
    const {entryFrames, exitFrames} = getCinematicVisibilityWindowFrames({
      treatment: plan.treatment,
      fps
    });
    const startFrame = Math.round((plan.chunk.startMs / 1000) * fps);
    const endFrame = Math.round((plan.chunk.endMs / 1000) * fps);
    const visible = frame >= startFrame - entryFrames - 6 && frame <= endFrame + exitFrames + 6;
    return {
      plan,
      startFrame,
      endFrame,
      visible
    };
  });

  const active = planWithVisibility
    .filter((item) => item.visible)
    .sort((a, b) => {
      const aActive = frame >= a.startFrame && frame <= a.endFrame ? 1 : 0;
      const bActive = frame >= b.startFrame && frame <= b.endFrame ? 1 : 0;
      if (aActive !== bActive) {
        return bActive - aActive;
      }
      return b.startFrame - a.startFrame;
    })[0];

  const visiblePlans = captionPolicy.singleActiveChunk
    ? active
      ? [active.plan]
      : []
    : planWithVisibility.filter((item) => item.visible).map((item) => item.plan);

  return (
    <div className="dg-caption-region" style={getCaptionContainerStyle(upperSafeZone, captionBias)}>
      <div className="dg-caption-ambience" />
      {visiblePlans.map((plan) => (
        <CaptionTreatmentLayer key={plan.chunk.id} plan={plan} />
      ))}
    </div>
  );
};
