import React from "react";

import type {MotionShowcaseCue} from "../lib/types";
import {
  formatAzureGCounterValue,
  resolveAzureGCounterSpec
} from "../lib/motion-platform/azureg-animations";

type AzureGAnimatedCounterProps = {
  cue: MotionShowcaseCue;
  visibility: number;
  accent: {
    primary: string;
    secondary: string;
    glow: string;
    text: string;
  };
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const easeOutCubic = (value: number): number => 1 - Math.pow(1 - clamp01(value), 3);

const lerp = (from: number, to: number, progress: number): number => from + (to - from) * clamp01(progress);

export const AzureGAnimatedCounter: React.FC<AzureGAnimatedCounterProps> = ({
  cue,
  visibility,
  accent
}) => {
  const spec = resolveAzureGCounterSpec(cue);
  const progress = easeOutCubic(visibility);
  const currentValue = lerp(spec.startValue, spec.targetValue, progress);
  const currentDisplayValue = formatAzureGCounterValue({
    tone: spec.tone,
    prefix: spec.prefix,
    suffix: spec.suffix,
    value: currentValue
  });

  const revealLift = lerp(spec.preset.runtimeParams.blurFromPx * 0.7, 0, progress);
  const revealScale = lerp(spec.preset.runtimeParams.scaleFrom, 1, progress);
  const revealOpacity = lerp(0.2, 1, progress);
  const railWidth = `${lerp(28, 100, progress).toFixed(2)}%`;

  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gap: 10,
        padding: "14px 16px 12px",
        borderRadius: 24,
        background: [
          `radial-gradient(circle at 18% 20%, ${accent.glow}, rgba(255,255,255,0) 40%)`,
          `radial-gradient(circle at 82% 18%, rgba(255,255,255,0.1), rgba(255,255,255,0) 36%)`,
          `linear-gradient(180deg, rgba(255,255,255,${spec.preset.runtimeParams.plateOpacity}), rgba(255,255,255,0.03))`
        ].join(", "),
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: `0 24px 60px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255,255,255,0.04)`,
        overflow: "hidden"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${spec.preset.palette.accent}22, rgba(255,255,255,0) 52%)`,
          opacity: spec.preset.runtimeParams.sheenOpacity,
          pointerEvents: "none"
        }}
      />
      <div style={{position: "relative", zIndex: 1, display: "grid", gap: 10}}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            color: accent.primary,
            fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
            fontSize: "0.64rem",
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase"
          }}
        >
          <span>{spec.preset.label}</span>
          <span style={{color: "rgba(241, 246, 255, 0.66)"}}>AzureG</span>
        </div>
        <div
          style={{
            position: "relative",
            display: "grid",
            gap: 8,
            padding: "2px 0 4px",
            transform: `translate3d(0, ${revealLift}px, 0) scale(${revealScale})`,
            opacity: revealOpacity,
            filter: `blur(${Math.max(0, revealLift * 0.08)}px)`
          }}
        >
          <div
            style={{
              color: "rgba(246, 250, 255, 0.82)",
              fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase"
            }}
          >
            {spec.preset.description}
          </div>
          <div
            style={{
              fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
              fontSize: spec.tone === "year" ? "clamp(30px, 3vw, 44px)" : "clamp(34px, 3.4vw, 56px)",
              lineHeight: 0.9,
              letterSpacing: spec.tone === "year" ? "-0.045em" : "-0.06em",
              fontVariantNumeric: "tabular-nums lining-nums",
              WebkitFontFeatureSettings: "\"tnum\" 1, \"lnum\" 1",
              textShadow: `0 0 24px ${accent.glow}, 0 12px 28px rgba(0, 0, 0, 0.22)`,
              backgroundImage: `linear-gradient(90deg, ${spec.preset.palette.primary}, ${spec.preset.palette.secondary}, ${spec.preset.palette.primary})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
              minHeight: "1.05em"
            }}
          >
            {currentDisplayValue}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "rgba(234, 240, 252, 0.78)",
              fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
              fontSize: "0.72rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }}
          >
            <div
              style={{
                width: railWidth,
                height: 2,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${spec.preset.palette.rail}, ${spec.preset.palette.accent})`,
                boxShadow: `0 0 18px ${accent.glow}`
              }}
            />
            <span>{spec.displayValue}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
