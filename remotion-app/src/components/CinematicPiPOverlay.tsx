import React, {type CSSProperties, useMemo} from "react";
import {AbsoluteFill, Html5Video, Img, OffthreadVideo, staticFile} from "remotion";

import {useStablePreviewFrame} from "../lib/preview-runtime-stability";
import type {
  CinematicPiPLayoutPreset,
  MotionAssetManifest,
  MotionCombatElement,
  MotionCombatRole,
  VideoMetadata
} from "../lib/types";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import {
  buildCinematicPiPCompositionPlan,
  resolveCinematicPiPStageState
} from "../lib/motion-platform/pip-composition-planner";

const PREVIEW_MEDIA_ACCEPTABLE_TIMESHIFT_SECONDS = 2.5;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, progress: number): number => from + (to - from) * progress;

const easeOutCubic = (value: number): number => 1 - (1 - clamp01(value)) ** 3;

const uniqueById = (assets: MotionAssetManifest[]): MotionAssetManifest[] => {
  const seen = new Set<string>();
  const output: MotionAssetManifest[] = [];

  for (const asset of assets) {
    if (seen.has(asset.id)) {
      continue;
    }
    seen.add(asset.id);
    output.push(asset);
  }

  return output;
};

const resolveAssetSrc = (src: string): string => {
  if (/^(https?:)?\/\//.test(src) || src.startsWith("/")) {
    return src;
  }
  return staticFile(src);
};

const resolveAssetAccent = (asset: MotionAssetManifest): {primary: string; secondary: string; glow: string} => {
  const tags = new Set(asset.themeTags ?? []);
  if (tags.has("warm") || tags.has("heroic")) {
    return {
      primary: "#f8d48e",
      secondary: "#f08e56",
      glow: "rgba(244, 178, 100, 0.28)"
    };
  }
  if (tags.has("cool")) {
    return {
      primary: "#8eb9ff",
      secondary: "#6185ff",
      glow: "rgba(118, 158, 255, 0.28)"
    };
  }
  if (tags.has("calm")) {
    return {
      primary: "#d0d9e9",
      secondary: "#97a5bf",
      glow: "rgba(180, 198, 224, 0.18)"
    };
  }
  return {
    primary: "#e8edf8",
    secondary: "#aeb8ce",
    glow: "rgba(174, 184, 206, 0.18)"
  };
};

const COMBAT_ROLE_ORDER: Record<MotionCombatRole, number> = {
  "primary-attacker": 0,
  "secondary-attacker": 1,
  support: 2,
  utility: 3
};

const getCombatRoleLabel = (role: MotionCombatRole): string => {
  if (role === "primary-attacker") {
    return "Primary";
  }
  if (role === "secondary-attacker") {
    return "Secondary";
  }
  if (role === "support") {
    return "Support";
  }
  return "Utility";
};

const getCombatRoleAccent = (role: MotionCombatRole): {primary: string; secondary: string; glow: string} => {
  if (role === "primary-attacker") {
    return {
      primary: "#f9dc9a",
      secondary: "#f4a968",
      glow: "rgba(244, 173, 99, 0.28)"
    };
  }
  if (role === "secondary-attacker") {
    return {
      primary: "#acc9ff",
      secondary: "#7f9cff",
      glow: "rgba(127, 156, 255, 0.24)"
    };
  }
  if (role === "support") {
    return {
      primary: "#98ead7",
      secondary: "#65c9d0",
      glow: "rgba(108, 214, 201, 0.22)"
    };
  }
  return {
    primary: "#d7deec",
    secondary: "#aab5c8",
    glow: "rgba(175, 183, 201, 0.16)"
  };
};

const getCombatTierLabel = (element?: MotionCombatElement | null): string => {
  if (!element) {
    return "";
  }
  return `${element.tier} / ${element.motionStyle.replace(/-/g, " ")}`;
};

const getCombatRoleRank = (element?: MotionCombatElement | null): number => {
  if (!element) {
    return COMBAT_ROLE_ORDER.utility;
  }
  return COMBAT_ROLE_ORDER[element.role] ?? COMBAT_ROLE_ORDER.utility;
};

const getAssetLabel = (asset: MotionAssetManifest): string => {
  return asset.canonicalLabel ?? asset.id.replace(/[-_]+/g, " ");
};

const getAssetDescriptor = (asset: MotionAssetManifest): string => {
  if (asset.family === "flare") {
    return "Light field";
  }
  if (asset.family === "panel") {
    return "Side structure";
  }
  if (asset.family === "frame") {
    return "Frame system";
  }
  if (asset.family === "grid") {
    return "Grid bed";
  }
  if (asset.family === "depth-mask") {
    return "Depth mask";
  }
  if (asset.family === "foreground-element") {
    return "Foreground accent";
  }
  return "Motion module";
};

const getAssetMotionLabel = (asset: MotionAssetManifest): string => {
  if (asset.family === "flare") {
    return "Glow";
  }
  if (asset.family === "panel") {
    return "Slide";
  }
  if (asset.family === "frame") {
    return "Drift";
  }
  if (asset.family === "foreground-element") {
    return "Float";
  }
  return "Pulse";
};

const getCardMotionTransform = ({
  reveal,
  motionFlavor,
  index
}: {
  reveal: number;
  motionFlavor: string;
  index: number;
}): string => {
  const eased = easeOutCubic(reveal);
  const drift = motionFlavor === "slide" ? 14 : motionFlavor === "float" ? 10 : motionFlavor === "glow" ? 6 : 8;
  const translateX =
    motionFlavor === "slide"
      ? lerp(18, 0, eased)
      : motionFlavor === "float"
        ? Math.sin((index + 1) * 0.7) * 4 * (1 - eased)
        : motionFlavor === "drift"
          ? lerp(10, 0, eased)
          : 0;
  const translateY =
    motionFlavor === "float"
      ? lerp(12, 0, eased)
      : motionFlavor === "glow"
        ? lerp(10, 0, eased)
        : lerp(drift, 0, eased);
  const scale = motionFlavor === "glow" ? lerp(0.94, 1, eased) : lerp(0.98, 1, eased);
  return `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
};

const buildAssetCardStyle = ({
  leftPercent,
  topPercent,
  widthPercent,
  heightPercent,
  reveal,
  accentGlow,
  motionFlavor,
  index
}: {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  reveal: number;
  accentGlow: string;
  motionFlavor: string;
  index: number;
}): CSSProperties => {
  const eased = easeOutCubic(reveal);
  return {
    position: "absolute",
    left: `${leftPercent}%`,
    top: `${topPercent}%`,
    width: `${widthPercent}%`,
    height: `${heightPercent}%`,
    padding: "14px",
    borderRadius: 26,
    border: "1px solid rgba(255,255,255,0.11)",
    background: [
      "radial-gradient(circle at 14% 12%, rgba(255,255,255,0.14), rgba(255,255,255,0) 32%)",
      `radial-gradient(circle at 86% 18%, ${accentGlow}, rgba(255,255,255,0) 42%)`,
      "linear-gradient(180deg, rgba(10,14,22,0.88), rgba(7,10,18,0.78))"
    ].join(", "),
    boxShadow: `0 22px 46px rgba(0,0,0,${0.2 + eased * 0.14}), 0 0 0 1px rgba(255,255,255,0.06)`,
    backdropFilter: "blur(18px)",
    opacity: clamp01(reveal),
    transform: getCardMotionTransform({reveal, motionFlavor, index}),
    transformOrigin: "center center",
    overflow: "hidden",
    willChange: "transform, opacity"
  };
};

const PiPAssetCard: React.FC<{
  asset: MotionAssetManifest;
  combatElement?: MotionCombatElement | null;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
  reveal: number;
  index: number;
  motionFlavor: string;
}> = ({
  asset,
  leftPercent,
  topPercent,
  widthPercent,
  heightPercent,
  reveal,
  index,
  motionFlavor,
  combatElement
}) => {
  const accent = resolveAssetAccent(asset);
  const combatAccent = combatElement ? getCombatRoleAccent(combatElement.role) : accent;
  const style = buildAssetCardStyle({
    leftPercent,
    topPercent,
    widthPercent,
    heightPercent,
    reveal,
    accentGlow: combatAccent.glow,
    motionFlavor,
    index
  });
  const label = getAssetLabel(asset);
  const combatLabel = combatElement ? getCombatRoleLabel(combatElement.role) : getAssetMotionLabel(asset);
  const combatTierLabel = getCombatTierLabel(combatElement);
  const combatTags = combatElement
    ? `${combatLabel} / ${combatTierLabel}`
    : getAssetMotionLabel(asset);

  return (
    <div
      style={style}
      data-animation-tags={`pip asset-module ${asset.family ?? "asset"} ${asset.themeTags?.join(" ") ?? ""} ${combatElement ? `combat-${combatElement.role}` : ""}`}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
          fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: combatAccent.primary
        }}
      >
        <span>{getAssetDescriptor(asset)}</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(238,244,255,0.78)",
            letterSpacing: "0.14em"
          }}
        >
          {combatLabel}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "calc(100% - 2.6rem)",
          borderRadius: 20,
          overflow: "hidden",
          background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))"
        }}
      >
        <Img
          src={resolveAssetSrc(asset.src)}
          alt={label}
          style={{
            position: "absolute",
            inset: "12% 10%",
            width: "80%",
            height: "76%",
            objectFit: "contain",
            filter: "drop-shadow(0 16px 28px rgba(0,0,0,0.24))",
            opacity: 0.96
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 42%, ${accent.glow} 0%, rgba(255,255,255,0) 62%)`,
            mixBlendMode: "screen",
            opacity: 0.68
          }}
        />
      </div>
      <div
        style={{
          display: "grid",
          gap: 4,
          marginTop: 10,
          color: "rgba(238,244,255,0.9)"
        }}
      >
        <div
          style={{
            fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
            fontSize: "clamp(1rem, 1.45vw, 1.35rem)",
            lineHeight: 0.96,
            letterSpacing: "-0.04em",
            textShadow: `0 0 22px ${combatAccent.glow}, 0 10px 18px rgba(0,0,0,0.22)`
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
            fontSize: 11,
            lineHeight: 1.36,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(223,230,244,0.7)"
          }}
        >
          {asset.family ?? "motion"} / {combatTags}
        </div>
      </div>
    </div>
  );
};

const getChipStyle = (accent: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)",
  boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 10px 24px rgba(0,0,0,0.14)`,
  color: accent
});

export const CinematicPiPOverlay: React.FC<{
  model: MotionCompositionModel;
  videoSrc: string;
  videoMetadata: Pick<VideoMetadata, "width" | "height" | "durationSeconds" | "durationInFrames">;
  headlineText?: string;
  supportText?: string;
  layoutPreset?: CinematicPiPLayoutPreset;
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
}> = ({
  model,
  videoSrc,
  videoMetadata,
  headlineText = "PiP is not a box.",
  supportText = "PiP is a subject container that unlocks the rest of the frame as a storytelling surface.",
  layoutPreset,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0
}) => {
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const currentFrame = stableFrame;
  const combatPlan = model.compositionCombatPlan;
  const combatAssetMap = useMemo(() => {
    const assetMap = new Map<string, MotionCombatElement>();

    combatPlan?.elements.forEach((element) => {
      if (!element.assetId) {
        return;
      }
      const current = assetMap.get(element.assetId);
      if (
        !current ||
        getCombatRoleRank(element) < getCombatRoleRank(current) ||
        (getCombatRoleRank(element) === getCombatRoleRank(current) && element.score > current.score)
      ) {
        assetMap.set(element.assetId, element);
      }
    });

    return assetMap;
  }, [combatPlan]);
  const motionAssets = useMemo(() => {
    return uniqueById([
      ...model.motionPlan.selectedAssets,
      ...model.showcasePlan.selectedAssets
    ])
      .sort((left, right) => {
        const leftElement = combatAssetMap.get(left.id) ?? null;
        const rightElement = combatAssetMap.get(right.id) ?? null;
        const roleGap = getCombatRoleRank(leftElement) - getCombatRoleRank(rightElement);
        if (roleGap !== 0) {
          return roleGap;
        }
        return (rightElement?.score ?? 0) - (leftElement?.score ?? 0);
      })
      .slice(0, 4);
  }, [combatAssetMap, model.motionPlan.selectedAssets, model.showcasePlan.selectedAssets]);
  const plan = useMemo(() => {
    return buildCinematicPiPCompositionPlan({
      videoMetadata,
      motionTier: model.motionPlan.motionIntensity,
      layoutPreset,
      motionAssets
    });
  }, [layoutPreset, model.motionPlan.motionIntensity, motionAssets, videoMetadata]);
  const stageState = useMemo(
    () => resolveCinematicPiPStageState({plan, currentFrame}),
    [currentFrame, plan]
  );
  const motionPlans = plan.motionAssetPlacements;
  const combatSummaryChips = useMemo(() => {
    if (!combatPlan) {
      return [];
    }

    return [
      {
        label: "Primary",
        value: String(combatPlan.roleCounts["primary-attacker"]),
        accent: getCombatRoleAccent("primary-attacker")
      },
      {
        label: "Secondary",
        value: String(combatPlan.roleCounts["secondary-attacker"]),
        accent: getCombatRoleAccent("secondary-attacker")
      },
      {
        label: "Support",
        value: String(combatPlan.roleCounts.support),
        accent: getCombatRoleAccent("support")
      },
      {
        label: "Utility",
        value: String(combatPlan.roleCounts.utility),
        accent: getCombatRoleAccent("utility")
      },
      {
        label: "Synergy",
        value: `${Math.round(combatPlan.synergyScore * 100)}%`,
        accent: getCombatRoleAccent("primary-attacker")
      }
    ];
  }, [combatPlan]);
  const previewSource = resolveAssetSrc(videoSrc);
  const cardStyle: CSSProperties = {
    position: "absolute",
    left: `${stageState.cardRect.leftPercent}%`,
    top: `${stageState.cardRect.topPercent}%`,
    width: `${stageState.cardRect.widthPercent}%`,
    height: `${stageState.cardRect.heightPercent}%`,
    borderRadius: `${stageState.cardRect.borderRadiusPx}px`,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: `0 ${stageState.shadowOffsetYPx.toFixed(1)}px ${stageState.shadowBlurPx.toFixed(1)}px rgba(0,0,0,${stageState.shadowOpacity.toFixed(3)}), 0 0 0 1px rgba(255,255,255,0.04)`,
    transform: "translate3d(0, 0, 0)",
    transformOrigin: "center center",
    background: "rgba(10, 13, 20, 0.42)",
    willChange: "transform, width, height, left, top, border-radius, box-shadow"
  };

  const cardVideoStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    objectFit: "cover",
    objectPosition: `${plan.subjectAnchor.xPercent}% ${plan.subjectAnchor.yPercent}%`,
    filter: "saturate(1.04) contrast(1.04) brightness(0.995)",
    transform: `scale(${(1.02 + stageState.settleProgress * 0.008).toFixed(4)})`
  };
  const renderVideoLayer = (style: CSSProperties): React.ReactElement => {
    return stabilizePreviewTimeline ? (
      <Html5Video
        src={previewSource}
        muted
        acceptableTimeShiftInSeconds={PREVIEW_MEDIA_ACCEPTABLE_TIMESHIFT_SECONDS}
        pauseWhenBuffering={false}
        style={style}
      />
    ) : (
      <OffthreadVideo
        src={previewSource}
        muted
        pauseWhenBuffering
        style={style}
      />
    );
  };

  return (
    <AbsoluteFill
      style={{
        zIndex: 8,
        pointerEvents: "none",
        isolation: "isolate"
      }}
      data-animation-registry-ref="host:cinematic-pip-overlay"
      data-animation-tags="pip cinematic composition subject-container free-space editorial premium"
    >
      <AbsoluteFill
        style={{
          background: [
            "radial-gradient(110% 70% at 20% 18%, rgba(115, 145, 255, 0.08) 0%, rgba(115,145,255,0) 56%)",
            "radial-gradient(98% 68% at 86% 18%, rgba(244, 180, 101, 0.08) 0%, rgba(244,180,101,0) 56%)",
            "linear-gradient(180deg, rgba(2,5,11,0.18), rgba(2,5,11,0.42) 100%)"
          ].join(", "),
          opacity: 0.84
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: "8% 4.5% 6%",
          borderRadius: 42,
          overflow: "hidden"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(7, 10, 18, 0.18), rgba(7, 10, 18, 0.46))",
            opacity: 1 - stageState.freeSpaceProgress * 0.24
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at ${plan.subjectAnchor.xPercent}% ${plan.subjectAnchor.yPercent}%, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 30%)`,
            opacity: 0.8
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.96 - stageState.settleProgress * 0.1
        }}
      >
        {renderVideoLayer({
          position: "absolute",
          inset: 0,
          objectFit: "cover",
          filter: `blur(${stageState.backgroundBlurPx.toFixed(2)}px) saturate(1.02) contrast(1.02) brightness(${(0.98 - stageState.settleProgress * 0.02).toFixed(3)})`,
          transform: `scale(${stageState.backgroundScale.toFixed(4)})`
        })}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(84% 60% at 50% 50%, rgba(8, 12, 20, 0.04) 0%, rgba(8, 12, 20, 0.18) 42%, rgba(8, 12, 20, 0.38) 100%)",
          mixBlendMode: "multiply"
        }}
      />

      <div
        style={{
          position: "absolute",
          left: `${plan.cardBox.leftPercent}%`,
          top: `${plan.cardBox.topPercent}%`,
          width: `${plan.cardBox.widthPercent}%`,
          height: `${plan.cardBox.heightPercent}%`,
          borderRadius: `${plan.cardBox.borderRadiusPx}px`,
          background: `radial-gradient(circle at 50% 42%, rgba(255,255,255,0.09), rgba(255,255,255,0) 42%)`,
          filter: `blur(${plan.shadow.blurPx}px)`,
          opacity: stageState.shadowOpacity,
          transform: `translate3d(0, ${stageState.shadowOffsetYPx.toFixed(1)}px, 0) scale(0.98)`,
          transformOrigin: "center center"
        }}
      />

      <div style={cardStyle}>
        {renderVideoLayer(cardVideoStyle)}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: [
              "linear-gradient(180deg, rgba(7, 10, 16, 0.18), rgba(7, 10, 16, 0.06) 28%, rgba(7, 10, 16, 0.18) 100%)",
              "radial-gradient(circle at 22% 12%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 24%)"
            ].join(", "),
            mixBlendMode: "screen"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 18,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(6, 9, 16, 0.54)",
            backdropFilter: "blur(14px)",
            color: "rgba(244, 248, 255, 0.9)",
            fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: stageState.freeSpaceProgress > 0.15 ? 1 : 0.92
          }}
          data-animation-tags="pip subject-card label-chip"
        >
          <span
            style={{
              width: 36,
              height: 3,
              borderRadius: 999,
              background: "linear-gradient(90deg, rgba(140,175,255,1), rgba(244,179,100,1))",
              boxShadow: "0 0 20px rgba(140,175,255,0.22)"
            }}
          />
          Subject container
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: stageState.freeSpaceProgress
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${plan.freeSpaceZones.find((zone) => zone.role === "headline")?.leftPercent ?? 58}%`,
            top: `${plan.freeSpaceZones.find((zone) => zone.role === "headline")?.topPercent ?? 12}%`,
            width: `${plan.freeSpaceZones.find((zone) => zone.role === "headline")?.widthPercent ?? 32}%`,
            display: "grid",
            gap: 12,
            color: "#f5f8ff"
          }}
          data-animation-tags="pip headline free-space narrative"
        >
          <div
            style={{
              fontFamily: "\"DM Serif Display\", \"Playfair Display\", serif",
              fontSize: "clamp(2.3rem, 4vw, 5rem)",
              lineHeight: 0.94,
              letterSpacing: "-0.05em",
              textShadow: "0 18px 42px rgba(0,0,0,0.32)"
            }}
          >
            {headlineText}
          </div>
          {combatSummaryChips.length > 0 ? (
            <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
              {combatSummaryChips.map((chip) => (
                <span
                  key={chip.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 10px 24px rgba(0,0,0,0.14)`,
                    color: chip.accent.primary,
                    fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase"
                  }}
                >
                  <span>{chip.label}</span>
                  <strong style={{color: "#f4f8ff", letterSpacing: "0.08em"}}>{chip.value}</strong>
                </span>
              ))}
            </div>
          ) : null}
          <div
            style={{
              maxWidth: "34ch",
              fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
              fontSize: "clamp(0.88rem, 1.3vw, 1rem)",
              lineHeight: 1.42,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(233,238,248,0.78)"
            }}
          >
            {supportText}
          </div>
          <div style={{display: "flex", flexWrap: "wrap", gap: 10}}>
            <span style={getChipStyle("rgba(246, 250, 255, 0.84)")}>Face-safe crop</span>
            <span style={getChipStyle("rgba(246, 250, 255, 0.84)")}>Cinematic shadow</span>
            <span style={getChipStyle("rgba(246, 250, 255, 0.84)")}>Active free space</span>
          </div>
        </div>

        {motionPlans.map((placement, index) => {
          const zone = plan.freeSpaceZones.find((candidate) => candidate.id === placement.zoneId);
          const reveal = clamp01((currentFrame - plan.entrance.fullFrameFrames - 8 - index * plan.entrance.assetStaggerFrames) /
            Math.max(1, plan.entrance.freeSpaceRevealFrames));
          const effectiveReveal = easeOutCubic(reveal);
          if (!zone) {
            return null;
          }
          return (
            <PiPAssetCard
              key={placement.asset.id}
              asset={placement.asset}
              combatElement={combatAssetMap.get(placement.asset.id) ?? null}
              leftPercent={placement.leftPercent}
              topPercent={placement.topPercent}
              widthPercent={placement.widthPercent}
              heightPercent={placement.heightPercent}
              reveal={effectiveReveal}
              index={index}
              motionFlavor={placement.motionFlavor}
            />
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "4.5%",
          transform: "translateX(-50%)",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(5,8,14,0.5)",
          backdropFilter: "blur(16px)",
          color: "rgba(229,236,250,0.84)",
          fontFamily: "\"Manrope\", \"DM Sans\", sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: clamp01(stageState.freeSpaceProgress * 1.08)
        }}
      >
        <span
          style={{
            width: 44,
            height: 3,
            borderRadius: 999,
            background: "linear-gradient(90deg, rgba(140,175,255,1), rgba(244,179,100,1))"
          }}
        />
        PiP stage settles into a storytelling layout
      </div>
    </AbsoluteFill>
  );
};
