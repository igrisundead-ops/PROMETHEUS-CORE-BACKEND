import React, {useMemo} from "react";
import {AbsoluteFill, useVideoConfig} from "remotion";

import {selectActiveMotionChoreographySceneAtTime, resolveMotionChoreographySceneStateAtTime} from "../lib/motion-platform/choreography-planner";
import {resolveSchemaStageEffectRoute} from "../lib/motion-platform/schema-mapping-resolver";
import type {MotionCompositionModel} from "../lib/motion-platform/scene-engine";
import type {MotionChoreographyScenePlan, MotionPrimitiveId} from "../lib/types";
import {useStablePreviewFrame} from "../lib/preview-runtime-stability";
import {
  AnimatedHeadline,
  resolveLandscapeTitleSafeLayout,
  StageUnderlayEffects
} from "../web-preview/native-preview-stage-cinematics";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const pickFocusWordIndex = (text: string): number => {
  const words = text.split(/\s+/).filter(Boolean);
  const numericIndex = words.findIndex((word) => /\d/.test(word));
  if (numericIndex >= 0) {
    return numericIndex;
  }
  return Math.max(0, Math.floor(words.length / 2));
};

const renderPrimitiveText = ({
  text,
  primitiveId,
  reveal
}: {
  text: string;
  primitiveId?: MotionPrimitiveId;
  reveal: number;
}): React.ReactNode => {
  if (!text) {
    return null;
  }

  if (primitiveId === "typewriter") {
    const count = clamp(Math.round(text.length * reveal), 0, text.length);
    const visible = text.slice(0, count);
    return (
      <>
        {visible}
        {reveal < 0.999 ? (
          <span
            style={{
              display: "inline-block",
              width: "0.08em",
              height: "0.94em",
              marginLeft: "0.08em",
              verticalAlign: "middle",
              background: "rgba(247,249,255,0.88)"
            }}
          />
        ) : null}
      </>
    );
  }

  if (primitiveId === "highlight-word") {
    const words = text.split(/\s+/).filter(Boolean);
    const focusIndex = pickFocusWordIndex(text);
    return words.map((word, index) => (
      <span
        key={`${word}-${index}`}
        style={{
          color: index === focusIndex ? "#ffd88a" : undefined,
          letterSpacing: index === focusIndex ? "-0.01em" : undefined,
          textShadow: index === focusIndex ? "0 0 24px rgba(255, 216, 138, 0.24)" : undefined,
          marginRight: index < words.length - 1 ? "0.22em" : undefined
        }}
      >
        {word}
      </span>
    ));
  }

  return text;
};

const buildClipPath = (primitiveId: MotionPrimitiveId | undefined, reveal: number): string | undefined => {
  if (primitiveId === "circle-reveal") {
    return `circle(${(clamp(reveal, 0, 1) * 120).toFixed(1)}% at 50% 50%)`;
  }
  return undefined;
};

export const MotionChoreographyStage: React.FC<{
  scene: MotionChoreographyScenePlan;
  currentTimeMs: number;
  zIndex?: number;
}> = ({
  scene,
  currentTimeMs,
  zIndex = 6
}) => {
  const sceneState = useMemo(
    () => resolveMotionChoreographySceneStateAtTime({scene, currentTimeMs}),
    [currentTimeMs, scene]
  );
  const headlineTransform = sceneState.targetTransforms[`${scene.sceneId}-headline`];
  const subtextTransform = sceneState.targetTransforms[`${scene.sceneId}-subtext`];
  const headlineBinding = scene.layerBindings.find((binding) => binding.targetType === "headline");
  const subtextBinding = scene.layerBindings.find((binding) => binding.targetType === "subtext");
  const titleSafeLayout = resolveLandscapeTitleSafeLayout({
    sceneKind: scene.sceneKind
  });
  const stageEffectRoute = useMemo(() => resolveSchemaStageEffectRoute({
    text: scene.headlineText,
    subtext: scene.subtextText,
    sceneKind: scene.sceneKind,
    primitiveId: headlineBinding?.primitiveId
  }), [headlineBinding?.primitiveId, scene.headlineText, scene.sceneKind, scene.subtextText]);

  if (!scene.headlineText || !headlineTransform || headlineTransform.opacity <= 0.01) {
    return null;
  }

  return (
    <AbsoluteFill
      style={{pointerEvents: "none", zIndex}}
      data-animation-registry-ref="host:motion-choreography-overlay"
      data-animation-tags="motion choreography overlay text"
    >
      <div
        style={{
          ...titleSafeLayout.outerStyle,
          transform: `translate3d(${sceneState.stageTransform.translateX.toFixed(2)}px, ${sceneState.stageTransform.translateY.toFixed(2)}px, 0) scale(${sceneState.stageTransform.scale.toFixed(3)}) rotate(${sceneState.stageTransform.rotateDeg.toFixed(3)}deg)`,
          transformOrigin: "center center",
          opacity: sceneState.stageTransform.opacity
        }}
      >
        <div className="preview-native-title-stack" style={titleSafeLayout.stackStyle}>
          <div
            style={{
              width: "100%",
              maxWidth: "100%",
              clipPath: buildClipPath(headlineBinding?.primitiveId, headlineTransform.reveal),
              opacity: headlineTransform.opacity,
              filter: `blur(${headlineTransform.blurPx.toFixed(2)}px)`,
              transform: `translate3d(${headlineTransform.translateX.toFixed(2)}px, ${headlineTransform.translateY.toFixed(2)}px, 0) scale(${headlineTransform.scale.toFixed(3)}) rotate(${headlineTransform.rotateDeg.toFixed(3)}deg)`,
              transformOrigin: "center center"
            }}
            data-animation-target-id={`${scene.sceneId}-headline`}
            data-animation-registry-ref={scene.focusTargetId}
            data-animation-tags="headline focus-target motion-text"
            data-schema-stage-route={stageEffectRoute.reasoning}
          >
            <div className="preview-native-headline-surface">
              <StageUnderlayEffects
                route={stageEffectRoute}
                reveal={headlineTransform.reveal}
                currentTimeMs={currentTimeMs}
              />
              <div className="preview-native-headline-copy">
                <AnimatedHeadline
                  text={scene.headlineText}
                  reveal={headlineTransform.reveal}
                  currentTimeMs={currentTimeMs}
                  route={stageEffectRoute}
                  primitiveId={headlineBinding?.primitiveId}
                />
              </div>
            </div>
          </div>

          {scene.subtextText && subtextTransform && subtextTransform.opacity > 0.01 ? (
            <div
              className="preview-native-subcopy"
              style={{
                opacity: subtextTransform.opacity,
                filter: `blur(${subtextTransform.blurPx.toFixed(2)}px)`,
                transform: `translate3d(${subtextTransform.translateX.toFixed(2)}px, ${subtextTransform.translateY.toFixed(2)}px, 0) scale(${subtextTransform.scale.toFixed(3)})`
              }}
              data-animation-target-id={`${scene.sceneId}-subtext`}
              data-animation-registry-ref={`${scene.sceneId}-subtext`}
              data-animation-tags="subtext focus-target motion-text"
            >
              <div>
                {renderPrimitiveText({
                  text: scene.subtextText,
                  primitiveId: subtextBinding?.primitiveId,
                  reveal: subtextTransform.reveal
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const MotionChoreographyOverlay: React.FC<{
  model: MotionCompositionModel;
  stabilizePreviewTimeline?: boolean;
  previewTimelineResetVersion?: number;
}> = ({
  model,
  stabilizePreviewTimeline = false,
  previewTimelineResetVersion = 0
}) => {
  const {fps} = useVideoConfig();
  const {stableFrame} = useStablePreviewFrame({
    enabled: stabilizePreviewTimeline,
    resetKey: previewTimelineResetVersion
  });
  const currentTimeMs = (stableFrame / fps) * 1000;
  const activeScene = useMemo(
    () => selectActiveMotionChoreographySceneAtTime({
      plan: model.choreographyPlan,
      currentTimeMs
    }),
    [currentTimeMs, model.choreographyPlan]
  );

  if (!activeScene) {
    return null;
  }

  return (
    <MotionChoreographyStage
      scene={activeScene}
      currentTimeMs={currentTimeMs}
    />
  );
};
