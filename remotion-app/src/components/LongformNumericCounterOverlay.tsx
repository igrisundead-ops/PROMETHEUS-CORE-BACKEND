import React from "react";

import type {LongformNumericTreatment} from "../lib/longform-numeric-treatment";

type LongformNumericCounterOverlayProps = {
  treatment: LongformNumericTreatment;
  currentTimeMs: number;
  baseFontSizePx: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number): number => 1 - (1 - clamp01(value)) ** 3;
const easeInOutCubic = (value: number): number => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
};
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const formatCoreValue = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(Math.max(0, Math.round(value)));
};

const getAccent = (treatment: LongformNumericTreatment): {
  primary: string;
  secondary: string;
  glow: string;
  rail: string;
  support: string;
} => {
  if (treatment.spec.tone === "percentage") {
    return {
      primary: "#f4fffb",
      secondary: "#8ae2d0",
      glow: "rgba(114, 224, 201, 0.32)",
      rail: "linear-gradient(90deg, rgba(138, 226, 208, 0.2), rgba(72, 179, 157, 0.95), rgba(138, 226, 208, 0.18))",
      support: "rgba(229, 255, 249, 0.86)"
    };
  }

  if (treatment.spec.tone === "currency") {
    return {
      primary: "#fff7eb",
      secondary: "#f2c67a",
      glow: "rgba(242, 181, 105, 0.32)",
      rail: "linear-gradient(90deg, rgba(242, 198, 122, 0.18), rgba(240, 140, 79, 0.96), rgba(242, 198, 122, 0.18))",
      support: "rgba(255, 241, 219, 0.84)"
    };
  }

  if (treatment.spec.tone === "year") {
    return {
      primary: "#fff9ef",
      secondary: "#d8c07d",
      glow: "rgba(216, 192, 125, 0.26)",
      rail: "linear-gradient(90deg, rgba(216, 192, 125, 0.14), rgba(159, 184, 255, 0.96), rgba(216, 192, 125, 0.14))",
      support: "rgba(248, 242, 227, 0.82)"
    };
  }

  return {
    primary: "#f8fbff",
    secondary: "#9fb8ff",
    glow: "rgba(159, 184, 255, 0.30)",
    rail: "linear-gradient(90deg, rgba(159, 184, 255, 0.18), rgba(123, 114, 255, 0.92), rgba(159, 184, 255, 0.18))",
    support: "rgba(235, 242, 255, 0.84)"
  };
};

export const LongformNumericCounterOverlay: React.FC<LongformNumericCounterOverlayProps> = ({
  treatment,
  currentTimeMs,
  baseFontSizePx
}) => {
  const accent = getAccent(treatment);
  const countDurationMs = Math.max(440, Math.min(840, (treatment.endMs - treatment.startMs) * 0.58));
  const enterProgress = easeOutCubic((currentTimeMs - (treatment.startMs - 70)) / 240);
  const countProgress = easeOutCubic((currentTimeMs - treatment.startMs) / countDurationMs);
  const unitProgress = easeOutCubic((currentTimeMs - treatment.unitRevealMs + 40) / 220);
  const supportProgress = easeOutCubic((currentTimeMs - treatment.unitRevealMs + 10) / 280);
  const exitProgress = easeInOutCubic((currentTimeMs - (treatment.endMs - 150)) / 190);
  const overallOpacity = clamp01(enterProgress * (1 - exitProgress * 0.92));
  const settleScale = lerp(0.94, 1, enterProgress);
  const settleLift = lerp(18, 0, enterProgress) + exitProgress * 10;
  const currentValue = lerp(treatment.spec.startValue, treatment.spec.targetValue, countProgress);
  const showPrefix = treatment.spec.prefix.length > 0;
  const showSuffix = treatment.spec.suffix.length > 0;
  const bigNumberSizePx = Math.max(baseFontSizePx * 2.95, 86);
  const unitSizePx = Math.max(baseFontSizePx * 1.12, 34);
  const supportSizePx = Math.max(baseFontSizePx * 0.48, 18);
  const railWidthPercent = lerp(18, 100, countProgress);

  return (
    <div
      style={{
        width: "100%",
        display: "grid",
        justifyItems: "center",
        gap: supportProgress > 0 ? 10 : 4,
        opacity: overallOpacity,
        transform: `translate3d(0, ${settleLift.toFixed(2)}px, 0) scale(${settleScale.toFixed(3)})`,
        transformOrigin: "center center",
        willChange: "transform, opacity"
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: "0.06em",
          filter: `blur(${lerp(7, 0, enterProgress).toFixed(2)}px)`
        }}
      >
        {showPrefix ? (
          <span
            style={{
              paddingTop: "0.24em",
              color: accent.secondary,
              fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
              fontSize: `${unitSizePx}px`,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              opacity: 0.92
            }}
          >
            {treatment.spec.prefix}
          </span>
        ) : null}
        <span
          style={{
            display: "inline-block",
            color: accent.primary,
            fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
            fontSize: `${bigNumberSizePx}px`,
            lineHeight: 0.9,
            letterSpacing: "-0.055em",
            fontVariantNumeric: "tabular-nums lining-nums",
            WebkitFontFeatureSettings: "\"tnum\" 1, \"lnum\" 1",
            textShadow: `0 0 22px ${accent.glow}, 0 12px 30px rgba(0, 0, 0, 0.34)`
          }}
        >
          {formatCoreValue(currentValue)}
        </span>
        {showSuffix ? (
          <span
            style={{
              paddingTop: "0.14em",
              color: accent.secondary,
              fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
              fontSize: `${unitSizePx}px`,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              opacity: unitProgress,
              transform: `translate3d(0, ${lerp(8, 0, unitProgress).toFixed(2)}px, 0)`,
              textShadow: `0 0 18px ${accent.glow}`
            }}
          >
            {treatment.spec.suffix}
          </span>
        ) : null}
      </div>
      <div
        style={{
          width: `${railWidthPercent.toFixed(2)}%`,
          maxWidth: 520,
          minWidth: 72,
          height: 2,
          borderRadius: 999,
          background: accent.rail,
          boxShadow: `0 0 18px ${accent.glow}`,
          opacity: 0.88 * enterProgress
        }}
      />
      {treatment.supportText ? (
        <div
          style={{
            maxWidth: "88%",
            color: accent.support,
            fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
            fontSize: `${supportSizePx}px`,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            textAlign: "center",
            opacity: supportProgress,
            transform: `translate3d(0, ${lerp(12, 0, supportProgress).toFixed(2)}px, 0)`,
            textShadow: "0 6px 16px rgba(0, 0, 0, 0.26)"
          }}
        >
          {treatment.supportText}
        </div>
      ) : null}
    </div>
  );
};
