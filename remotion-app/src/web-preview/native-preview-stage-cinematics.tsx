import React, {type CSSProperties} from "react";

import type {MotionPrimitiveId, MotionSceneKind} from "../lib/types";
import type {
  CinematicTextAnimationPreset,
  SchemaStageEffectRoute
} from "../lib/motion-platform/schema-mapping-resolver";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number): number => 1 - (1 - clamp01(value)) ** 3;

type LandscapeTitleSafeLayout = {
  outerStyle: CSSProperties;
  stackStyle: CSSProperties;
};

type AnimatedHeadlineProps = {
  text: string;
  reveal: number;
  currentTimeMs: number;
  route: SchemaStageEffectRoute;
  primitiveId?: MotionPrimitiveId;
};

type StageUnderlayEffectsProps = {
  route: SchemaStageEffectRoute;
  reveal: number;
  currentTimeMs: number;
};

type StageOverlayAssetProps = {
  src: string;
  alt: string;
  fitMode: "contain" | "cover";
  filter?: string;
  style?: CSSProperties;
  glowVisible?: boolean;
  className?: string;
};

type HeadlineToken = {
  key: string;
  text: string;
  focus: boolean;
  groupIndex: number;
};

const splitWords = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

const pickFocusWordIndex = (words: string[]): number => {
  const numericIndex = words.findIndex((word) => /\d/.test(word));
  if (numericIndex >= 0) {
    return numericIndex;
  }
  const uppercaseIndex = words.findIndex((word) => /^[A-Z0-9]{3,}$/.test(word));
  if (uppercaseIndex >= 0) {
    return uppercaseIndex;
  }
  return Math.max(0, Math.floor(words.length / 2));
};

const buildHeadlineTokens = (text: string): HeadlineToken[] => {
  const words = splitWords(text);
  const focusWordIndex = pickFocusWordIndex(words);

  return words.map((word, index) => ({
    key: `${word}-${index}`,
    text: word,
    focus: index === focusWordIndex,
    groupIndex: Math.floor(index / 2)
  }));
};

const resolveRotatingGroupIndex = (tokens: HeadlineToken[], currentTimeMs: number): number => {
  if (tokens.length <= 2) {
    return 0;
  }

  const groupCount = Math.max(1, tokens[tokens.length - 1]?.groupIndex ?? 0);
  const cycleLengthMs = 740;
  return Math.floor(currentTimeMs / cycleLengthMs) % (groupCount + 1);
};

const getTokenProgress = ({
  reveal,
  index,
  length,
  preset
}: {
  reveal: number;
  index: number;
  length: number;
  preset: CinematicTextAnimationPreset;
}): number => {
  const stagger = preset === "split-stagger" ? 0.09 : preset === "blur-to-sharp" ? 0.055 : 0.07;
  const offset = length > 1 ? index * stagger : 0;
  return easeOutCubic(clamp01((reveal - offset) / Math.max(0.28, 1 - offset)));
};

const getAnimatedTokenStyle = ({
  token,
  index,
  tokens,
  reveal,
  preset,
  currentTimeMs,
  focusWordOnly
}: {
  token: HeadlineToken;
  index: number;
  tokens: HeadlineToken[];
  reveal: number;
  preset: CinematicTextAnimationPreset;
  currentTimeMs: number;
  focusWordOnly: boolean;
}): CSSProperties => {
  const progress = getTokenProgress({
    reveal,
    index,
    length: tokens.length,
    preset
  });
  const activeGroupIndex = resolveRotatingGroupIndex(tokens, currentTimeMs);
  const directionalSign = index % 2 === 0 ? -1 : 1;
  const baseOpacity = 0.18 + progress * 0.82;
  const baseBlur = (1 - progress) * (preset === "blur-to-sharp" ? 11 : 8);
  const baseTranslateY = (1 - progress) * (preset === "split-stagger" ? 32 : 22);
  const baseRotate = preset === "split-stagger"
    ? (1 - progress) * directionalSign * 2.4
    : preset === "rotating-emphasis"
      ? (1 - progress) * directionalSign * 4.8
      : 0;
  let scale = 0.96 + progress * 0.04;
  let opacity = baseOpacity;
  let blur = baseBlur;
  let translateY = baseTranslateY;
  let translateX = 0;
  let rotate = baseRotate;
  let background = "transparent";
  let boxShadow = "none";
  let color = token.focus ? "#ffffff" : "rgba(244, 246, 255, 0.9)";
  let border = "1px solid transparent";

  if (preset === "focus-frame") {
    const shouldFrame = focusWordOnly ? token.focus : token.focus || index === activeGroupIndex;
    if (shouldFrame) {
      scale += 0.035;
      opacity = Math.min(1, opacity + 0.12);
      blur *= 0.28;
      translateY *= 0.26;
      background = "linear-gradient(135deg, rgba(31, 54, 114, 0.52), rgba(10, 14, 27, 0.16))";
      boxShadow = "0 0 0 1px rgba(255,255,255,0.16), 0 16px 42px rgba(0,0,0,0.34), 0 0 36px rgba(121,174,255,0.16)";
      border = "1px solid rgba(255,255,255,0.14)";
      color = "#ffffff";
    } else {
      opacity *= 0.84;
      scale *= 0.992;
      blur += 0.8;
    }
  }

  if (preset === "rotating-emphasis") {
    const isActiveGroup = token.groupIndex === activeGroupIndex;
    scale += isActiveGroup ? 0.03 : -0.012;
    opacity *= isActiveGroup ? 1 : 0.56;
    blur += isActiveGroup ? 0 : 1.6;
    translateY += isActiveGroup ? 0 : 8;
    translateX = isActiveGroup ? 0 : directionalSign * 8;
    rotate += isActiveGroup ? 0 : directionalSign * 2;
  }

  if (preset === "blur-to-sharp") {
    blur += token.focus ? 0 : 0.8;
    translateY *= token.focus ? 0.78 : 0.92;
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: preset === "focus-frame" ? "0.08em 0.18em 0.12em" : undefined,
    borderRadius: preset === "focus-frame" ? "0.34em" : undefined,
    background,
    border,
    boxShadow,
    color,
    opacity,
    filter: `blur(${blur.toFixed(2)}px)`,
    transform: `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(3)}) rotate(${rotate.toFixed(2)}deg)`,
    willChange: "transform, opacity, filter"
  };
};

const renderTypewriterHeadline = (text: string, reveal: number): React.ReactNode => {
  const count = Math.max(0, Math.min(text.length, Math.round(text.length * clamp01(reveal))));
  const visibleText = text.slice(0, count);

  return (
    <>
      {visibleText}
      {reveal < 0.999 ? (
        <span className="preview-native-headline-caret" />
      ) : null}
    </>
  );
};

export const resolveLandscapeTitleSafeLayout = ({
  sceneKind
}: {
  sceneKind?: MotionSceneKind;
}): LandscapeTitleSafeLayout => {
  const maxWidth = sceneKind === "quote"
    ? "min(60vw, 760px)"
    : sceneKind === "comparison"
      ? "min(64vw, 900px)"
      : "min(68vw, 980px)";
  const outerStyle: CSSProperties = {
    position: "absolute",
    inset: "11% 10.5% 18% 10.5%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center"
  };
  const stackStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth,
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: "0.9rem"
  };

  return {outerStyle, stackStyle};
};

export const StageUnderlayEffects: React.FC<StageUnderlayEffectsProps> = ({
  route,
  reveal,
  currentTimeMs
}) => {
  const revealProgress = easeOutCubic(reveal);
  const driftPhase = Math.sin(currentTimeMs / 420);
  const lightSweepX = -34 + revealProgress * 84 + driftPhase * 6;
  const ringScale = 0.82 + revealProgress * 0.28;

  return (
    <div className="preview-native-headline-underlay" aria-hidden="true">
      <div
        className="preview-native-headline-radial"
        style={{
          opacity: route.underlayEffect === "depth-haze" ? 0.32 : 0.62 * revealProgress,
          transform: `translate3d(-50%, -50%, 0) scale(${(0.94 + revealProgress * 0.12).toFixed(3)})`
        }}
      />
      {route.underlayEffect === "light-sweep" ? (
        <div
          className="preview-native-headline-sweep"
          style={{
            opacity: 0.24 + revealProgress * 0.32,
            transform: `translate3d(${lightSweepX.toFixed(2)}%, 0, 0) rotate(-8deg)`
          }}
        />
      ) : null}
      {route.underlayEffect === "depth-haze" ? (
        <div
          className="preview-native-headline-depthplate"
          style={{
            opacity: 0.28 + revealProgress * 0.24
          }}
        />
      ) : null}
      {route.ringAccent ? (
        <div
          className="preview-native-headline-ring"
          style={{
            opacity: 0.22 + revealProgress * 0.34,
            transform: `translate3d(-50%, -50%, 0) scale(${ringScale.toFixed(3)})`
          }}
        />
      ) : null}
    </div>
  );
};

export const AnimatedHeadline: React.FC<AnimatedHeadlineProps> = ({
  text,
  reveal,
  currentTimeMs,
  route,
  primitiveId
}) => {
  if (!text.trim()) {
    return null;
  }

  if (primitiveId === "typewriter") {
    return (
      <span className="preview-native-headline-inline">
        {renderTypewriterHeadline(text, reveal)}
      </span>
    );
  }

  const tokens = buildHeadlineTokens(text);
  if (tokens.length === 0) {
    return <span className="preview-native-headline-inline">{text}</span>;
  }

  return (
    <span className="preview-native-headline-inline">
      {tokens.map((token, index) => (
        <span
          key={token.key}
          className="preview-native-headline-token"
          style={getAnimatedTokenStyle({
            token,
            index,
            tokens,
            reveal,
            preset: route.animationPreset,
            currentTimeMs,
            focusWordOnly: route.focusWordOnly
          })}
        >
          {token.text}
        </span>
      ))}
    </span>
  );
};

export const StageOverlayAsset: React.FC<StageOverlayAssetProps> = ({
  src,
  alt,
  fitMode,
  filter,
  style,
  glowVisible = true,
  className = ""
}) => {
  return (
    <div className={`preview-native-stage-overlay-asset ${className}`.trim()} style={style}>
      {glowVisible ? <div className="preview-native-showcase-glow" /> : null}
      <img
        src={src}
        alt={alt}
        className="preview-native-stage-overlay-asset-image"
        loading="eager"
        decoding="async"
        style={{
          width: "100%",
          height: fitMode === "contain" ? "auto" : "100%",
          objectFit: fitMode,
          filter
        }}
      />
    </div>
  );
};
