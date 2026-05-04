import React, {useMemo} from "react";
import {AbsoluteFill, Img, staticFile, useVideoConfig} from "remotion";

import {
  buildLongformSemanticSidecallPresentation,
  type LongformSemanticSidecallPresentation
} from "../lib/longform-semantic-sidecall";
import {
  resolveCaptionEditorialDecision,
  type CaptionEditorialContext,
  type CaptionEditorialDecision,
  type CaptionSurfaceTone
} from "../lib/motion-platform/caption-editorial-engine";
import {useStablePreviewFrame} from "../lib/preview-runtime-stability";
import {selectLongformActiveChunk} from "../lib/longform-word-timing";
import type {CaptionChunk} from "../lib/types";

type LongformSemanticSidecallOverlayProps = {
  chunks: CaptionChunk[];
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
  editorialContext?: Omit<CaptionEditorialContext, "chunk" | "currentTimeMs">;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number): number => 1 - (1 - clamp01(value)) ** 3;
const easeInOutCubic = (value: number): number => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
};

type VariantPalette = {
  primary: string;
  secondary: string;
  glow: string;
  border: string;
  text: string;
  muted: string;
  panel: string;
  surface: string;
};

const getVariantPalette = (
  presentation: LongformSemanticSidecallPresentation,
  surfaceTone: CaptionSurfaceTone
): VariantPalette => {
  if (surfaceTone === "light") {
    return {
      primary: "#172034",
      secondary: "#4f6394",
      glow: "rgba(35, 47, 79, 0.14)",
      border: "rgba(18, 25, 42, 0.12)",
      text: "#10131a",
      muted: "rgba(16, 21, 31, 0.72)",
      panel: "rgba(255,255,255,0.56)",
      surface: "rgba(255,255,255,0.70)"
    };
  }

  if (presentation.variant === "entity-card") {
    return {
      primary: "#b9ccff",
      secondary: "#f4d78f",
      glow: "rgba(142, 173, 255, 0.30)",
      border: "rgba(184, 203, 255, 0.22)",
      text: "#ffffff",
      muted: "rgba(231, 237, 255, 0.82)",
      panel: "rgba(8, 11, 18, 0.18)",
      surface: "rgba(255,255,255,0.05)"
    };
  }

  if (presentation.variant === "step-row" || presentation.variant === "step-stack") {
    return {
      primary: "#92ead9",
      secondary: "#7d8dff",
      glow: "rgba(121, 167, 255, 0.28)",
      border: "rgba(143, 224, 212, 0.20)",
      text: "#fbfcff",
      muted: "rgba(226, 240, 255, 0.78)",
      panel: "rgba(8, 11, 18, 0.20)",
      surface: "rgba(255,255,255,0.05)"
    };
  }

  return {
    primary: "#f0d28b",
    secondary: "#7d8dff",
    glow: "rgba(128, 165, 255, 0.28)",
    border: "rgba(237, 213, 146, 0.20)",
    text: "#ffffff",
    muted: "rgba(226, 232, 248, 0.82)",
    panel: "rgba(8, 11, 18, 0.20)",
    surface: "rgba(255,255,255,0.04)"
  };
};

const getPanelStyle = ({
  presentation,
  visibility,
  translateX,
  translateY,
  scale,
  palette
}: {
  presentation: LongformSemanticSidecallPresentation;
  visibility: number;
  translateX: number;
  translateY: number;
  scale: number;
  palette: VariantPalette;
}): React.CSSProperties => {
  const width = presentation.variant === "entity-card"
    ? "min(31vw, 430px)"
    : presentation.variant === "step-row"
      ? "min(38vw, 560px)"
      : presentation.variant === "step-stack"
        ? "min(30vw, 420px)"
        : "min(28vw, 380px)";
  const top = presentation.variant === "step-row"
    ? "48.5%"
    : presentation.variant === "step-stack"
      ? "37.5%"
      : "22.4%";

  return {
    position: "absolute",
    right: presentation.variant === "step-row" ? "6.2%" : "4.2%",
    top,
    width,
    minWidth: 220,
    padding: presentation.variant === "step-row" ? "18px 18px 18px" : "18px 18px 20px",
    borderRadius: presentation.variant === "step-row" ? 28 : 24,
    border: `1px solid ${palette.border}`,
    background: `linear-gradient(180deg, ${palette.panel}, ${palette.surface})`,
    boxShadow: palette.text === "#10131a"
      ? "0 18px 36px rgba(10, 14, 20, 0.12), 0 0 0 1px rgba(255,255,255,0.26)"
      : "0 20px 42px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.03)",
    backdropFilter: "none",
    opacity: visibility,
    transform: `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`,
    transformOrigin: presentation.variant === "step-row" ? "right center" : "right top",
    overflow: "hidden",
    color: palette.text,
    willChange: "transform, opacity"
  };
};

const getHeaderStyle = (palette: VariantPalette): React.CSSProperties => {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    color: palette.primary,
    fontFamily: "\"DM Sans\", sans-serif",
    fontSize: "0.66rem",
    fontWeight: 800,
    letterSpacing: "0.16em",
    textTransform: "uppercase"
  };
};

const getHeaderBarStyle = (presentation: LongformSemanticSidecallPresentation, palette: VariantPalette): React.CSSProperties => {
  return {
    width: presentation.variant === "step-row" ? 52 : 42,
    height: 3,
    borderRadius: 999,
    background: `linear-gradient(90deg, ${palette.primary}, ${palette.secondary})`,
    boxShadow: `0 0 14px ${palette.glow}`
  };
};

const getTagStyle = (palette: VariantPalette): React.CSSProperties => {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    background: palette.text === "#10131a"
      ? "rgba(255,255,255,0.64)"
      : "rgba(255,255,255,0.06)",
    border: `1px solid ${palette.border}`,
    color: palette.text === "#10131a" ? "rgba(16, 21, 31, 0.82)" : "rgba(241, 246, 255, 0.88)",
    fontFamily: "\"DM Sans\", sans-serif",
    fontSize: "0.64rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase"
  };
};

const renderGraphicAssetPanel = ({
  presentation,
  currentTimeMs,
  chunk,
  palette
}: {
  presentation: LongformSemanticSidecallPresentation;
  currentTimeMs: number;
  chunk: CaptionChunk;
  palette: VariantPalette;
}): React.ReactNode => {
  const asset = presentation.graphicAsset;
  if (!asset) {
    return null;
  }

  const assetProgress = easeOutCubic((currentTimeMs - (chunk.startMs - 180)) / 260);
  const assetOffsetY = 10 - assetProgress * 10;
  const isStepVariant = presentation.variant === "step-row" || presentation.variant === "step-stack";

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        marginBottom: isStepVariant ? 12 : 14,
        opacity: clamp01(assetProgress),
        transform: `translate3d(0, ${assetOffsetY.toFixed(2)}px, 0)`,
        willChange: "transform, opacity"
      }}
    >
      <div style={getHeaderStyle(palette)}>
        <span>{asset.label}</span>
        <div style={getHeaderBarStyle(presentation, palette)} />
      </div>
      <div
        style={{
          position: "relative",
          minHeight: presentation.variant === "step-stack" ? 150 : 166,
          borderRadius: 24,
          border: `1px solid ${palette.border}`,
          background: "transparent",
          boxShadow: "0 16px 34px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.02)",
          overflow: "hidden"
        }}
      >
        <Img
          src={staticFile(asset.src)}
          style={{
            position: "absolute",
            inset: "12px 14px 18px",
            width: "calc(100% - 28px)",
            height: "calc(100% - 30px)",
            objectFit: "contain",
            filter: "drop-shadow(0 20px 26px rgba(0,0,0,0.30))"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 10,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12
          }}
        >
          <span
            style={{
              ...getTagStyle(palette),
              paddingInline: 12,
              maxWidth: "72%",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {asset.copy}
          </span>
          <span
            style={{
              color: palette.muted,
              fontFamily: "\"DM Sans\", sans-serif",
              fontSize: "0.62rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase"
            }}
          >
            Graphic asset
          </span>
        </div>
      </div>
    </div>
  );
};

const renderKeywordCard = ({
  presentation,
  currentTimeMs,
  chunk,
  palette,
  decision
}: {
  presentation: LongformSemanticSidecallPresentation;
  currentTimeMs: number;
  chunk: CaptionChunk;
  palette: VariantPalette;
  decision: CaptionEditorialDecision;
}): React.ReactNode => {
  const displayKeywords = (decision.keywordPhrases.length > 0 ? decision.keywordPhrases : presentation.keywords).slice(
    0,
    decision.mode === "keyword-only" ? 1 : 2
  );
  return (
    <div style={{display: "grid", gap: 10}}>
      {renderGraphicAssetPanel({presentation, currentTimeMs, chunk, palette})}
      <div style={getHeaderStyle(palette)}>
        <span>{presentation.intentLabel}</span>
        <div style={getHeaderBarStyle(presentation, palette)} />
      </div>
      <div
        style={{
          display: "grid",
          gap: 8,
          padding: "4px 0 2px"
        }}
      >
        {displayKeywords.map((keyword, index) => {
          const keywordProgress = easeOutCubic((currentTimeMs - (chunk.startMs - 120 + index * 52)) / 240);
          const keywordScale = 0.98 + keywordProgress * 0.02;
          const keywordOpacity = clamp01(keywordProgress);
          return (
            <div
              key={`${chunk.id}-${keyword}-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 18,
                border: `1px solid ${palette.border}`,
                background: decision.surfaceTone === "light"
                  ? "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.5))"
                  : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                boxShadow: index === 0 ? `0 0 18px ${palette.glow}` : "none",
                opacity: keywordOpacity,
                transform: `translate3d(0, ${(6 - keywordProgress * 6).toFixed(2)}px, 0) scale(${keywordScale.toFixed(3)})`
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  color: palette.text,
                  fontFamily: decision.fontFamily,
                  fontSize: index === 0
                    ? `clamp(${Math.round(28 * decision.fontSizeScale)}px, ${2.8 * decision.fontSizeScale}vw, ${Math.round(42 * decision.fontSizeScale)}px)`
                    : `clamp(${Math.round(22 * decision.fontSizeScale)}px, ${2.2 * decision.fontSizeScale}vw, ${Math.round(32 * decision.fontSizeScale)}px)`,
                  lineHeight: 0.94,
                  letterSpacing: decision.letterSpacing,
                  textTransform: decision.uppercaseBias ? "uppercase" : "none",
                  textShadow: `0 0 14px ${palette.glow}, 0 8px 20px rgba(0, 0, 0, 0.20)`,
                  textWrap: "balance"
                }}
              >
                {decision.keywordAnimation === "letter-by-letter" && index === 0
                  ? keyword.split("").map((char, charIndex) => {
                    const charProgress = easeOutCubic((currentTimeMs - (chunk.startMs - 90 + charIndex * 30)) / 220);
                    return (
                      <span
                        key={`${chunk.id}-${keyword}-${index}-${charIndex}`}
                        style={{
                          display: "inline-block",
                          opacity: charProgress,
                          transform: `translate3d(0, ${(8 - charProgress * 8).toFixed(2)}px, 0) scale(${(0.94 + charProgress * 0.06).toFixed(3)})`,
                          filter: `blur(${((1 - charProgress) * 4).toFixed(2)}px)`
                        }}
                      >
                        {char}
                      </span>
                    );
                  })
                  : keyword}
              </div>
              {index === 0 ? (
                <span style={getTagStyle(palette)}>Sidecall</span>
              ) : null}
            </div>
          );
        })}
      </div>
      {presentation.supportingLabel ? (
        <div
          style={{
            marginTop: 2,
            color: palette.muted,
            fontFamily: "\"DM Sans\", sans-serif",
            fontSize: "0.76rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase"
          }}
        >
          {presentation.supportingLabel}
        </div>
      ) : null}
    </div>
  );
};

const renderEntityCard = ({
  presentation,
  currentTimeMs,
  chunk,
  palette,
  decision
}: {
  presentation: LongformSemanticSidecallPresentation;
  currentTimeMs: number;
  chunk: CaptionChunk;
  palette: VariantPalette;
  decision: CaptionEditorialDecision;
}): React.ReactNode => {
  const nameProgress = easeOutCubic((currentTimeMs - (chunk.startMs - 140)) / 260);
  const detailProgress = easeOutCubic((currentTimeMs - (chunk.startMs - 72)) / 220);
  return (
    <div style={{display: "grid", gap: 12}}>
      {renderGraphicAssetPanel({presentation, currentTimeMs, chunk, palette})}
      <div style={getHeaderStyle(palette)}>
        <span>{presentation.intentLabel}</span>
        <div style={getHeaderBarStyle(presentation, palette)} />
      </div>
      <div
        style={{
          display: "grid",
          gap: 8,
          padding: "2px 0 4px"
        }}
      >
        <div
          style={{
            color: palette.muted,
            fontFamily: decision.fontFamily,
            fontSize: `clamp(${Math.round(1.2 * decision.fontSizeScale * 16)}px, ${2 * decision.fontSizeScale}vw, ${Math.round(1.6 * decision.fontSizeScale * 16)}px)`,
            lineHeight: 1,
            letterSpacing: decision.letterSpacing,
            textTransform: decision.uppercaseBias ? "uppercase" : "none",
            opacity: clamp01(detailProgress),
            transform: `translate3d(0, ${(10 - detailProgress * 10).toFixed(2)}px, 0)`
          }}
        >
          Reference figure
        </div>
        <div
          style={{
            color: palette.text,
            fontFamily: decision.fontFamily,
            fontSize: `clamp(${Math.round(34 * decision.fontSizeScale)}px, ${3.2 * decision.fontSizeScale}vw, ${Math.round(52 * decision.fontSizeScale)}px)`,
            lineHeight: 0.9,
            letterSpacing: decision.letterSpacing,
            textTransform: decision.uppercaseBias ? "uppercase" : "none",
            textShadow: `0 0 24px ${palette.glow}, 0 10px 28px rgba(0,0,0,0.28)`,
            textWrap: "balance",
            opacity: clamp01(nameProgress),
            transform: `translate3d(0, ${(12 - nameProgress * 12).toFixed(2)}px, 0) scale(${(0.95 + nameProgress * 0.05).toFixed(3)})`
          }}
        >
          {presentation.leadLabel}
        </div>
        {presentation.supportingLabel ? (
          <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
            <span style={getTagStyle(palette)}>{presentation.supportingLabel}</span>
            <span style={getTagStyle(palette)}>Named cue</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const renderStepSequence = ({
  presentation,
  currentTimeMs,
  chunk,
  palette,
  decision
}: {
  presentation: LongformSemanticSidecallPresentation;
  currentTimeMs: number;
  chunk: CaptionChunk;
  palette: VariantPalette;
  decision: CaptionEditorialDecision;
}): React.ReactNode => {
  const rowLayout = presentation.variant === "step-row";
  return (
    <div style={{display: "grid", gap: 14}}>
      {renderGraphicAssetPanel({presentation, currentTimeMs, chunk, palette})}
      <div style={getHeaderStyle(palette)}>
        <span>{presentation.intentLabel}</span>
        <div style={getHeaderBarStyle(presentation, palette)} />
      </div>
      <div
        style={{
          color: palette.muted,
          fontFamily: decision.fontFamily,
          fontSize: `clamp(${Math.round(1.1 * decision.fontSizeScale * 16)}px, ${1.8 * decision.fontSizeScale}vw, ${Math.round(1.5 * decision.fontSizeScale * 16)}px)`,
          lineHeight: 1,
          letterSpacing: decision.letterSpacing,
          textTransform: decision.uppercaseBias ? "uppercase" : "none"
        }}
      >
        Fluid sequence
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: rowLayout ? "repeat(3, minmax(0, 1fr))" : "repeat(1, minmax(0, 1fr))",
          gap: 10
        }}
      >
        {presentation.stepItems.map((item, index) => {
          const stepProgress = easeOutCubic((currentTimeMs - (chunk.startMs - 120 + index * 60)) / 240);
          return (
            <div
              key={`${chunk.id}-${item.label}-${index}`}
              style={{
                padding: "14px 14px 12px",
                borderRadius: 20,
                border: `1px solid ${palette.border}`,
                background: [
                  `radial-gradient(circle at 14% 16%, ${palette.glow}, rgba(255,255,255,0) 40%)`,
                  decision.surfaceTone === "light"
                    ? "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.5))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))"
                ].join(", "),
                boxShadow: index === 0 ? `0 0 24px ${palette.glow}` : "0 16px 34px rgba(0,0,0,0.16)",
                opacity: clamp01(stepProgress),
                transform: `translate3d(0, ${(12 - stepProgress * 12).toFixed(2)}px, 0) scale(${(0.96 + stepProgress * 0.04).toFixed(3)})`
              }}
            >
              <div
                style={{
                  marginBottom: 8,
                  color: palette.primary,
                  fontFamily: "\"DM Sans\", sans-serif",
                  fontSize: "0.64rem",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase"
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  color: palette.text,
                  fontFamily: decision.fontFamily,
                  fontSize: rowLayout
                    ? `clamp(${Math.round(20 * decision.fontSizeScale)}px, ${2 * decision.fontSizeScale}vw, ${Math.round(30 * decision.fontSizeScale)}px)`
                    : `clamp(${Math.round(26 * decision.fontSizeScale)}px, ${2.4 * decision.fontSizeScale}vw, ${Math.round(36 * decision.fontSizeScale)}px)`,
                  lineHeight: 0.94,
                  letterSpacing: decision.letterSpacing,
                  textTransform: decision.uppercaseBias ? "uppercase" : "none",
                  textShadow: `0 0 20px ${palette.glow}, 0 10px 24px rgba(0,0,0,0.22)`,
                  textWrap: "balance"
                }}
              >
                {item.detail}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LongformSemanticSidecallOverlay: React.FC<LongformSemanticSidecallOverlayProps> = ({
  chunks,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0,
  editorialContext
}) => {
  const {fps} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const currentTimeMs = ((stableFrame + 0.5) / fps) * 1000;
  const activeChunk = useMemo(() => selectLongformActiveChunk(chunks, currentTimeMs), [chunks, currentTimeMs]);
  const editorialDecision = useMemo(() => {
    const chunk = activeChunk ?? chunks[0];
    if (!chunk) {
      return resolveCaptionEditorialDecision({
        chunk: {
          id: "idle",
          text: "",
          startMs: 0,
          endMs: 0,
          words: [],
          styleKey: "",
          motionKey: "",
          layoutVariant: "inline",
          emphasisWordIndices: []
        },
        ...editorialContext,
        currentTimeMs
      });
    }

    return resolveCaptionEditorialDecision({
      chunk,
      ...editorialContext,
      currentTimeMs
    });
  }, [activeChunk, chunks, currentTimeMs, editorialContext]);
  const presentation = useMemo(() => {
    if (!activeChunk) {
      return null;
    }
    return buildLongformSemanticSidecallPresentation({chunk: activeChunk});
  }, [activeChunk]);

  if (!activeChunk || !presentation) {
    return null;
  }

  const entryProgress = easeOutCubic((currentTimeMs - (activeChunk.startMs - 160)) / 280);
  const exitProgress = easeInOutCubic((currentTimeMs - (activeChunk.endMs + 56)) / 260);
  const visibility = clamp01(entryProgress * (1 - exitProgress));
  const translateX = 34 - entryProgress * 34 + exitProgress * 14;
  const translateY = presentation.variant === "step-row"
    ? 14 - entryProgress * 14 + exitProgress * 8
    : 0;
  const scale = presentation.variant === "step-row"
    ? 0.96 + entryProgress * 0.04 - exitProgress * 0.015
    : 0.975 + entryProgress * 0.025 - exitProgress * 0.012;
  const palette = getVariantPalette(presentation, editorialDecision.surfaceTone);

  return (
    <AbsoluteFill
      style={{zIndex: 8, pointerEvents: "none"}}
      data-animation-tags="semantic-sidecall focus-target"
      data-animation-registry-ref="host:semantic-sidecall-cue-visual"
    >
      <div
        style={getPanelStyle({
          presentation,
          visibility,
          translateX,
          translateY,
          scale,
          palette
        })}
      >
        <div
          style={{
            position: "absolute",
            inset: "auto 16px 14px auto",
            width: 76,
            height: 76,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(160, 197, 255, 0.26), rgba(255,255,255,0) 70%)",
            filter: "blur(14px)",
            opacity: 0.52
          }}
        />
        <div style={{position: "relative", zIndex: 1}}>
          {presentation.variant === "entity-card"
            ? renderEntityCard({presentation, currentTimeMs, chunk: activeChunk, palette, decision: editorialDecision})
            : presentation.variant === "step-row" || presentation.variant === "step-stack"
              ? renderStepSequence({presentation, currentTimeMs, chunk: activeChunk, palette, decision: editorialDecision})
              : renderKeywordCard({presentation, currentTimeMs, chunk: activeChunk, palette, decision: editorialDecision})}
        </div>
      </div>
    </AbsoluteFill>
  );
};
